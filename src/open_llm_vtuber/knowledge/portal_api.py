"""
官网新闻/公告后台管理（2026-09-29 三期提前落地，去公众号依赖版）。

官网首页新闻栏/公告栏与新闻中心页此前读前端静态数组（portal-content.ts，
改一条要重建+OTA）。本模块把内容搬进后台：管理员贴外链（公众号文章、
教育局通知等）或直接撰写文字文章，官网刷新即见，无需重新发布。

两个路由组：
  GET  /api/portal/content          公共（官网匿名可读，仅 published 条目）
  POST/PUT/DELETE /api/portal/items 后台管理（require_staff，写审计）

存储 data/portal/content.json 为每 worker 内存快照——多进程部署下写入只落
处理请求的 worker，**必须**以文件签名（mtime_ns+size）为跨进程信号做读时
对账（同 knowledge/crud.py 的 09-29 修复，勿删）。
"""
import json
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from pydantic import BaseModel, Field

from .audit import bump_counter, record as audit_record
from .auth import require_staff

NEWS_CATEGORIES = ("校园新闻", "荣誉喜报", "媒体聚焦")
AUDIENCES = ("全体", "家长", "学生")


class PortalItem(BaseModel):
    """一条官网新闻或公告。url 与 content 二选一：url=外链型（新窗口跳转），
    content=自撰文字文章型（官网 #/article/<id> 阅读页内开）。"""
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    kind: Literal["news", "announcement"] = "news"
    title: str
    date: str = ""  # YYYY-MM-DD 或 YYYY-MM，宽松字符串（占位历史数据有只到月的）
    category: Optional[Literal["校园新闻", "荣誉喜报", "媒体聚焦"]] = None  # 仅新闻
    audience: Optional[Literal["全体", "家长", "学生"]] = None  # 仅公告
    source: Optional[str] = None  # 链接来源名称，如"南方+"
    url: Optional[str] = None
    content: Optional[str] = None  # 纯文字，段落按换行
    pinned: bool = False
    published: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    created_by: str = ""


class PortalItemIn(BaseModel):
    """后台新建/编辑入参（id/时间戳/created_by 服务端管）"""
    kind: Literal["news", "announcement"] = "news"
    title: str
    date: str = ""
    category: Optional[str] = None
    audience: Optional[str] = None
    source: Optional[str] = None
    url: Optional[str] = None
    content: Optional[str] = None
    pinned: bool = False
    published: bool = True


# 首次启动引导数据=前端 portal-content.ts 占位条的等值迁移（校方在后台改删，
# 前端那份仅作断电/API 不可达时的回退显示）。
_BOOTSTRAP_ITEMS = [
    PortalItem(id="n1", kind="news", title="佛山唯一！13名学子凭信息学特长保送清华大学、北京大学",
               date="2025-06-30", category="荣誉喜报",
               url="https://static.nfnews.com/content/202506/30/c11454630.html",
               source="南方+（南方日报）"),
    PortalItem(id="n2", kind="news", title="石实实验学校正式复办小学，一年级计划招生160人",
               date="2025-04", category="校园新闻"),
    PortalItem(id="n3", kind="news", title="获评首批全国健康学校建设单位",
               date="2025-05", category="荣誉喜报"),
    PortalItem(id="n4", kind="news", title="获评国家防震减灾科普示范学校（全市唯一）",
               date="2024-02-25", category="荣誉喜报",
               url="https://www.nanhai.gov.cn/fsnhq/bmdh/zfbm/qyjj/xxgkml/gzdt/content/post_5908947.html",
               source="南海区应急管理局"),
    PortalItem(id="n5", kind="news", title="25周年校庆晚会举行，两万余名校友共叙情谊",
               date="2025-11", category="校园新闻"),
    PortalItem(id="n6", kind="news", title="南海区教育局媒体系列报道：扬长教育、人人出彩",
               date="2026-04", category="媒体聚焦",
               url="https://www.nanhai.gov.cn/fsnhq/bmdh/zfbm/qjyj/xxgkml/gzdt/content/post_6945094.html",
               source="南海区教育局"),
    PortalItem(id="a1", kind="announcement", title="2026年秋季学期开学返校安排及注意事项",
               date="2026-08-25", audience="全体"),
    PortalItem(id="a2", kind="announcement", title="南海区优秀学生、优秀学生干部评选结果公示",
               date="2026-03-10", audience="学生"),
    PortalItem(id="a3", kind="announcement", title="校园开放日暨招生咨询活动安排",
               date="2026-04-12", audience="家长"),
    PortalItem(id="a4", kind="announcement", title="期中考试日程与诚信考试须知",
               date="2026-04-20", audience="学生"),
    PortalItem(id="a5", kind="announcement", title="校车线路与课后服务报名通知",
               date="2026-02-18", audience="家长"),
]


class PortalStore:
    """content.json 读写；签名对账保证多 worker 即时收敛"""

    def __init__(self, portal_dir: str = "data/portal"):
        self.portal_dir = Path(portal_dir)
        self.content_file = self.portal_dir / "content.json"
        self.portal_dir.mkdir(parents=True, exist_ok=True)
        self._items: dict = {}
        self._sig: Optional[tuple] = None
        self._lock = threading.Lock()
        self._bootstrap_if_empty()
        self._load()

    def _file_signature(self) -> Optional[tuple]:
        try:
            st = self.content_file.stat()
            return (st.st_mtime_ns, st.st_size)
        except OSError:
            return None

    def _bootstrap_if_empty(self) -> None:
        if self.content_file.exists() and self.content_file.stat().st_size > 2:
            return
        data = {it.id: it.model_dump() for it in _BOOTSTRAP_ITEMS}
        self.content_file.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.info(f"Portal content bootstrapped with {len(data)} items")

    def _load(self) -> None:
        try:
            data = json.loads(self.content_file.read_text(encoding="utf-8"))
            self._items = {k: PortalItem(**v) for k, v in data.items()}
            self._sig = self._file_signature()
        except Exception as e:  # noqa: BLE001
            logger.error(f"读取官网内容失败，保留内存态：{e}")

    def _refresh_if_changed(self) -> None:
        """多进程部署：后台改动可能落在其他 worker，读前对账（勿删，见模块 docstring）"""
        sig = self._file_signature()
        if self._sig is not None and sig is not None and sig != self._sig:
            self._load()

    def _save(self) -> None:
        data = {k: v.model_dump() for k, v in self._items.items()}
        self.content_file.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        self._sig = self._file_signature()

    def get_published(self) -> List[PortalItem]:
        with self._lock:
            self._refresh_if_changed()
            items = [it for it in self._items.values() if it.published]
        # pinned 优先，组内按日期倒序（新的在前）；date 宽松字符串，倒序比较即可。
        # 两次稳定排序：先日期倒序，再按 pinned 归零（组内保序）
        items.sort(key=lambda x: (x.date, x.created_at), reverse=True)
        items.sort(key=lambda x: not x.pinned)
        return items

    def find_by_url(self, url: str) -> Optional[PortalItem]:
        """公众号同步按 url 幂等 upsert 用"""
        with self._lock:
            self._refresh_if_changed()
            for it in self._items.values():
                if it.url and it.url == url:
                    return it
        return None

    def get_article(self, item_id: str) -> Optional[PortalItem]:
        with self._lock:
            self._refresh_if_changed()
            it = self._items.get(item_id)
            if it and it.published and it.content:
                return it
        return None

    def list_all(self) -> List[PortalItem]:
        with self._lock:
            self._refresh_if_changed()
            items = list(self._items.values())
        items.sort(key=lambda x: (x.kind, x.date), reverse=True)
        return items

    def create(self, item: PortalItem) -> PortalItem:
        with self._lock:
            self._refresh_if_changed()
            self._items[item.id] = item
            self._save()
        return item

    def update(self, item_id: str, **kwargs) -> Optional[PortalItem]:
        with self._lock:
            self._refresh_if_changed()
            it = self._items.get(item_id)
            if not it:
                return None
            for k, v in kwargs.items():
                if hasattr(it, k) and v is not None:
                    setattr(it, k, v)
            it.updated_at = datetime.now().isoformat()
            self._save()
            return it

    def delete(self, item_id: str) -> bool:
        with self._lock:
            self._refresh_if_changed()
            if item_id not in self._items:
                return False
            del self._items[item_id]
            self._save()
            return True


_store: Optional[PortalStore] = None
_store_lock = threading.Lock()


def get_portal_store() -> PortalStore:
    global _store
    if _store is None:
        with _store_lock:
            if _store is None:
                _store = PortalStore()
    return _store


def _validate_item_in(data: PortalItemIn) -> dict:
    """入参清洗：分类/面向对象按 kind 归位，url 协议白名单，url/content 至少给一样
    （都不给也允许——纯标题条目渲染为不可点击，与历史占位行为一致）"""
    out = data.model_dump()
    if data.kind == "news":
        out["audience"] = None
        if out["category"] not in NEWS_CATEGORIES:
            out["category"] = "校园新闻"
    else:
        out["category"] = None
        if out["audience"] not in AUDIENCES:
            out["audience"] = "全体"
    url = (out.get("url") or "").strip()
    if url and not url.lower().startswith(("http://", "https://")):
        raise HTTPException(status_code=422, detail="链接需以 http:// 或 https:// 开头")
    out["url"] = url or None
    out["content"] = (out.get("content") or "").strip() or None
    if not out["title"].strip():
        raise HTTPException(status_code=422, detail="标题不能为空")
    out["title"] = out["title"].strip()
    out["date"] = (out.get("date") or "").strip()
    out["source"] = (out.get("source") or "").strip() or None
    return out


def init_portal_public_routes() -> APIRouter:
    """公共路由：官网匿名可读（访问令牌门禁仍由全局中间件管）"""
    router = APIRouter(prefix="/api/portal", tags=["portal"])

    @router.get("/content")
    async def get_portal_content():
        """官网新闻/公告（仅 published）。形状对齐前端 NewsItem/AnnouncementItem，
        多带 has_article 供前端把自撰文章渲染为内部阅读页链接。"""
        items = get_portal_store().get_published()
        news, ann = [], []
        for it in items:
            base = {
                "id": it.id, "title": it.title, "date": it.date,
                "url": it.url, "source": it.source,
                "has_article": bool(it.content),
            }
            if it.kind == "news":
                base["category"] = it.category
                news.append(base)
            else:
                base["audience"] = it.audience
                ann.append(base)
        bump_counter("portal_content_serve")
        return {"news": news, "announcements": ann}

    @router.get("/article/{item_id}")
    async def get_portal_article(item_id: str):
        """文章阅读页数据（仅 published 且有正文的条目）"""
        it = get_portal_store().get_article(item_id)
        if not it:
            raise HTTPException(status_code=404, detail="文章不存在或未发布")
        return {
            "id": it.id, "kind": it.kind, "title": it.title, "date": it.date,
            "source": it.source, "url": it.url, "content": it.content,
        }

    return router


def init_portal_admin_routes() -> APIRouter:
    """后台管理路由：require_staff（admin/editor 均可发，与知识库一致）"""
    router = APIRouter(
        prefix="/api/portal", tags=["portal"],
        dependencies=[Depends(require_staff)],
    )

    @router.get("/items")
    async def list_items(user: dict = Depends(require_staff)):
        items = get_portal_store().list_all()
        return {"items": [it.model_dump() for it in items], "total": len(items)}

    @router.post("/items")
    async def create_item(data: PortalItemIn, user: dict = Depends(require_staff)):
        fields = _validate_item_in(data)
        item = PortalItem(**fields, created_by=user["username"])
        get_portal_store().create(item)
        audit_record(user["username"], "portal.create", item.id, item.title)
        logger.info(f"官网内容已发布：{item.kind}/{item.id} {item.title}")
        return {"id": item.id, "title": item.title}

    @router.put("/items/{item_id}")
    async def update_item(item_id: str, data: PortalItemIn,
                          user: dict = Depends(require_staff)):
        fields = _validate_item_in(data)
        updated = get_portal_store().update(item_id, **fields)
        if not updated:
            raise HTTPException(status_code=404, detail="条目不存在")
        audit_record(user["username"], "portal.update", item_id, updated.title)
        return {"id": updated.id, "title": updated.title}

    @router.delete("/items/{item_id}")
    async def delete_item(item_id: str, user: dict = Depends(require_staff)):
        ok = get_portal_store().delete(item_id)
        if not ok:
            raise HTTPException(status_code=404, detail="条目不存在")
        audit_record(user["username"], "portal.delete", item_id)
        return {"deleted": item_id}

    @router.post("/sync-wechat")
    async def sync_wechat(user: dict = Depends(require_staff)):
        """从学校公众号拉「已发布」文章进官网内容库（A路线，手动触发）。
        凭据在服务器 conf.yaml wechat_mp 节，绝不进 git（见 wechat_sync.py）。"""
        from .wechat_sync import WechatSyncError, sync_wechat_to_portal_async
        try:
            result = await sync_wechat_to_portal_async()
        except WechatSyncError as e:
            raise HTTPException(status_code=502, detail=str(e))
        except Exception as e:  # noqa: BLE001
            logger.exception("公众号同步异常")
            raise HTTPException(status_code=502, detail=f"同步失败：{e}")
        audit_record(user["username"], "portal.wechat_sync", "sync",
                     f"new={result['created']} upd={result['updated']} hid={result['hidden']}")
        return result

    return router


def init_portal_routes() -> list:
    """server.py 挂载入口：返回 [公共路由, 管理路由]"""
    return [init_portal_public_routes(), init_portal_admin_routes()]
