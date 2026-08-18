"""
知识库管理模块 - 学校知识库统一管理接口

提供知识文档的 CRUD 操作、分类管理、状态管理等功能。
"""

import os
import shutil
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from datetime import datetime
from loguru import logger

from .vector_store import VectorStore
from .document_processor import DocumentProcessor
from .retriever import SchoolKnowledgeRetriever


class SchoolKnowledgeBase:
    """学校知识库管理类"""

    # 知识库状态
    STATUS_DRAFT = "draft"  # 草稿
    STATUS_PUBLISHED = "published"  # 已发布
    STATUS_ARCHIVED = "archived"  # 已归档

    # 默认分类
    DEFAULT_CATEGORIES = [
        "校史",
        "荣誉",
        "招生",
        "课程",
        "教师",
        "学生",
        "制度",
        "校园",
        "活动",
    ]

    def __init__(
        self,
        persist_directory: str = None,
        knowledge_dir: str = None,
    ):
        """
        初始化知识库

        Args:
            persist_directory: 向量数据库持久化目录
            knowledge_dir: 知识文档存储目录
        """
        # 设置目录
        project_root = Path(__file__).parent.parent

        if persist_directory is None:
            persist_directory = project_root / "school_data" / "vector_db"
        if knowledge_dir is None:
            knowledge_dir = project_root / "school_data" / "knowledge"

        self.persist_directory = Path(persist_directory)
        self.knowledge_dir = Path(knowledge_dir)
        self.knowledge_dir.mkdir(parents=True, exist_ok=True)

        # 初始化组件
        self.vector_store = VectorStore(persist_directory=str(self.persist_directory))
        self.document_processor = DocumentProcessor()
        self.retriever = SchoolKnowledgeRetriever(self.vector_store)

        logger.info(
            f"SchoolKnowledgeBase initialized: "
            f"persist_dir='{persist_directory}', "
            f"knowledge_dir='{knowledge_dir}'"
        )

    def add_document(
        self,
        file_path: str = None,
        text: str = None,
        category: str = None,
        title: str = None,
        metadata: Dict[str, Any] = None,
        status: str = STATUS_PUBLISHED,
    ) -> List[str]:
        """
        添加文档到知识库

        Args:
            file_path: 文件路径（与 text 二选一）
            text: 文本内容（与 file_path 二选一）
            category: 文档分类
            title: 文档标题
            metadata: 额外元数据
            status: 发布状态

        Returns:
            添加的文档块 ID 列表
        """
        if file_path is None and text is None:
            raise ValueError("必须提供 file_path 或 text 参数")

        if metadata is None:
            metadata = {}

        # 添加基础元数据
        if category:
            metadata["category"] = category
        if title:
            metadata["title"] = title
        metadata["status"] = status
        metadata["created_at"] = datetime.now().isoformat()

        # 处理文档
        if file_path:
            # 处理文件
            chunks, metadatas = self.document_processor.process_file(file_path, metadata)
        else:
            # 处理纯文本
            chunks = self.document_processor.split_text_into_chunks(text)
            metadatas = []
            for i, chunk in enumerate(chunks):
                chunk_metadata = metadata.copy()
                chunk_metadata["chunk_index"] = i
                chunk_metadata["total_chunks"] = len(chunks)
                metadatas.append(chunk_metadata)

        # 存储到向量库
        doc_ids = self.vector_store.add_documents(
            documents=chunks,
            metadatas=metadatas,
        )

        logger.info(
            f"Added document: title='{title}', category='{category}', "
            f"chunks={len(chunks)}, ids={doc_ids[:3]}..."
        )

        return doc_ids

    def add_documents_from_directory(
        self,
        directory: str,
        category: str = None,
        metadata: Dict[str, Any] = None,
        status: str = STATUS_PUBLISHED,
    ) -> List[str]:
        """
        批量添加目录中的文档

        Args:
            directory: 目录路径
            category: 分类
            metadata: 基础元数据
            status: 发布状态

        Returns:
            所有添加的文档 ID 列表
        """
        if metadata is None:
            metadata = {}

        if category:
            metadata["category"] = category
        metadata["status"] = status

        chunks, metadatas = self.document_processor.process_directory(directory, metadata=metadata)

        if not chunks:
            logger.warning(f"No documents found in directory: {directory}")
            return []

        doc_ids = self.vector_store.add_documents(chunks, metadatas)

        logger.info(f"Added {len(doc_ids)} chunks from directory: {directory}")
        return doc_ids

    def update_document(
        self,
        doc_id: str,
        text: str = None,
        metadata: Dict[str, Any] = None,
    ) -> bool:
        """
        更新文档

        Args:
            doc_id: 文档 ID
            text: 新的文本内容
            metadata: 新的元数据

        Returns:
            是否成功
        """
        update_data = {}
        if text:
            chunks = self.document_processor.split_text_into_chunks(text)
            update_data["documents"] = chunks
        if metadata:
            update_data["metadatas"] = [metadata]

        if not update_data:
            logger.warning("Update called without text or metadata")
            return False

        result = self.vector_store.update(ids=[doc_id], **update_data)

        if result:
            logger.info(f"Updated document: {doc_id}")

        return result

    def delete_document(
        self,
        doc_id: str = None,
        category: str = None,
        title: str = None,
    ) -> int:
        """
        删除文档

        Args:
            doc_id: 文档 ID
            category: 按分类删除
            title: 按标题删除

        Returns:
            删除的文档数量
        """
        if doc_id:
            return self.vector_store.delete(ids=[doc_id])

        # 按条件删除需要先查询
        where = {}
        if category:
            where["category"] = category
        if title:
            where["title"] = title

        if not where:
            logger.warning("Delete called without ID or conditions")
            return 0

        # 注意：这里会删除所有匹配条件的文档
        return self.vector_store.delete(where=where)

    def search(
        self,
        query: str,
        top_k: int = 5,
        category: str = None,
        status: str = STATUS_PUBLISHED,
    ) -> List[Dict[str, Any]]:
        """
        搜索知识库

        Args:
            query: 查询文本
            top_k: 返回结果数量
            category: 分类过滤
            status: 状态过滤

        Returns:
            搜索结果列表
        """
        # 添加状态过滤
        where = {"status": status} if status else None
        if category:
            if where is None:
                where = {}
            where["category"] = category

        results = self.vector_store.search(
            query=query,
            n_results=top_k,
            where=where,
        )

        logger.info(f"Search: query='{query}', results={len(results)}")
        return results

    def retrieve_with_rag(self, query: str, **kwargs) -> Dict[str, Any]:
        """
        RAG 检索 - 返回可用于 LLM 的上下文

        Args:
            query: 查询文本
            **kwargs: 其他检索参数

        Returns:
            包含检索结果的字典
        """
        return self.retriever.smart_retrieve(query, **kwargs)

    def get_categories(self) -> List[str]:
        """
        获取所有分类

        Returns:
            分类列表
        """
        return self.vector_store.get_all_categories()

    def get_document_count(
        self,
        category: str = None,
        status: str = None,
    ) -> int:
        """
        获取文档数量统计

        Args:
            category: 分类过滤
            status: 状态过滤

        Returns:
            文档数量
        """
        # 向量库的 count() 不支持过滤，这里返回总数
        # 如需精确统计，需要遍历所有文档
        return self.vector_store.count()

    def get_document_by_id(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        根据 ID 获取文档

        Args:
            doc_id: 文档 ID

        Returns:
            文档内容
        """
        return self.vector_store.get_by_id(doc_id)

    def list_documents(
        self,
        category: str = None,
        status: str = STATUS_PUBLISHED,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        列出文档

        Args:
            category: 分类过滤
            status: 状态过滤
            limit: 最大返回数量

        Returns:
            文档列表
        """
        where = {"status": status} if status else None
        if category:
            if where is None:
                where = {}
            where["category"] = category

        # ChromaDB 不支持 list 操作，这里用 search 模拟
        # 获取所有文档（使用通用查询）
        results = self.vector_store.search(
            query="",
            n_results=limit,
            where=where,
        )

        return results

    def import_from_file(
        self,
        file_path: str,
        category: str = None,
        title: str = None,
    ) -> List[str]:
        """
        从文件导入文档并复制到知识库目录

        Args:
            file_path: 源文件路径
            category: 分类
            title: 标题

        Returns:
            添加的文档 ID 列表
        """
        # 复制文件到知识库目录
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # 按分类组织目录
        target_dir = self.knowledge_dir / (category or "uncategorized")
        target_dir.mkdir(parents=True, exist_ok=True)

        target_path = target_dir / file_path.name
        shutil.copy2(file_path, target_path)

        # 添加到知识库
        if title is None:
            title = file_path.stem

        doc_ids = self.add_document(
            file_path=str(target_path),
            category=category,
            title=title,
        )

        logger.info(f"Imported file: {file_path} -> {target_path}")
        return doc_ids

    def rebuild_index(self) -> bool:
        """
        重建索引 - 清空并重新加载所有文档

        Returns:
            是否成功
        """
        try:
            # 获取当前所有文档
            # 注意：这会丢失所有现有数据
            logger.warning("Rebuilding index - all existing data will be lost")

            # 清空向量库
            self.vector_store.clear()

            # 从知识库目录重新加载
            total_ids = []
            for category_dir in self.knowledge_dir.iterdir():
                if category_dir.is_dir():
                    category = category_dir.name
                    for file_path in category_dir.glob("*"):
                        if file_path.is_file() and self.document_processor.is_supported_format(str(file_path)):
                            try:
                                ids = self.add_document(
                                    file_path=str(file_path),
                                    category=category,
                                    title=file_path.stem,
                                )
                                total_ids.extend(ids)
                            except Exception as e:
                                logger.error(f"Error reloading {file_path}: {e}")

            logger.info(f"Index rebuilt: {len(total_ids)} chunks reloaded")
            return True

        except Exception as e:
            logger.error(f"Error rebuilding index: {e}")
            return False

    def export_metadata(self, output_file: str = None) -> bool:
        """
        导出所有文档元数据

        Args:
            output_file: 输出文件路径

        Returns:
            是否成功
        """
        try:
            if output_file is None:
                output_file = self.knowledge_dir / "metadata_export.json"

            import json

            # 获取所有文档
            results = self.vector_store.collection.get(include=["metadatas"])

            export_data = {
                "export_time": datetime.now().isoformat(),
                "total_documents": len(results["ids"]) if results else 0,
                "documents": []
            }

            if results:
                for i, doc_id in enumerate(results["ids"]):
                    export_data["documents"].append({
                        "id": doc_id,
                        "metadata": results["metadatas"][i] if results["metadatas"] else {},
                    })

            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, ensure_ascii=False, indent=2)

            logger.info(f"Exported metadata to: {output_file}")
            return True

        except Exception as e:
            logger.error(f"Error exporting metadata: {e}")
            return False

    def get_statistics(self) -> Dict[str, Any]:
        """
        获取知识库统计信息

        Returns:
            统计数据字典
        """
        categories = self.get_categories()
        total_docs = self.get_document_count()

        category_counts = {}
        for category in categories:
            category_counts[category] = self.get_document_count(category=category)

        return {
            "total_documents": total_docs,
            "total_categories": len(categories),
            "categories": category_counts,
            "persist_directory": str(self.persist_directory),
            "knowledge_directory": str(self.knowledge_dir),
        }
