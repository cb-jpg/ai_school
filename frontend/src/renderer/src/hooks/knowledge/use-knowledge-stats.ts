/**
 * Hook for knowledge statistics
 */
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useKnowledgeContext } from '@/context/knowledge-context';
import { useKnowledgeAPI } from '@/services/knowledge-api';
import { toaster } from '@/components/ui/toaster';

export function useKnowledgeStats() {
  const { t } = useTranslation();
  const { statistics, setStatistics, loading, setLoading } = useKnowledgeContext();
  const { fetchStats } = useKnowledgeAPI();

  // Fetch statistics
  const fetchStatistics = useCallback(async () => {
    setLoading(true);
    try {
      const stats = await fetchStats();
      setStatistics(stats);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      toaster.create({
        title: t('knowledge.error.statsFailed'),
        type: 'error',
        duration: 3000
      });
    } finally {
      setLoading(false);
    }
  }, [fetchStats, setStatistics, setLoading, t]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  return {
    statistics,
    loading,
    fetchStatistics
  };
}
