"""
公众号文章同步（A路线，2026-09-30）：把学校微信公众号「已发布」的文章拉进
官网内容库（PortalStore），官网新闻中心「媒体聚焦」刷新即见，无需手工贴链接。

凭据只存服务器，**绝不进 git**（conf.yaml 本身已在 .gitignore）：
conf.yaml 顶层加节，环境变量可覆盖（OLLV_WECHAT_MP_APPID / OLLV_WECHAT_MP_SECRET）：

    wechat_mp:
      appid: 'wx........'
      secret: '........'

链路：cgi-bin/token 取 access_token（带过期缓存）→
cgi-bin/freepublish/batchget 拉已发布文章（article_url 为永久链接）→
按 url 幂等 upsert 进 PortalStore（kind=news, category=媒体聚焦,
source=学校微信公众号，created_by=wechat-sync）。已从公众号撤回/删除的文章
同步在官网下架（仅当本次确实拉到了文章时才做清扫，防 API 异常清空）。
由后台「从公众号同步」按钮手动触发，不做定时任务。
"""
import asyncio
import hashlib
import json
import os
import threading
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlencode

from loguru import logger

from .portal_api import PortalItem, get_portal_store

WECHAT_API = "https://api.weixin.qq.com/cgi-bin"
SYNC_SOURCE = "学校微信公众号"
SYNC_BY = "wechat-sync"
PAGE_SIZE = 20  # freepublish/batchget 单页上限
MAX_PAGES = 3   # 最多拉 3 页（60 篇），官网新闻栏只展示最新若干条，足够

_TOKEN_CACHE: dict = {}
_TOKEN_LOCK = threading.Lock()


class WechatSyncError(Exception):
    """带用户可读信息的同步失败（errcode 已翻译成中文处置提示）"""


def _load_credentials() -> tuple:
    """读 AppID/Secret：环境变量优先，其次 conf.yaml 顶层 wechat_mp 节。
    每次同步现读（同步是低频手动操作，不值得缓存；改 conf 无需重启）。"""
    appid = os.environ.get("OLLV_WECHAT_MP_APPID", "").strip()
    secret = os.environ.get("OLLV_WECHAT_MP_SECRET", "").strip()
    if appid and secret:
        return appid, secret
    conf_path = Path("conf.yaml")
    if not conf_path.exists():
        conf_path = Path(__file__).resolve().parents[3] / "conf.yaml"
    if conf_path.exists():
        try:
            import yaml
            conf = yaml.safe_load(conf_path.read_text(encoding="utf-8")) or {}
            mp = conf.get("wechat_mp") or {}
            appid = appid or str(mp.get("appid") or "").strip()
            secret = secret or str(mp.get("secret") or "").strip()
        except Exception as e:  # noqa: BLE001
            logger.warning(f"读取 conf.yaml wechat_mp 节失败：{e}")
    if not appid or not secret:
        raise WechatSyncError(
            "未配置公众号凭据：请在服务器 conf.yaml 顶层增加 wechat_mp 节"
            "（appid / secret），或设置环境变量 OLLV_WECHAT_MP_APPID / OLLV_WECHAT_MP_SECRET")
    return appid, secret


def _friendly_err(errcode: int, errmsg: str) -> str:
    if errcode == 40164:
        return ("服务器IP不在公众号白名单：请登录公众号后台「设置与开发 → 基本配置 → "
                "IP白名单」，加入 183.36.243.124 后重试")
    if errcode in (40001, 40125, 41004):
        return "AppSecret 不正确或已被重置：请到公众号后台「基本配置」核对/重置后更新 conf.yaml"
    if errcode == 40013:
        return "AppID 不正确：请核对公众号后台「设置与开发 → 基本配置」中的 AppID"
    if errcode == 48001:
        return ("公众号无「发布」接口权限（freepublish 需认证公众号）：可先在后台用"
                "「外链」方式贴公众号文章链接")
    return f"微信接口返回 {errcode}：{errmsg or '未知错误'}"


def _http_json(url: str, payload: Optional[dict] = None, timeout: int = 10) -> dict:
    """urllib 即可（同步是低频手动操作，不引新依赖）。POST=payload 非 None。"""
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_access_token(force: bool = False) -> str:
    """取 access_token，带过期缓存（提前 5 分钟失效）。errcode 翻译成处置提示。"""
    with _TOKEN_LOCK:
        if not force and _TOKEN_CACHE.get("token") and time.time() < _TOKEN_CACHE.get("expires_at", 0):
            return _TOKEN_CACHE["token"]
        appid, secret = _load_credentials()
        url = f"{WECHAT_API}/token?{urlencode({'grant_type': 'client_credential', 'appid': appid, 'secret': secret})}"
        try:
            data = _http_json(url)
        except Exception as e:  # noqa: BLE001
            raise WechatSyncError(f"连接微信接口失败：{e}") from e
        if "access_token" not in data:
            raise WechatSyncError(_friendly_err(data.get("errcode", -1), data.get("errmsg", "")))
        _TOKEN_CACHE["token"] = data["access_token"]
        _TOKEN_CACHE["expires_at"] = time.time() + int(data.get("expires_in", 7200)) - 300
        return data["access_token"]


def _extract_articles(data: dict) -> List[dict]:
    """batchget 响应 → 扁平文章列表 [{title, url, update_time}]。
    多图文推送的每篇文章各算一条；无 article_url 或已删除/撤回的跳过。"""
    articles: List[dict] = []
    for pub in data.get("item") or []:
        update_time = int(pub.get("update_time") or 0)
        for news in (pub.get("content") or {}).get("news_item") or []:
            if str(news.get("is_deleted", "0")).lower() in ("1", "true"):
                continue
            url = (news.get("article_url") or "").strip()
            title = (news.get("title") or "").strip()
            if not url or not title:
                continue
            articles.append({"title": title, "url": url, "update_time": update_time})
    return articles


def fetch_published_articles() -> List[dict]:
    """拉最近已发布文章（最多 MAX_PAGES 页）。同一 url 只保留最新一条。"""
    token = get_access_token()
    seen: dict = {}
    for page in range(MAX_PAGES):
        url = f"{WECHAT_API}/freepublish/batchget?access_token={token}"
        try:
            data = _http_json(url, payload={"offset": page * PAGE_SIZE,
                                            "count": PAGE_SIZE, "no_content": 1})
        except Exception as e:  # noqa: BLE001
            raise WechatSyncError(f"连接微信接口失败：{e}") from e
        if data.get("errcode"):
            raise WechatSyncError(_friendly_err(data["errcode"], data.get("errmsg", "")))
        for art in _extract_articles(data):
            seen.setdefault(art["url"], art)
        if (data.get("item_count") or 0) < PAGE_SIZE:
            break
    return list(seen.values())


def sync_wechat_to_portal() -> dict:
    """按 url 幂等 upsert 进 PortalStore；返回计数摘要（给后台提示用）。"""
    articles = fetch_published_articles()
    store = get_portal_store()
    created = updated = skipped = hidden = 0
    fetched_urls: set = set()
    for art in articles:
        url = art["url"]
        fetched_urls.add(url)
        date = (datetime.fromtimestamp(art["update_time"]).strftime("%Y-%m-%d")
                if art["update_time"] else "")
        existing = store.find_by_url(url)
        if existing:
            if existing.title != art["title"] or existing.date != date:
                store.update(existing.id, title=art["title"], date=date,
                             source=SYNC_SOURCE)
            updated += 1
            continue
        item = PortalItem(
            id="wx" + hashlib.md5(url.encode("utf-8")).hexdigest()[:8],
            kind="news", title=art["title"], date=date, category="媒体聚焦",
            source=SYNC_SOURCE, url=url, published=True, pinned=False,
            created_by=SYNC_BY)
        store.create(item)
        created += 1
    # 公众号已撤回/删除的文章同步下架；仅当本次确实拉到文章才清扫，
    # 防 API 异常返回空列表把官网公众号条目一锅端。
    if articles:
        for it in store.list_all():
            if it.created_by == SYNC_BY and it.url and it.url not in fetched_urls and it.published:
                store.update(it.id, published=False)
                hidden += 1
    result = {"ok": True, "total": len(articles), "created": created,
              "updated": updated, "hidden": hidden, "skipped": len(articles) - len(fetched_urls)}
    logger.info(f"公众号同步完成：{result}")
    return result


async def sync_wechat_to_portal_async() -> dict:
    """async 包装：urllib 是阻塞调用，丢线程池避免卡事件循环。"""
    return await asyncio.to_thread(sync_wechat_to_portal)
