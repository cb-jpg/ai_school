/**
 * Knowledge Dashboard Component
 * Shows statistics and overview of the knowledge base
 */

import {
  Box,
  SimpleGrid,
  Text,
  Flex,
  HStack,
  VStack,
  Spinner,
  createToaster
} from '@chakra-ui/react';
import {
  FiFileText,
  FiDatabase,
  FiFolder,
  FiClock,
  FiTrendingUp
} from 'react-icons/fi';
import { useEffect, useState } from 'react';
import { useKnowledgeAdminAPI, type Statistics } from '@/services/knowledge-admin-api';

const toaster = createToaster({
  placement: 'top-end',
  overlap: true,
  max: 3
});

const swissFont = '"Helvetica Neue", Arial, sans-serif';
const ink = '#121826';
const muted = '#586174';
const hairline = '#D9DEE8';
const paper = '#FFFFFF';
const blue = '#002FA7';
const blueWash = '#E8EEFF';
const green = '#047857';
const greenWash = '#D1FAE5';
const amber = '#B45309';
const amberWash = '#FEF3C7';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: typeof FiFileText;
  color: string;
  bgColor: string;
}

function StatCard({ label, value, icon: Icon, color, bgColor }: StatCardProps) {
  return (
    <Box
      p="16px"
      background={paper}
      border="1px solid"
      borderColor={hairline}
      borderRadius="4px"
    >
      <Flex align="center" gap="12px">
        <Box width="40px" height="40px" background={bgColor} color={color} display="grid" placeItems="center" borderRadius="4px">
          <Icon size="20px" />
        </Box>
        <Box flex="1">
          <Text color={muted} fontSize="11px" fontWeight="600" lineHeight="1.3">
            {label}
          </Text>
          <Text
            mt="4px"
            color={ink}
            fontSize="24px"
            lineHeight="1"
            fontWeight="700"
            fontVariantNumeric="tabular-nums"
          >
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Text>
        </Box>
      </Flex>
    </Box>
  );
}

interface CategoryItemProps {
  name: string;
  count: number;
  total: number;
  index: number;
}

function CategoryItem({ name, count, total, index }: CategoryItemProps) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  const barWidth = `${percentage}%`;

  return (
    <Box
      py="10px"
      borderTop={index === 0 ? 'none' : '1px solid'}
      borderColor={hairline}
    >
      <Flex align="center" justify="space-between" mb="6px">
        <Text color={ink} fontSize="12px" fontWeight="600">
          {name}
        </Text>
        <HStack gap="8px">
          <Text color={muted} fontSize="11px" fontVariantNumeric="tabular-nums">
            {count.toLocaleString()}
          </Text>
          <Text color={blue} fontSize="11px" fontWeight="600" fontVariantNumeric="tabular-nums">
            {percentage}%
          </Text>
        </HStack>
      </Flex>
      <Box width="100%" height="6px" background={surface} borderRadius="3px" overflow="hidden">
        <Box
          width={barWidth}
          height="100%"
          background={blue}
          transition="width 0.3s ease"
        />
      </Box>
    </Box>
  );
}

export default function KnowledgeDashboard() {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getStatistics } = useKnowledgeAdminAPI();

  useEffect(() => {
    async function loadStatistics() {
      try {
        setLoading(true);
        setError(null);
        const response = await getStatistics();
        if (response.success) {
          setStatistics(response.statistics);
        } else {
          throw new Error('获取统计信息失败');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '未知错误';
        setError(errorMessage);
        toaster.create({
          title: '加载失败',
          description: errorMessage,
          status: 'error',
          duration: 3000,
          isClosable: true
        });
      } finally {
        setLoading(false);
      }
    }

    loadStatistics();
  }, [getStatistics]);

  if (loading) {
    return (
      <Box py="48px" display="flex" justifyContent="center" alignItems="center">
        <VStack gap="16px">
          <Spinner size="lg" color={blue} />
          <Text color={muted} fontSize="12px">加载统计数据...</Text>
        </VStack>
      </Box>
    );
  }

  if (error || !statistics) {
    return (
      <Box py="48px" px="24px" textAlign="center">
        <Text color={muted} fontSize="13px">
          {error || '无法加载统计数据'}
        </Text>
      </Box>
    );
  }

  // Calculate category distribution
  const categoryEntries = Object.entries(statistics.categories || {});
  const totalByCategory = categoryEntries.reduce((sum, [, count]) => sum + count, 0);
  const recentAdditions = statistics.recent_additions || 0;

  return (
    <VStack gap="20px" py="20px" align="stretch">
      {/* Key Statistics */}
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap="12px">
        <StatCard
          label="文档总数"
          value={statistics.total_documents || 0}
          icon={FiFileText}
          color={blue}
          bgColor={blueWash}
        />
        <StatCard
          label="知识块总数"
          value={statistics.total_chunks || 0}
          icon={FiDatabase}
          color={green}
          bgColor={greenWash}
        />
        <StatCard
          label="分类数量"
          value={categoryEntries.length}
          icon={FiFolder}
          color={amber}
          bgColor={amberWash}
        />
        <StatCard
          label="近期新增"
          value={recentAdditions}
          icon={FiTrendingUp}
          color={blue}
          bgColor={blueWash}
        />
      </SimpleGrid>

      {/* Category Distribution */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} gap="12px">
        <Box
          p="16px"
          background={paper}
          border="1px solid"
          borderColor={hairline}
          borderRadius="4px"
        >
          <Flex align="center" gap="8px" mb="12px">
            <FiFolder color={blue} />
            <Text color={ink} fontSize="13px" fontWeight="700">
              分类分布
            </Text>
          </Flex>
          {categoryEntries.length > 0 ? (
            <VStack align="stretch" gap="0">
              {categoryEntries
                .sort(([, a], [, b]) => b - a)
                .map(([name, count], index) => (
                  <CategoryItem
                    key={name}
                    name={name}
                    count={count}
                    total={totalByCategory}
                    index={index}
                  />
                ))}
            </VStack>
          ) : (
            <Text color={muted} fontSize="12px" py="20px" textAlign="center">
              暂无分类数据
            </Text>
          )}
        </Box>

        {/* System Status */}
        <Box
          p="16px"
          background={paper}
          border="1px solid"
          borderColor={hairline}
          borderRadius="4px"
        >
          <Flex align="center" gap="8px" mb="12px">
            <FiClock color={blue} />
            <Text color={ink} fontSize="13px" fontWeight="700">
              系统状态
            </Text>
          </Flex>
          <VStack align="stretch" gap="12px">
            <Flex justify="space-between" py="8px" borderBottom="1px solid" borderColor={hairline}>
              <Text color={muted} fontSize="12px">服务状态</Text>
              <HStack gap="6px">
                <Box width="8px" height="8px" background={green} borderRadius="50%" />
                <Text color={green} fontSize="12px" fontWeight="600">运行中</Text>
              </HStack>
            </Flex>
            <Flex justify="space-between" py="8px" borderBottom="1px solid" borderColor={hairline}>
              <Text color={muted} fontSize="12px">索引状态</Text>
              <Text color={blue} fontSize="12px" fontWeight="600">正常</Text>
            </Flex>
            <Flex justify="space-between" py="8px">
              <Text color={muted} fontSize="12px">最后更新</Text>
              <Text color={ink} fontSize="12px" fontVariantNumeric="tabular-nums">
                {new Date().toLocaleString('zh-CN')}
              </Text>
            </Flex>
          </VStack>
        </Box>
      </SimpleGrid>

      {/* Quick Tips */}
      <Box
        p="16px"
        background={blueWash}
        border="1px solid"
        borderColor={blue}
        borderRadius="4px"
      >
        <Flex align="flex-start" gap="12px">
          <Text color={blue} fontSize="20px" fontWeight="700" lineHeight="1">
            💡
          </Text>
          <Box flex="1">
            <Text color={ink} fontSize="12px" fontWeight="700" mb="6px">
              管理提示
            </Text>
            <VStack align="stretch" gap="4px">
              <Text color={muted} fontSize="11px" lineHeight="1.6">
                • 定期检查"未回答问题"页面，补充知识库内容
              </Text>
              <Text color={muted} fontSize="11px" lineHeight="1.6">
                • 上传新文档后，确认切分和向量化状态
              </Text>
              <Text color={muted} fontSize="11px" lineHeight="1.6">
                • 使用搜索功能测试知识库检索效果
              </Text>
            </VStack>
          </Box>
        </Flex>
      </Box>
    </VStack>
  );
}
