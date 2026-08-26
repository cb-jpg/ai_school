"""
对话 RAG 服务：把新知识库（data/knowledge）接入对话流程。

职责：
- 关键词判断是否需要检索（沿用旧 school_rag 的触发词表）
- 从向量库检索已发布知识并构建增强 prompt
- 记录未命中 / 低置信问题到 data/runtime/question_log.json（供后台"未命中问题查看"）
"""
import asyncio
import json
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import uuid4
from loguru import logger

from .crud import get_knowledge_crud
from .models import KnowledgeStatus, Chunk
from .vector_store import get_vector_store

# 运行时数据固定在仓库根目录 data/runtime 下
RUNTIME_DIR = Path(__file__).resolve().parents[3] / "data" / "runtime"

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
TOP_K = 3
MIN_SCORE = 0.3                 # 相似度低于此分数的块不参与结果
LOW_CONFIDENCE_THRESHOLD = 0.5  # 命中但最高分低于此值记为低置信问题

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
            self._save()

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
            self._save()

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

    @staticmethod
    def needs_rag_retrieval(query: str) -> bool:
        """检测查询是否需要 RAG 检索（包含学校相关关键词）"""
        if not query:
            return False
        return any(keyword in query for keyword in SCHOOL_KEYWORDS)

    def _searchable_entry_ids(self) -> Set[str]:
        """可被检索的知识条目：已索引或已发布（归档/处理中/出错的不参与）"""
        try:
            entries = get_knowledge_crud().get_all(include_archived=False)
            return {
                e.id for e in entries
                if e.status in (KnowledgeStatus.INDEXED, KnowledgeStatus.PUBLISHED)
            }
        except Exception as e:
            logger.error(f"获取可检索知识条目失败：{e}")
            return set()

    def _search_sync(
        self, query: str, entry_ids: Set[str], top_k: int
    ) -> List[Tuple[Chunk, float]]:
        store = get_vector_store()
        results: List[Tuple[Chunk, float]] = []
        for entry_id in entry_ids:
            results.extend(
                store.search(query, entry_id=entry_id, top_k=top_k, min_score=MIN_SCORE)
            )
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]

    async def search(self, query: str, top_k: int = TOP_K) -> List[Dict[str, Any]]:
        """检索已发布知识，返回 [{chunk_id, entry_id, title, category, content, score}]

        管理端搜索与对话 RAG 共用这一条检索路径。
        """
        searchable = self._searchable_entry_ids()
        if not searchable:
            return []
        try:
            results = await asyncio.to_thread(self._search_sync, query, searchable, top_k)
        except Exception as e:
            logger.error(f"RAG 检索失败：{e}")
            return []

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
        return docs

    async def retrieve_and_enrich_input(
        self, query: str, top_k: int = TOP_K
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

        knowledge_context = "\n\n".join(
            f"[资料{i}] {doc['title']}：{doc['content']}"
            for i, doc in enumerate(docs, 1)
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
