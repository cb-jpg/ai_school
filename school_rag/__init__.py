"""
School RAG Module - 学校知识库检索增强生成模块

提供学校专属知识库的文档处理、向量存储、检索和管理功能。
"""

from .knowledge_base import SchoolKnowledgeBase
from .vector_store import VectorStore
from .retriever import SchoolKnowledgeRetriever
from .document_processor import DocumentProcessor
from .school_rag_integration import SchoolRAGIntegration, get_rag_integration

__all__ = [
    'SchoolKnowledgeBase',
    'VectorStore',
    'SchoolKnowledgeRetriever',
    'DocumentProcessor',
    'SchoolRAGIntegration',
    'get_rag_integration',
]

__version__ = '0.1.0'
