"""
检索器模块 - 学校知识库检索器

提供混合检索、多轮对话上下文支持等功能。
"""

from typing import List, Dict, Any, Optional
from loguru import logger
from .vector_store import VectorStore


class SchoolKnowledgeRetriever:
    """学校知识库检索器"""

    # 默认检索配置
    DEFAULT_TOP_K = 5  # 返回前K个结果
    DEFAULT_SCORE_THRESHOLD = 0.3  # 相似度阈值

    # 分类关键词映射（用于过滤）
    CATEGORY_KEYWORDS = {
        "校史": ["创办", "建立", "历史", "迁址", "更名", "发展", "变迁"],
        "荣誉": ["荣誉", "奖项", "获奖", "表彰", "称号", "认证"],
        "招生": ["招生", "录取", "报考", "入学", "分数线", "招生计划"],
        "课程": ["课程", "学科", "教学", "科目", "选修", "必修"],
        "教师": ["教师", "老师", "师资", "教职工", "名师", "骨干教师"],
        "学生": ["学生", "学生活动", "学生会", "社团", "实践"],
        "制度": ["制度", "规定", "规章", "管理办法", "细则"],
        "校园": ["校园", "设施", "环境", "建筑", "图书馆", "实验室"],
    }

    def __init__(
        self,
        vector_store: VectorStore,
        top_k: int = None,
        score_threshold: float = None,
    ):
        """
        初始化检索器

        Args:
            vector_store: 向量存储实例
            top_k: 返回结果数量
            score_threshold: 相似度阈值
        """
        self.vector_store = vector_store
        self.top_k = top_k or self.DEFAULT_TOP_K
        self.score_threshold = score_threshold or self.DEFAULT_SCORE_THRESHOLD

        logger.info(
            f"SchoolKnowledgeRetriever initialized: top_k={self.top_k}, "
            f"score_threshold={self.score_threshold}"
        )

    def retrieve(
        self,
        query: str,
        top_k: int = None,
        category: str = None,
        score_threshold: float = None,
    ) -> List[Dict[str, Any]]:
        """
        检索相关文档

        Args:
            query: 查询文本
            top_k: 返回结果数量
            category: 分类过滤
            score_threshold: 相似度阈值

        Returns:
            检索结果列表
        """
        top_k = top_k or self.top_k
        score_threshold = score_threshold or self.score_threshold

        # 构建过滤条件
        where = None
        if category:
            where = {"category": category}

        # 执行检索
        results = self.vector_store.search(
            query=query,
            n_results=top_k * 2,  # 获取更多结果以便过滤
            where=where,
        )

        # 过滤低分结果
        filtered_results = [
            result for result in results
            if result.get("score", 0) >= score_threshold
        ]

        # 返回top_k个结果
        return filtered_results[:top_k]

    def retrieve_with_context(
        self,
        query: str,
        conversation_history: List[Dict[str, str]] = None,
        top_k: int = None,
        category: str = None,
    ) -> Dict[str, Any]:
        """
        结合对话上下文的检索

        Args:
            query: 当前查询
            conversation_history: 对话历史
            top_k: 返回结果数量
            category: 分类过滤

        Returns:
            包含检索结果和处理后上下文的字典
        """
        # 如果有对话历史，尝试从中提取关键词来优化查询
        enhanced_query = query
        if conversation_history and len(conversation_history) > 0:
            enhanced_query = self._enhance_query_with_history(query, conversation_history)

        # 执行检索
        results = self.retrieve(
            query=enhanced_query,
            top_k=top_k,
            category=category,
        )

        return {
            "query": query,
            "enhanced_query": enhanced_query,
            "results": results,
            "context": self._format_results_as_context(results),
        }

    def _enhance_query_with_history(
        self,
        query: str,
        conversation_history: List[Dict[str, str]],
    ) -> str:
        """
        根据对话历史增强查询

        Args:
            query: 原始查询
            conversation_history: 对话历史

        Returns:
            增强后的查询
        """
        # 获取最近的几轮对话
        recent_history = conversation_history[-3:] if len(conversation_history) > 3 else conversation_history

        # 提取关键实体和主题
        context_terms = []
        for turn in recent_history:
            user_msg = turn.get("user", "")
            # 简单的关键词提取（可以后续用更复杂的 NLP）
            if "学校" in user_msg or "什么" in user_msg:
                context_terms.append("学校信息")
            if "多少" in user_msg or "几个" in user_msg:
                context_terms.append("数量统计")

        # 如果没有提取到有用信息，返回原查询
        if not context_terms:
            return query

        # 构建增强查询
        enhanced = f"{query} ({' '.join(context_terms)})"
        return enhanced

    def _format_results_as_context(self, results: List[Dict[str, Any]]) -> str:
        """
        将检索结果格式化为上下文文本

        Args:
            results: 检索结果

        Returns:
            格式化的上下文文本
        """
        if not results:
            return "未找到相关信息。"

        context_parts = []
        for i, result in enumerate(results, 1):
            doc = result.get("document", "")
            metadata = result.get("metadata", {})
            score = result.get("score", 0)

            # 添加来源信息
            source = metadata.get("source_file", "未知来源")
            category = metadata.get("category", "")

            context_part = f"[资料{i}] {doc}"
            if category:
                context_part += f"\n分类: {category}"
            context_part += f"\n相似度: {score:.2f}"

            context_parts.append(context_part)

        return "\n\n".join(context_parts)

    def detect_category_from_query(self, query: str) -> Optional[str]:
        """
        从查询中检测分类

        Args:
            query: 查询文本

        Returns:
            检测到的分类
        """
        query_lower = query.lower()

        for category, keywords in self.CATEGORY_KEYWORDS.items():
            for keyword in keywords:
                if keyword in query_lower:
                    return category

        return None

    def smart_retrieve(
        self,
        query: str,
        conversation_history: List[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        智能检索 - 自动检测分类并优化检索策略

        Args:
            query: 查询文本
            conversation_history: 对话历史

        Returns:
            检索结果和元信息
        """
        # 自动检测分类
        detected_category = self.detect_category_from_query(query)

        logger.info(f"Smart retrieve: query='{query}', detected_category='{detected_category}'")

        # 执行检索
        retrieval_result = self.retrieve_with_context(
            query=query,
            conversation_history=conversation_history,
            category=detected_category,
        )

        # 添加元信息
        retrieval_result["detected_category"] = detected_category
        retrieval_result["has_results"] = len(retrieval_result["results"]) > 0

        return retrieval_result

    def get_relevant_snippets(
        self,
        query: str,
        max_length: int = 1000,
    ) -> str:
        """
        获取相关的摘要片段

        Args:
            query: 查询文本
            max_length: 最大长度（字符数）

        Returns:
            摘要片段文本
        """
        results = self.retrieve(query, top_k=3)

        if not results:
            return "抱歉，知识库中没有找到与您的问题相关的信息。"

        # 合并结果并截断
        combined_text = " ".join([r.get("document", "") for r in results])

        if len(combined_text) <= max_length:
            return combined_text
        else:
            # 智能截断，尽量在句子边界
            truncated = combined_text[:max_length]
            last_period = max(
                truncated.rfind("。"),
                truncated.rfind("！"),
                truncated.rfind("？"),
                truncated.rfind("."),
                truncated.rfind("!"),
                truncated.rfind("?"),
            )
            if last_period > max_length * 0.8:  # 如果在合理范围内
                truncated = truncated[:last_period + 1]

            return truncated + "..."

    async def retrieve_async(
        self,
        query: str,
        top_k: int = None,
        conversation_history: List[Dict[str, str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        异步检索相关文档

        Args:
            query: 查询文本
            top_k: 返回结果数量
            conversation_history: 对话历史

        Returns:
            检索结果列表
        """
        # 使用 smart_retrieve 获取结果
        result = self.smart_retrieve(
            query=query,
            conversation_history=conversation_history,
        )

        # 返回结果列表
        return result.get("results", [])
