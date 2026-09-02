/**
 * 文档知识库页面
 * 查看知识条目的文档切分结果与向量化状态：
 * - 左侧：文档列表（支持按来源筛选与搜索）
 * - 右侧：选中文档的向量化状态概览（状态/块数/模型/更新时间/错误信息）与逐块切分内容
 */

import { FC, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Badge,
  Input,
  Accordion,
} from '@chakra-ui/react';
import {
  FiDatabase,
  FiFile,
  FiGlobe,
  FiEdit3,
  FiImage,
  FiRefreshCw,
} from 'react-icons/fi';
import { toaster } from '@/components/ui/toaster';
import {
  listKnowledgeEntries,
  getKnowledgeDetail,
  reindexEntry,
  type KnowledgeDetailRaw,
  type KnowledgeEntryStatus,
  type KnowledgeListItemRaw,
  type KnowledgeSourceType,
} from '@/services/knowledge-admin-api';

const colors = {
  primary: '#1a4d8f',
  primaryLight: '#2d6ab3',
  accent: '#e8f0fe',
  gray50: '#f8fafc',
  gray100: '#f1f5f9',
  gray200: '#e2e8f0',
  gray400: '#a0aec0',
  gray600: '#475569',
  gray800: '#1e293b',
};

const STATUS_META: Record<KnowledgeEntryStatus, { label: string; color: string }> = {
  processing: { label: '待向量化', color: '#d97706' },
  indexed: { label: '已向量化', color: '#059669' },
  published: { label: '已发布', color: '#2563eb' },
  archived: { label: '已归档', color: '#64748b' },
  error: { label: '向量化失败', color: '#dc2626' },
};

const SOURCE_META: Record<KnowledgeSourceType, { label: string; icon: typeof FiFile }> = {
  file: { label: '文件上传', icon: FiFile },
  url: { label: '网页抓取', icon: FiGlobe },
  manual: { label: '手动录入', icon: FiEdit3 },
  ocr: { label: '图片识别', icon: FiImage },
};

const SOURCE_FILTERS: Array<{ value: KnowledgeSourceType | 'all'; label: string }> = [
  { value: 'all', label: '全部来源' },
  { value: 'file', label: '文件上传' },
  { value: 'url', label: '网页抓取' },
  { value: 'manual', label: '手动录入' },
  { value: 'ocr', label: '图片识别' },
];

const EMBEDDING_MODEL_LABEL = 'paraphrase-multilingual-MiniLM-L12-v2（384 维）';

function formatDate(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '-' : d.toLocaleString('zh-CN', { hour12: false });
}

export const DocumentKnowledge: FC = () => {
  const [entries, setEntries] = useState<KnowledgeListItemRaw[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [sourceFilter, setSourceFilter] = useState<KnowledgeSourceType | 'all'>('all');
  const [keyword, setKeyword] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<KnowledgeDetailRaw | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reindexing, setReindexing] = useState(false);

  const loadList = async (): Promise<void> => {
    setListLoading(true);
    setListError(null);
    try {
      const list = await listKnowledgeEntries();
      setEntries(list);
    } catch (e) {
      setEntries([]);
      setListError(e instanceof Error ? e.message : String(e));
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    void loadList();
  }, []);

  // 首次加载完成后自动选中第一条，避免右侧空白
  useEffect(() => {
    if (!selectedId && entries.length > 0) {
      setSelectedId(entries[0].id);
    }
  }, [entries, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    getKnowledgeDetail(selectedId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setDetail(null);
          toaster.create({
            title: '读取切分详情失败',
            description: e instanceof Error ? e.message : String(e),
            type: 'error',
            duration: 3000,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filteredEntries = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return entries.filter((item) => {
      if (sourceFilter !== 'all' && item.source_type !== sourceFilter) return false;
      if (kw && !`${item.title}${item.file_name ?? ''}`.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [entries, sourceFilter, keyword]);

  const handleReindex = async (): Promise<void> => {
    if (!detail) return;
    setReindexing(true);
    try {
      await reindexEntry(detail.id);
      toaster.create({
        title: '已重建该文档的向量索引',
        type: 'success',
        duration: 2500,
      });
      const data = await getKnowledgeDetail(detail.id);
      setDetail(data);
      void loadList();
    } catch (e) {
      toaster.create({
        title: '重建索引失败',
        description: e instanceof Error ? e.message : String(e),
        type: 'error',
        duration: 3500,
      });
    } finally {
      setReindexing(false);
    }
  };

  return (
    <Box
      width="full"
      height="full"
      display="flex"
      flexDirection={{ base: 'column', md: 'row' }}
      gap="6"
      p={{ base: '4', md: '6' }}
      overflow={{ base: 'auto', md: 'hidden' }}
    >
      {/* 左侧：文档列表（手机端固定高度让内部滚动生效；maxHeight 不约束
          flex 子项高度，会被内容撑开导致 overflow:hidden 裁切且无法滚动） */}
      <Box
        width={{ base: 'full', md: '360px' }}
        flexShrink={0}
        height={{ base: '60vh', md: 'auto' }}
        bg="white"
        rounded="xl"
        border="1px solid"
        borderColor={colors.gray200}
        display="flex"
        flexDirection="column"
        overflow="hidden"
      >
        <Box p="4" borderBottom="1px solid" borderColor={colors.gray200}>
          <HStack justify="space-between" mb="3" flexWrap="wrap" rowGap="2">
            <HStack gap="2">
              <Box
                width="26px"
                height="26px"
                bg={colors.accent}
                color={colors.primary}
                display="grid"
                placeItems="center"
                rounded="md"
              >
                <FiDatabase size="14" />
              </Box>
              <Text fontSize="sm" fontWeight="semibold" color={colors.gray800}>
                文档列表（{filteredEntries.length}）
              </Text>
            </HStack>
            <Button size="xs" variant="ghost" flexShrink={0} onClick={() => void loadList()}>
              <FiRefreshCw />
              刷新
            </Button>
          </HStack>
          <VStack gap="2" align="stretch">
            <Input
              size="sm"
              placeholder="搜索标题或文件名"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <HStack gap="1" flexWrap="wrap">
              {SOURCE_FILTERS.map((f) => (
                <Badge
                  key={f.value}
                  as="button"
                  cursor="pointer"
                  px="2"
                  py="0.5"
                  rounded="md"
                  fontSize="10px"
                  bg={sourceFilter === f.value ? colors.primary : colors.gray100}
                  color={sourceFilter === f.value ? 'white' : colors.gray600}
                  _hover={{ opacity: 0.85 }}
                  onClick={() => setSourceFilter(f.value)}
                >
                  {f.label}
                </Badge>
              ))}
            </HStack>
          </VStack>
        </Box>

        <Box flex="1" overflowY="auto">
          {listLoading && (
            <Text fontSize="xs" color={colors.gray600} p="4">
              正在加载文档列表…
            </Text>
          )}
          {listError && !listLoading && (
            <Box p="4">
              <Text fontSize="xs" color="#C53030">
                加载失败：{listError}
              </Text>
              <Button size="xs" mt="2" onClick={() => void loadList()}>
                重试
              </Button>
            </Box>
          )}
          {!listLoading && !listError && filteredEntries.length === 0 && (
            <Text fontSize="xs" color={colors.gray600} p="4">
              暂无匹配的文档。可通过上方"完整知识库管理"页面上传文件或抓取网页。
            </Text>
          )}
          {filteredEntries.map((entry) => {
            const meta = STATUS_META[entry.status] ?? STATUS_META.processing;
            const srcMeta = SOURCE_META[entry.source_type] ?? SOURCE_META.manual;
            const selected = selectedId === entry.id;
            return (
              <Box
                key={entry.id}
                p="3"
                borderBottom="1px solid"
                borderColor={colors.gray100}
                cursor="pointer"
                bg={selected ? colors.accent : 'transparent'}
                borderLeft="3px solid"
                borderLeftColor={selected ? colors.primary : 'transparent'}
                onClick={() => setSelectedId(entry.id)}
                _hover={{ bg: selected ? colors.accent : colors.gray50 }}
              >
                <VStack align="stretch" gap="1">
                  <HStack gap="2">
                    <srcMeta.icon size="12" color={colors.gray600} />
                    <Text fontSize="sm" fontWeight="medium" color={colors.gray800} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" flex="1">
                      {entry.title}
                    </Text>
                  </HStack>
                  <HStack gap="2" justify="space-between">
                    <HStack gap="1">
                      <Badge fontSize="9px" px="1.5" py="0.5" bg={colors.gray100} color={colors.gray600}>
                        {srcMeta.label}
                      </Badge>
                      <Badge fontSize="9px" px="1.5" py="0.5" bg={`${meta.color}1a`} color={meta.color}>
                        {meta.label}
                      </Badge>
                    </HStack>
                    <Text fontSize="2xs" color={colors.gray400}>
                      {entry.chunk_count} 块
                    </Text>
                  </HStack>
                </VStack>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* 右侧：向量化状态 + 切分结果（手机端自然高度、随外层整页滚动；
          flex=1+overflow:hidden 会把切分结果压没且无法滑动） */}
      <Box
        flex={{ base: 'none', md: '1' }}
        bg="white"
        rounded="xl"
        border="1px solid"
        borderColor={colors.gray200}
        display="flex"
        flexDirection="column"
        overflow={{ base: 'visible', md: 'hidden' }}
      >
        {detailLoading && !detail && (
          <Text fontSize="sm" color={colors.gray600} p="6">
            正在加载文档详情…
          </Text>
        )}

        {!detailLoading && !detail && (
          <VStack flex="1" align="center" justify="center" gap="2" p="6">
            <FiDatabase size="28" color={colors.gray400} />
            <Text fontSize="sm" color={colors.gray600} textAlign="center">
              选择一个文档查看切分结果与向量化状态
            </Text>
          </VStack>
        )}

        {detail && (
          <>
            <Box p="5" borderBottom="1px solid" borderColor={colors.gray200}>
              <HStack justify="space-between" mb="4" flexWrap="wrap" rowGap="2" align="flex-start">
                <VStack align="start" gap="0" maxWidth="100%">
                  <Text fontSize="lg" fontWeight="semibold" color={colors.gray800}>
                    {detail.title}
                  </Text>
                  {(detail.file_name || detail.source_url) && (
                    <Text fontSize="2xs" color={colors.gray400} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" maxW="full">
                      {detail.file_name || detail.source_url}
                    </Text>
                  )}
                </VStack>
                <Button
                  size="sm"
                  bg={colors.primary}
                  color="white"
                  _hover={{ bg: colors.primaryLight }}
                  disabled={reindexing}
                  loading={reindexing}
                  loadingText="重建中…"
                  flexShrink={0}
                  onClick={() => void handleReindex()}
                >
                  <FiRefreshCw />
                  重建向量索引
                </Button>
              </HStack>

              {/* 向量化状态 */}
              <VStack align="stretch" gap="3">
                <HStack gap="6" flexWrap="wrap" rowGap="2">
                  <StatBlock label="向量化状态">
                    <Badge bg={`${STATUS_META[detail.status]?.color ?? '#d97706'}1a`} color={STATUS_META[detail.status]?.color ?? '#d97706'} px="2" py="0.5" rounded="md" fontSize="11px">
                      {STATUS_META[detail.status]?.label ?? detail.status}
                    </Badge>
                  </StatBlock>
                  <StatBlock label="切分块数">
                    <Text fontSize="sm" fontWeight="semibold" color={colors.gray800}>
                      {detail.chunk_count} 块
                    </Text>
                  </StatBlock>
                  <StatBlock label="向量模型">
                    <Text fontSize="sm" color={colors.gray800}>
                      {EMBEDDING_MODEL_LABEL}
                    </Text>
                  </StatBlock>
                  <StatBlock label="最近更新">
                    <Text fontSize="sm" color={colors.gray800}>
                      {formatDate(detail.updated_at)}
                    </Text>
                  </StatBlock>
                </HStack>

                {detail.summary && (
                  <Text fontSize="xs" color={colors.gray600}>
                    摘要：{detail.summary}
                  </Text>
                )}

                {detail.error_message && (
                  <Box bg="#FFF5F5" border="1px solid #FED7D7" rounded="md" p="3">
                    <Text fontSize="xs" color="#C53030">
                      处理失败原因：{detail.error_message}
                    </Text>
                  </Box>
                )}
              </VStack>
            </Box>

            {/* 切分结果 */}
            <Box
              flex={{ base: 'none', md: '1' }}
              overflowY={{ base: 'visible', md: 'auto' }}
              p={{ base: '4', md: '5' }}
            >
              <Text fontSize="sm" fontWeight="semibold" color={colors.gray800} mb="3">
                切分结果（{detail.chunks.length} 块）
              </Text>

              {detail.chunks.length === 0 ? (
                <Text fontSize="xs" color={colors.gray600}>
                  该文档还没有生成切分块。可尝试点击右上角"重建向量索引"；若状态为失败，请检查 error 信息。
                </Text>
              ) : (
                <Accordion.Root collapsible defaultValue={['chunk-0']}>
                  {detail.chunks.map((chunk) => (
                    <Accordion.Item key={chunk.id} value={`chunk-${chunk.chunk_index}`} borderWidth="1px" borderColor={colors.gray200} rounded="md" mb="2">
                      <Accordion.ItemTrigger py="2" px="3">
                        <HStack gap="2" flex="1">
                          <Text fontSize="xs" fontWeight="medium" color={colors.primary}>
                            块 {chunk.chunk_index + 1}
                          </Text>
                          <Text fontSize="2xs" color={colors.gray400}>
                            {chunk.content.length} 字 · ID {chunk.id.slice(0, 8)}
                          </Text>
                        </HStack>
                        <Accordion.ItemIndicator />
                      </Accordion.ItemTrigger>
                      <Accordion.ItemContent pb="3" px="3">
                        <Box
                          as="pre"
                          whiteSpace="pre-wrap"
                          fontFamily="'Segoe UI', sans-serif"
                          fontSize="xs"
                          lineHeight="1.7"
                          color={colors.gray800}
                          m="0"
                          p="2"
                          bg={colors.gray50}
                          rounded="md"
                          maxHeight={{ base: 'none', md: '300px' }}
                          overflowY={{ base: 'visible', md: 'auto' }}
                        >
                          {chunk.content}
                        </Box>
                      </Accordion.ItemContent>
                    </Accordion.Item>
                  ))}
                </Accordion.Root>
              )}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

function StatBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Text fontSize="2xs" color={colors.gray400} mb="0.5">
        {label}
      </Text>
      {children}
    </Box>
  );
}
