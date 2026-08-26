/**
 * Knowledge Base Admin Panel
 * Main admin interface for managing the school knowledge base
 */

import {
  Box,
  Button,
  Flex,
  Text,
  HStack,
  Tabs,
  Icon,
  Spinner,
  createToaster
} from '@chakra-ui/react';
import {
  FiBookOpen,
  FiUpload,
  FiList,
  FiBarChart2,
  FiHelpCircle,
  FiRefreshCw,
  FiSettings,
  FiLogOut
} from 'react-icons/fi';
import { useState, useCallback } from 'react';
import { useKnowledgeAdminAPI } from '@/services/knowledge-admin-api';
import KnowledgeDashboard from './knowledge-dashboard';
import KnowledgeList from './knowledge-list';
import KnowledgeUpload from './knowledge-upload';
import UnansweredQuestions from './unanswered-questions';

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
const surface = '#F7F7F8';
const blue = '#002FA7';
const blueWash = '#E8EEFF';

interface KnowledgeAdminProps {
  onClose?: () => void;
}

export default function KnowledgeAdmin({ onClose }: KnowledgeAdminProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { checkHealth, rebuildIndex } = useKnowledgeAdminAPI();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await checkHealth();
      toaster.create({
        title: '刷新成功',
        description: '知识库数据已更新',
        type: 'success'
      });
      // Trigger re-render by changing tab state slightly
      setActiveTab(prev => prev);
    } catch (error) {
      toaster.create({
        title: '刷新失败',
        description: error instanceof Error ? error.message : '无法连接到知识库服务',
        type: 'error'
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [checkHealth]);

  const handleRebuildIndex = useCallback(async () => {
    if (!confirm('确定要重建知识库索引吗？这可能需要一些时间。')) return;

    setIsRefreshing(true);
    try {
      const result = await rebuildIndex();
      if (result.success) {
        toaster.create({
          title: '索引重建成功',
          description: result.message,
          type: 'success'
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toaster.create({
        title: '索引重建失败',
        description: error instanceof Error ? error.message : '未知错误',
        type: 'error'
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [rebuildIndex]);

  const tabs = [
    { id: '0', label: '概览', icon: FiBarChart2 },
    { id: '1', label: '知识库', icon: FiList },
    { id: '2', label: '上传', icon: FiUpload },
    { id: '3', label: '未回答问题', icon: FiHelpCircle },
  ];

  return (
    <Box
      position="absolute"
      top={{ base: '10px', lg: '16px' }}
      left={{ base: '12px', lg: '24px' }}
      right={{ base: '12px', lg: '24px' }}
      bottom={{ base: '10px', lg: '16px' }}
      zIndex={30}
      background={paper}
      border="1px solid"
      borderColor={hairline}
      fontFamily={swissFont}
      borderRadius="4px"
      overflow="hidden"
    >
      {/* Header */}
      <Box
        px={{ base: '16px', lg: '24px' }}
        py="16px"
        borderBottom="1px solid"
        borderColor={hairline}
        background={surface}
      >
        <Flex align="center" justify="space-between" gap="16px" flexWrap="wrap">
          <Flex align="center" gap="12px">
            <Box width="32px" height="32px" background={blue} color={paper} display="grid" placeItems="center" borderRadius="2px">
              <Icon as={FiBookOpen} width="16px" height="16px" />
            </Box>
            <Box>
              <Text color={ink} fontSize="16px" fontWeight="700" lineHeight="1.1">
                知识库管理后台
              </Text>
              <Text mt="3px" color={muted} fontSize="11px" lineHeight="1.1">
                学校知识 RAG 数据库管理
              </Text>
            </Box>
          </Flex>

          <HStack gap="8px">
            <Button
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              height="32px"
              px="12px"
              borderRadius="2px"
              border="1px solid"
              borderColor={hairline}
              background={paper}
              color={ink}
              fontFamily={swissFont}
              _hover={{ borderColor: blue, color: blue, background: blueWash }}
            >
              {isRefreshing ? <Spinner size="xs" /> : <Icon as={FiRefreshCw} />}
              刷新
            </Button>
            <Button
              size="sm"
              onClick={handleRebuildIndex}
              disabled={isRefreshing}
              height="32px"
              px="12px"
              borderRadius="2px"
              border="1px solid"
              borderColor={blue}
              background={blue}
              color={paper}
              fontFamily={swissFont}
              _hover={{ background: ink, borderColor: ink }}
            >
              <Icon as={FiSettings} />
              重建索引
            </Button>
            {onClose && (
              <Button
                size="sm"
                onClick={onClose}
                height="32px"
                px="12px"
                borderRadius="2px"
                border="1px solid"
                borderColor={hairline}
                background={paper}
                color={muted}
                fontFamily={swissFont}
                _hover={{ borderColor: '#B3261E', color: '#B3261E' }}
              >
                <Icon as={FiLogOut} />
                关闭
              </Button>
            )}
          </HStack>
        </Flex>
      </Box>

      {/* Tabs */}
      <Box px={{ base: '16px', lg: '24px' }}>
        <Tabs.Root
          value={tabs[activeTab].id}
          onValueChange={(details) => setActiveTab(tabs.findIndex(t => t.id === details.value))}
        >
          <Tabs.List
            borderBottom="2px solid"
            borderColor={hairline}
            gap="24px"
          >
            {tabs.map((tab) => (
              <Tabs.Trigger
                key={tab.id}
                value={tab.id}
                py="12px"
                px="0"
                borderBottom="3px solid transparent"
                borderBottomColor={activeTab === tabs.indexOf(tab) ? blue : 'transparent'}
                color={activeTab === tabs.indexOf(tab) ? ink : muted}
                fontWeight={activeTab === tabs.indexOf(tab) ? '700' : '400'}
                fontSize="13px"
                _selected={{ color: blue }}
                _hover={{ color: blue }}
              >
                <HStack gap="6px">
                  <Icon as={tab.icon} width="14px" height="14px" />
                  <Text>{tab.label}</Text>
                </HStack>
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <Tabs.Content value={tabs[0].id} p="0">
            <KnowledgeDashboard />
          </Tabs.Content>
          <Tabs.Content value={tabs[1].id} p="0">
            <KnowledgeList />
          </Tabs.Content>
          <Tabs.Content value={tabs[2].id} p="0">
            <KnowledgeUpload />
          </Tabs.Content>
          <Tabs.Content value={tabs[3].id} p="0">
            <UnansweredQuestions />
          </Tabs.Content>
        </Tabs.Root>
      </Box>
    </Box>
  );
}
