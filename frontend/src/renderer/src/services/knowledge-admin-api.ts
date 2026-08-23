/**
 * Knowledge base admin API service
 * Connects to the school_admin backend at port 8001
 */

const API_BASE = 'http://localhost:8001';

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

// ============== API Functions ==============

/**
 * Check API health
 */
export async function checkHealth(): Promise<{ status: string; timestamp: string; service: string }> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Add text document to knowledge base
 */
export async function addDocument(request: {
  text: string;
  category?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; document_ids: string[]; message: string }> {
  const response = await fetch(`${API_BASE}/api/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    throw new Error(`Failed to add document: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Upload file to knowledge base
 */
export async function uploadDocument(
  file: File,
  category?: string,
  title?: string
): Promise<{ success: boolean; document_ids: string[]; message: string; chunks_count: number }> {
  const formData = new FormData();
  formData.append('file', file);
  if (category) formData.append('category', category);
  if (title) formData.append('title', title);

  const response = await fetch(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    throw new Error(`Failed to upload document: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Update document
 */
export async function updateDocument(
  docId: string,
  request: {
    text?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/api/documents`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc_id: docId, ...request })
  });
  if (!response.ok) {
    throw new Error(`Failed to update document: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Delete document
 */
export async function deleteDocument(request: {
  doc_id?: string;
  category?: string;
  title?: string;
}): Promise<{ success: boolean; deleted_count: number; message: string }> {
  const response = await fetch(`${API_BASE}/api/documents`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    throw new Error(`Failed to delete document: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Search documents
 */
export async function searchDocuments(request: {
  query: string;
  top_k?: number;
  category?: string;
}): Promise<{ success: boolean; query: string; results: SearchResult[]; total: number }> {
  const response = await fetch(`${API_BASE}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    throw new Error(`Failed to search documents: ${response.statusText}`);
  }
  return response.json();
}

/**
 * RAG query
 */
export async function ragQuery(request: {
  query: string;
  conversation_history?: Array<{ role: string; content: string }>;
}): Promise<{
  success: boolean;
  query: string;
  context?: string;
  has_results?: boolean;
  detected_category?: string;
  results?: SearchResult[];
}> {
  const response = await fetch(`${API_BASE}/api/rag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    throw new Error(`Failed to perform RAG query: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get all categories
 */
export async function getCategories(): Promise<{ success: boolean; categories: string[] }> {
  const response = await fetch(`${API_BASE}/api/categories`);
  if (!response.ok) {
    throw new Error(`Failed to get categories: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get statistics
 */
export async function getStatistics(): Promise<{ success: boolean; statistics: Statistics }> {
  const response = await fetch(`${API_BASE}/api/statistics`);
  if (!response.ok) {
    throw new Error(`Failed to get statistics: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get document by ID
 */
export async function getDocument(docId: string): Promise<{ success: boolean; document: Document }> {
  const response = await fetch(`${API_BASE}/api/documents/${docId}`);
  if (!response.ok) {
    throw new Error(`Failed to get document: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Rebuild index
 */
export async function rebuildIndex(): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/api/documents/rebuild`, {
    method: 'POST'
  });
  if (!response.ok) {
    throw new Error(`Failed to rebuild index: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Export metadata
 */
export async function exportMetadata(): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/api/export/metadata`);
  if (!response.ok) {
    throw new Error(`Failed to export metadata: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Hook for knowledge admin API
 */
export function useKnowledgeAdminAPI() {
  return {
    checkHealth,
    addDocument,
    uploadDocument,
    updateDocument,
    deleteDocument,
    searchDocuments,
    ragQuery,
    getCategories,
    getStatistics,
    getDocument,
    rebuildIndex,
    exportMetadata
  };
}
