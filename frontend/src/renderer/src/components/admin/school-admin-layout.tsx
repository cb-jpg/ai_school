/**
 * 石实实验学校 - AI数字人管理员工作台
 * 学校主题风格的管理后台布局
 */

import { FC, useState, useRef } from 'react';
import { Box, HStack, VStack, Text, Button, Badge } from '@chakra-ui/react';
import { Avatar } from '@/components/ui/avatar';
import { useAdmin } from '@/context/admin-context';
import {
  FiGrid,
  FiMessageSquare,
  FiUsers,
  FiDatabase,
  FiBook,
  FiFileText,
  FiUser,
  FiMic,
  FiSettings,
  FiLogOut,
  FiChevronLeft,
  FiChevronDown,
  FiChevronRight,
} from 'react-icons/fi';
import '@/styles/school-theme.css';

// 学校颜色配置
const schoolColors = {
  primary: '#1a4d8f',
  primaryLight: '#2d6ab3',
  primaryDark: '#0f3a6e',
  secondary: '#c41e3a',
  secondaryLight: '#e64d5e',
  accent: '#d4a520',
  accentLight: '#f0c660',
  gray50: '#f8fafc',
  gray100: '#f1f5f9',
  gray200: '#e2e8f0',
  gray600: '#475569',
  gray800: '#1e293b',
};

// 菜单分组类型
interface MenuGroupConfig {
  id: string;
  title: string;
  icon: typeof FiGrid;
  items: MenuItemConfig[];
  defaultOpen?: boolean;
}

// 菜单项类型
interface MenuItemConfig {
  id: string;
  label: string;
  icon: typeof FiMessageSquare;
  badge?: string | number;
  onClick: () => void;
  description?: string;
  disabled?: boolean;
}

// 菜单分组配置
const menuGroups: MenuGroupConfig[] = [
  {
    id: 'workspace',
    title: '工作台',
    icon: FiGrid,
    defaultOpen: true,
    items: [
      {
        id: 'workspace',
        label: '主工作台',
        icon: FiGrid,
        onClick: () => {},
        description: '现代化工作台',
      },
      {
        id: 'dashboard',
        label: '数据仪表盘',
        icon: FiGrid,
        onClick: () => {},
        description: '工作台首页',
      },
    ],
  },
  {
    id: 'conversation',
    title: '对话运营',
    icon: FiMessageSquare,
    defaultOpen: true,
    items: [
      {
        id: 'test-conversation',
        label: '测试对话',
        icon: FiMic,
        onClick: () => {},
        description: '管理员测试问答（包含对话历史）',
      },
      {
        id: 'group-management',
        label: '群组管理',
        icon: FiUsers,
        onClick: () => {},
        description: '无',
        disabled: true,
      },
    ],
  },
  {
    id: 'knowledge',
    title: '知识库管理',
    icon: FiDatabase,
    defaultOpen: true,
    items: [
      {
        id: 'knowledge-admin',
        label: '知识库管理',
        icon: FiDatabase,
        onClick: () => {},
        description: '完整知识库管理',
        badge: '推荐',
      },
      {
        id: 'unanswered-questions',
        label: '待补充问题库',
        icon: FiMessageSquare,
        onClick: () => {},
        description: '无',
        disabled: true,
      },
      {
        id: 'document-knowledge',
        label: '文档知识库',
        icon: FiFileText,
        onClick: () => {},
        description: '无',
        disabled: true,
      },
      {
        id: 'faq-knowledge',
        label: '高频问答库',
        icon: FiBook,
        onClick: () => {},
        description: '无',
        disabled: true,
      },
    ],
  },
  {
    id: 'config-system',
    title: '配置及系统',
    icon: FiSettings,
    defaultOpen: false,
    items: [
      {
        id: 'avatar-settings',
        label: '角色形象设置',
        icon: FiUser,
        onClick: () => {},
        description: '无',
        disabled: true,
      },
      {
        id: 'voice-settings',
        label: '播报语音设置',
        icon: FiMic,
        onClick: () => {},
        description: '无',
        disabled: true,
      },
      {
        id: 'pet-mode',
        label: '宠物模式设置',
        icon: FiGrid,
        onClick: () => {},
        description: '无',
        disabled: true,
      },
      {
        id: 'user-permissions',
        label: '用户权限',
        icon: FiUsers,
        onClick: () => {},
        description: '无',
        disabled: true,
      },
      {
        id: 'model-settings',
        label: '语音&模型参数设置',
        icon: FiSettings,
        onClick: () => {},
        description: '无',
        disabled: true,
      },
      {
        id: 'system-logs',
        label: '系统日志',
        icon: FiFileText,
        onClick: () => {},
        description: '无',
        disabled: true,
      },
    ],
  },
];

// 菜单分组组件
const MenuGroupItem: FC<{
  group: MenuGroupConfig;
  isOpen: boolean;
  onToggle: () => void;
  activeItem: string | null;
  onItemClick: (itemId: string) => void;
  isCollapsed: boolean;
}> = ({ group, isOpen, onToggle, activeItem, onItemClick, isCollapsed }) => {
  const GroupIcon = group.icon;

  return (
    <Box mb="2">
      <Button
        variant="ghost"
        width="full"
        justifyContent="space-between"
        onClick={onToggle}
        px="3"
        py="2"
        borderRadius="lg"
        _hover={{
          bg: 'rgba(26, 77, 143, 0.05)',
        }}
        className="school-menu-group"
      >
        <HStack gap="3">
          <GroupIcon boxSize="4" color={schoolColors.primary} />
          {!isCollapsed && (
            <Text fontSize="sm" fontWeight="semibold" color={schoolColors.gray800}>
              {group.title}
            </Text>
          )}
        </HStack>
        {!isCollapsed && (
          <Box
            transition="transform 0.2s"
            transform={isOpen ? 'rotate(0deg)' : 'rotate(-90deg)'}
          >
            <FiChevronDown boxSize="4" color={schoolColors.gray600} />
          </Box>
        )}
      </Button>

      {isOpen && (
        <VStack gap="1" align="stretch" mt="1" pl={isCollapsed ? '0' : '8'}>
          {group.items.map((item) => {
            const ItemIcon = item.icon;
            const isActive = activeItem === item.id;
            const isDisabled = item.disabled === true;

            return (
              <Button
                key={item.id}
                variant="ghost"
                width="full"
                justifyContent={isCollapsed ? 'center' : 'flex-start'}
                onClick={() => !isDisabled && onItemClick(item.id)}
                px="3"
                py="2"
                borderRadius="lg"
                className={`school-menu-item ${isActive ? 'active' : ''}`}
                position="relative"
                disabled={isDisabled}
                opacity={isDisabled ? 0.5 : 1}
                cursor={isDisabled ? 'not-allowed' : 'pointer'}
              >
                <HStack gap="3" width="full">
                  <ItemIcon
                    boxSize="4"
                    color={isActive ? schoolColors.primary : schoolColors.gray600}
                  />
                  {!isCollapsed && (
                    <>
                      <Text
                        fontSize="sm"
                        color={isActive ? schoolColors.primary : schoolColors.gray600}
                        fontWeight={isActive ? 'semibold' : 'normal'}
                      >
                        {item.label}
                      </Text>
                      {item.badge && (
                        <Badge
                          bg={schoolColors.secondary}
                          color="white"
                          fontSize="9px"
                          px="2"
                          py="0.5"
                          rounded="full"
                          ml="auto"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </>
                  )}
                </HStack>
              </Button>
            );
          })}
        </VStack>
      )}
    </Box>
  );
};

// 主布局组件
export const SchoolAdminLayout: FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { openAdmin } = useAdmin();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>('dashboard');
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(menuGroups.filter(g => g.defaultOpen).map(g => g.id))
  );

  const toggleGroup = (groupId: string) => {
    const newOpenGroups = new Set(openGroups);
    if (newOpenGroups.has(groupId)) {
      newOpenGroups.delete(groupId);
    } else {
      newOpenGroups.add(groupId);
    }
    setOpenGroups(newOpenGroups);
  };

  const handleItemClick = (itemId: string) => {
    setActiveItem(itemId);

    // 路由映射
    const routeMap: Record<string, string> = {
      'workspace': '#/main/workspace',
      'dashboard': '#/main/dashboard',
      'test-conversation': '#/main/test-conversation',
      'knowledge-admin': '#/main/knowledge-admin',
      'unanswered-questions': '#/main/unanswered-questions',
    };

    if (routeMap[itemId]) {
      window.location.hash = routeMap[itemId];
    } else {
      // 对于未实现的功能，可以打开管理面板或显示提示
      console.log(`功能 ${itemId} 待实现`);
    }
  };

  return (
    <Box
      width="full"
      height="100vh"
      display="flex"
      className="school-background"
      fontFamily="Microsoft YaHei, SimHei, sans-serif"
    >
      {/* 左侧边栏 */}
      <Box
        as="aside"
        width={isCollapsed ? '80px' : '280px'}
        height="100vh"
        bg="white"
        borderRight="1px solid"
        borderColor={schoolColors.gray200}
        display="flex"
        flexDirection="column"
        transition="width 0.3s ease"
        position="fixed"
        left={0}
        top={0}
        zIndex={30}
        className="school-sidebar-menu"
      >
        {/* 学校Logo区域 */}
        <Box
          height="16"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          px="6"
          className="school-logo-area"
        >
          <HStack gap="3">
            <Box
              width="10"
              height="10"
              rounded="lg"
              bg="white"
              display="flex"
              alignItems="center"
              justifyContent="center"
              boxShadow="lg"
            >
              <Text
                color={schoolColors.primary}
                fontWeight="bold"
                fontSize="lg"
                fontFamily="serif"
              >
                石
              </Text>
            </Box>
            {!isCollapsed && (
              <VStack align="start" spacing="0">
                <Text
                  fontSize="sm"
                  fontWeight="bold"
                  color="white"
                  letterSpacing="tight"
                >
                  石实实验学校
                </Text>
                <Text fontSize="9px" color="rgba(255,255,255,0.8)">
                  AI数字人管理后台
                </Text>
              </VStack>
            )}
          </HStack>
        </Box>

        {/* 导航菜单区域 */}
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
              bg: schoolColors.gray200,
              borderRadius: 'full',
            },
          }}
        >
          <VStack gap="1" align="stretch">
            {menuGroups.map((group) => (
              <MenuGroupItem
                key={group.id}
                group={group}
                isOpen={openGroups.has(group.id)}
                onToggle={() => toggleGroup(group.id)}
                activeItem={activeItem}
                onItemClick={handleItemClick}
                isCollapsed={isCollapsed}
              />
            ))}
          </VStack>
        </Box>

        {/* 用户区域 */}
        <Box
          borderTop="1px solid"
          borderColor={schoolColors.gray200}
          p="3"
          bg="white"
        >
          <VStack gap="2">
            {/* 用户信息 */}
            <HStack gap="3" width="full">
              {!isCollapsed && (
                <>
                  <Avatar
                    size="sm"
                    bg={schoolColors.primary}
                    color="white"
                    name="管理员"
                  />
                  <VStack align="start" spacing="0" flex="1">
                    <Text fontSize="sm" fontWeight="medium" color={schoolColors.gray800}>
                      管理员
                    </Text>
                    <Text fontSize="10px" color={schoolColors.gray600}>
                      系统管理员
                    </Text>
                  </VStack>
                </>
              )}
            </HStack>

            {/* 操作按钮 */}
            <VStack gap="1" width="full">
              {!isCollapsed && (
                <Button
                  variant="ghost"
                  size="sm"
                  width="full"
                  justifyContent="flex-start"
                  onClick={() => { window.location.hash = '#/hero'; }}
                  gap="2"
                >
                  <FiLogOut boxSize="4" color={schoolColors.gray600} />
                  <Text fontSize="xs" color={schoolColors.gray600}>返回Hero页面</Text>
                </Button>
              )}
              {/* 折叠按钮 */}
              <Button
                variant="ghost"
                size="sm"
                width="full"
                onClick={() => setIsCollapsed(!isCollapsed)}
                color={schoolColors.gray600}
              >
                <HStack justify="center" gap="2">
                  {isCollapsed ? (
                    <FiChevronRight boxSize="4" />
                  ) : (
                    <>
                      <Text fontSize="xs">收起</Text>
                      <FiChevronLeft boxSize="4" />
                    </>
                  )}
                </HStack>
              </Button>
            </VStack>
          </VStack>
        </Box>
      </Box>

      {/* 右侧主内容区 */}
      <Box
        ml={isCollapsed ? '80px' : '280px'}
        width="calc(100% - (var(--sidebar-width, 280px)))"
        height="100vh"
        transition="margin-left 0.3s ease"
        display="flex"
        flexDirection="column"
      >
        {/* 顶部导航栏 */}
        <Box
          height="16"
          bg="white"
          borderBottom="1px solid"
          borderColor={schoolColors.gray200}
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          px="6"
          className="school-header"
        >
          <HStack gap="4">
            <Text
              fontSize="lg"
              fontWeight="semibold"
              color={schoolColors.primary}
              className="school-title"
            >
              AI数字人 - 管理员工作台
            </Text>
          </HStack>

          <HStack gap="4">
            <Badge
              bg={schoolColors.accent}
              color="white"
              px="3"
              py="1"
              rounded="md"
              fontSize="xs"
            >
              石实实验学校
            </Badge>
            <Avatar
              size="sm"
              bg={schoolColors.primary}
              color="white"
              name="管理员"
            />
            <Text fontSize="sm" color={schoolColors.gray600} fontWeight="medium">
              管理员
            </Text>
          </HStack>
        </Box>

        {/* 主内容区域 */}
        <Box
          flex="1"
          overflowY="auto"
          p="6"
          bg={schoolColors.gray50}
          css={{
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              bg: schoolColors.gray100,
            },
            '&::-webkit-scrollbar-thumb': {
              bg: schoolColors.gray200,
              borderRadius: 'full',
            },
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default SchoolAdminLayout;