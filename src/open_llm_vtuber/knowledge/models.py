"""
Knowledge base data models for the school RAG system.
"""
from datetime import datetime
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, Field
from uuid import uuid4


class SourceType(str, Enum):
    """Type of knowledge source"""
    FILE = "file"
    URL = "url"
    MANUAL = "manual"
    OCR = "ocr"


class KnowledgeStatus(str, Enum):
    """Processing status of knowledge entry"""
    PROCESSING = "processing"
    INDEXED = "indexed"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    ERROR = "error"


class KnowledgeCategory(str, Enum):
    """Standard knowledge categories for school data"""
    SCHOOL_INTRO = "school_intro"      # 学校简介
    HISTORY = "history"                # 校史
    MOTTO = "motto"                   # 校训
    PHILOSOPHY = "philosophy"         # 办学理念
    CULTURE = "culture"               # 校园文化
    RULES = "rules"                   # 规章制度
    ADMISSIONS = "admissions"         # 招生简章
    COURSES = "courses"               # 课程介绍
    ACTIVITIES = "activities"         # 校园活动
    FAQ = "faq"                       # 常见问题
    HONORS = "honors"                 # 学校荣誉
    TEACHERS = "teachers"             # 教师资料
    STUDENTS = "students"             # 学习标兵
    OTHER = "other"                   # 其他


class Chunk(BaseModel):
    """A text chunk from document processing"""
    id: str = Field(default_factory=lambda: str(uuid4()))
    content: str
    source_id: str
    chunk_index: int
    metadata: dict = Field(default_factory=dict)


class KnowledgeEntry(BaseModel):
    """A knowledge entry in the system"""
    id: str = Field(default_factory=lambda: str(uuid4()))
    title: str
    category: KnowledgeCategory
    tags: List[str] = Field(default_factory=list)
    source_type: SourceType
    source_url: Optional[str] = None
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    status: KnowledgeStatus = KnowledgeStatus.PROCESSING
    chunk_count: int = 0
    summary: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    published_at: Optional[datetime] = None
    created_by: Optional[str] = None  # User who created the entry


class KnowledgeStats(BaseModel):
    """Statistics about knowledge base usage"""
    total_entries: int
    published_entries: int
    processing_entries: int
    total_chunks: int
    category_counts: dict
    recent_unanswered: List[str]  # Question IDs
    low_confidence_questions: List[str]  # Question IDs
