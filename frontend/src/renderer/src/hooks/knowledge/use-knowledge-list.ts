/**
 * Hook for knowledge list management
 */
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useKnowledgeContext } from '@/context/knowledge-context';
import { useKnowledgeAPI } from '@/services/knowledge-api';
import { toaster } from '@/components/ui/toaster';
import { KnowledgeFilters } from '@/types/knowledge';

export function useKnowledgeList() {
  const { t } = useTranslation();
  const {
    knowledgeList,
    setKnowledgeList,
    filters,
    setFilters,
    loading,
    setLoading,
    selectedItems,
    toggleSelection,
    clearSelection,
    selectAll
  } = useKnowledgeContext();

  const { fetchList, delete: deleteEntry, bulkOperation } = useKnowledgeAPI();

  // Fetch knowledge list
  const fetchKnowledgeList = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await fetchList(filters);
      setKnowledgeList(entries);
    } catch (error) {
      console.error('Error fetching knowledge list:', error);
      toaster.create({
        title: t('knowledge.error.fetchFailed'),
        type: 'error',
        duration: 3000
      });
    } finally {
      setLoading(false);
    }
  }, [fetchList, filters, setKnowledgeList, setLoading, t]);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<KnowledgeFilters>) => {
    setFilters({ ...filters, ...newFilters });
  }, [filters, setFilters]);

  // Delete single entry
  const deleteKnowledge = useCallback(async (entryId: string) => {
    try {
      await deleteEntry(entryId);
      await fetchKnowledgeList(); // Refresh list
      toaster.create({
        title: t('knowledge.success.delete'),
        type: 'success',
        duration: 2000
      });
    } catch (error) {
      console.error('Error deleting knowledge:', error);
      toaster.create({
        title: t('knowledge.error.deleteFailed'),
        type: 'error',
        duration: 3000
      });
    }
  }, [deleteEntry, fetchKnowledgeList, t]);

  // Bulk delete
  const bulkDelete = useCallback(async () => {
    if (selectedItems.size === 0) return;

    try {
      const result = await bulkOperation(Array.from(selectedItems), 'delete');
      await fetchKnowledgeList(); // Refresh list
      clearSelection();
      toaster.create({
        title: t('knowledge.success.bulkDelete', { count: Object.values(result.results).filter(Boolean).length }),
        type: 'success',
        duration: 2000
      });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      toaster.create({
        title: t('knowledge.error.bulkDeleteFailed'),
        type: 'error',
        duration: 3000
      });
    }
  }, [selectedItems, bulkOperation, fetchKnowledgeList, clearSelection, t]);

  // Publish entry
  const publishEntry = useCallback(async (entryId: string) => {
    try {
      await bulkOperation([entryId], 'publish');
      await fetchKnowledgeList();
      toaster.create({
        title: t('knowledge.success.publish'),
        type: 'success',
        duration: 2000
      });
    } catch (error) {
      console.error('Error publishing entry:', error);
      toaster.create({
        title: t('knowledge.error.publishFailed'),
        type: 'error',
        duration: 3000
      });
    }
  }, [bulkOperation, fetchKnowledgeList, t]);

  // Archive entry
  const archiveEntry = useCallback(async (entryId: string) => {
    try {
      await bulkOperation([entryId], 'archive');
      await fetchKnowledgeList();
      toaster.create({
        title: t('knowledge.success.archive'),
        type: 'success',
        duration: 2000
      });
    } catch (error) {
      console.error('Error archiving entry:', error);
      toaster.create({
        title: t('knowledge.error.archiveFailed'),
        type: 'error',
        duration: 3000
      });
    }
  }, [bulkOperation, fetchKnowledgeList, t]);

  // Refresh list when filters change
  useEffect(() => {
    fetchKnowledgeList();
  }, [filters.category, filters.status, filters.include_archived]);
  // Don't refresh on search change (wait for user to submit)

  return {
    // State
    knowledgeList,
    filters,
    loading,
    selectedItems,

    // Actions
    fetchKnowledgeList,
    updateFilters,
    deleteKnowledge,
    bulkDelete,
    publishEntry,
    archiveEntry,
    toggleSelection,
    clearSelection,
    selectAll
  };
}
