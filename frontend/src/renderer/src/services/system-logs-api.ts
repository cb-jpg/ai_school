/**
 * 系统日志服务 —— 对接 /api/logs/*
 * 对应功能点：知识库更新记录（§7 知识库后台）、问答统计（一期范围）、运行状态查看。
 */

import { authFetch } from './auth';

export interface KnowledgeStats {
  total_entries: number;
  total_chunks: number;
  status_counts?: Record<string, number>;
  category_counts?: Record<string, number>;
  unanswered_count?: number | null;
}

export interface AuditEntry {
  ts: number;
  username: string;
  action: string;
  target_id: string;
  target_title: string;
  detail: string;
}

export interface AuditResponse {
  total: number;
  entries: AuditEntry[];
  actions: string[];
}

export interface ServiceLog {
  file: string;
  size: number;
  lines: string[];
}

/** 内容审核记录（合规 2026-10-14：五大要素=用户ID/审核时间/输入指令/输出内容/审核状态） */
export interface ContentReviewEntry {
  ts: number;
  review_time: string;
  username: string;
  input_text: string;
  output_text: string;
  status: string;
  hit_words?: string[];
}

export interface ContentReviewResponse {
  total: number;
  entries: ContentReviewEntry[];
  statuses: string[];
}

async function request<T>(path: string): Promise<T> {
  const response = await authFetch(path);
  if (!response.ok) {
    const detail = await response
      .json()
      .then((data) => data?.detail)
      .catch(() => null);
    throw new Error(detail || `请求失败（${response.status}）`);
  }
  return response.json();
}

/** 知识库与问答概况 → GET /api/logs/stats（admin） */
export function fetchKnowledgeStats(): Promise<KnowledgeStats> {
  return request<KnowledgeStats>('/api/logs/stats');
}

/** 操作记录 → GET /api/logs/audit */
export function fetchAuditEntries(params?: {
  limit?: number;
  offset?: number;
  action?: string;
}): Promise<AuditResponse> {
  const query = new URLSearchParams();
  if (params?.limit != null) query.set('limit', String(params.limit));
  if (params?.offset != null) query.set('offset', String(params.offset));
  if (params?.action) query.set('action', params.action);
  const qs = query.toString();
  return request<AuditResponse>(`/api/logs/audit${qs ? `?${qs}` : ''}`);
}

/** 服务运行日志尾部 → GET /api/logs/service（admin） */
export function fetchServiceLog(lines = 400): Promise<ServiceLog> {
  return request<ServiceLog>(`/api/logs/service?lines=${lines}`);
}

/** 对话内容审核记录 → GET /api/logs/content-review（后台角色） */
export function fetchContentReview(params?: {
  limit?: number;
  offset?: number;
  status?: string;
}): Promise<ContentReviewResponse> {
  const query = new URLSearchParams();
  if (params?.limit != null) query.set('limit', String(params.limit));
  if (params?.offset != null) query.set('offset', String(params.offset));
  if (params?.status) query.set('status', params.status);
  const qs = query.toString();
  return request<ContentReviewResponse>(`/api/logs/content-review${qs ? `?${qs}` : ''}`);
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: '新建条目',
  update: '更新条目',
  delete: '删除条目',
  bulk_delete: '批量删除',
  bulk_publish: '批量发布',
  bulk_archive: '批量归档',
  bulk_reindex: '批量重建索引',
  upload: '上传文件',
  add_url: '网页抓取',
  reindex: '重建索引',
};
