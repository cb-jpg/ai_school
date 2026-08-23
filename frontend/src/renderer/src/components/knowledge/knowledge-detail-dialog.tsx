/**
 * Knowledge detail dialog component
 */
import {
  Box,
  Text,
  Button,
  Dialog,
  VStack,
  HStack,
  Progress,
  Badge,
  Spinner
} from '@chakra-ui/react';
import { FiClock, FiTag, FiFileText, FiArchive, FiCheckCircle } from 'react-icons/fi';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { knowledgeStyles } from './knowledge-styles';
import { KnowledgeEntry, Chunk, CATEGORY_LABELS, STATUS_LABELS } from '@/types/knowledge';
import { useKnowledgeAPI } from '@/services/knowledge-api';

interface KnowledgeDetailDialogProps {
  entryId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

function KnowledgeDetailDialog({
  entryId,
  open,
  onClose,
  onUpdate
}: KnowledgeDetailDialogProps) {
  const { t } = useTranslation();
  const { fetchDetail, reindex } = useKnowledgeAPI();

  const [loading, setLoading] = useState(false);
  const [entry, setEntry] = useState<KnowledgeEntry | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);

  useEffect(() => {
    if (open && entryId) {
      loadDetail();
    }
  }, [open, entryId]);

  const loadDetail = async () => {
    if (!entryId) return;

    setLoading(true);
    try {
      const data = await fetchDetail(entryId);
      setEntry(data);
      setChunks(data.chunks || []);
    } catch (error) {
      console.error('Error loading detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReindex = async () => {
    if (!entryId) return;

    try {
      await reindex(entryId);
      await loadDetail();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error reindexing:', error);
    }
  };

  if (!entryId) return null;

  return (
    <DialogRoot open={open} onOpenChange={(details) => !details.open && onClose()}>
      <DialogBackdrop />
      <DialogContent>
        <DialogCloseTrigger />

        {loading ? (
          <Box p={8} textAlign="center">
            <Spinner size="lg" />
          </Box>
        ) : entry ? (
          <VStack gap={4} align="stretch">
            {/* Header */}
            <DialogHeader>
              <DialogTitle>{entry.title}</DialogTitle>
            </DialogHeader>

            {/* Metadata */}
            <VStack gap={3} align="stretch">
              <HStack gap={4} flexWrap="wrap">
                <HStack gap={2}>
                  <FiTag color="whiteAlpha.500" />
                  <Text color="whiteAlpha.700" fontSize="sm">
                    {t('knowledge.category')}:
                  </Text>
                  <Badge>{CATEGORY_LABELS[entry.category]}</Badge>
                </HStack>

                <HStack gap={2}>
                  <FiFileText color="whiteAlpha.500" />
                  <Text color="whiteAlpha.700" fontSize="sm">
                    {t('knowledge.status')}:
                  </Text>
                  <Badge colorPalette={entry.status === 'published' ? 'green' : 'yellow'}>
                    {STATUS_LABELS[entry.status]}
                  </Badge>
                </HStack>

                <HStack gap={2}>
                  <FiClock color="whiteAlpha.500" />
                  <Text color="whiteAlpha.700" fontSize="sm">
                    {t('knowledge.updated')}:
                  </Text>
                  <Text color="whiteAlpha.500" fontSize="sm">
                    {new Date(entry.updated_at).toLocaleString()}
                  </Text>
                </HStack>
              </HStack>

              {/* Source info */}
              {entry.source_url && (
                <Box>
                  <Text color="whiteAlpha.700" fontSize="sm" mb={1}>
                    {t('knowledge.sourceUrl')}:
                  </Text>
                  <Text color="blue.300" fontSize="sm" wordBreak="break-all">
                    {entry.source_url}
                  </Text>
                </Box>
              )}

              {entry.file_name && (
                <Box>
                  <Text color="whiteAlpha.700" fontSize="sm" mb={1}>
                    {t('knowledge.fileName')}:
                  </Text>
                  <Text color="whiteAlpha.500" fontSize="sm">
                    {entry.file_name}
                  </Text>
                </Box>
              )}

              {/* Tags */}
              {entry.tags.length > 0 && (
                <HStack gap={2} flexWrap="wrap">
                  {entry.tags.map(tag => (
                    <Badge key={tag} variant="outline">
                      #{tag}
                    </Badge>
                  ))}
                </HStack>
              )}

              {/* Summary */}
              {entry.summary && (
                <Box>
                  <Text color="whiteAlpha.700" fontSize="sm" mb={1}>
                    {t('knowledge.summary')}:
                  </Text>
                  <Text color="whiteAlpha.500" fontSize="sm">
                    {entry.summary}
                  </Text>
                </Box>
              )}

              {/* Chunk count */}
              <Box>
                <HStack justify="space-between" mb={1}>
                  <Text color="whiteAlpha.700" fontSize="sm">
                    {t('knowledge.chunkCount')}:
                  </Text>
                  <Text color="white" fontSize="sm" fontWeight="semibold">
                    {entry.chunk_count}
                  </Text>
                </HStack>
                {entry.chunk_count > 0 && (
                  <Progress
                    value={entry.status === 'error' ? 0 : 100}
                    colorPalette={entry.status === 'published' ? 'green' : 'blue'}
                    size="sm"
                  />
                )}
              </Box>

              {/* Error message */}
              {entry.status === 'error' && entry.error_message && (
                <Box p={3} bg="red.500" bgOpacity={0.1} borderRadius="md">
                  <Text color="red.300" fontSize="sm">
                    {entry.error_message}
                  </Text>
                </Box>
              )}
            </VStack>

            {/* Chunks */}
            {chunks.length > 0 && (
              <Box>
                <Text color="white" fontSize="md" fontWeight="semibold" mb={2}>
                  {t('knowledge.chunks')}
                </Text>
                <VStack gap={2} maxH="200px" overflowY="auto">
                  {chunks.slice(0, 5).map((chunk, index) => (
                    <Box
                      key={chunk.id}
                      p={3}
                      bg="whiteAlpha.50"
                      borderRadius="md"
                      borderLeft="2px solid"
                      borderLeftColor="blue.500"
                    >
                      <Text color="whiteAlpha.500" fontSize="xs" mb={1}>
                        {t('knowledge.chunk', { number: index + 1 })}
                      </Text>
                      <Text color="whiteAlpha.700" fontSize="sm" noOfLines={2}>
                        {chunk.content}
                      </Text>
                    </Box>
                  ))}
                  {chunks.length > 5 && (
                    <Text color="whiteAlpha.500" fontSize="xs" textAlign="center">
                      {t('knowledge.moreChunks', { count: chunks.length - 5 })}
                    </Text>
                  )}
                </VStack>
              </Box>
            )}

            {/* Actions */}
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                {t('common.close')}
              </Button>
              {entry.status !== 'error' && (
                <Button
                  leftIcon={<FiFileText />}
                  onClick={handleReindex}
                >
                  {t('knowledge.reindex')}
                </Button>
              )}
            </DialogFooter>
          </VStack>
        ) : null}
      </DialogContent>
    </DialogRoot>
  );
}

export default KnowledgeDetailDialog;
