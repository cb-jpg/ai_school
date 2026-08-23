/**
 * Knowledge base type definitions
 */

// ============== Enums ==============

export enum SourceType {
  FILE = 'file',
  URL = 'url',
  MANUAL = 'manual',
  OCR = 'ocr'
}

export enum KnowledgeStatus {
  PROCESSING = 'processing',
  INDEXED = 'indexed',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  ERROR = 'error'
}

export enum KnowledgeCategory {
  SCHOOL_INTRO = 'school_intro',
  HISTORY = 'history',
  MOTTO = 'motto',
  PHILOSOPHY = 'philosophy',
  CULTURE = 'culture',
  RULES = 'rules',
  ADMISSIONS = 'admissions',
  COURSES = 'courses',
  ACTIVITIES = 'activities',
  FAQ = 'faq',
  HONORS = 'honors',
  TEACHERS = 'teachers',
  STUDENTS = 'students',
  OTHER = 'other'
}

// ============== Models ==============

export interface Chunk {
  id: string;
  content: string;
  source_id: string;
  chunk_index: number;
  metadata: Record<string, unknown>;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  category: KnowledgeCategory;
  tags: string[];
  source_type: SourceType;
  source_url?: string;
  file_path?: string;
  file_name?: string;
  status: KnowledgeStatus;
  chunk_count: number;
  summary?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  created_by?: string;
}

export interface KnowledgeListItem extends KnowledgeEntry {}

export interface KnowledgeDetailResponse extends KnowledgeEntry {
  chunks: Chunk[];
}

// ============== API Request/Response Types ==============

export interface KnowledgeCreateRequest {
  title: string;
  category: KnowledgeCategory;
  tags: string[];
  content: string;
  summary?: string;
}

export interface KnowledgeUpdateRequest {
  title?: string;
  category?: KnowledgeCategory;
  tags?: string[];
  summary?: string;
  status?: KnowledgeStatus;
}

export interface UrlAddRequest {
  url: string;
  title?: string;
  category: KnowledgeCategory;
  tags: string[];
}

export interface BulkOperationRequest {
  entry_ids: string[];
  operation: 'publish' | 'archive' | 'delete' | 'reindex';
}

export interface UploadProgressResponse {
  upload_id: string;
  file_name: string;
  status: string;
  progress: number;
  message?: string;
  entry_id?: string;
}

export interface UnansweredQuestion {
  id: string;
  question: string;
  timestamp: string;
  count: number;
}

export interface LowConfidenceQuestion {
  id: string;
  question: string;
  confidence_score: number;
  timestamp: string;
  retrieval_count: number;
}

export interface KnowledgeStatsResponse {
  total_entries: number;
  published_entries: number;
  processing_entries: number;
  archived_entries: number;
  error_entries: number;
  total_chunks: number;
  category_counts: Record<string, number>;
  recent_unanswered: UnansweredQuestion[];
  low_confidence_questions: LowConfidenceQuestion[];
}

// ============== Filter Types ==============

export interface KnowledgeFilters {
  category?: KnowledgeCategory;
  status?: KnowledgeStatus;
  search?: string;
  include_archived?: boolean;
}

// ============== Category Labels ==============

export const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  [KnowledgeCategory.SCHOOL_INTRO]: '学校简介',
  [KnowledgeCategory.HISTORY]: '校史',
  [KnowledgeCategory.MOTTO]: '校训',
  [KnowledgeCategory.PHILOSOPHY]: '办学理念',
  [KnowledgeCategory.CULTURE]: '校园文化',
  [KnowledgeCategory.RULES]: '规章制度',
  [KnowledgeCategory.ADMISSIONS]: '招生简章',
  [KnowledgeCategory.COURSES]: '课程介绍',
  [KnowledgeCategory.ACTIVITIES]: '校园活动',
  [KnowledgeCategory.FAQ]: '常见问题',
  [KnowledgeCategory.HONORS]: '学校荣誉',
  [KnowledgeCategory.TEACHERS]: '教师资料',
  [KnowledgeCategory.STUDENTS]: '学习标兵',
  [KnowledgeCategory.OTHER]: '其他'
};

export const STATUS_LABELS: Record<KnowledgeStatus, string> = {
  [KnowledgeStatus.PROCESSING]: '处理中',
  [KnowledgeStatus.INDEXED]: '已索引',
  [KnowledgeStatus.PUBLISHED]: '已发布',
  [KnowledgeStatus.ARCHIVED]: '已停用',
  [KnowledgeStatus.ERROR]: '错误'
};

export const STATUS_COLORS: Record<KnowledgeStatus, string> = {
  [KnowledgeStatus.PROCESSING]: 'yellow',
  [KnowledgeStatus.INDEXED]: 'blue',
  [KnowledgeStatus.PUBLISHED]: 'green',
  [KnowledgeStatus.ARCHIVED]: 'gray',
  [KnowledgeStatus.ERROR]: 'red'
};
