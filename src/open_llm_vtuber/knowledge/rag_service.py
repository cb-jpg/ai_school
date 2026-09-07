"""
对话 RAG 服务：把新知识库（data/knowledge）接入对话流程。

职责：
- 关键词判断是否需要检索（沿用旧 school_rag 的触发词表）
- 从向量库检索已发布知识并构建增强 prompt
- 记录未命中 / 低置信问题到 data/runtime/question_log.json（供后台"未命中问题查看"）

并发说明（2026-09-06 扩容改造）：
- 检索跑在模块级专用小线程池上（不挤占默认 executor、抢不死 GIL），超量请求在 asyncio 侧排队
- 查询结果带 TTL 缓存：校园场景大量用户问相同/相近问题，同题只算一次
"""
import asyncio
import json
import threading
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import uuid4
from loguru import logger

from .crud import get_knowledge_crud
from .models import KnowledgeStatus, Chunk
from .vector_store import get_vector_store
from ..utils.turn_latency import current_span

# 运行时数据固定在仓库根目录 data/runtime 下
RUNTIME_DIR = Path(__file__).resolve().parents[3] / "data" / "runtime"

# 检索专用线程池：小池子限制 GIL 密集任务的最大并发，其余请求排队等待
_SEARCH_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="rag-search")

# 查询结果缓存：TTL + 容量上限
_QUERY_CACHE_TTL = 180.0
_QUERY_CACHE_MAX = 256

# 可检索条目集合缓存的有效期（配合 crud 全内存读取，这里只为省去每次全表过滤）
_SEARCHABLE_TTL = 30.0

# 学校相关关键词（用于检测是否需要进行 RAG 检索）——沿用 school_rag 触发词表
SCHOOL_KEYWORDS = [
    # 学校基本信息
    "学校", "校区", "校址", "创办", "成立", "更名", "校名", "历史",
    # 校园文化
    "校训", "校徽", "校歌", "办学", "理念", "文化", "特色",
    # 学校荣誉
    "荣誉", "奖项", "获奖", "称号", "表彰", "认证",
    # 招生与课程
    "招生", "报名", "录取", "入学", "课程", "专业", "教学",
    # 规章制度
    "规定", "制度", "章程", "办法", "细则", "条例",
    # 教师与学生
    "教师", "老师", "学生", "同学", "标兵", "优秀",
    # 活动与设施
    "活动", "社团", "设施", "图书馆", "实验室", "操场",
    # 其他学校相关
    "校长", "班主任", "年级", "班级", "食堂", "宿舍",
]

# 检索参数
TOP_K = 6
MIN_SCORE = 0.3                 # 相似度低于此分数的块不参与结果
LOW_CONFIDENCE_THRESHOLD = 0.5  # 命中但最高分低于此值记为低置信问题

# 对话 RAG 参数（与管理端 search 的 TOP_K 区分）：
# RAG 资料几乎是对话 prompt 的全部 prefill，条数直接决定 LLM 首字延迟；
# 4 条 + 单条 480 字符上限（切块时已限 500，几乎无损）把上下文压 ~1/3，
# 换取 64 并发突发下更快的 TTFT。MIN_SCORE/RRF 排序不变，质量不受影响。
CHAT_TOP_K = 4
DOC_CHAR_CAP = 480

# 问题记录上限（防止文件无限增长）
MAX_LOGGED_QUESTIONS = 500


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S")


class QuestionLog:
    """未命中 / 低置信问题记录（data/runtime/question_log.json）"""

    def __init__(self, log_file: Path = None):
        self.log_file = log_file or (RUNTIME_DIR / "question_log.json")
        self._lock = threading.Lock()
        self.data: Dict[str, list] = {}
        self._dirty = False
        self._save_timer: Optional[threading.Timer] = None
        self._load()

    def _load(self) -> None:
        if self.log_file.exists():
            try:
                self.data = json.loads(self.log_file.read_text(encoding="utf-8"))
            except Exception as e:
                logger.error(f"读取问题记录失败，将重建：{e}")
                self.data = {}
        self.data.setdefault("unanswered", [])
        self.data.setdefault("low_confidence", [])

    def _save(self) -> None:
        try:
            self.log_file.parent.mkdir(parents=True, exist_ok=True)
            self.log_file.write_text(
                json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        except Exception as e:
            logger.error(f"写入问题记录失败：{e}")

    def _trim(self, key: str) -> None:
        items = self.data[key]
        if len(items) > MAX_LOGGED_QUESTIONS:
            del items[: len(items) - MAX_LOGGED_QUESTIONS]

    def _schedule_save(self) -> None:
        """防抖写盘：对话热路径上记录问题时不再同步写 JSON 阻塞调用方，
        合并 2s 窗口内的多次记录为一次落盘"""
        with self._lock:
            self._dirty = True
            if self._save_timer is not None:
                return
            timer = threading.Timer(2.0, self._flush_save)
            timer.daemon = True
            self._save_timer = timer
        timer.start()

    def _flush_save(self) -> None:
        with self._lock:
            self._dirty = False
            self._save_timer = None
        self._save()

    def record_unanswered(self, question: str) -> None:
        q = question.strip()
        if not q:
            return
        with self._lock:
            for item in self.data["unanswered"]:
                if item["question"] == q:
                    item["count"] += 1
                    item["last_asked"] = _now_iso()
                    break
            else:
                self.data["unanswered"].append({
                    "id": str(uuid4()),
                    "question": q,
                    "count": 1,
                    "first_asked": _now_iso(),
                    "last_asked": _now_iso(),
                })
            self._trim("unanswered")
        self._schedule_save()

    def record_low_confidence(self, question: str, score: float) -> None:
        q = question.strip()
        if not q:
            return
        with self._lock:
            for item in self.data["low_confidence"]:
                if item["question"] == q:
                    item["count"] += 1
                    item["score"] = round(min(item["score"], score), 4)
                    item["last_asked"] = _now_iso()
                    break
            else:
                self.data["low_confidence"].append({
                    "id": str(uuid4()),
                    "question": q,
                    "score": round(score, 4),
                    "count": 1,
                    "first_asked": _now_iso(),
                    "last_asked": _now_iso(),
                })
            self._trim("low_confidence")
        self._schedule_save()

    def get_unanswered(self) -> list:
        return list(self.data.get("unanswered", []))

    def get_low_confidence(self) -> list:
        return list(self.data.get("low_confidence", []))

    def remove_unanswered(self, question_id: str) -> bool:
        """管理员补充答案后关闭问题；返回是否删除成功"""
        with self._lock:
            before = len(self.data["unanswered"])
            self.data["unanswered"] = [
                i for i in self.data["unanswered"] if i["id"] != question_id
            ]
            removed = len(self.data["unanswered"]) < before
            if removed:
                self._save()
            return removed

    def remove_low_confidence(self, question_id: str) -> bool:
        with self._lock:
            before = len(self.data["low_confidence"])
            self.data["low_confidence"] = [
                i for i in self.data["low_confidence"] if i["id"] != question_id
            ]
            removed = len(self.data["low_confidence"]) < before
            if removed:
                self._save()
            return removed


class RagService:
    """对话 RAG 服务：检索新知识库并丰富用户输入"""

    def __init__(self):
        self.question_log = QuestionLog()
        self._query_cache: "OrderedDict[Tuple[str, int], Tuple[float, List[Dict[str, Any]]]]" = (
            OrderedDict()
        )
        self._query_cache_lock = threading.Lock()
        self._searchable_cache: Tuple[float, Set[str]] = (0.0, set())

    @staticmethod
    def needs_rag_retrieval(query: str) -> bool:
        """检测查询是否需要 RAG 检索（包含学校相关关键词）"""
        if not query:
            return False
        return any(keyword in query for keyword in SCHOOL_KEYWORDS)

    def _searchable_entry_ids(self) -> Set[str]:
        """可被检索的知识条目：已索引或已发布（归档/处理中/出错的不参与）

        结果短暂缓存（crud 索引本身是全内存读取，这里省去每次全表过滤与集合构建）；
        知识库管理端改动后最迟 _SEARCHABLE_TTL 秒生效。
        """
        now = time.monotonic()
        cached_at, cached_ids = self._searchable_cache
        if cached_ids and now - cached_at < _SEARCHABLE_TTL:
            return cached_ids
        try:
            entries = get_knowledge_crud().get_all(include_archived=False)
            ids = {
                e.id for e in entries
                if e.status in (KnowledgeStatus.INDEXED, KnowledgeStatus.PUBLISHED)
            }
        except Exception as e:
            logger.error(f"获取可检索知识条目失败：{e}")
            return cached_ids
        self._searchable_cache = (now, ids)
        return ids

    @staticmethod
    def _normalize_query(query: str) -> str:
        """查询归一化：压缩空白，让"同题不同空白"命中同一缓存"""
        return " ".join(query.split())

    def _cache_get(self, key: Tuple[str, int]) -> Optional[List[Dict[str, Any]]]:
        with self._query_cache_lock:
            item = self._query_cache.get(key)
            if item is None:
                return None
            cached_at, docs = item
            if time.monotonic() - cached_at > _QUERY_CACHE_TTL:
                del self._query_cache[key]
                return None
            self._query_cache.move_to_end(key)
            return docs

    def _cache_put(self, key: Tuple[str, int], docs: List[Dict[str, Any]]) -> None:
        with self._query_cache_lock:
            self._query_cache[key] = (time.monotonic(), docs)
            self._query_cache.move_to_end(key)
            while len(self._query_cache) > _QUERY_CACHE_MAX:
                self._query_cache.popitem(last=False)

    def _search_sync(
        self, query: str, entry_ids: Set[str], top_k: int,
        timings: "dict[str, float] | None" = None,
    ) -> List[Tuple[Chunk, float]]:
        # 全库一次混合检索（向量 + BM25，RRF），替代旧版逐条目循环
        # timings：LATENCY 分段计时用（线程内取不到 contextvar，显式带回时刻）
        if timings is not None:
            timings["start"] = time.monotonic()
        try:
            return get_vector_store().search_all(
                query, entry_ids, top_k=top_k, min_score=MIN_SCORE
            )
        finally:
            if timings is not None:
                timings["end"] = time.monotonic()

    async def search(self, query: str, top_k: int = TOP_K) -> List[Dict[str, Any]]:
        """检索已发布知识，返回 [{chunk_id, entry_id, title, category, content, score}]

        管理端搜索与对话 RAG 共用这一条检索路径。
        检索跑在专用小线程池上；相同查询在 TTL 内直接命中缓存（校园场景同题率极高）。
        """
        cache_key = (self._normalize_query(query), top_k)
        cached = self._cache_get(cache_key)
        if cached is not None:
            span = current_span()
            if span is not None:
                span.set_once("rag_cache", True)
            return cached

        searchable = self._searchable_entry_ids()
        if not searchable:
            return []
        span = current_span()
        timings: dict[str, float] = {"submit": time.monotonic()}
        try:
            loop = asyncio.get_running_loop()
            results = await loop.run_in_executor(
                _SEARCH_EXECUTOR, self._search_sync, query, searchable, top_k,
                timings if span is not None else None,
            )
        except Exception as e:
            logger.error(f"RAG 检索失败：{e}")
            return []
        if span is not None:
            span.set_once("rag", round(time.monotonic() - timings["submit"], 3))
            if "start" in timings and "end" in timings:
                span.set_once("rag_q", round(timings["start"] - timings["submit"], 3))
                span.set_once("rag_exec", round(timings["end"] - timings["start"], 3))

        crud = get_knowledge_crud()
        docs = []
        for chunk, score in results:
            entry = crud.get(chunk.source_id)
            docs.append({
                "chunk_id": chunk.id,
                "entry_id": chunk.source_id,
                "title": entry.title if entry else "",
                "category": entry.category.value if entry else None,
                "content": chunk.content,
                "score": round(float(score), 4),
            })
        self._cache_put(cache_key, docs)
        return docs

    async def retrieve_and_enrich_input(
        self, query: str, top_k: int = CHAT_TOP_K
    ) -> Dict[str, Any]:
        """检索知识库并返回丰富后的输入信息

        Returns:
            Dict 包含 original_query / enriched_query / retrieved_docs / has_context
        """
        result: Dict[str, Any] = {
            "original_query": query,
            "enriched_query": query,
            "retrieved_docs": [],
            "has_context": False,
        }

        if not self._searchable_entry_ids():
            self.question_log.record_unanswered(query)
            return result

        docs = await self.search(query, top_k=top_k)
        if not docs:
            logger.info("未检索到相关学校知识")
            self.question_log.record_unanswered(query)
            return result

        best_score = docs[0]["score"]
        if best_score < LOW_CONFIDENCE_THRESHOLD:
            self.question_log.record_low_confidence(query, best_score)

        def _fmt_doc(i: int, doc: Dict[str, Any]) -> str:
            content = doc["content"]
            if len(content) > DOC_CHAR_CAP:
                content = content[:DOC_CHAR_CAP] + "…"
            return f"[资料{i}] {doc['title']}：{content}"

        knowledge_context = "\n\n".join(
            _fmt_doc(i, doc) for i, doc in enumerate(docs, 1)
        )
        enriched_query = f"""【用户问题】
{query}

【相关学校资料】
{knowledge_context}

请只依据上述学校资料回答，资料里没有的信息就坦诚说明不清楚，并建议同学咨询老师，不要编造。回答保持简洁，用两三句口语化的中文即可。"""

        result.update({
            "enriched_query": enriched_query,
            "retrieved_docs": docs,
            "has_context": True,
        })
        logger.info(f"RAG 检索完成，找到 {len(docs)} 条相关资料（最高分 {best_score:.3f}）")
        return result


# 全局单例
_rag_service: Optional[RagService] = None


def get_rag_service() -> RagService:
    global _rag_service
    if _rag_service is None:
        _rag_service = RagService()
    return _rag_service


def get_question_log() -> QuestionLog:
    return get_rag_service().question_log
