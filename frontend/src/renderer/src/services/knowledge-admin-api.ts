/**
 * Knowledge base admin API service
 * 适配层：保持 useKnowledgeAdminAPI 的旧接口签名，内部全部走
 * 主服务的新知识库接口（/api/knowledge/*，经 vite 代理到 :12393），
 * 由 authFetch 注入登录 token。
 */

import { authFetch } from '@/services/auth';

// ============== Type Definitions ==============

export interface Document {
  id: string;
  title?: string;
  content?: string;
  category?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  score?: number;
  category?: string;
  title?: string;
}

export interface Statistics {
  total_documents: number;
  total_chunks: number;
  categories: Record<string, number>;
  recent_additions?: number;
}

export interface CategoryInfo {
  name: string;
  count: number;
}

// ============== Helpers ==============

// 中文分类（表单 datalist 用的值）→ 新后端 KnowledgeCategory 枚举
const CATEGORY_MAP: Record<string, string> = {
  '学校简介': 'school_intro',
  '校史': 'history',
  '校训': 'motto',
  '办学理念': 'philosophy',
  '校园文化': 'culture',
  '规章制度': 'rules',
  '招生简章': 'admissions',
  '课程介绍': 'courses',
  '校园活动': 'activities',
  '常见问题': 'faq',
  '学校荣誉': 'honors',
  '教师资料': 'teachers',
  '学习标兵': 'students',
  '其他': 'other',
};

const VALID_CATEGORIES = new Set(Object.values(CATEGORY_MAP));

function normalizeCategory(category?: string): string {
  if (!category) return 'other';
  if (VALID_CATEGORIES.has(category)) return category;
  return CATEGORY_MAP[category] || 'other';
}

async function request(path: string, init: RequestInit = {}): Promise<any> {
  const response = await authFetch(path, init);
  if (!response.ok) {
    const detail = await response
      .json()
      .then((data) => data?.detail)
      .catch(() => null);
    throw new Error(detail || `请求失败（${response.status}）`);
  }
  return response.json();
}

// ============== API Functions ==============

/**
 * Check API health（主服务 /health，无需登录）
 */
export async function checkHealth(): Promise<{ status: string; timestamp: string; service: string }> {
  const response = await fetch('/health');
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'open-llm-vtuber-knowledge',
  };
}

/**
 * Add text document to knowledge base → POST /api/knowledge/create
 */
export async function addDocument(requestBody: {
  text: string;
  category?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; document_ids: string[]; message: string }> {
  const tags = (requestBody.metadata?.tags as string[] | undefined) || [];
  const entry = await request('/api/knowledge/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: requestBody.title?.trim() || '(未命名)',
      content: requestBody.text,
      category: normalizeCategory(requestBody.category),
      tags,
    }),
  });
  return {
    success: true,
    document_ids: [entry.id],
    message: '已添加到知识库',
  };
}

/**
 * Upload file to knowledge base → POST /api/knowledge/upload
 */
export async function uploadDocument(
  file: File,
  category?: string,
  title?: string
): Promise<{ success: boolean; document_ids: string[]; message: string; chunks_count: number }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title?.trim() || file.name);
  formData.append('category', normalizeCategory(category));
  formData.append('tags', '');

  const result = await request('/api/knowledge/upload', {
    method: 'POST',
    body: formData,
  });

  if (result.status !== 'completed') {
    throw new Error(result.message || '文件处理失败');
  }
  return {
    success: true,
    document_ids: result.entry_id ? [result.entry_id] : [],
    message: result.message || '上传成功',
    chunks_count: 0,
  };
}

/**
 * Delete document（按 entry id）→ DELETE /api/knowledge/{id}
 */
export async function deleteDocument(requestBody: {
  doc_id?: string;
  category?: string;
  title?: string;
}): Promise<{ success: boolean; deleted_count: number; message: string }> {
  if (!requestBody.doc_id) {
    throw new Error('仅支持按文档 ID 删除');
  }
  await request(`/api/knowledge/${requestBody.doc_id}`, { method: 'DELETE' });
  return { success: true, deleted_count: 1, message: '已删除' };
}

/**
 * Add knowledge from a web URL → POST /api/knowledge/add-url
 */
export async function addUrlDocument(requestBody: {
  url: string;
  title?: string;
  category?: string;
  tags?: string[];
}): Promise<{ success: boolean; document_ids: string[]; message: string }> {
  const result = await request('/api/knowledge/add-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: requestBody.url.trim(),
      title: requestBody.title?.trim() || null,
      category: normalizeCategory(requestBody.category),
      tags: requestBody.tags || [],
    }),
  });

  if (result.status !== 'completed') {
    throw new Error(result.message || '网页抓取失败');
  }
  return {
    success: true,
    document_ids: result.entry_id ? [result.entry_id] : [],
    message: result.message || '网页抓取成功',
  };
}

/**
 * Search documents → POST /api/knowledge/search
 * 结果按知识条目去重（每条目保留最高分块），id 为条目 ID（可直接用于删除）。
 */
export async function searchDocuments(requestBody: {
  query: string;
  top_k?: number;
  category?: string;
}): Promise<{ success: boolean; query: string; results: SearchResult[]; total: number }> {
  const data = await request('/api/knowledge/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: requestBody.query, top_k: requestBody.top_k ?? 10 }),
  });

  const byEntry = new Map<string, SearchResult>();
  for (const doc of data.results || []) {
    if (requestBody.category) {
      const expected = normalizeCategory(requestBody.category);
      if (doc.category !== expected) continue;
    }
    const existing = byEntry.get(doc.entry_id);
    if (!existing || (doc.score ?? 0) > (existing.score ?? 0)) {
      byEntry.set(doc.entry_id, {
        id: doc.entry_id,
        content: doc.content,
        metadata: {
          entry_id: doc.entry_id,
          title: doc.title,
          score: doc.score,
        },
        score: doc.score,
        category: doc.category,
        title: doc.title,
      });
    }
  }

  const results = Array.from(byEntry.values());
  return { success: true, query: requestBody.query, results, total: results.length };
}

/**
 * Get all categories（静态：与后端 KnowledgeCategory 枚举一致）
 */
export async function getCategories(): Promise<{ success: boolean; categories: string[] }> {
  return { success: true, categories: Object.keys(CATEGORY_MAP) };
}

/**
 * Get statistics → GET /api/knowledge/stats
 */
export async function getStatistics(): Promise<{ success: boolean; statistics: Statistics }> {
  const stats = await request('/api/knowledge/stats');
  return {
    success: true,
    statistics: {
      total_documents: stats.total_entries,
      total_chunks: stats.total_chunks,
      categories: stats.category_counts || {},
    },
  };
}

/**
 * Get document by ID → GET /api/knowledge/{id}（chunks 拼接为 content）
 */
export async function getDocument(docId: string): Promise<{ success: boolean; document: Document }> {
  const detail = await request(`/api/knowledge/${docId}`);
  return {
    success: true,
    document: {
      id: detail.id,
      title: detail.title,
      content: (detail.chunks || []).map((c: { content: string }) => c.content).join('\n\n'),
      category: detail.category,
      metadata: { status: detail.status, tags: detail.tags, source_type: detail.source_type },
      created_at: detail.created_at,
      updated_at: detail.updated_at,
    },
  };
}

/**
 * Rebuild index → 对全部条目批量重建索引
 */
export async function rebuildIndex(): Promise<{ success: boolean; message: string }> {
  const entries = await request('/api/knowledge/list?include_archived=false');
  const ids = (entries || []).map((e: { id: string }) => e.id);
  if (ids.length === 0) {
    return { success: true, message: '知识库为空，无需重建' };
  }
  await request('/api/knowledge/bulk-operation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry_ids: ids, operation: 'reindex' }),
  });
  return { success: true, message: `已对 ${ids.length} 个条目重建索引` };
}

/**
 * Hook for knowledge admin API
 */
export function useKnowledgeAdminAPI() {
  return {
    checkHealth,
    addDocument,
    uploadDocument,
    addUrlDocument,
    deleteDocument,
    searchDocuments,
    getCategories,
    getStatistics,
    getDocument,
    rebuildIndex,
  };
}
