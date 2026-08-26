/**
 * Knowledge statistics component
 */
import { Box, Text, VStack, HStack } from '@chakra-ui/react';
import { FiDatabase, FiFileText, FiAlertCircle, FiTrendingUp } from 'react-icons/fi';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { knowledgeStyles } from './knowledge-styles';
import { KnowledgeStatsResponse } from '@/types/knowledge';

interface KnowledgeStatsProps {
  statistics: KnowledgeStatsResponse | null;
  loading: boolean;
}

const StatCard = memo(({
  icon: Icon,
  value,
  label,
  color
}: {
  icon: any;
  value: number | string;
  label: string;
  color: string;
}) => (
  <Box {...knowledgeStyles.stats.card}>
    <HStack justify="space-between" mb={2}>
      <Icon size={20} color={color} />
      <Text {...knowledgeStyles.stats.statValue}>{value}</Text>
    </HStack>
    <Text {...knowledgeStyles.stats.statLabel}>{label}</Text>
  </Box>
));

StatCard.displayName = 'StatCard';

function KnowledgeStats({ statistics, loading }: KnowledgeStatsProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={12}>
        <Text color="whiteAlpha.500">{t('knowledge.stats.loading')}</Text>
      </Box>
    );
  }

  if (!statistics) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={12}>
        <Text color="whiteAlpha.500">{t('knowledge.stats.noData')}</Text>
      </Box>
    );
  }

  return (
    <Box {...knowledgeStyles.stats.container}>
      {/* Overview stats */}
      <Box {...knowledgeStyles.stats.cards}>
        <StatCard
          icon={FiDatabase}
          value={statistics.total_entries}
          label={t('knowledge.stats.totalEntries')}
          color="blue.500"
        />
        <StatCard
          icon={FiFileText}
          value={statistics.published_entries}
          label={t('knowledge.stats.published')}
          color="green.500"
        />
        <StatCard
          icon={FiAlertCircle}
          value={statistics.error_entries}
          label={t('knowledge.stats.errors')}
          color="red.500"
        />
        <StatCard
          icon={FiTrendingUp}
          value={statistics.total_chunks}
          label={t('knowledge.stats.totalChunks')}
          color="purple.500"
        />
      </Box>

      {/* Category distribution */}
      <Box {...knowledgeStyles.stats.section}>
        <Text {...knowledgeStyles.stats.sectionTitle}>
          {t('knowledge.stats.byCategory')}
        </Text>
        <VStack gap={3} align="stretch">
          {Object.entries(statistics.category_counts).map(([cat, count]) => (
            <Box key={cat}>
              <HStack justify="space-between" mb={1}>
                <Text color="white" fontSize="sm">{t(`knowledge.category.${cat}`)}</Text>
                <Text color="whiteAlpha.600" fontSize="sm">{count}</Text>
              </HStack>
              <Box width="100%" height="6px" borderRadius="3px" overflow="hidden" bg="rgba(255,255,255,0.15)">
                <Box
                  width={`${Math.round((count / statistics.total_entries) * 100)}%`}
                  height="100%"
                  bg="#3182ce"
                />
              </Box>
            </Box>
          ))}
        </VStack>
      </Box>

      {/* Unanswered questions */}
      {statistics.recent_unanswered.length > 0 && (
        <Box {...knowledgeStyles.stats.section}>
          <Text {...knowledgeStyles.stats.sectionTitle}>
            {t('knowledge.stats.unanswered')}
          </Text>
          <VStack {...knowledgeStyles.stats.questionList}>
            {statistics.recent_unanswered.map(q => (
              <Box key={q.id} {...knowledgeStyles.stats.questionItem}>
                <Text color="white" fontSize="sm">{q.question}</Text>
                <Text color="whiteAlpha.500" fontSize="xs">
                  {q.count}x
                </Text>
              </Box>
            ))}
          </VStack>
        </Box>
      )}

      {/* Low confidence questions */}
      {statistics.low_confidence_questions.length > 0 && (
        <Box {...knowledgeStyles.stats.section}>
          <Text {...knowledgeStyles.stats.sectionTitle}>
            {t('knowledge.stats.lowConfidence')}
          </Text>
          <VStack {...knowledgeStyles.stats.questionList}>
            {statistics.low_confidence_questions.map(q => (
              <Box key={q.id} {...knowledgeStyles.stats.questionItem}>
                <Text color="white" fontSize="sm">{q.question}</Text>
                <HStack gap={2}>
                  <Text color="yellow.500" fontSize="xs">
                    {(q.confidence_score * 100).toFixed(0)}%
                  </Text>
                  <Text color="whiteAlpha.500" fontSize="xs">
                    {q.retrieval_count}x
                  </Text>
                </HStack>
              </Box>
            ))}
          </VStack>
        </Box>
      )}
    </Box>
  );
}

export default KnowledgeStats;
