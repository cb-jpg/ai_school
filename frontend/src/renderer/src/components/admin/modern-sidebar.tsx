/**
 * 现代化侧边栏 - 按照SaaS landing page风格设计
 * 重新设计的main界面侧边栏 - 保留原有功能
 */

import { FC, useState, useEffect } from 'react';
import { Box, Button, HStack, VStack, Text } from '@chakra-ui/react';
import {
  FiSettings,
  FiChevronLeft,
  FiChevronRight,
  FiLogOut,
  FiGrid,
  FiDatabase,
  FiBookOpen,
  FiUsers,
  FiBarChart2,
  FiClock,
  FiPlus,
  FiLayers,
} from 'react-icons/fi';
import { createToaster } from '@chakra-ui/react';
import { useAdmin } from '@/context/admin-context';
import { useKnowledgeAdminAPI } from '@/services/knowledge-admin-api';
import { useSidebar } from '@/hooks/sidebar/use-sidebar';
import GroupDrawer from '../sidebar/group-drawer';
import HistoryDrawer from '../sidebar/history-drawer';
import KnowledgeDrawer from '../knowledge/knowledge-drawer';
import { ModeType } from '@/context/mode-context';

const toaster = createToaster({
  placement: 'top-end',
  overlap: true,
  max: 3
});

// 导航菜单项定义
interface MenuItem {
  id: string;
  label: string;
  icon: typeof FiGrid;
  badge?: string | number;
  onClick: () => void;
  description?: string;
  isDrawer?: boolean;
  drawerComponent?: React.ReactNode;
}

export const ModernSidebar: FC<{
  isCollapsed: boolean;
  onToggle: () => void;
  userName?: string;
}> = ({ isCollapsed, onToggle, userName = '管理员' }) => {
  const [activeItem, setActiveItem] = useState('dashboard');
  const { openAdmin } = useAdmin();
  const { getStatistics } = useKnowledgeAdminAPI();
  const [stats, setStats] = useState<any>(null);
  const [currentMode, setCurrentMode] = useState<ModeType>('window');
  const [, setIsElectron] = useState(false);

  // 获取真实统计数据
  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getStatistics();
        setStats(data);
      } catch (error) {
        console.log('无法连接到知识库API');
      }
    };
    loadStats();
  }, [getStatistics]);

  // 检测是否在 Electron 环境
  useEffect(() => {
    setIsElectron(window.api !== undefined);
  }, []);

  // 使用原有的 sidebar hook
  const {
    createNewHistory,
    setMode,
  } = useSidebar();

  // 导航菜单配置 - 保留原有功能
  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      label: '工作台',
      icon: FiGrid,
      onClick: () => setActiveItem('dashboard'),
      description: '系统概览和快速操作'
    },
    {
      id: 'new-conversation',
      label: '新对话',
      icon: FiPlus,
      onClick: () => {
        createNewHistory();
        toaster.create({ title: '已创建新对话', type: 'success' });
      },
      description: '开始新的对话'
    },
    {
      id: 'history',
      label: '对话历史',
      icon: FiClock,
      onClick: () => {},
      description: '查看历史对话',
      isDrawer: true,
      drawerComponent: (
        <HistoryDrawer>
          <Button variant="ghost" width="full" justifyContent="flex-start">
            <HStack gap="3">
              <FiClock size="5" />
              {!isCollapsed && <Text fontSize="sm">对话历史</Text>}
            </HStack>
          </Button>
        </HistoryDrawer>
      )
    },
    {
      id: 'groups',
      label: '群组管理',
      icon: FiUsers,
      onClick: () => {},
      description: '管理群组会话',
      isDrawer: true,
      drawerComponent: (
        <GroupDrawer>
          <Button variant="ghost" width="full" justifyContent="flex-start">
            <HStack gap="3">
              <FiUsers size="5" />
              {!isCollapsed && <Text fontSize="sm">群组管理</Text>}
            </HStack>
          </Button>
        </GroupDrawer>
      )
    },
    {
      id: 'knowledge',
      label: '知识库',
      icon: FiDatabase,
      badge: stats?.total_entries || undefined,
      onClick: () => {},
      description: '知识库管理',
      isDrawer: true,
      drawerComponent: (
        <KnowledgeDrawer>
          <Button variant="ghost" width="full" justifyContent="flex-start">
            <HStack gap="3">
              <FiDatabase size="5" />
              {!isCollapsed && (
                <>
                  <Text fontSize="sm">知识库</Text>
                  {stats?.total_entries && (
                    <Box
                      backgroundColor="indigo.100"
                      color="indigo.600"
                      fontSize="10px"
                      fontWeight="semibold"
                      px="2"
                      py="0.5"
                      rounded="full"
                    >
                      {stats.total_entries}
                    </Box>
                  )}
                </>
              )}
            </HStack>
          </Button>
        </KnowledgeDrawer>
      )
    },
    {
      id: 'mode-switch',
      label: '模式切换',
      icon: FiLayers,
      onClick: () => {
        const newMode: ModeType = currentMode === 'window' ? 'pet' : 'window';
        setCurrentMode(newMode);
        setMode(newMode);
        toaster.create({
          title: `已切换到${newMode === 'window' ? '窗口' : '宠物'}模式`,
          type: 'info'
        });
      },
      description: currentMode === 'window' ? '切换到宠物模式' : '切换到窗口模式'
    },
  ];

  return (
    <Box
      as="aside"
      width={isCollapsed ? '80px' : '280px'}
      height="100vh"
      bg="white"
      borderRight="1px solid"
      borderColor="gray.200"
      display="flex"
      flexDirection="column"
      transition="width 0.3s ease"
      fontFamily="Inter, sans-serif"
      position="fixed"
      left={0}
      top={0}
      zIndex={30}
    >
      {/* Logo区域 */}
      <Box
        height="16"
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        px="6"
        borderBottom="1px solid"
        borderColor="gray.200"
      >
        <HStack gap="3">
          <Box
            width="8"
            height="8"
            rounded="lg"
            bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Text color="white" fontWeight="semibold" fontSize="sm">
              AI
            </Text>
          </Box>
          {!isCollapsed && (
            <Text
              fontSize="lg"
              fontWeight="semibold"
              color="gray.900"
              letterSpacing="tight"
            >
              知识库助手
            </Text>
          )}
        </HStack>
      </Box>

      {/* 导航菜单区域 - 可滚动 */}
      <Box
        flex="1"
        overflowY="auto"
        py="4"
        px="3"
        css={{
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            bg: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            bg: 'gray.300',
            borderRadius: 'full',
          },
        }}
      >
        <VStack gap="1" align="stretch">
          {menuItems.map((item) => (
            <Box key={item.id}>
              {item.isDrawer && item.drawerComponent ? (
                item.drawerComponent
              ) : (
                <Button
                  variant="ghost"
                  width="full"
                  justifyContent={isCollapsed ? 'center' : 'flex-start'}
                  onClick={item.onClick}
                  backgroundColor={activeItem === item.id ? 'gray.100' : 'transparent'}
                  color={activeItem === item.id ? 'gray.900' : 'gray.600'}
                  _hover={{
                    backgroundColor: 'gray.100',
                    color: 'gray.900',
                  }}
                  borderRadius="lg"
                  py="3"
                  px="3"
                  position="relative"
                >
                  <HStack gap={isCollapsed ? '0' : '3'}>
                    <item.icon
                      size="5"
                      color={activeItem === item.id ? '#6366F1' : 'currentColor'}
                    />
                    {!isCollapsed && (
                      <VStack align="start" gap="0" flex="1">
                        <Text fontSize="sm" fontWeight="medium">
                          {item.label}
                        </Text>
                        {item.description && (
                          <Text fontSize="10px" color="gray.400">
                            {item.description}
                          </Text>
                        )}
                      </VStack>
                    )}
                  </HStack>
                </Button>
              )}
            </Box>
          ))}

          {!isCollapsed && (
            <Box
              my="4"
              height="1px"
              bg="gray.200"
            />
          )}

          {/* 系统功能 */}
          {!isCollapsed && (
            <VStack gap="1" align="stretch">
              <Text fontSize="xs" color="gray.400" fontWeight="semibold" px="3" py="2">
                系统功能
              </Text>
              <Button
                variant="ghost"
                size="sm"
                justifyContent="flex-start"
                onClick={() => {
                  toaster.create({ title: '设置功能开发中', type: 'info' });
                }}
              >
                <HStack gap="3">
                  <FiSettings size="4" />
                  <Text fontSize="sm">系统设置</Text>
                </HStack>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                justifyContent="flex-start"
                onClick={() => {
                  openAdmin();
                  toaster.create({ title: '打开管理后台', type: 'info' });
                }}
              >
                <HStack gap="3">
                  <FiBarChart2 size="4" />
                  <Text fontSize="sm">管理后台</Text>
                </HStack>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                justifyContent="flex-start"
                onClick={() => {
                  window.location.hash = '#/hero';
                  toaster.create({ title: '切换到Hero页面', type: 'info' });
                }}
              >
                <HStack gap="3">
                  <FiBookOpen size="4" />
                  <Text fontSize="sm">校园内容</Text>
                </HStack>
              </Button>
            </VStack>
          )}
        </VStack>
      </Box>

      {/* 用户区域 */}
      <Box
        borderTop="1px solid"
        borderColor="gray.200"
        p="3"
      >
        <Button
          variant="ghost"
          width="full"
          justifyContent="space-between"
          onClick={() => {
            toaster.create({ title: '已退出工作台', type: 'info' });
          }}
        >
          <HStack gap="3">
            {!isCollapsed && (
              <>
                <Box
                  width="8"
                  height="8"
                  rounded="full"
                  bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  color="white"
                  fontSize="xs"
                  fontWeight="medium"
                >
                  {userName.charAt(0)}
                </Box>
                <VStack align="start" gap="0" flex="1">
                  <Text fontSize="sm" fontWeight="medium" color="gray.900">
                    {userName}
                  </Text>
                  <Text fontSize="10px" color="gray.400">
                    系统管理员
                  </Text>
                </VStack>
              </>
            )}
            <FiLogOut size="4" color="gray.400" />
          </HStack>
        </Button>

        {/* 折叠按钮 */}
        <Button
          variant="ghost"
          size="sm"
          width="full"
          mt="2"
          onClick={onToggle}
          color="gray.400"
        >
          <HStack justify="center" gap="2">
            {isCollapsed ? (
              <FiChevronRight size="4" />
            ) : (
              <>
                <Text fontSize="xs">收起</Text>
                <FiChevronLeft size="4" />
              </>
            )}
          </HStack>
        </Button>
      </Box>
    </Box>
  );
};

export default ModernSidebar;
