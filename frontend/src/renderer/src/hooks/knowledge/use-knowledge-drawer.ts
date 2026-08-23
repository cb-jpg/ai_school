/**
 * Hook for knowledge drawer state management
 */
import { useState, useCallback } from 'react';
import { useKnowledgeContext } from '@/context/knowledge-context';

export function useKnowledgeDrawer() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'upload' | 'statistics'>('list');

  const {
    clearSelection
  } = useKnowledgeContext();

  const handleOpen = useCallback(() => {
    setOpen(true);
    setActiveTab('list');
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    clearSelection();
  }, [clearSelection]);

  const switchTab = useCallback((tab: 'list' | 'upload' | 'statistics') => {
    setActiveTab(tab);
  }, []);

  return {
    open,
    setOpen,
    activeTab,
    setActiveTab: switchTab,
    handleOpen,
    handleClose
  };
}
