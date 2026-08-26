"""
API request/response schemas for knowledge base endpoints.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from .models import KnowledgeStatus, KnowledgeCategory, SourceType


# ============== Request Schemas ==============

class KnowledgeCreateRequest(BaseModel):
    """Request to create a new knowledge entry manually"""
    title: str = Field(..., min_length=1, max_length=200)
    category: KnowledgeCategory
    tags: List[str] = Field(default_factory=list)
    content: str = Field(..., min_length=1)
    summary: Optional[str] = None


class KnowledgeUpdateRequest(BaseModel):
    """Request to update an existing knowledge entry"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[KnowledgeCategory] = None
    tags: Optional[List[str]] = None
    summary: Optional[str] = None
    status: Optional[KnowledgeStatus] = None


class UrlAddRequest(BaseModel):
    """Request to add knowledge from a URL"""
    url: str = Field(..., min_length=1)
    title: Optional[str] = None
    category: KnowledgeCategory
    tags: List[str] = Field(default_factory=list)


class BulkOperationRequest(BaseModel):
    """Request for bulk operations"""
    entry_ids: List[str]
    operation: str = Field(..., pattern="^(publish|archive|delete|reindex)$")


class SearchRequest(BaseModel):
    """Request for knowledge chunk search"""
    query: str = Field(..., min_length=1, max_length=500)
    top_k: int = Field(5, ge=1, le=20)


class CategoryFilterRequest(BaseModel):
    """Request to filter by category"""
    categories: List[KnowledgeCategory]
    include_archived: bool = False


# ============== Response Schemas ==============

class KnowledgeListItem(BaseModel):
    """Knowledge entry in list view"""
    id: str
    title: str
    category: KnowledgeCategory
    source_type: SourceType
    status: KnowledgeStatus
    chunk_count: int
    tags: List[str]
    created_at: datetime
    updated_at: datetime
    file_name: Optional[str] = None


class KnowledgeDetailResponse(BaseModel):
    """Full knowledge entry detail"""
    id: str
    title: str
    category: KnowledgeCategory
    tags: List[str]
    source_type: SourceType
    source_url: Optional[str] = None
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    status: KnowledgeStatus
    chunk_count: int
    summary: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None
    created_by: Optional[str] = None
    chunks: List[dict] = Field(default_factory=list)


class UploadProgressResponse(BaseModel):
    """File upload progress"""
    upload_id: str
    file_name: str
    status: str  # uploading, processing, completed, error
    progress: int = 0  # 0-100
    message: Optional[str] = None
    entry_id: Optional[str] = None


class UnansweredQuestion(BaseModel):
    """Question that wasn't answered by knowledge base"""
    id: str
    question: str
    timestamp: datetime
    count: int


class LowConfidenceQuestion(BaseModel):
    """Question with low confidence in RAG retrieval"""
    id: str
    question: str
    confidence_score: float
    timestamp: datetime
    retrieval_count: int


class KnowledgeStatsResponse(BaseModel):
    """Knowledge base statistics"""
    total_entries: int
    published_entries: int
    processing_entries: int
    archived_entries: int
    error_entries: int
    total_chunks: int
    category_counts: dict
    recent_unanswered: List[UnansweredQuestion]
    low_confidence_questions: List[LowConfidenceQuestion]


# ============== WebSocket Message Schemas ==============

class KnowledgeListMessage(BaseModel):
    """WebSocket message for knowledge list update"""
    type: str = "knowledge-list"
    entries: List[KnowledgeListItem]


class KnowledgeUploadProgressMessage(BaseModel):
    """WebSocket message for upload progress"""
    type: str = "knowledge-upload-progress"
    progress: UploadProgressResponse


class KnowledgeDetailMessage(BaseModel):
    """WebSocket message for knowledge detail"""
    type: str = "knowledge-detail"
    entry: KnowledgeDetailResponse


class KnowledgeStatsMessage(BaseModel):
    """WebSocket message for statistics update"""
    type: str = "knowledge-stats"
    stats: KnowledgeStatsResponse


class KnowledgeErrorMessage(BaseModel):
    """WebSocket error message"""
    type: str = "knowledge-error"
    error: str
    details: Optional[str] = None
