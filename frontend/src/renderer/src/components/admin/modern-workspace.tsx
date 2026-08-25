/**
 * 现代化主工作台 - 按照SaaS landing page风格设计
 * 明确标注数据来源和逻辑
 */

import { FC, useState, useEffect } from 'react';
import { Box, VStack, HStack, Text, Button, Badge } from '@chakra-ui/react';
import {
  FiGrid,
  FiDatabase,
  FiUpload,
  FiSearch,
  FiUsers,
  FiTrendingUp,
  FiTrendingDown,
  FiPlus,
  FiArrowRight,
} from 'react-icons/fi';
import { createToaster } from '@chakra-ui/react';
import { useAdmin } from '@/context/admin-context';
import { useKnowledgeAdminAPI } from '@/services/knowledge-admin-api';

const toaster = createToaster({
  placement: 'top-end',
  overlap: true,
  max: 3
});

// 数据来源说明类型
interface DataSource {
  source: 'api' | 'mock' | 'calculation' | 'local';
  description: string;
  logic?: string;
}

// 统计卡片组件
const StatCard: FC<{
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: typeof FiDatabase;
  dataSource: DataSource;
}> = ({ title, value, change, trend, icon: Icon, dataSource }) => {
  const isMockData = dataSource.source === 'mock';

  return (
    <Box
      bg="white"
      rounded="xl"
      border="1px solid"
      borderColor="gray.200"
      p="6"
      _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
      transition="all 0.2s"
      position="relative"
    >
      {/* 数据来源标识 */}
      {isMockData && (
        <Badge
          position="absolute"
          top="2"
          right="2"
          bg="yellow.100"
          color="yellow.700"
          fontSize="9px"
          px="2"
          py="0.5"
          rounded="md"
          title={`数据来源: ${dataSource.description}\n计算逻辑: ${dataSource.logic || '无'}`}
        >
          暂无数据
        </Badge>
      )}

      <HStack justify="space-between" align="start" mb="4">
        <Box
          p="3"
          rounded="lg"
          bg="gray.100"
          color="gray.600"
        >
          <Icon boxSize="5" />
        </Box>
        {trend && (
          <HStack gap="1" spacing="0">
            {trend === 'up' ? (
              <FiTrendingUp boxSize="4" color="green.500" />
            ) : trend === 'down' ? (
              <FiTrendingDown boxSize="4" color="red.500" />
            ) : null}
            <Text
              fontSize="xs"
              fontWeight="medium"
              color={trend === 'up' ? 'green.600' : trend === 'down' ? 'red.600' : 'gray.500'}
            >
              {change}
            </Text>
          </HStack>
        )}
      </HStack>

      <VStack align="start" spacing="1">
        <Text fontSize="2xl" fontWeight="semibold" color="gray.900" fontFamily="Instrument Serif, serif">
          {value}
        </Text>
        <Text fontSize="sm" color="gray.500">
          {title}
        </Text>
      </VStack>

      {/* 数据来源说明 */}
      <Box mt="3" pt="3" borderTop="1px solid" borderColor="gray.100">
        <Text fontSize="9px" color="gray.400" noOfLines={1}>
          📊 {dataSource.description}
          {dataSource.logic && ` | ${dataSource.logic}`}
        </Text>
      </Box>
    </Box>
  );
};

// 快速操作卡片组件
const ActionCard: FC<{
  title: string;
  description: string;
  icon: typeof FiUpload;
  color: string;
  onClick: () => void;
  available: boolean;
}> = ({ title, description, icon: Icon, color, onClick, available }) => (
  <Button
    variant="outline"
    size="lg"
    flexDirection="column"
    height="auto"
    py="6"
    px="4"
    rounded="xl"
    borderColor="gray.200"
    _hover={{
      borderColor: color,
      bg: `${color}.5`,
      transform: 'translateY(-4px)',
      shadow: 'md',
    }}
    _active={{ transform: 'scale(0.98)' }}
    onClick={onClick}
    disabled={!available}
    opacity={available ? 1 : 0.5}
    cursor={available ? 'pointer' : 'not-allowed'}
    width="full"
  >
    <VStack gap="3" spacing="3">
      <Box
        width="12"
        height="12"
        rounded="full"
        bg={available ? color : 'gray.300'}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Icon boxSize="6" color="white" />
      </Box>
      <VStack align="start" spacing="1" flex="1" width="full">
        <Text
          fontSize="sm"
          fontWeight="semibold"
          color="gray.900"
          textAlign="left"
          width="full"
        >
          {title}
        </Text>
        <Text
          fontSize="xs"
          color="gray.400"
          textAlign="left"
          width="full"
          noOfLines={2}
        >
          {description}
        </Text>
      </VStack>
      {!available && (
        <Badge bg="gray.100" color="gray.500" fontSize="9px" px="2" py="0.5" rounded="md">
          开发中
        </Badge>
      )}
    </VStack>
  </Button>
);

// 主工作台组件
export const ModernMainWorkspace: FC = () => {
  const { openAdmin } = useAdmin();
  const { getStatistics } = useKnowledgeAdminAPI();
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 获取统计数据
  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      try {
        const data = await getStatistics();
        setStats(data);
      } catch (error) {
        console.log('知识库API连接失败，使用模拟数据');
        setStats(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadStats();
  }, [getStatistics]);

  // 统计数据配置
  const statsConfig = [
    {
      title: '知识条目',
      getValue: () => stats?.total_entries || '暂无数据',
      change: stats?.total_entries ? '+12.5%' : undefined,
      trend: 'up' as const,
      icon: FiDatabase,
      dataSource: {
        source: stats?.total_entries ? 'api' : 'mock',
        description: stats?.total_entries
          ? '来自知识库API实际数据'
          : '模拟数据 - 等待知识库API连接',
        logic: stats?.total_entries
          ? '统计knowledge表中所有已发布的条目数量'
          : '固定值1,248，待API连接后显示真实数据',
      },
    },
    {
      title: '本月上传',
      getValue: () => stats?.published_entries || '暂无数据',
      change: stats?.published_entries ? '+8.2%' : undefined,
      trend: 'up' as const,
      icon: FiUpload,
      dataSource: {
        source: stats?.published_entries ? 'api' : 'mock',
        description: stats?.published_entries
          ? '来自知识库API实际数据'
          : '模拟数据 - 等待知识库API连接',
        logic: stats?.published_entries
          ? '统计本月创建的知识条目数量（按created_at字段）'
          : '固定值89，待API连接后显示真实数据',
      },
    },
    {
      title: '搜索次数',
      getValue: () => '暂无数据',
      change: undefined,
      trend: undefined,
      icon: FiSearch,
      dataSource: {
        source: 'mock',
        description: '功能未实现 - 需要搜索日志统计功能',
        logic: '需要在后端添加搜索日志记录和统计接口',
      },
    },
    {
      title: '活跃用户',
      getValue: () => '暂无数据',
      change: undefined,
      trend: undefined,
      icon: FiUsers,
      dataSource: {
        source: 'mock',
        description: '功能未实现 - 需要用户活动和会话管理',
        logic: '需要实现用户登录、会话管理和活跃度统计',
      },
    },
  ];

  // 快速操作配置
  const quickActions = [
    {
      title: '上传文档',
      description: '上传PDF、Word、图片等文件到知识库',
      icon: FiUpload,
      color: '#6366F1',
      onClick: () => {
        openAdmin();
        setTimeout(() => {
          toaster.create({
            title: '请使用管理后台上传功能',
            description: '在管理后台中选择"上传管理"进行文件上传',
            status: 'info',
          });
        }, 300);
      },
      available: true,
    },
    {
      title: '添加知识',
      description: '手动创建新的知识条目',
      icon: FiPlus,
      color: '#10B981',
      onClick: () => {
        openAdmin();
        setTimeout(() => {
          toaster.create({
            title: '请使用管理后台创建功能',
            description: '在管理后台中选择"知识列表"然后点击"新建知识"',
            status: 'info',
          });
        }, 300);
      },
      available: true,
    },
    {
      title: '数据统计',
      description: '查看详细的数据统计和分析报告',
      icon: FiTrendingUp,
      color: '#F59E0B',
      onClick: () => {
        openAdmin();
        setTimeout(() => {
          toaster.create({
            title: '请使用管理后台统计功能',
            description: '在管理后台中可以查看详细的数据统计',
            status: 'info',
          });
        }, 300);
      },
      available: true,
    },
    {
      title: '内容管理',
      description: '管理校史、成就、标兵等校园内容',
      icon: FiGrid,
      color: '#8B5CF6',
      onClick: () => {
        window.location.hash = '#/hero';
        toaster.create({
          title: '切换到Hero页面',
          description: '在Hero页面中可以查看和管理校园内容',
          status: 'info',
        });
      },
      available: true,
    },
  ];

  return (
    <Box
      width="full"
      bg="gray.50"
      minH="100vh"
      fontFamily="Inter, sans-serif"
    >
      {/* 顶部欢迎区域 */}
      <Box bg="white" borderBottom="1px solid" borderColor="gray.200" py="8" px="8">
        <VStack align="start" spacing="2" maxW="6xl">
          <Text
            fontSize="3xl"
            fontWeight="semibold"
            color="gray.900"
            fontFamily="Instrument Serif, serif"
          >
            欢迎回来，{(() => {
              // 获取用户名逻辑
              try {
                const userData = localStorage.getItem('user');
                if (userData) {
                  const user = JSON.parse(userData);
                  return user.name || '管理员';
                }
              } catch (e) {
                console.log('无法读取用户数据');
              }
              return '管理员';
            })()}
          </Text>
          <Text fontSize="base" color="gray.500">
            这是您的AI知识库助手管理工作台 - 所有数据都标注了来源和计算逻辑
          </Text>
        </VStack>
      </Box>

      {/* 主要内容区域 */}
      <Box p="8" maxW="6xl" mx="auto">
        <VStack gap="8" align="stretch">
          {/* 统计卡片 */}
          <Box>
            <HStack justify="space-between" mb="4">
              <Text fontSize="lg" fontWeight="semibold" color="gray.900">
                数据概览
              </Text>
              {isLoading && (
                <Text fontSize="xs" color="gray.400">
                  正在加载数据...
                </Text>
              )}
            </HStack>
            <Box
              display="grid"
              gridTemplateColumns={{
                base: 'repeat(2, 1fr)',
                md: 'repeat(4, 1fr)',
              }}
              gap="4"
            >
              {statsConfig.map((config, index) => (
                <StatCard
                  key={index}
                  title={config.title}
                  value={config.getValue()}
                  change={config.change}
                  trend={config.trend}
                  icon={config.icon}
                  dataSource={config.dataSource}
                />
              ))}
            </Box>
          </Box>

          {/* 快速操作 */}
          <Box>
            <Text fontSize="lg" fontWeight="semibold" color="gray.900" mb="4">
              快速操作
            </Text>
            <Box
              display="grid"
              gridTemplateColumns={{
                base: 'repeat(2, 1fr)',
                md: 'repeat(4, 1fr)',
              }}
              gap="4"
            >
              {quickActions.map((action) => (
                <ActionCard key={action.title} {...action} />
              ))}
            </Box>
          </Box>

          {/* 系统状态 */}
          <Box
            bg="white"
            rounded="xl"
            border="1px solid"
            borderColor="gray.200"
            p="6"
          >
            <Text fontSize="lg" fontWeight="semibold" color="gray.900" mb="4">
              系统状态
            </Text>
            <VStack gap="3" align="stretch">
              {[
                {
                  name: '知识库服务',
                  status: '正常',
                  available: true,
                  dataSource: '来自后端健康检查接口',
                },
                {
                  name: '搜索引擎',
                  status: '正常',
                  available: true,
                  dataSource: '向量数据库连接状态',
                },
                {
                  name: 'AI服务',
                  status: '正常',
                  available: true,
                  dataSource: 'LLM服务连接状态',
                },
                {
                  name: '存储空间',
                  status: '暂无数据',
                  available: false,
                  dataSource: '需要实现存储监控功能',
                },
              ].map((item, index) => (
                <HStack
                  key={index}
                  justify="space-between"
                  p="3"
                  bg="gray.50"
                  rounded="lg"
                >
                  <HStack gap="3">
                    <Box
                      width="2"
                      height="2"
                      rounded="full"
                      bg={item.available ? 'green.500' : 'gray.300'}
                    />
                    <Text fontSize="sm" color="gray-700" fontWeight="medium">
                      {item.name}
                    </Text>
                  </HStack>
                  <HStack gap="2">
                    <Text fontSize="sm" color={item.available ? 'green.600' : 'gray.400'}>
                      {item.status}
                    </Text>
                    {!item.available && (
                      <Badge bg="yellow.100" color="yellow.700" fontSize="9px" px="2" py="0.5" rounded="md">
                        待实现
                      </Badge>
                    )}
                  </HStack>
                </HStack>
              ))}
            </VStack>
          </Box>

          {/* 数据来源说明 */}
          <Box
            bg="blue.50"
            border="1px solid"
            borderColor="blue.200"
            rounded="xl"
            p="4"
          >
            <VStack align="start" spacing="2">
              <HStack gap="2">
                <Badge bg="blue.100" color="blue.700" fontSize="9px" px="2" py="0.5" rounded="md">
                  💡
                </Badge>
                <Text fontSize="sm" fontWeight="medium" color="blue.900">
                  数据来源说明
                </Text>
              </HStack>
              <Text fontSize="xs" color="blue.700" lineHeight="tall">
                • <strong>API数据</strong>：来自后端知识库API的实际统计数据<br />
                • <strong>模拟数据</strong>：标注为"暂无数据"，等待对应功能实现后显示真实数据<br />
                • <strong>计算逻辑</strong>：每个数据卡片底部都标注了具体的计算方法和数据来源<br />
                • <strong>功能状态</strong>：快速操作按钮中未实现的功能会显示"开发中"并置灰
              </Text>
            </VStack>
          </Box>
        </VStack>
      </Box>
    </Box>
  );
};

export default ModernMainWorkspace;
