/**
 * Knowledge base context for state management
 */
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { KnowledgeEntry, KnowledgeFilters, KnowledgeStatsResponse } from '@/types/knowledge';

interface KnowledgeContextType {
  // List state
  knowledgeList: KnowledgeEntry[];
  setKnowledgeList: (list: KnowledgeEntry[]) => void;

  // Selection state
  selectedKnowledge: KnowledgeEntry | null;
  setSelectedKnowledge: (entry: KnowledgeEntry | null) => void;

  // Selected items for bulk operations
  selectedItems: Set<string>;
  setSelectedItems: (items: Set<string>) => void;

  // Filters
  filters: KnowledgeFilters;
  setFilters: (filters: KnowledgeFilters) => void;

  // Loading states
  loading: boolean;
  setLoading: (loading: boolean) => void;

  // Statistics
  statistics: KnowledgeStatsResponse | null;
  setStatistics: (stats: KnowledgeStatsResponse | null) => void;

  // Upload progress
  uploadProgress: number;
  setUploadProgress: (progress: number) => void;

  // Toggle selection
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
}

const KnowledgeContext = createContext<KnowledgeContextType | undefined>(undefined);

interface KnowledgeProviderProps {
  children: ReactNode;
}

export function KnowledgeProvider({ children }: KnowledgeProviderProps) {
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeEntry[]>([]);
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeEntry | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<KnowledgeFilters>({});
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<KnowledgeStatsResponse | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const toggleSelection = useCallback((id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelectedItems(new Set(knowledgeList.map(entry => entry.id)));
  }, [knowledgeList]);

  const value: KnowledgeContextType = {
    knowledgeList,
    setKnowledgeList,
    selectedKnowledge,
    setSelectedKnowledge,
    selectedItems,
    setSelectedItems,
    filters,
    setFilters,
    loading,
    setLoading,
    statistics,
    setStatistics,
    uploadProgress,
    setUploadProgress,
    toggleSelection,
    clearSelection,
    selectAll
  };

  return (
    <KnowledgeContext.Provider value={value}>
      {children}
    </KnowledgeContext.Provider>
  );
}

export function useKnowledgeContext(): KnowledgeContextType {
  const context = useContext(KnowledgeContext);
  if (!context) {
    throw new Error('useKnowledgeContext must be used within KnowledgeProvider');
  }
  return context;
}
