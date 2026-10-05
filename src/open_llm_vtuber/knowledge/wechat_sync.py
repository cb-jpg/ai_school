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
后台「从公众号同步」按钮可手动触发；另有常驻定时同步（默认每 6 小时，
环境变量 OLLV_WECHAT_SYNC_INTERVAL_HOURS 调整周期，设 0 关闭），
多 worker 部署靠状态文件 + 独占锁保证同一周期只有一个进程真正执行。
"""
import asyncio
import hashlib
import json
import os
import re
import threading
import time
import urllib.request
from datetime import datetime
from html.parser import HTMLParser
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
            # freepublish/batchget 实测返回链接字段是 url（文档写的 article_url
            # 实际不出现，2026-10-05 实锤：16 篇文章因取错字段全被丢弃）；两者都收
            url = (news.get("article_url") or news.get("url") or "").strip()
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
    result["kb"] = _ingest_articles_to_kb()
    result["kb_anchor"] = _refresh_latest_anchor()
    logger.info(f"公众号同步完成：{result}")
    return result


async def sync_wechat_to_portal_async() -> dict:
    """async 包装：urllib 是阻塞调用，丢线程池避免卡事件循环。"""
    return await asyncio.to_thread(sync_wechat_to_portal)


# ---- 定时自动同步（2026-10-05）：无需人工点按钮 ----

_SYNC_INTERVAL_ENV = "OLLV_WECHAT_SYNC_INTERVAL_HOURS"
DEFAULT_SYNC_INTERVAL_HOURS = 6.0
_STATE_FILE = Path("data/portal/wechat_sync_state.json")
_LOCK_FILE = Path("data/portal/.wechat_sync.lock")


def _last_ok_age_hours() -> float:
    """上次成功同步距今的小时数；状态文件缺失/损坏视为∞（该跑了）。"""
    try:
        data = json.loads(_STATE_FILE.read_text(encoding="utf-8"))
        return (time.time() - float(data.get("last_ok", 0))) / 3600
    except Exception:  # noqa: BLE001
        return float("inf")


def _claim_lock(interval_hours: float) -> bool:
    """独占锁：多 worker 只有一个进程真正执行。锁陈旧（超周期+2h）视为持有者已死。"""
    _LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(str(_LOCK_FILE), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.close(fd)
        return True
    except FileExistsError:
        try:
            if time.time() - _LOCK_FILE.stat().st_mtime > interval_hours * 3600 + 7200:
                _LOCK_FILE.unlink()
                fd = os.open(str(_LOCK_FILE), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.close(fd)
                return True
        except OSError:
            pass
        return False


def _release_lock() -> None:
    try:
        _LOCK_FILE.unlink()
    except OSError:
        pass


def _mark_ok() -> None:
    _STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    _STATE_FILE.write_text(json.dumps({"last_ok": time.time()}), encoding="utf-8")


def start_wechat_sync_scheduler() -> None:
    """启动公众号→官网定时同步常驻线程。未配置凭据或周期设为 0 时不启动。
    每小时醒一次判断是否到期，到期且抢到锁的进程执行同步，失败下个周期重试。"""
    try:
        interval_hours = float(
            os.environ.get(_SYNC_INTERVAL_ENV, DEFAULT_SYNC_INTERVAL_HOURS) or 0)
    except ValueError:
        interval_hours = DEFAULT_SYNC_INTERVAL_HOURS
    if interval_hours <= 0:
        return

    def _loop() -> None:
        try:
            _load_credentials()
        except WechatSyncError as e:
            logger.info(f"公众号定时同步未启用：{e}")
            return
        time.sleep(120)  # 避开进程启动高峰再首跑
        logger.info(f"公众号定时同步已启动（每 {interval_hours:g} 小时）")
        while True:
            if _last_ok_age_hours() >= interval_hours and _claim_lock(interval_hours):
                try:
                    result = sync_wechat_to_portal()
                    _mark_ok()
                    logger.info(f"公众号定时同步执行完毕：{result}")
                except Exception as e:  # noqa: BLE001
                    logger.warning(f"公众号定时同步失败（下个周期重试）：{e}")
                finally:
                    _release_lock()
            time.sleep(3600)

    threading.Thread(target=_loop, daemon=True, name="wechat-sync-timer").start()


# ---- 公众号文章正文 → 知识库（2026-10-05）：数字人答题也能引用最新动态 ----
#
# 同步进官网的同时，把还没灌过库的文章抓回正文（mp.weixin.qq.com 页面
# id="js_content" 容器），走 create_manual_entry → crud.create →
# index_chunks 标准链路进知识库。覆盖范围=官网内容库里所有公众号域名
# 的已发布条目（含后台手动贴的链接）。已在知识库的记进状态文件不再重抓；
# 抓取失败不记状态（下轮重试）；纯图片无正文（<100 字）记 skip 不重试。
# 公众号撤回的文章只下架官网，知识库保留（新闻无时效风险，且避开
# delete 不清向量索引的孤儿 chunk 坑）。OLLV_WECHAT_KB_INGEST=0 可关。

_KB_STATE_FILE = Path("data/portal/wechat_kb_state.json")
_KB_INGEST_ENV = "OLLV_WECHAT_KB_INGEST"
_KB_MIN_CHARS = 100   # 低于此长度视为纯图片灌水文，无检索价值
_KB_MAX_PER_RUN = 30  # 单次最多抓取篇数
_UA_IPHONE = ("Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
              "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.40")

_KB_LOCK = threading.Lock()


def _is_wx_url(url: Optional[str]) -> bool:
    return bool(url) and "mp.weixin.qq.com" in url


def _http_get_text(url: str, timeout: int = 15, max_bytes: int = 6 * 1024 * 1024) -> str:
    req = urllib.request.Request(url, headers={
        "User-Agent": _UA_IPHONE, "Accept-Language": "zh-CN,zh;q=0.9"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read(max_bytes).decode("utf-8", errors="ignore")


class _TextExtractor(HTMLParser):
    """js_content 片段 → 纯文本：块级标签转换行，其余剥壳，实体自动还原。"""
    _BLOCKS = {"p", "div", "section", "br", "li", "h1", "h2", "h3", "h4",
               "blockquote", "tr", "table", "figcaption"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: List[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in self._BLOCKS:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self._BLOCKS:
            self.parts.append("\n")

    def handle_data(self, data):
        self.parts.append(data)


def _extract_js_content(html: str) -> str:
    """定位 id="js_content" 正文容器（内部嵌套 div，按配对深度找闭合）转纯文本。"""
    start = html.find('id="js_content"')
    if start == -1:
        return ""
    body_start = html.find(">", start) + 1
    end = len(html)
    depth = 1
    for m in re.finditer(r"</?div\b", html[body_start:], re.IGNORECASE):
        depth += -1 if m.group(0).startswith("</") else 1
        if depth == 0:
            end = body_start + m.start()
            break
    extractor = _TextExtractor()
    extractor.feed(html[body_start:end])
    lines = [re.sub(r"[ \t　]+", " ", ln).strip()
             for ln in "".join(extractor.parts).splitlines()]
    out: List[str] = []
    for ln in lines:
        if ln or (out and out[-1]):
            out.append(ln)
    return "\n".join(out).strip()


def _extract_article_meta(html: str) -> tuple:
    """(标题, 日期)：og:title + `var ct = "纪元秒"`。"""
    tm = re.search(r'property="og:title" content="([^"]+)"', html) \
        or re.search(r"property='og:title' content='([^']+)'", html)
    title = (tm.group(1) if tm else "").strip()
    date = ""
    cm = re.search(r'var ct = "([0-9]+)"', html)
    if cm:
        date = datetime.fromtimestamp(int(cm.group(1))).strftime("%Y-%m-%d")
    return title, date


def _pick_kb_category(title: str):
    from .models import KnowledgeCategory
    if re.search(r"荣誉|喜报|获奖|夺冠|佳绩|祝贺|一等奖|二等奖|特等奖|金牌|百强", title):
        return KnowledgeCategory.HONORS
    return KnowledgeCategory.ACTIVITIES


def _kb_state() -> dict:
    try:
        return json.loads(_KB_STATE_FILE.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {}


def _kb_state_put(state: dict) -> None:
    _KB_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    _KB_STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=1),
                              encoding="utf-8")


def _ingest_articles_to_kb() -> dict:
    """官网内容库里尚未灌库的公众号文章 → 抓正文 → 知识库。"""
    if os.environ.get(_KB_INGEST_ENV, "").strip() == "0":
        return {"ingested": 0, "skipped": 0, "failed": 0, "disabled": True}
    with _KB_LOCK:  # 进程内串行；跨进程竞态由 source_url 查重兜底
        from .crud import get_knowledge_crud
        from .document_processor import DocumentProcessor
        from .vector_store import get_vector_store

        crud = get_knowledge_crud()
        state = _kb_state()
        # 其他 worker 刚灌过但状态文件还没记到的，按 source_url 补账防重
        for e in crud.get_all():
            if _is_wx_url(e.source_url):
                state.setdefault(e.source_url, {"entry_id": e.id, "ts": time.time()})

        store = get_portal_store()
        candidates = [
            it for it in store.list_all()
            if it.published and _is_wx_url(it.url)
            and it.url not in state
        ]
        candidates.sort(key=lambda x: x.date or "", reverse=True)
        candidates = candidates[:_KB_MAX_PER_RUN]

        ingested = skipped = failed = 0
        for it in candidates:
            try:
                html = _http_get_text(it.url)
            except Exception as e:  # noqa: BLE001
                logger.warning(f"知识库灌文抓取失败（下轮重试）：{it.title[:24]} {e}")
                failed += 1
                continue
            if "环境异常" in html[:3000]:
                logger.warning(f"知识库灌文遇验证页（下轮重试）：{it.title[:24]}")
                failed += 1
                continue
            text = _extract_js_content(html)
            if len(text) < _KB_MIN_CHARS:
                state[it.url] = {"skip": True, "ts": time.time()}
                skipped += 1
                logger.info(f"公众号文章正文过短视为图片稿，跳过灌库：{it.title[:24]}")
                continue
            page_title, page_date = _extract_article_meta(html)
            title = (page_title or it.title).strip()
            date = it.date or page_date
            content = f"{title}\n{date} 发布于学校微信公众号。\n\n{text}"
            if any(e.title == title for e in crud.get_all()):
                title = f"{title}（{date}）"
            try:
                entry, chunks = asyncio.run(DocumentProcessor().create_manual_entry(
                    title=title, content=content,
                    category=_pick_kb_category(title),
                    tags=["公众号", "校园动态"], created_by=SYNC_BY))
                crud.create(entry)
                crud.update(entry.id, source_url=it.url)
                get_vector_store().index_chunks(entry.id, chunks)
            except Exception as e:  # noqa: BLE001
                logger.warning(f"知识库灌文入库失败（下轮重试）：{it.title[:24]} {e}")
                failed += 1
                continue
            state[it.url] = {"entry_id": entry.id, "ts": time.time(),
                             "date": date, "digest": text[:100]}
            ingested += 1
            logger.info(f"公众号文章已灌知识库：{title}（{len(chunks)} 块）")
            time.sleep(1.0)  # 对公众号页面温和抓取
        if candidates:
            _kb_state_put(state)
        return {"ingested": ingested, "skipped": skipped, "failed": failed}


# ---- 「最新动态」问答锚点条目：桥接笼统题 → 公众号新文章 ----
#
# 公众号文章标题都是具体事件（「石光扬长汇｜…」），笼统问法（「学校最近
# 有什么活动」）检索时被校史「…开展的各项活动」这类字面匹配条目压住
# （09-26/27 同款问题）。按既定经验做问答体锚点：固定 id、每轮同步后用
# 近期文章一览刷新内容。index_chunks 对同 id 是覆盖式更新，直接重索引
# 即可，不走删除重建（避开 delete 不清向量索引的孤儿 chunk 坑）。

KB_LATEST_ENTRY_ID = "qa-wechat-latest"
KB_LATEST_TITLE = "问答：学校最近有什么活动？最新校园动态一览"


def _refresh_latest_anchor() -> bool:
    state = _kb_state()
    from .crud import get_knowledge_crud
    from .document_processor import DocumentProcessor
    from .models import (KnowledgeCategory, KnowledgeEntry, KnowledgeStatus,
                         SourceType)
    from .vector_store import get_vector_store

    crud = get_knowledge_crud()
    items = []
    for url, info in state.items():
        if info.get("skip") or not info.get("entry_id"):
            continue
        entry = crud.get(info["entry_id"])
        if not entry:
            continue
        summary = entry.summary or ""
        dm = re.search(r"(\d{4}-\d{2}-\d{2})", summary)
        date = info.get("date") or (dm.group(1) if dm else "")
        digest = (info.get("digest") or summary).replace("\n", " ").strip()
        # 老状态没有 digest 时回退 summary，剥掉内容头（标题+发布行）
        digest = re.sub(r".*?发布于学校微信公众号。", "", digest, count=1,
                        flags=re.S).strip()
        items.append({"date": date, "title": entry.title, "digest": digest[:70]})
    if not items:
        return False
    items.sort(key=lambda x: x["date"], reverse=True)
    items = items[:12]
    listing = "\n".join(
        f"- {it['date'] or '日期不详'}《{it['title']}》{it['digest']}"
        for it in items)
    content = (
        f"{KB_LATEST_TITLE}\n\n"
        "学校微信公众号持续发布校园动态，近期文章如下（时间从近到远）：\n"
        f"{listing}\n\n"
        "想了解某一项的详细情况，可以直接追问，例如「学校最近的家长会」"
        "「教师分享会讲了什么」。"
    )
    processor = DocumentProcessor()
    chunks = processor._chunk_text(content, title=KB_LATEST_TITLE)
    try:
        if crud.get(KB_LATEST_ENTRY_ID):
            crud.update(KB_LATEST_ENTRY_ID,
                        summary=processor._generate_summary(content),
                        chunk_count=len(chunks))
        else:
            crud.create(KnowledgeEntry(
                id=KB_LATEST_ENTRY_ID, title=KB_LATEST_TITLE,
                category=KnowledgeCategory.ACTIVITIES,
                tags=["公众号", "校园动态", "问答"],
                source_type=SourceType.MANUAL,
                status=KnowledgeStatus.INDEXED,
                chunk_count=len(chunks),
                summary=processor._generate_summary(content),
                created_by=SYNC_BY))
        asyncio.run(processor._save_processed_data(KB_LATEST_ENTRY_ID, content, chunks))
        get_vector_store().index_chunks(KB_LATEST_ENTRY_ID, chunks)
        logger.info(f"「最新动态」锚点已刷新（{len(items)} 篇，{len(chunks)} 块）")
        return True
    except Exception as e:  # noqa: BLE001
        logger.warning(f"「最新动态」锚点刷新失败：{e}")
        return False
