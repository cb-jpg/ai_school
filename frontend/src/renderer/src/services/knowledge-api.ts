/**
 * Knowledge base API service
 */
import { useWebSocket } from '@/context/websocket-context';
import {
  KnowledgeEntry,
  KnowledgeFilters,
  KnowledgeStatsResponse,
  KnowledgeCreateRequest,
  UrlAddRequest
} from '@/types/knowledge';

const API_BASE = '/api/knowledge';

/**
 * Fetch knowledge list with filters
 */
export async function fetchKnowledgeList(filters: KnowledgeFilters = {}): Promise<KnowledgeEntry[]> {
  const params = new URLSearchParams();

  if (filters.category) params.append('category', filters.category);
  if (filters.status) params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  if (filters.include_archived) params.append('include_archived', 'true');

  const response = await fetch(`${API_BASE}/list?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch knowledge list: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch knowledge statistics
 */
export async function fetchKnowledgeStats(): Promise<KnowledgeStatsResponse> {
  const response = await fetch(`${API_BASE}/stats`);
  if (!response.ok) {
    throw new Error(`Failed to fetch statistics: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch knowledge detail
 */
export async function fetchKnowledgeDetail(entryId: string): Promise<KnowledgeEntry> {
  const response = await fetch(`${API_BASE}/${entryId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch knowledge detail: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Create manual knowledge entry
 */
export async function createKnowledge(request: KnowledgeCreateRequest): Promise<KnowledgeEntry> {
  const response = await fetch(`${API_BASE}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    throw new Error(`Failed to create knowledge: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Update knowledge entry
 */
export async function updateKnowledge(entryId: string, request: Partial<KnowledgeCreateRequest>): Promise<KnowledgeEntry> {
  const response = await fetch(`${API_BASE}/${entryId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    throw new Error(`Failed to update knowledge: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Delete knowledge entry
 */
export async function deleteKnowledge(entryId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${entryId}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    throw new Error(`Failed to delete knowledge: ${response.statusText}`);
  }
}

/**
 * Bulk operation on knowledge entries
 */
export async function bulkOperation(entryIds: string[], operation: 'publish' | 'archive' | 'delete' | 'reindex'): Promise<{ results: Record<string, boolean>; message: string }> {
  const response = await fetch(`${API_BASE}/bulk-operation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry_ids: entryIds, operation })
  });
  if (!response.ok) {
    throw new Error(`Failed to perform bulk operation: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Upload file to knowledge base
 */
export async function uploadFile(file: File, title: string, category: string, tags: string = '', summary?: string): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title);
  formData.append('category', category);
  formData.append('tags', tags);
  if (summary) formData.append('summary', summary);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    throw new Error(`Failed to upload file: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Add knowledge from URL
 */
export async function addKnowledgeFromUrl(request: UrlAddRequest): Promise<any> {
  const response = await fetch(`${API_BASE}/add-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    throw new Error(`Failed to add URL: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Reindex knowledge entry
 */
export async function reindexEntry(entryId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/${entryId}/reindex`, {
    method: 'POST'
  });
  if (!response.ok) {
    throw new Error(`Failed to reindex entry: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Hook for knowledge list management with WebSocket support
 */
export function useKnowledgeAPI() {
  const { sendMessage } = useWebSocket();

  return {
    // Fetch list via HTTP
    fetchList: fetchKnowledgeList,

    // Fetch stats via HTTP
    fetchStats: fetchKnowledgeStats,

    // Create via HTTP
    create: createKnowledge,

    // Update via HTTP
    update: updateKnowledge,

    // Delete via HTTP
    delete: deleteKnowledge,

    // Bulk operation
    bulkOperation,

    // Upload file
    uploadFile,

    // Add URL
    addUrl: addKnowledgeFromUrl,

    // Reindex
    reindex: reindexEntry,

    // Request list refresh via WebSocket
    requestListRefresh: () => {
      sendMessage({ type: 'request-knowledge-list' });
    }
  };
}
