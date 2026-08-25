/* eslint-disable react/require-default-props */
import { Box, Button, HStack, VStack, Text, Badge } from '@chakra-ui/react';
import {
  FiSettings, FiClock, FiPlus, FiChevronLeft, FiUsers, FiLayers, FiBook,
  FiGrid, FiDatabase, FiUpload, FiBarChart2, FiTrendingUp, FiActivity
} from 'react-icons/fi';
import { memo, useState, useEffect, useRef } from 'react';
import { sidebarStyles } from './sidebar-styles';
import SettingUI from './setting/setting-ui';
import ChatHistoryPanel from './chat-history-panel';
import BottomTab from './bottom-tab';
import HistoryDrawer from './history-drawer';
import KnowledgeDrawer from '../knowledge/knowledge-drawer';
import { useSidebar } from '@/hooks/sidebar/use-sidebar';
import GroupDrawer from './group-drawer';
import { ModeType } from '@/context/mode-context';
import WelcomeCard from './welcome-card';
import TopicNav from './topic-nav';
import AdminEntry from './admin-entry';
import { useAdmin } from '@/context/admin-context';

// Type definitions
interface SidebarProps {
  isCollapsed?: boolean
  onToggle: () => void
}

interface HeaderButtonsProps {
  onSettingsOpen: () => void
  onNewHistory: () => void
  setMode: (mode: ModeType) => void
  currentMode: 'window' | 'pet'
  isElectron: boolean
}

// 工作台统计组件
const WorkspaceStats = memo(() => {
  // 使用模拟统计数据，后续可连接真实API
  const statItems = [
    { label: '知识条目', value: '1,248', trend: '+12%', icon: FiDatabase },
    { label: '本月上传', value: '89', trend: '+8%', icon: FiUpload },
    { label: '搜索次数', value: '3.4K', trend: '+23%', icon: FiActivity },
  ];

  return (
    <Box px="4" py="3" bg="whiteAlpha.50" borderRadius="lg" mb="2">
      <Text fontSize="sm" fontWeight="semibold" color="white" mb="3" display="flex" alignItems="center" gap="2">
        <FiTrendingUp boxSize="4" />
        工作台概览
      </Text>
      <VStack gap="2" align="stretch">
        {statItems.map((stat, index) => (
          <HStack key={index} justify="space-between" fontSize="xs">
            <HStack gap="2" color="whiteAlpha.800">
              <stat.icon boxSize="3" />
              <Text>{stat.label}</Text>
            </HStack>
            <HStack gap="1">
              <Text color="white" fontWeight="medium">{stat.value}</Text>
              <Text color="green.300" fontSize="10px">{stat.trend}</Text>
            </HStack>
          </HStack>
        ))}
      </VStack>
    </Box>
  );
});

WorkspaceStats.displayName = 'WorkspaceStats';

// 快速操作按钮组件
const QuickActions = memo(() => {
  const { openAdmin } = useAdmin();
  const knowledgeDrawerRef = useRef<{ open: () => void } | null>(null);

  const handleUploadDocument = () => {
    // 打开知识库上传抽屉
    const knowledgeButton = document.querySelector('[data-knowledge-drawer-trigger]') as HTMLButtonElement;
    if (knowledgeButton) {
      knowledgeButton.click();
    }
  };

  const handleCreateKnowledge = () => {
    // 打开知识库管理
    openAdmin();
  };

  const handleViewStats = () => {
    // 打开管理后台的统计页面
    openAdmin();
  };

  const actions = [
    {
      label: '上传文档',
      icon: FiUpload,
      color: 'blue.400',
      onClick: handleUploadDocument
    },
    {
      label: '新建知识',
      icon: FiDatabase,
      color: 'green.400',
      onClick: handleCreateKnowledge
    },
    {
      label: '查看统计',
      icon: FiBarChart2,
      color: 'orange.400',
      onClick: handleViewStats
    },
  ];

  return (
    <Box px="4" py="2">
      <Text fontSize="xs" color="whiteAlpha.600" mb="2" fontWeight="medium">
        快速操作
      </Text>
      <VStack gap="1" align="stretch">
        {actions.map((action) => (
          <Button
            key={action.label}
            size="sm"
            variant="ghost"
            justifyContent="flex-start"
            width="full"
            color="whiteAlpha.900"
            fontSize="xs"
            gap="2"
            borderRadius="md"
            _hover={{
              bg: `${action.color}.20`,
              color: 'white',
            }}
            onClick={action.onClick}
          >
            <action.icon boxSize="3" color={action.color} />
            {action.label}
          </Button>
        ))}
      </VStack>
    </Box>
  );
});

QuickActions.displayName = 'QuickActions';

// Reusable components
const ToggleButton = memo(({ isCollapsed, onToggle }: {
  isCollapsed: boolean
  onToggle: () => void
}) => (
  <Box
    {...sidebarStyles.sidebar.toggleButton}
    style={{
      transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
    }}
    onClick={onToggle}
  >
    <FiChevronLeft />
  </Box>
));

ToggleButton.displayName = 'ToggleButton';

const ModeMenu = memo(({ setMode, currentMode, isElectron }: {
  setMode: (mode: ModeType) => void
  currentMode: ModeType
  isElectron: boolean
}) => (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => {
      if (currentMode === 'window' && isElectron) {
        setMode('pet');
      } else {
        setMode('window');
      }
    }}
    color="whiteAlpha.900"
    _hover={{
      bg: 'whiteAlpha.100',
      color: 'white',
    }}
    title={currentMode === 'window' ? '切换到Pet模式' : '切换到Live模式'}
  >
    <FiLayers />
  </Button>
));

ModeMenu.displayName = 'ModeMenu';

const HeaderButtons = memo(({ onSettingsOpen, onNewHistory, setMode, currentMode, isElectron }: HeaderButtonsProps) => {
  // 切换到工作台模式
  const toggleWorkspaceMode = () => {
    window.location.hash = '#/main?workspace=true';
    window.dispatchEvent(new Event('hashchange'));
  };

  return (
    <Box display="flex" gap={1}>
      <Button
        onClick={toggleWorkspaceMode}
        variant="ghost"
        size="sm"
        color="whiteAlpha.900"
        _hover={{
          bg: 'whiteAlpha.100',
          color: 'white',
        }}
        title="切换到工作台模式"
      >
        <FiGrid />
      </Button>
      <Button
        onClick={onSettingsOpen}
        variant="ghost"
        size="sm"
        color="whiteAlpha.900"
        _hover={{
          bg: 'whiteAlpha.100',
          color: 'white',
        }}
        title="设置"
      >
        <FiSettings />
      </Button>

    <GroupDrawer>
      <Button
        variant="ghost"
        size="sm"
        color="whiteAlpha.900"
        _hover={{
          bg: 'whiteAlpha.100',
          color: 'white',
        }}
        title="群组"
      >
        <FiUsers />
      </Button>
    </GroupDrawer>

    <HistoryDrawer>
      <Button
        variant="ghost"
        size="sm"
        color="whiteAlpha.900"
        _hover={{
          bg: 'whiteAlpha.100',
          color: 'white',
        }}
        title="历史"
      >
        <FiClock />
      </Button>
    </HistoryDrawer>

    <KnowledgeDrawer>
      <Button
        variant="ghost"
        size="sm"
        color="whiteAlpha.900"
        _hover={{
          bg: 'whiteAlpha.100',
          color: 'white',
        }}
        title="知识库"
        data-knowledge-drawer-trigger="true"
      >
        <FiBook />
      </Button>
    </KnowledgeDrawer>

    <Button
      onClick={onNewHistory}
      variant="ghost"
      size="sm"
      color="whiteAlpha.900"
      _hover={{
        bg: 'whiteAlpha.100',
        color: 'white',
      }}
      title="新对话"
    >
      <FiPlus />
    </Button>

    <ModeMenu setMode={setMode} currentMode={currentMode} isElectron={isElectron} />
  </Box>
  );
});

HeaderButtons.displayName = 'HeaderButtons';

const SidebarContent = memo(({
  onSettingsOpen,
  onNewHistory,
  setMode,
  currentMode,
  isElectron
}: HeaderButtonsProps) => (
  <Box {...sidebarStyles.sidebar.content}>
    <Box {...sidebarStyles.sidebar.header}>
      <HeaderButtons
        onSettingsOpen={onSettingsOpen}
        onNewHistory={onNewHistory}
        setMode={setMode}
        currentMode={currentMode}
        isElectron={isElectron}
      />
    </Box>

    {/* 工作台统计 - 新增 */}
    <WorkspaceStats />

    {/* 快速操作 - 新增 */}
    <QuickActions />

    {/* Welcome Card - 新用户引导 */}
    <Box px="4" pt="2">
      <WelcomeCard />
    </Box>

    {/* Topic Navigation - 专题导航 */}
    <Box px="4">
      <TopicNav />
    </Box>

    {/* Admin Entry - 管理后台入口 */}
    <Box px="4" pb="2">
      <AdminEntry variant="menuItem" />
    </Box>

    <ChatHistoryPanel />
    <BottomTab />
  </Box>
));

SidebarContent.displayName = 'SidebarContent';

// Main component
function Sidebar({ isCollapsed = false, onToggle }: SidebarProps): JSX.Element {
  const {
    settingsOpen,
    onSettingsOpen,
    onSettingsClose,
    createNewHistory,
    setMode,
    currentMode,
    isElectron,
  } = useSidebar();

  return (
    <Box {...sidebarStyles.sidebar.container(isCollapsed)}>
      <ToggleButton isCollapsed={isCollapsed} onToggle={onToggle} />

      {!isCollapsed && !settingsOpen && (
        <SidebarContent
          onSettingsOpen={onSettingsOpen}
          onNewHistory={createNewHistory}
          setMode={setMode}
          currentMode={currentMode}
          isElectron={isElectron}
        />
      )}

      {!isCollapsed && settingsOpen && (
        <SettingUI
          open={settingsOpen}
          onClose={onSettingsClose}
          onToggle={onToggle}
        />
      )}
    </Box>
  );
}

export default Sidebar;
