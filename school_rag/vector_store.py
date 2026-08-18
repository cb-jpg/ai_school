"""
向量存储模块 - 基于 ChromaDB 的向量数据库封装

提供文档的向量化、存储、检索和删除功能。
"""

import os
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions
from loguru import logger


class VectorStore:
    """ChromaDB 向量存储封装类"""

    # 中文向量模型配置
    # 使用轻量级多语言模型，适合中文环境
    DEFAULT_EMBEDDING_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"

    def __init__(
        self,
        persist_directory: str = None,
        collection_name: str = "school_knowledge",
        embedding_model: str = None,
    ):
        """
        初始化向量存储

        Args:
            persist_directory: 持久化存储目录
            collection_name: 集合名称
            embedding_model: 嵌入模型名称
        """
        # 默认持久化目录
        if persist_directory is None:
            project_root = Path(__file__).parent.parent
            persist_directory = project_root / "school_data" / "vector_db"

        self.persist_directory = Path(persist_directory)
        self.persist_directory.mkdir(parents=True, exist_ok=True)

        self.collection_name = collection_name
        self.embedding_model = embedding_model or self.DEFAULT_EMBEDDING_MODEL

        # 初始化 ChromaDB 客户端
        self.client = chromadb.PersistentClient(
            path=str(self.persist_directory),
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True,
            )
        )

        # 初始化嵌入函数
        self.embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=self.embedding_model,
            device="cpu"  # CPU 模式，适合大多数环境
        )

        # 获取或创建集合
        self.collection = self._get_or_create_collection()

        logger.info(
            f"VectorStore initialized: collection='{collection_name}', "
            f"persist_dir='{persist_directory}', model='{self.embedding_model}'"
        )

    def _get_or_create_collection(self):
        """获取或创建集合"""
        try:
            # 尝试获取现有集合
            collection = self.client.get_collection(
                name=self.collection_name,
                embedding_function=self.embedding_function
            )
            logger.info(f"Using existing collection: {self.collection_name}")
            return collection
        except Exception:
            # 集合不存在，创建新集合
            collection = self.client.create_collection(
                name=self.collection_name,
                embedding_function=self.embedding_function,
                metadata={"description": "学校知识库向量存储"}
            )
            logger.info(f"Created new collection: {self.collection_name}")
            return collection

    def add_documents(
        self,
        documents: List[str],
        metadatas: List[Dict[str, Any]] = None,
        ids: List[str] = None,
    ) -> List[str]:
        """
        添加文档到向量存储

        Args:
            documents: 文档文本列表
            metadatas: 文档元数据列表
            ids: 文档ID列表（可选，自动生成）

        Returns:
            添加的文档ID列表
        """
        if not documents:
            return []

        # 生成ID（如果未提供）
        if ids is None:
            import uuid
            ids = [str(uuid.uuid4()) for _ in documents]

        # 确保元数据列表长度匹配
        if metadatas is None:
            metadatas = [{}] * len(documents)

        # 添加默认元数据
        for i, metadata in enumerate(metadatas):
            if "created_at" not in metadata:
                from datetime import datetime
                metadata["created_at"] = datetime.now().isoformat()

        try:
            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            logger.info(f"Added {len(documents)} documents to vector store")
            return ids
        except Exception as e:
            logger.error(f"Error adding documents: {e}")
            raise

    def search(
        self,
        query: str,
        n_results: int = 5,
        where: Dict[str, Any] = None,
        where_document: Dict[str, Any] = None,
    ) -> List[Dict[str, Any]]:
        """
        向量相似度搜索

        Args:
            query: 查询文本
            n_results: 返回结果数量
            where: 元数据过滤条件
            where_document: 文档内容过滤条件

        Returns:
            搜索结果列表，每个元素包含 id、document、metadata、score
        """
        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=n_results,
                where=where,
                where_document=where_document,
            )

            # 格式化结果
            formatted_results = []
            if results and results["documents"] and results["documents"][0]:
                for i, doc in enumerate(results["documents"][0]):
                    formatted_results.append({
                        "id": results["ids"][0][i],
                        "document": doc,
                        "metadata": results["metadatas"][0][i],
                        "score": 1.0 - results["distances"][0][i] if results.get("distances") else None,
                    })

            return formatted_results

        except Exception as e:
            logger.error(f"Error searching documents: {e}")
            return []

    def delete(self, ids: List[str] = None, where: Dict[str, Any] = None) -> int:
        """
        删除文档

        Args:
            ids: 要删除的文档ID列表
            where: 删除条件（元数据过滤）

        Returns:
            删除的文档数量
        """
        try:
            if ids:
                self.collection.delete(ids=ids)
                logger.info(f"Deleted {len(ids)} documents by IDs")
                return len(ids)
            elif where:
                # ChromaDB 不直接支持按条件删除的数量统计
                self.collection.delete(where=where)
                logger.info(f"Deleted documents by condition: {where}")
                return -1  # 无法确定数量
            else:
                logger.warning("Delete called without IDs or conditions")
                return 0
        except Exception as e:
            logger.error(f"Error deleting documents: {e}")
            return 0

    def update(
        self,
        ids: List[str],
        documents: List[str] = None,
        metadatas: List[Dict[str, Any]] = None,
    ) -> bool:
        """
        更新文档

        Args:
            ids: 要更新的文档ID列表
            documents: 新的文档内容
            metadatas: 新的元数据

        Returns:
            是否成功
        """
        try:
            self.collection.update(
                ids=ids,
                documents=documents,
                metadatas=metadatas
            )
            logger.info(f"Updated {len(ids)} documents")
            return True
        except Exception as e:
            logger.error(f"Error updating documents: {e}")
            return False

    def get_by_id(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        根据ID获取文档

        Args:
            doc_id: 文档ID

        Returns:
            文档内容，包含 id、document、metadata
        """
        try:
            results = self.collection.get(ids=[doc_id], include=["documents", "metadatas"])
            if results and results["documents"]:
                return {
                    "id": doc_id,
                    "document": results["documents"][0],
                    "metadata": results["metadatas"][0] if results["metadatas"] else {},
                }
            return None
        except Exception as e:
            logger.error(f"Error getting document by ID: {e}")
            return None

    def count(self) -> int:
        """
        获取文档总数

        Returns:
            文档数量
        """
        try:
            return self.collection.count()
        except Exception as e:
            logger.error(f"Error counting documents: {e}")
            return 0

    def clear(self) -> bool:
        """
        清空所有文档

        Returns:
            是否成功
        """
        try:
            # 删除并重新创建集合
            self.client.delete_collection(name=self.collection_name)
            self.collection = self.client.create_collection(
                name=self.collection_name,
                embedding_function=self.embedding_function,
                metadata={"description": "学校知识库向量存储"}
            )
            logger.info(f"Cleared all documents from collection: {self.collection_name}")
            return True
        except Exception as e:
            logger.error(f"Error clearing collection: {e}")
            return False

    def get_all_categories(self) -> List[str]:
        """
        获取所有文档分类

        Returns:
            分类列表
        """
        try:
            # 获取所有文档的元数据
            results = self.collection.get(include=["metadatas"])
            categories = set()
            if results and results["metadatas"]:
                for metadata in results["metadatas"]:
                    if "category" in metadata:
                        categories.add(metadata["category"])
            return list(categories)
        except Exception as e:
            logger.error(f"Error getting categories: {e}")
            return []
