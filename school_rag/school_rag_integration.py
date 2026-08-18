"""
学校知识库 RAG 集成模块

用于将学校知识库检索集成到 Open-LLM-VTuber 的对话流程中
"""
import re
from typing import Optional, Dict, Any, List
from loguru import logger

from .knowledge_base import SchoolKnowledgeBase
from .retriever import SchoolRetriever


class SchoolRAGIntegration:
    """学校知识库 RAG 集成"""

    def __init__(self, knowledge_base_path: str = "school_data/vector_db"):
        """初始化 RAG 集成

        Args:
            knowledge_base_path: 知识库向量数据库路径
        """
        self.kb_path = knowledge_base_path
        self.knowledge_base: Optional[SchoolKnowledgeBase] = None
        self.retriever: Optional[SchoolRetriever] = None
        self._initialized = False

        # 学校相关关键词（用于检测是否需要进行 RAG 检索）
        self.school_keywords = [
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

    def initialize(self) -> None:
        """初始化知识库和检索器"""
        if self._initialized:
            return

        try:
            logger.info("初始化学校知识库 RAG 集成...")
            self.knowledge_base = SchoolKnowledgeBase(
                persist_directory=self.kb_path
            )
            self.retriever = SchoolRetriever(
                vector_store=self.knowledge_base.vector_store
            )
            self._initialized = True
            logger.info("学校知识库 RAG 集成初始化完成")
        except Exception as e:
            logger.warning(f"学校知识库初始化失败: {e}，RAG 功能将不可用")
            self._initialized = False

    def needs_rag_retrieval(self, query: str) -> bool:
        """检测查询是否需要 RAG 检索

        Args:
            query: 用户查询文本

        Returns:
            bool: 是否需要进行 RAG 检索
        """
        if not self._initialized or not query:
            return False

        query_lower = query.lower()
        # 检查是否包含学校相关关键词
        for keyword in self.school_keywords:
            if keyword in query:
                logger.debug(f"检测到学校相关关键词: {keyword}")
                return True

        return False

    async def retrieve_and_enrich_input(
        self,
        query: str,
        conversation_history: Optional[List[Dict[str, Any]]] = None,
        top_k: int = 3,
    ) -> Dict[str, Any]:
        """检索知识库并返回丰富后的输入信息

        Args:
            query: 用户查询
            conversation_history: 对话历史（用于上下文检索）
            top_k: 返回的相关文档数量

        Returns:
            Dict包含:
                - original_query: 原始查询
                - enriched_query: 包含知识库上下文的丰富查询
                - retrieved_docs: 检索到的相关文档
                - has_context: 是否成功检索到相关内容
        """
        result = {
            "original_query": query,
            "enriched_query": query,
            "retrieved_docs": [],
            "has_context": False,
        }

        if not self._initialized:
            logger.debug("RAG 未初始化，跳过知识库检索")
            return result

        if not self.needs_rag_retrieval(query):
            logger.debug("查询不涉及学校知识，跳过 RAG 检索")
            return result

        try:
            logger.info(f"执行 RAG 检索: {query}")

            # 执行检索
            retrieved_docs = await self.retriever.retrieve_async(
                query=query,
                top_k=top_k,
                conversation_history=conversation_history,
            )

            if not retrieved_docs:
                logger.info("未检索到相关学校知识")
                return result

            # 构建知识库上下文
            context_parts = []
            for i, doc in enumerate(retrieved_docs, 1):
                context_parts.append(f"[资料{i}] {doc.get('title', '')}: {doc.get('content', '')}")

            knowledge_context = "\n\n".join(context_parts)

            # 构建丰富后的查询（将知识库上下文附加到原始查询）
            enriched_query = f"""【用户问题】
{query}

【相关学校资料】
{knowledge_context}

请基于上述学校资料回答用户的问题。如果资料中没有相关信息，请明确说明。"""

            result.update({
                "enriched_query": enriched_query,
                "retrieved_docs": retrieved_docs,
                "has_context": True,
            })

            logger.info(f"RAG 检索完成，找到 {len(retrieved_docs)} 条相关资料")

        except Exception as e:
            logger.error(f"RAG 检索失败: {e}")

        return result

    async def get_topic_explanation(self, topic_type: str, topic_id: str = None) -> Optional[str]:
        """获取专题内容讲解（用于专题页面的"讲解这一段"功能）

        Args:
            topic_type: 专题类型（history/achievement/student）
            topic_id: 专题内容 ID

        Returns:
            Optional[str]: 讲解内容，如果未找到则返回 None
        """
        if not self._initialized:
            return None

        try:
            # 从专题数据模型获取内容
            if topic_type == "history":
                from .models.school_history import SchoolHistoryNode
                data = SchoolHistoryNode.get_data()
                if topic_id:
                    for node in data:
                        if node.get("id") == topic_id:
                            return self._format_topic_content(node)
                else:
                    # 返回完整校史
                    return self._format_complete_topic(data, "校史")

            elif topic_type == "achievement":
                from .models.school_achievement import SchoolAchievement
                data = SchoolAchievement.get_data()
                if topic_id:
                    for item in data:
                        if item.get("id") == topic_id:
                            return self._format_topic_content(item)
                else:
                    return self._format_complete_topic(data, "学校成就")

            elif topic_type == "student":
                from .models.student_model import StudentModel
                data = StudentModel.get_data()
                if topic_id:
                    for student in data:
                        if student.get("id") == topic_id:
                            return self._format_topic_content(student)
                else:
                    return self._format_complete_topic(data, "学习标兵")

        except Exception as e:
            logger.error(f"获取专题讲解内容失败: {e}")

        return None

    def _format_topic_content(self, item: Dict[str, Any]) -> str:
        """格式化单个专题内容用于讲解"""
        title = item.get("title", "")
        description = item.get("description", "")
        facts = item.get("key_facts", [])

        parts = [f"{title}：{description}"]
        if facts:
            parts.append("关键事实：" + "、".join(facts))

        return " ".join(parts)

    def _format_complete_topic(self, items: List[Dict[str, Any]], topic_name: str) -> str:
        """格式化完整专题内容用于连续讲解"""
        intro = f"下面为您讲解{topic_name}：\n\n"
        contents = []
        for item in items:
            contents.append(self._format_topic_content(item))

        return intro + "\n\n".join(contents)


# 全局单例
_rag_integration: Optional[SchoolRAGIntegration] = None


def get_rag_integration(knowledge_base_path: str = "school_data/vector_db") -> SchoolRAGIntegration:
    """获取 RAG 集成单例

    Args:
        knowledge_base_path: 知识库向量数据库路径

    Returns:
        SchoolRAGIntegration: RAG 集成实例
    """
    global _rag_integration
    if _rag_integration is None:
        _rag_integration = SchoolRAGIntegration(
            knowledge_base_path=knowledge_base_path
        )
        _rag_integration.initialize()
    return _rag_integration
