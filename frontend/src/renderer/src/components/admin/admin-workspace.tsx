/**
 * AI知识库助手 - 工作台页面
 * 集成现有系统Context和API的后台管理界面
 */

import { FC, useState } from 'react';
import { Box, Button, HStack, VStack, Text, Input } from '@chakra-ui/react';
import { toaster } from '@/components/ui/toaster';

import {
  FiDatabase,
  FiSettings,
  FiFileText,
  FiUpload,
  FiBarChart2,
  FiBookOpen,
  FiUsers,
  FiChevronLeft,
  FiChevronRight,
  FiBell,
  FiSearch,
  FiLogOut,
  FiGrid,
} from 'react-icons/fi';

// 类型定义
interface NavItem {
  id: string;
  label: string;
  icon: typeof FiGrid;
  badge?: string | number;
  children?: NavItem[];
}

// 侧边栏组件
const AdminSidebar: FC<{
  isCollapsed: boolean;
  onToggle: () => void;
  activeItem: string;
  onItemClick: (itemId: string) => void;
}> = ({ isCollapsed, onToggle, activeItem, onItemClick }) => {
  const navItems: NavItem[] = [
    {
      id: 'workspace',
      label: '工作台',
      icon: FiGrid,
    },
    {
      id: 'knowledge',
      label: '知识库管理',
      icon: FiDatabase,
      children: [
        { id: 'knowledge-list', label: '知识列表', icon: FiFileText },
        { id: 'knowledge-upload', label: '上传管理', icon: FiUpload },
        { id: 'knowledge-stats', label: '统计分析', icon: FiBarChart2 },
      ],
    },
    {
      id: 'campus',
      label: '校园内容',
      icon: FiBookOpen,
      children: [
        { id: 'campus-history', label: '校史管理', icon: FiFileText },
        { id: 'campus-achievements', label: '成就管理', icon: FiFileText },
        { id: 'campus-role-models', label: '标兵管理', icon: FiUsers },
      ],
    },
    {
      id: 'settings',
      label: '系统设置',
      icon: FiSettings,
    },
  ];

  const [expandedSections, setExpandedSections] = useState<string[]>(['knowledge', 'campus']);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId],
    );
  };

  return (
    <Box
      bg="white"
      borderRight="1px solid"
      borderColor="gray.200"
      height="100vh"
      display="flex"
      flexDirection="column"
      transition="all 0.3s"
      width={isCollapsed ? '80px' : '280px'}
      fontFamily="Inter, sans-serif"
    >
      {/* Logo区域 */}
      <Box
        height="16"
        display="flex"
        alignItems="center"
        px="6"
        borderBottom="1px solid"
        borderColor="gray.200"
      >
        <HStack gap="3">
          <Box
            width="8"
            height="8"
            borderRadius="lg"
            backgroundGradient="to-br"
            gradientFrom="gray.800"
            gradientTo="gray.700"
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

      {/* 导航菜单 */}
      <Box
        as="nav"
        flex="1"
        overflowY="auto"
        py="6"
        px="3"
      >
        <VStack gap="1" align="stretch">
          {navItems.map((item) => (
            <Box key={item.id}>
              {item.children ? (
                // 有子菜单的项目
                <VStack gap="1" align="stretch">
                  <Button
                    variant="ghost"
                    width="full"
                    justifyContent="space-between"
                    onClick={() => {
                      onItemClick(item.id);
                      if (!isCollapsed) toggleSection(item.id);
                    }}
                    backgroundColor={
                      activeItem === item.id || activeItem?.startsWith(item.id)
                        ? 'gray.900'
                        : 'transparent'
                    }
                    color={
                      activeItem === item.id || activeItem?.startsWith(item.id)
                        ? 'white'
                        : 'gray.600'
                    }
                    _hover={{
                      backgroundColor:
                        activeItem === item.id || activeItem?.startsWith(item.id)
                          ? 'gray.900'
                          : 'gray.100',
                      color:
                        activeItem === item.id || activeItem?.startsWith(item.id)
                          ? 'white'
                          : 'gray.900',
                    }}
                    borderRadius="lg"
                    py="2.5"
                    px="3"
                  >
                    <HStack gap="3">
                      <item.icon size="5" />
                      {!isCollapsed && (
                        <Text fontSize="sm" fontWeight="medium">
                          {item.label}
                        </Text>
                      )}
                    </HStack>
                    {!isCollapsed && (
                      <Box
                        transition="transform 0.2s"
                        transform={
                          expandedSections.includes(item.id)
                            ? 'rotate(90deg)'
                            : 'rotate(0deg)'
                        }
                      >
                        <FiChevronRight size="4" />
                      </Box>
                    )}
                  </Button>

                  {/* 子菜单 */}
                  {!isCollapsed && expandedSections.includes(item.id) && (
                    <VStack
                      gap="1"
                      align="stretch"
                      ml="8"
                    >
                      {item.children.map((child) => (
                        <Button
                          key={child.id}
                          variant="ghost"
                          size="sm"
                          onClick={() => onItemClick(child.id)}
                          color={
                            activeItem === child.id ? 'indigo.600' : 'gray.600'
                          }
                          fontWeight={activeItem === child.id ? 'medium' : 'normal'}
                          justifyContent="flex-start"
                        >
                          <HStack gap="2">
                            {child.icon && <child.icon size="4" />}
                            {child.label}
                          </HStack>
                        </Button>
                      ))}
                    </VStack>
                  )}
                </VStack>
              ) : (
                // 无子菜单的项目
                <Button
                  variant="ghost"
                  width="full"
                  onClick={() => onItemClick(item.id)}
                  backgroundColor={
                    activeItem === item.id ? 'gray.900' : 'transparent'
                  }
                  color={activeItem === item.id ? 'white' : 'gray.600'}
                  _hover={{
                    backgroundColor: activeItem === item.id ? 'gray.900' : 'gray.100',
                    color: activeItem === item.id ? 'white' : 'gray.900',
                  }}
                  borderRadius="lg"
                  py="2.5"
                  px="3"
                >
                  <HStack gap="3">
                    <item.icon size="5" />
                    {!isCollapsed && (
                      <Text fontSize="sm" fontWeight="medium">
                        {item.label}
                      </Text>
                    )}
                    {item.badge && !isCollapsed && (
                      <Box
                        ml="auto"
                        backgroundColor="indigo.500"
                        color="white"
                        fontSize="xs"
                        px="2"
                        py="0.5"
                        borderRadius="full"
                      >
                        {item.badge}
                      </Box>
                    )}
                  </HStack>
                </Button>
              )}
            </Box>
          ))}
        </VStack>
      </Box>

      {/* 底部折叠按钮 */}
      <Box
        p="3"
        borderTop="1px solid"
        borderColor="gray.200"
      >
        <Button
          variant="ghost"
          width="full"
          onClick={onToggle}
          color="gray.600"
          _hover={{
            backgroundColor: 'gray.100',
            color: 'gray.900',
          }}
        >
          <HStack gap="2">
            {isCollapsed ? (
              <FiChevronRight size="5" />
            ) : (
              <>
                <FiChevronLeft size="5" />
                <Text fontSize="sm">收起侧边栏</Text>
              </>
            )}
          </HStack>
        </Button>
      </Box>
    </Box>
  );
};

// 顶部导航栏组件
const AdminHeader: FC<{ sidebarCollapsed: boolean; userName?: string }> = ({
  userName = '管理员',
}) => {
  const [notifications] = useState([
    { id: 1, message: '知识库更新完成', time: '5分钟前' },
    { id: 2, message: '新的文档上传', time: '1小时前' },
  ]);

  return (
    <Box
      height="16"
      borderBottom="1px solid"
      borderColor="gray.200"
      backgroundColor="white/80"
      backdropBlur="sm"
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      px="6"
      zIndex="20"
      fontFamily="Inter, sans-serif"
    >
      {/* 搜索栏 */}
      <HStack gap="4">
        <Box position="relative" width="80">
          <FiSearch
            transform="translateY(-50%)"
            color="gray.400"
          />
          <Input
            placeholder="搜索知识库、文档..."
            width="full"
            paddingLeft="10"
            paddingRight="4"
            paddingY="2"
            backgroundColor="gray.100"
            borderRadius="lg"
            fontSize="sm"
            border="0"
            _focus={{ outline: 'none', boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.2)' }}
            fontFamily="Inter, sans-serif"
          />
          <Box
            as="kbd"
            position="absolute"
            right="3"
            top="50%"
            transform="translateY(-50%)"
            px="2"
            py="0.5"
            fontSize="xs"
            color="gray.400"
            backgroundColor="white"
            borderRadius="md"
            border="1px solid"
            borderColor="gray.200"
          >
            ⌘K
          </Box>
        </Box>
      </HStack>

      {/* 右侧操作区 */}
      <HStack gap="4">
        {/* 通知按钮 */}
        <Button
          variant="ghost"
          position="relative"
          color="gray.600"
          _hover={{
            backgroundColor: 'gray.100',
            color: 'gray.900',
          }}
        >
          <FiBell size="5" />
          {notifications.length > 0 && (
            <Box
              position="absolute"
              top="1"
              right="1"
              width="2"
              height="2"
              backgroundColor="indigo.500"
              borderRadius="full"
            />
          )}
        </Button>

        {/* 用户菜单 */}
        <HStack
          gap="3"
          pl="4"
          borderLeft="1px solid"
          borderColor="gray.200"
        >
          <Box textAlign="right">
            <Text fontSize="sm" fontWeight="medium" color="gray.900">
              {userName}
            </Text>
            <Text fontSize="xs" color="gray.500">
              系统管理员
            </Text>
          </Box>
          <Box
            width="9"
            height="9"
            borderRadius="full"
            backgroundGradient="to-br"
            gradientFrom="indigo.500"
            gradientTo="indigo.600"
            display="flex"
            alignItems="center"
            justifyContent="center"
            color="white"
            fontWeight="medium"
          >
            {userName.charAt(0)}
          </Box>
          <Button
            variant="ghost"
            size="sm"
            color="gray.600"
            _hover={{
              backgroundColor: 'gray.100',
              color: 'gray.900',
            }}
            onClick={() => {
              toaster.create({ title: '已退出登录', type: 'info' });
              window.location.hash = '#/main';
            }}
            title="退出工作台"
          >
            <FiLogOut size="4" />
          </Button>
        </HStack>
      </HStack>
    </Box>
  );
};

// 主内容区域组件
const AdminContent: FC<{
  activeItem: string;
}> = ({ activeItem }) => {
  // 根据activeItem渲染不同的内容
  const renderContent = () => {
    switch (activeItem) {
      case 'workspace':
        return <WorkspaceDashboard />;
      case 'knowledge-list':
        return <KnowledgeListContent />;
      case 'knowledge-upload':
        return <KnowledgeUploadContent />;
      case 'knowledge-stats':
        return <KnowledgeStatsContent />;
      default:
        return <WorkspaceDashboard />;
    }
  };

  return (
    <Box
      flex="1"
      overflowY="auto"
      backgroundColor="gray.50"
    >
      <Box p="6" md={{ p: '8' }}>
        {renderContent()}
      </Box>
    </Box>
  );
};

// 工作台仪表板内容
const WorkspaceDashboard: FC = () => {
  const [stats] = useState({
    total_entries: 1248,
    uploaded: 89,
    searches: 3456,
    active_users: 456,
  });

  return (
    <>
      <Box mb="8">
        <Text
          fontSize="3xl"
          md={{ fontSize: '4xl' }}
          fontWeight="semibold"
          color="gray.900"
          mb="2"
          fontFamily="Instrument Serif, serif"
        >
          工作台
        </Text>
        <Text fontSize="base" color="gray.600" maxW="2xl">
          欢迎回来！这是您的AI知识库助手管理工作台概览。
        </Text>
      </Box>

      {/* 统计卡片 */}
      <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }}
        gap="6"
        mb="8"
      >
        <StatCard
          title="知识条目"
          value={stats.total_entries.toLocaleString()}
          change="+12.5%"
          trend="up"
          icon={FiDatabase}
        />
        <StatCard
          title="本月上传"
          value={stats.uploaded}
          change="+8.2%"
          trend="up"
          icon={FiUpload}
        />
        <StatCard
          title="搜索次数"
          value={stats.searches.toLocaleString()}
          change="+23.1%"
          trend="up"
          icon={FiSearch}
        />
        <StatCard
          title="活跃用户"
          value={stats.active_users}
          change="+5.8%"
          trend="up"
          icon={FiUsers}
        />
      </Box>

      {/* 主要内容区域 */}
      <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', lg: 'repeat(3, 1fr)' }}
        gap="6"
      >
        {/* 快速操作 */}
        <ContentCard title="快速操作" colSpan={{ base: 1, lg: 1 }}>
          <Box
            display="grid"
            gridTemplateColumns="repeat(2, 1fr)"
            gap="3"
          >
            {[
              { label: '上传文档', icon: FiUpload, color: 'blue.500' },
              { label: '添加知识', icon: FiFileText, color: 'green.500' },
              { label: '管理分类', icon: FiBookOpen, color: 'purple.500' },
              { label: '查看统计', icon: FiBarChart2, color: 'orange.500' },
            ].map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="lg"
                flexDirection="column"
                gap="3"
                height="auto"
                py="6"
                borderRadius="xl"
                _hover={{ transform: 'scale(1.05)', translateY: '-2px' }}
                _active={{ transform: 'scale(0.95)' }}
                onClick={() =>
                  toaster.create({
                    title: `${action.label}功能开发中`,
                    type: 'info',
                  })
                }
              >
                <Box
                  width="12"
                  height="12"
                  rounded="full"
                  backgroundColor={`${action.color}`}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <action.icon size="6" color="white" />
                </Box>
                <Text fontSize="sm" fontWeight="medium" color="gray.900">
                  {action.label}
                </Text>
              </Button>
            ))}
          </Box>
        </ContentCard>

        {/* 系统状态 */}
        <ContentCard title="系统状态" colSpan={{ base: 1, lg: 2 }}>
          <VStack gap="4" align="stretch">
            {[
              { name: '知识库服务', status: '正常' },
              { name: '搜索引擎', status: '正常' },
              { name: 'AI服务', status: '正常' },
              { name: '存储空间', status: '45.2 GB / 100 GB' },
            ].map((item) => (
              <HStack key={item.name} justify="space-between">
                <Text fontSize="sm" color="gray.600">
                  {item.name}
                </Text>
                <Text fontSize="sm" color="gray.900">
                  {item.status}
                </Text>
              </HStack>
            ))}
          </VStack>
        </ContentCard>
      </Box>
    </>
  );
};

// 统计卡片组件
const StatCard: FC<{
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: typeof FiDatabase;
}> = ({ title, value, change, trend, icon: Icon }) => (
  <Box
    backgroundColor="white"
    rounded="xl"
    border="1px solid"
    borderColor="gray.200"
    p="6"
    _hover={{ shadow: 'lg' }}
    transition="shadow"
  >
    <HStack justify="space-between" align="start">
      <Box>
        <Text fontSize="sm" color="gray.600" mb="1">
          {title}
        </Text>
        <Text fontSize="2xl" fontWeight="semibold" color="gray.900">
          {value}
        </Text>
        {change && (
          <Text
            fontSize="sm"
            mt="2"
            color={
              trend === 'up'
                ? 'green.600'
                : trend === 'down'
                ? 'red.600'
                : 'gray.500'
            }
          >
            {change}
          </Text>
        )}
      </Box>
      {Icon && (
        <Box p="3" rounded="lg" backgroundColor="gray.100">
          <Icon size="5" color="indigo.500" />
        </Box>
      )}
    </HStack>
  </Box>
);

// 内容卡片组件
const ContentCard: FC<{
  title: string;
  children: React.ReactNode;
  colSpan?: any;
}> = ({ title, children, colSpan }) => (
  <Box
    backgroundColor="white"
    rounded="xl"
    border="1px solid"
    borderColor="gray.200"
    overflow="hidden"
    gridColumn={colSpan}
  >
    <Box px="6" py="4" borderBottom="1px solid" borderColor="gray.200">
      <Text fontSize="lg" fontWeight="semibold" color="gray.900">
        {title}
      </Text>
    </Box>
    <Box p="6">{children}</Box>
  </Box>
);

// 知识列表内容占位符
const KnowledgeListContent: FC = () => (
  <>
    <Box mb="8">
      <Text
        fontSize="3xl"
        fontWeight="semibold"
        color="gray.900"
        mb="2"
        fontFamily="Instrument Serif, serif"
      >
        知识列表
      </Text>
      <Text fontSize="base" color="gray.600">
        管理和维护学校知识库内容
      </Text>
    </Box>
    <ContentCard title="知识库列表">
      <Box textAlign="center" py="12">
        <FiDatabase size="16" color="gray.300" />
        <Text color="gray.500">知识库列表功能开发中...</Text>
      </Box>
    </ContentCard>
  </>
);

// 上传管理内容占位符
const KnowledgeUploadContent: FC = () => (
  <>
    <Box mb="8">
      <Text
        fontSize="3xl"
        fontWeight="semibold"
        color="gray.900"
        mb="2"
        fontFamily="Instrument Serif, serif"
      >
        上传管理
      </Text>
      <Text fontSize="base" color="gray.600">
        批量上传和处理知识文档
      </Text>
    </Box>
    <ContentCard title="文件上传">
      <Box textAlign="center" py="12">
        <FiUpload size="16" color="gray.300" />
        <Text color="gray.500">文件上传功能开发中...</Text>
      </Box>
    </ContentCard>
  </>
);

// 统计分析内容占位符
const KnowledgeStatsContent: FC = () => (
  <>
    <Box mb="8">
      <Text
        fontSize="3xl"
        fontWeight="semibold"
        color="gray.900"
        mb="2"
        fontFamily="Instrument Serif, serif"
      >
        统计分析
      </Text>
      <Text fontSize="base" color="gray.600">
        知识库使用统计和分析报告
      </Text>
    </Box>
    <ContentCard title="数据统计">
      <Box textAlign="center" py="12">
        <FiBarChart2 size="16" color="gray.300" />
        <Text color="gray.500">统计分析功能开发中...</Text>
      </Box>
    </ContentCard>
  </>
);

// 主工作台组件
export const AdminWorkspace: FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState('workspace');

  return (
    <Box
      display="flex"
      height="100vh"
      backgroundColor="white"
      overflow="hidden"
      fontFamily="Inter, sans-serif"
    >
      {/* 侧边栏 */}
      <AdminSidebar
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeItem={activeItem}
        onItemClick={setActiveItem}
      />

      {/* 主内容区域 */}
      <Box flex="1" display="flex" flexDirection="column" overflow="hidden">
        {/* 顶部导航 */}
        <AdminHeader sidebarCollapsed={sidebarCollapsed} />

        {/* 内容区域 */}
        <AdminContent activeItem={activeItem} />
      </Box>
    </Box>
  );
};

export default AdminWorkspace;
