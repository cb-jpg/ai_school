/**
 * 石实实验学校 - AI数字人管理员工作台
 * 学校主题风格的管理后台布局
 */

import { FC, useState } from 'react';
import { Box, HStack, VStack, Text, Button, Badge, IconButton } from '@chakra-ui/react';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth-context';
import {
  FiGrid,
  FiMessageSquare,
  FiUsers,
  FiDatabase,
  FiFileText,
  FiUser,
  FiMic,
  FiSettings,
  FiLogOut,
  FiChevronLeft,
  FiChevronDown,
  FiChevronRight,
  FiMenu,
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
  adminOnly?: boolean;
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
        id: 'avatar-settings',
        label: '角色形象设置',
        icon: FiUser,
        onClick: () => {},
        description: '数字人选择和角色配置',
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
        description: '未命中与低置信问题',
      },
      {
        id: 'document-knowledge',
        label: '文档知识库',
        icon: FiFileText,
        onClick: () => {},
        description: '切分结果与向量化状态',
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
        id: 'voice-settings',
        label: '播报语音设置',
        icon: FiMic,
        onClick: () => {},
        description: '无',
        disabled: true,
      },
      {
        id: 'user-management',
        label: '用户管理',
        icon: FiUsers,
        onClick: () => {},
        description: '管理员账号管理',
        adminOnly: true,
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
        description: '更新记录与运行日志',
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
          <GroupIcon size="4" color={schoolColors.primary} />
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
            <FiChevronDown size="4" color={schoolColors.gray600} />
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
                    size="4"
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
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>('dashboard');
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(menuGroups.filter(g => g.defaultOpen).map(g => g.id))
  );

  const visibleMenuGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => !item.adminOnly || user?.role === 'admin'),
  }));

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
    setMobileOpen(false); // 手机端抽屉：选中菜单后收起

    // 路由映射
    const routeMap: Record<string, string> = {
      'workspace': '#/main/workspace',
      'dashboard': '#/main/dashboard',
      'test-conversation': '#/main/test-conversation',
      'knowledge-admin': '#/main/knowledge-admin',
      'document-knowledge': '#/main/document-knowledge',
      'unanswered-questions': '#/main/unanswered-questions',
      'user-management': '#/main/user-management',
      'system-logs': '#/main/system-logs',
      'avatar-settings': '#/main/character-config',
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
      {/* 手机端抽屉遮罩（侧栏 z=30 之下、内容之上） */}
      {mobileOpen && (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="rgba(15, 23, 42, 0.45)"
          zIndex={29}
          display={{ base: 'block', md: 'none' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 左侧边栏：桌面端固定/可折叠；手机端为抽屉（默认移出屏幕，汉堡键呼出） */}
      <Box
        as="aside"
        width={{ base: '280px', md: isCollapsed ? '80px' : '280px' }}
        height="100vh"
        bg="white"
        borderRight="1px solid"
        borderColor={schoolColors.gray200}
        display="flex"
        flexDirection="column"
        transition="transform 0.3s ease, width 0.3s ease"
        position="fixed"
        left={0}
        top={0}
        zIndex={30}
        className="school-sidebar-menu"
        transform={{ base: mobileOpen ? 'translateX(0)' : 'translateX(-100%)', md: 'none' }}
        boxShadow={{ base: mobileOpen ? 'lg' : 'none', md: 'none' }}
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
              <VStack align="start" gap="0">
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
            {visibleMenuGroups.map((group) => (
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
                    name={user?.username || '未登录'}
                  />
                  <VStack align="start" gap="0" flex="1">
                    <Text fontSize="sm" fontWeight="medium" color={schoolColors.gray800}>
                      {user?.username || '未登录'}
                    </Text>
                    <Text fontSize="10px" color={schoolColors.gray600}>
                      {user?.role === 'admin' ? '系统管理员' : '知识管理员'}
                    </Text>
                  </VStack>
                </>
              )}
            </HStack>

            {/* 操作按钮 */}
            <VStack gap="1" width="full">
              {!isCollapsed && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    width="full"
                    justifyContent="flex-start"
                    onClick={() => { window.location.hash = '#/hero'; }}
                    gap="2"
                  >
                    <FiLogOut size="4" color={schoolColors.gray600} />
                    <Text fontSize="xs" color={schoolColors.gray600}>返回Hero页面</Text>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    width="full"
                    justifyContent="flex-start"
                    onClick={logout}
                    gap="2"
                  >
                    <FiLogOut size="4" color={schoolColors.secondary} />
                    <Text fontSize="xs" color={schoolColors.secondary}>退出登录</Text>
                  </Button>
                </>
              )}
              {/* 折叠按钮（仅桌面端；手机端抽屉固定宽度） */}
              <Button
                variant="ghost"
                size="sm"
                width="full"
                onClick={() => setIsCollapsed(!isCollapsed)}
                color={schoolColors.gray600}
                display={{ base: 'none', md: 'inline-flex' }}
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
            </VStack>
          </VStack>
        </Box>
      </Box>

      {/* 右侧主内容区：手机端全宽（侧栏为抽屉不占位）；桌面端留出侧栏宽度。
          flex:1 使其撑满剩余宽度（此前宽度塌成内容固有宽度，右侧大片空白） */}
      <Box
        ml={{ base: '0', md: isCollapsed ? '80px' : '280px' }}
        height="100vh"
        transition="margin-left 0.3s ease"
        display="flex"
        flexDirection="column"
        flex="1"
        minW="0"
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
          px={{ base: '3', md: '6' }}
          className="school-header"
        >
          <HStack gap="3">
            <IconButton
              display={{ base: 'inline-flex', md: 'none' }}
              aria-label="打开菜单"
              variant="ghost"
              size="sm"
              color={schoolColors.gray600}
              onClick={() => setMobileOpen(true)}
            >
              <FiMenu size={18} />
            </IconButton>
            <Text
              fontSize={{ base: 'sm', md: 'lg' }}
              fontWeight="semibold"
              color={schoolColors.primary}
              className="school-title"
            >
              AI数字人 - 管理员工作台
            </Text>
          </HStack>

          <HStack gap="4">
            <Badge
              display={{ base: 'none', md: 'inline-flex' }}
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
              name={user?.username || '未登录'}
            />
            <Text
              display={{ base: 'none', md: 'block' }}
              fontSize="sm"
              color={schoolColors.gray600}
              fontWeight="medium"
            >
              {user?.username || '未登录'}
            </Text>
          </HStack>
        </Box>

        {/* 主内容区域 */}
        <Box
          flex="1"
          overflowY="auto"
          p={{ base: '3', md: '6' }}
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