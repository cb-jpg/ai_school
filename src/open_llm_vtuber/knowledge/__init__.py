"""
Knowledge base module for school RAG system.
"""
from .models import (
    SourceType,
    KnowledgeStatus,
    KnowledgeCategory,
    KnowledgeEntry,
    Chunk,
    KnowledgeStats
)
from .schemas import (
    KnowledgeCreateRequest,
    KnowledgeUpdateRequest,
    UrlAddRequest,
    BulkOperationRequest,
    KnowledgeListItem,
    KnowledgeDetailResponse,
    UploadProgressResponse,
    KnowledgeStatsResponse,
    UnansweredQuestion,
    LowConfidenceQuestion
)
from .embeddings import (
    EmbeddingModel,
    CachedEmbeddingModel,
    get_embedding_model,
    clear_embedding_model
)
from .vector_store import (
    VectorStore,
    get_vector_store,
    reset_vector_store
)

__all__ = [
    # Models
    'SourceType',
    'KnowledgeStatus',
    'KnowledgeCategory',
    'KnowledgeEntry',
    'Chunk',
    'KnowledgeStats',
    # Schemas
    'KnowledgeCreateRequest',
    'KnowledgeUpdateRequest',
    'UrlAddRequest',
    'BulkOperationRequest',
    'KnowledgeListItem',
    'KnowledgeDetailResponse',
    'UploadProgressResponse',
    'KnowledgeStatsResponse',
    'UnansweredQuestion',
    'LowConfidenceQuestion',
    # Embeddings
    'EmbeddingModel',
    'CachedEmbeddingModel',
    'get_embedding_model',
    'clear_embedding_model',
    # Vector Store
    'VectorStore',
    'get_vector_store',
    'reset_vector_store',
]
