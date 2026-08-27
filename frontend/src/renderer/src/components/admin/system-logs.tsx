/**
 * 系统日志页面
 * - 概况卡片：知识库规模与未回答问题数（问答统计）
 * - 操作记录：知识库增删改/上传/重建索引的审计流水（功能点 §7 更新记录）
 * - 服务运行日志：logs/debug_*.log 尾部查看
 */

import { FC, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Badge,
  Tabs,
  Input,
} from '@chakra-ui/react';
import {
  FiDatabase,
  FiLayers,
  FiMessageSquare,
  FiRefreshCw,
  FiAlertTriangle,
  FiCheck,
} from 'react-icons/fi';
import { toaster } from '@/components/ui/toaster';
import {
  fetchKnowledgeStats,
  fetchAuditEntries,
  fetchServiceLog,
  AUDIT_ACTION_LABELS,
  type AuditEntry,
  type KnowledgeStats,
} from '@/services/system-logs-api';

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

function formatTs(ts: number): string {
  return new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false });
}

function formatBytes(size: number): string {
  if (size > 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size > 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${size} B`;
}

export const SystemLogs: FC = () => {
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  const [serviceLog, setServiceLog] = useState<string[]>([]);
  const [logMeta, setLogMeta] = useState<{ file: string; size: number } | null>(null);
  const [logLoading, setLogLoading] = useState(true);
  const [logKeyword, setLogKeyword] = useState('');

  const loadAll = async (): Promise<void> => {
    // 概况
    try {
      setStats(await fetchKnowledgeStats());
      setStatsError(null);
    } catch (e) {
      setStatsError(e instanceof Error ? e.message : String(e));
    }
    // 操作记录
    setAuditLoading(true);
    try {
      const data = await fetchAuditEntries({ limit: 300 });
      setAudit(data.entries);
      setAuditTotal(data.total);
    } catch (e) {
      setAudit([]);
      toaster.create({
        title: '读取操作记录失败',
        description: e instanceof Error ? e.message : String(e),
        type: 'error',
        duration: 3000,
      });
    } finally {
      setAuditLoading(false);
    }
    // 运行日志
    setLogLoading(true);
    try {
      const log = await fetchServiceLog(500);
      setServiceLog(log.lines);
      setLogMeta({ file: log.file, size: log.size });
    } catch (e) {
      setServiceLog([`[读取失败] ${e instanceof Error ? e.message : String(e)}`]);
      setLogMeta(null);
    } finally {
      setLogLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const filteredAudit = useMemo(() => {
    if (!actionFilter) return audit;
    return audit.filter((entry) => entry.action === actionFilter);
  }, [audit, actionFilter]);

  const filteredLogLines = useMemo(() => {
    const kw = logKeyword.trim().toLowerCase();
    if (!kw) return serviceLog;
    return serviceLog.filter((line) => line.toLowerCase().includes(kw));
  }, [serviceLog, logKeyword]);

  const hasUnreadableLog =
    serviceLog.length > 0 && serviceLog[0].startsWith('[读取失败]');

  return (
    <Box width="full" height="full" p="6" overflowY="auto">
      <HStack justify="space-between" mb="5">
        <VStack align="start" gap="0">
          <Text fontSize="lg" fontWeight="semibold" color={colors.gray800}>
            系统日志
          </Text>
          <Text fontSize="xs" color={colors.gray600}>
            知识库更新记录、问答概况与服务运行日志
          </Text>
        </VStack>
        <Button size="sm" variant="outline" onClick={() => void loadAll()}>
          <FiRefreshCw />
          全部刷新
        </Button>
      </HStack>

      {/* 概况卡片（问答统计 / 知识库状态） */}
      <Box mb="5">
        {statsError && (
          <Text fontSize="xs" color="#C53030">
            概况加载失败：{statsError}
          </Text>
        )}
        {!statsError && stats && (
          <HStack gap="3">
            <StatCard icon={<FiDatabase />} label="知识条目总数" value={stats.total_entries} />
            <StatCard
              icon={<FiCheck />}
              label="已向量化"
              value={stats.status_counts?.indexed ?? '-'}
            />
            <StatCard icon={<FiLayers />} label="切分块总数" value={stats.total_chunks} />
            <StatCard
              icon={<FiMessageSquare />}
              label="未回答问题"
              value={stats.unanswered_count ?? '-'}
            />
            <StatCard
              icon={<FiAlertTriangle />}
              label="处理出错"
              value={stats.status_counts?.error ?? 0}
            />
          </HStack>
        )}
      </Box>

      <Tabs.Root defaultValue="audit" lazyMount unmountOnExit={false}>
        <Tabs.List borderBottom="2px solid" borderColor={colors.gray200} gap="16px">
          <Tabs.Trigger value="audit" fontSize="sm">
            操作记录（{auditTotal}）
          </Tabs.Trigger>
          <Tabs.Trigger value="service" fontSize="sm">
            服务运行日志
          </Tabs.Trigger>
        </Tabs.List>

        {/* 操作记录 */}
        <Tabs.Content value="audit">
          <Box pt="4">
            <HStack mb="3" gap="2">
              <Badge
                as="button"
                cursor="pointer"
                px="2" py="1" rounded="md" fontSize="10px"
                bg={!actionFilter ? colors.primary : colors.gray100}
                color={!actionFilter ? 'white' : colors.gray600}
                onClick={() => setActionFilter('')}
              >
                全部动作
              </Badge>
              {Object.entries(AUDIT_ACTION_LABELS).map(([key, label]) => (
                <Badge
                  key={key}
                  as="button"
                  cursor="pointer"
                  px="2" py="1" rounded="md" fontSize="10px"
                  bg={actionFilter === key ? colors.primary : colors.gray100}
                  color={actionFilter === key ? 'white' : colors.gray600}
                  _hover={{ opacity: 0.85 }}
                  onClick={() => setActionFilter(key)}
                >
                  {label}
                </Badge>
              ))}
            </HStack>

            {auditLoading && (
              <Text fontSize="xs" color={colors.gray600}>
                正在加载操作记录…
              </Text>
            )}

            {!auditLoading && filteredAudit.length === 0 && (
              <Text fontSize="xs" color={colors.gray600}>
                暂无操作记录。上传文件、抓取网页或修改知识内容后会自动记录到这里。
              </Text>
            )}

            {!auditLoading &&
              filteredAudit.map((entry, idx) => (
                <Box
                  key={`${entry.ts}-${idx}`}
                  py="2.5"
                  px="3"
                  borderBottom="1px solid"
                  borderColor={colors.gray100}
                  bg={colors.gray50}
                  rounded="md"
                  mb="1.5"
                >
                  <HStack justify="space-between">
                    <HStack gap="2">
                      <Badge fontSize="9px" px="1.5" py="0.5" bg={colors.accent} color={colors.primary}>
                        {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                      </Badge>
                      <Text fontSize="xs" fontWeight="medium" color={colors.gray800} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                        {entry.target_title || '(无标题)'}
                      </Text>
                    </HStack>
                    <HStack gap="3">
                      <Text fontSize="2xs" color={colors.gray400}>
                        {entry.username || '未知用户'}
                      </Text>
                      <Text fontSize="2xs" color={colors.gray400}>
                        {formatTs(entry.ts)}
                      </Text>
                    </HStack>
                  </HStack>
                  {(entry.detail || entry.target_id) && (
                    <Text fontSize="2xs" color={colors.gray600} mt="1">
                      {entry.detail}
                      {entry.detail && entry.target_id ? ' · ' : ''}
                      {entry.target_id ? `ID ${entry.target_id.slice(0, 8)}` : ''}
                    </Text>
                  )}
                </Box>
              ))}
          </Box>
        </Tabs.Content>

        {/* 服务运行日志 */}
        <Tabs.Content value="service">
          <Box pt="4">
            <HStack mb="3" justify="space-between">
              <VStack align="start" gap="0">
                <Text fontSize="xs" color={colors.gray800} fontFamily="monospace">
                  {logMeta?.file || '—'}
                  {logMeta ? ` · ${formatBytes(logMeta.size)}` : ''}
                </Text>
                <Text fontSize="2xs" color={colors.gray400}>
                  显示最近 500 行{hasUnreadableLog ? '' : '，可用关键字过滤'}
                </Text>
              </VStack>
              <Button
                size="xs"
                variant="ghost"
                onClick={async () => {
                  try {
                    const log = await fetchServiceLog(500);
                    setServiceLog(log.lines);
                    setLogMeta({ file: log.file, size: log.size });
                  } catch (e) {
                    toaster.create({
                      title: '刷新运行日志失败',
                      description: e instanceof Error ? e.message : String(e),
                      type: 'error',
                      duration: 2500,
                    });
                  }
                }}
              >
                <FiRefreshCw />
                刷新
              </Button>
            </HStack>

            {!logLoading && !hasUnreadableLog && (
              <Input
                size="sm"
                mb="2"
                placeholder="过滤日志行，如 ERROR / WARNING / ws"
                value={logKeyword}
                onChange={(e) => setLogKeyword(e.target.value)}
                fontFamily="monospace"
              />
            )}

            <Box
              as="pre"
              m="0"
              p="3"
              bg="#101623"
              color="#c9d7ee"
              fontSize="2xs"
              fontFamily="'JetBrains Mono', Consolas, monospace"
              lineHeight="1.65"
              whiteSpace="pre-wrap"
              wordBreak="break-all"
              rounded="lg"
              maxHeight="calc(100vh - 380px)"
              overflowY="auto"
            >
              {logLoading
                ? '正在加载服务运行日志…'
                : filteredLogLines.join('\n') || '(无匹配日志行)'}
            </Box>
          </Box>
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  );
};

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <Box
      flex="1"
      bg="white"
      border="1px solid"
      borderColor={colors.gray200}
      rounded="lg"
      p="3.5"
      minWidth="140px"
    >
      <HStack gap="2" mb="1">
        {icon}
        <Text fontSize="2xs" color={colors.gray600}>
          {label}
        </Text>
      </HStack>
      <Text fontSize="xl" fontWeight="semibold" color={colors.primary}>
        {value}
      </Text>
    </Box>
  );
}
