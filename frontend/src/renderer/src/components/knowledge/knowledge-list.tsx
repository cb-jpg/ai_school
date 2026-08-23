/**
 * Knowledge list component
 */
import { Box, Text, IconButton, HStack, Badge, Spinner } from '@chakra-ui/react';
import { FiEdit2, FiTrash2, FiEye, FiArchive, FiCheckCircle } from 'react-icons/fi';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { knowledgeStyles } from './knowledge-styles';
import { KnowledgeEntry, STATUS_LABELS, STATUS_COLORS, CATEGORY_LABELS } from '@/types/knowledge';

interface KnowledgeListProps {
  entries: KnowledgeEntry[];
  loading: boolean;
  selectedItems: Set<string>;
  onToggleSelect: (id: string) => void;
  onViewDetail: (entry: KnowledgeEntry) => void;
  onEdit: (entry: KnowledgeEntry) => void;
  onDelete: (entryId: string) => void;
  onPublish?: (entryId: string) => void;
  onArchive?: (entryId: string) => void;
}

const KnowledgeCard = memo(({
  entry,
  isSelected,
  onSelect,
  onViewDetail,
  onEdit,
  onDelete,
  onPublish,
  onArchive
}: {
  entry: KnowledgeEntry;
  isSelected: boolean;
  onSelect: () => void;
  onViewDetail: (entry: KnowledgeEntry) => void;
  onEdit: (entry: KnowledgeEntry) => void;
  onDelete: (entryId: string) => void;
  onPublish?: (entryId: string) => void;
  onArchive?: (entryId: string) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Box
      {...knowledgeStyles.card.container}
      {...(isSelected ? knowledgeStyles.card.selected : {})}
    >
      <Box {...knowledgeStyles.card.header}>
        <Checkbox
          {...knowledgeStyles.card.checkbox}
          checked={isSelected}
          onChange={onSelect}
        />
        <Text {...knowledgeStyles.card.title}>{entry.title}</Text>
      </Box>

      <Box {...knowledgeStyles.card.meta}>
        <Badge {...knowledgeStyles.card.tag}>
          {CATEGORY_LABELS[entry.category]}
        </Badge>
        <Badge
          {...knowledgeStyles.card.status}
          colorPalette={STATUS_COLORS[entry.status] as any}
        >
          {STATUS_LABELS[entry.status]}
        </Badge>
        {entry.chunk_count > 0 && (
          <Text fontSize="xs" color="whiteAlpha.500">
            {entry.chunk_count} {t('knowledge.chunks')}
          </Text>
        )}
      </Box>

      {entry.summary && (
        <Text {...knowledgeStyles.card.summary}>
          {entry.summary}
        </Text>
      )}

      {entry.tags.length > 0 && (
        <HStack gap={1} flexWrap="wrap" mb={2}>
          {entry.tags.map(tag => (
            <Text key={tag} fontSize="xs" color="whiteAlpha.500">
              #{tag}
            </Text>
          ))}
        </HStack>
      )}

      <Box {...knowledgeStyles.card.footer}>
        <Text fontSize="xs" color="whiteAlpha.500">
          {new Date(entry.updated_at).toLocaleDateString()}
        </Text>
        <HStack {...knowledgeStyles.card.actions}>
          <IconButton
            aria-label={t('knowledge.viewDetail')}
            size="sm"
            variant="ghost"
            onClick={() => onViewDetail(entry)}
          >
            <FiEye />
          </IconButton>
          {onPublish && entry.status !== 'published' && (
            <IconButton
              aria-label={t('knowledge.publish')}
              size="sm"
              variant="ghost"
              colorPalette="green"
              onClick={() => onPublish(entry.id)}
            >
              <FiCheckCircle />
            </IconButton>
          )}
          {onArchive && entry.status !== 'archived' && (
            <IconButton
              aria-label={t('knowledge.archive')}
              size="sm"
              variant="ghost"
              colorPalette="yellow"
              onClick={() => onArchive(entry.id)}
            >
              <FiArchive />
            </IconButton>
          )}
          <IconButton
            aria-label={t('knowledge.edit')}
            size="sm"
            variant="ghost"
            onClick={() => onEdit(entry)}
          >
            <FiEdit2 />
          </IconButton>
          <IconButton
            aria-label={t('knowledge.delete')}
            size="sm"
            variant="ghost"
            colorPalette="red"
            onClick={() => onDelete(entry.id)}
          >
            <FiTrash2 />
          </IconButton>
        </HStack>
      </Box>
    </Box>
  );
});

KnowledgeCard.displayName = 'KnowledgeCard';

function KnowledgeList({
  entries,
  loading,
  selectedItems,
  onToggleSelect,
  onViewDetail,
  onEdit,
  onDelete,
  onPublish,
  onArchive
}: KnowledgeListProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={12}>
        <Spinner size="lg" color="blue.500" />
      </Box>
    );
  }

  if (entries.length === 0) {
    return (
      <Box {...knowledgeStyles.list.empty}>
        <Text fontSize="lg" mb={2}>{t('knowledge.noEntries')}</Text>
        <Text fontSize="sm">{t('knowledge.addFirstEntry')}</Text>
      </Box>
    );
  }

  return (
    <Box {...knowledgeStyles.list.container}>
      {entries.map(entry => (
        <KnowledgeCard
          key={entry.id}
          entry={entry}
          isSelected={selectedItems.has(entry.id)}
          onSelect={() => onToggleSelect(entry.id)}
          onViewDetail={onViewDetail}
          onEdit={onEdit}
          onDelete={onDelete}
          onPublish={onPublish}
          onArchive={onArchive}
        />
      ))}
    </Box>
  );
}

export default KnowledgeList;
