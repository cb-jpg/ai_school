/**
 * Knowledge base drawer - main entry component
 */
import {
  Box,
  Button,
  DrawerRoot,
  DrawerBackdrop,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerActionTrigger,
  Tabs,
  HStack,
  Input,
  IconButton
} from '@chakra-ui/react';
import { FiBook, FiPlus, FiSearch, FiFilter, FiX } from 'react-icons/fi';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseButton } from '@/components/ui/close-button';
import { knowledgeStyles } from './knowledge-styles';
import KnowledgeList from './knowledge-list';
import KnowledgeUpload from './knowledge-upload';
import KnowledgeStats from './knowledge-stats';
import KnowledgeDetailDialog from './knowledge-detail-dialog';
import { useKnowledgeList } from '@/hooks/knowledge/use-knowledge-list';
import { useKnowledgeUpload } from '@/hooks/knowledge/use-knowledge-upload';
import { useKnowledgeStats } from '@/hooks/knowledge/use-knowledge-stats';
import { useKnowledgeDrawer as useDrawerState } from '@/hooks/knowledge/use-knowledge-drawer';
import { KnowledgeEntry } from '@/types/knowledge';

interface KnowledgeDrawerProps {
  children?: React.ReactNode;
}

function KnowledgeDrawer({ children }: KnowledgeDrawerProps) {
  const { t } = useTranslation();
  const { open, setOpen, activeTab, setActiveTab, handleClose } = useDrawerState();

  // List management
  const {
    knowledgeList,
    loading,
    selectedItems,
    fetchKnowledgeList,
    updateFilters,
    deleteKnowledge,
    bulkDelete,
    publishEntry,
    archiveEntry,
    toggleSelection,
    clearSelection,
    selectAll
  } = useKnowledgeList();

  // Upload management
  const { uploading, uploadProgress, uploadFile, addUrl, createManual } = useKnowledgeUpload();

  // Stats management
  const { statistics, loading: statsLoading } = useKnowledgeStats();

  // Detail dialog
  const [detailEntryId, setDetailEntryId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = useCallback(() => {
    updateFilters({ search: searchQuery });
  }, [searchQuery, updateFilters]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    updateFilters({ search: '' });
  }, [updateFilters]);

  const handleViewDetail = useCallback((entry: KnowledgeEntry) => {
    setDetailEntryId(entry.id);
    setDetailOpen(true);
  }, []);

  const handleEdit = useCallback((entry: KnowledgeEntry) => {
    // For now, just show detail - edit can be implemented later
    setDetailEntryId(entry.id);
    setDetailOpen(true);
  }, []);

  const handleDelete = useCallback(async (entryId: string) => {
    await deleteKnowledge(entryId);
  }, [deleteKnowledge]);

  const handlePublish = useCallback(async (entryId: string) => {
    await publishEntry(entryId);
  }, [publishEntry]);

  const handleArchive = useCallback(async (entryId: string) => {
    await archiveEntry(entryId);
  }, [archiveEntry]);

  return (
    <>
      {children && (
        <Box as="span" display="inline-flex" onClick={() => setOpen(true)}>
          {children}
        </Box>
      )}
      <DrawerRoot open={open} onOpenChange={(details) => !details.open && handleClose()}>
        <DrawerBackdrop />
        <DrawerContent style={knowledgeStyles.drawer.content}>
          <DrawerHeader>
            <HStack gap={3}>
              <FiBook />
              <DrawerTitle>{t('knowledge.title')}</DrawerTitle>
            </HStack>
            <CloseButton onClick={handleClose} style={knowledgeStyles.drawer.closeButton} />
          </DrawerHeader>

          <DrawerBody>
            {/* Tabs */}
            <Tabs.Root
              value={activeTab}
              onValueChange={(details) => setActiveTab(details.value as any)}
              {...knowledgeStyles.tabs.root}
            >
              <Tabs.List {...knowledgeStyles.tabs.list}>
                <Tabs.Trigger value="list" {...knowledgeStyles.tabs.trigger}>
                  {t('knowledge.tabs.list')}
                </Tabs.Trigger>
                <Tabs.Trigger value="upload" {...knowledgeStyles.tabs.trigger}>
                  {t('knowledge.tabs.upload')}
                </Tabs.Trigger>
                <Tabs.Trigger value="statistics" {...knowledgeStyles.tabs.trigger}>
                  {t('knowledge.tabs.statistics')}
                </Tabs.Trigger>
              </Tabs.List>

              {/* List tab */}
              <Tabs.Content value="list" {...knowledgeStyles.tabs.content}>
                {/* Toolbar */}
                <Box {...knowledgeStyles.toolbar.container}>
                  <HStack {...knowledgeStyles.toolbar.search} gap={2}>
                    <Input
                      placeholder={t('knowledge.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <IconButton
                      aria-label={t('knowledge.search')}
                      variant="ghost"
                      onClick={handleSearch}
                    >
                      <FiSearch />
                    </IconButton>
                    {searchQuery && (
                      <IconButton
                        aria-label={t('common.clear')}
                        variant="ghost"
                        onClick={handleClearSearch}
                      >
                        <FiX />
                      </IconButton>
                    )}
                  </HStack>

                  <HStack {...knowledgeStyles.toolbar.filters}>
                    <Button
                      size="sm"
                      variant={showFilters ? 'solid' : 'outline'}
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <FiFilter />
                      {t('knowledge.filters')}
                    </Button>

                    {selectedItems.size > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        colorPalette="red"
                        onClick={bulkDelete}
                      >
                        {t('knowledge.deleteSelected', { count: selectedItems.size })}
                      </Button>
                    )}
                  </HStack>

                  <HStack {...knowledgeStyles.toolbar.actions}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={selectAll}
                    >
                      {t('knowledge.selectAll')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearSelection}
                    >
                      {t('knowledge.clearSelection')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setActiveTab('upload')}
                    >
                      <FiPlus />
                      {t('knowledge.add')}
                    </Button>
                  </HStack>
                </Box>

                {/* Filter options */}
                {showFilters && (
                  <HStack gap={2} mb={4} p={3} bg="gray.50" borderRadius="md">
                    {/* Filter controls can be added here */}
                  </HStack>
                )}

                {/* List */}
                <KnowledgeList
                  entries={knowledgeList}
                  loading={loading}
                  selectedItems={selectedItems}
                  onToggleSelect={toggleSelection}
                  onViewDetail={handleViewDetail}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onPublish={handlePublish}
                  onArchive={handleArchive}
                />
              </Tabs.Content>

              {/* Upload tab */}
              <Tabs.Content value="upload" {...knowledgeStyles.tabs.content}>
                <KnowledgeUpload
                  uploading={uploading}
                  uploadProgress={uploadProgress}
                  onFileUpload={uploadFile}
                  onUrlUpload={addUrl}
                  onManualCreate={createManual}
                />
              </Tabs.Content>

              {/* Statistics tab */}
              <Tabs.Content value="statistics" {...knowledgeStyles.tabs.content}>
                <KnowledgeStats statistics={statistics} loading={statsLoading} />
              </Tabs.Content>
            </Tabs.Root>
          </DrawerBody>

          <DrawerFooter>
            <DrawerActionTrigger asChild>
              <Button variant="outline">{t('common.close')}</Button>
            </DrawerActionTrigger>
          </DrawerFooter>
        </DrawerContent>
      </DrawerRoot>

      {/* Detail dialog */}
      <KnowledgeDetailDialog
        entryId={detailEntryId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdate={fetchKnowledgeList}
      />
    </>
  );
}

export default memo(KnowledgeDrawer);
