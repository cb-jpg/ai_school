/**
 * 石实实验学校 - 数据仪表盘
 * 管理员工作台首页
 */

import { FC } from 'react';
import { Box, VStack, HStack, Text, Button } from '@chakra-ui/react';
import {
  FiBook,
  FiMessageSquare,
  FiSettings,
} from 'react-icons/fi';

// 学校颜色配置
const colors = {
  primary: '#1a4d8f',
  primaryLight: '#2d6ab3',
  secondary: '#c41e3a',
  accent: '#d4a520',
  gray50: '#f8fafc',
  gray100: '#f1f5f9',
  gray200: '#e2e8f0',
  gray600: '#475569',
  gray800: '#1e293b',
};

// 主仪表盘组件
export const SchoolDashboard: FC = () => {
  return (
    <VStack gap="6" align="stretch" maxW="7xl" mx="auto">
      {/* 欢迎区域 */}
      <Box
        bg="white"
        rounded="xl"
        p="6"
        border="1px solid"
        borderColor={colors.gray200}
      >
        <HStack justify="space-between" align="center">
          <VStack align="start" gap="1">
            <Text fontSize="2xl" fontWeight="bold" color={colors.gray800}>
              欢迎回来，管理员
            </Text>
            <Text fontSize="sm" color={colors.gray600}>
              石实实验学校AI数字人管理工作台
            </Text>
          </VStack>
          <Box
            bg={colors.primary}
            color="white"
            px="4"
            py="2"
            rounded="lg"
            fontSize="sm"
            fontWeight="medium"
          >
            系统运行正常
          </Box>
        </HStack>
      </Box>

      {/* 快速操作 */}
      <Box
        bg="white"
        rounded="xl"
        p="6"
        border="1px solid"
        borderColor={colors.gray200}
      >
        <Text fontSize="lg" fontWeight="semibold" color={colors.gray800} mb="4">
          快速操作
        </Text>

        <HStack gap="4" flexWrap="wrap">
          <Button
            colorScheme="blue"
            size="md"
            rounded="lg"
            onClick={() => { window.location.hash = '#/main/knowledge-admin'; }}
          >
            <FiBook />
            管理知识库
          </Button>
          <Button
            colorScheme="purple"
            size="md"
            rounded="lg"
            onClick={() => { window.location.hash = '#/main/test-conversation'; }}
          >
            <FiMessageSquare />
            测试对话
          </Button>
          <Button
            colorScheme="gray"
            size="md"
            rounded="lg"
            onClick={() => { window.location.hash = '#/main/workspace'; }}
          >
            <FiSettings />
            系统设置
          </Button>
        </HStack>
      </Box>

      {/* 系统信息 */}
      <Box
        bg="white"
        rounded="xl"
        p="6"
        border="1px solid"
        borderColor={colors.gray200}
      >
        <Text fontSize="lg" fontWeight="semibold" color={colors.gray800} mb="4">
          系统信息
        </Text>

        <VStack gap="3" align="start">
          <HStack gap="2">
            <Text fontSize="sm" color={colors.gray600} minW="120px">
              系统版本：
            </Text>
            <Text fontSize="sm" color={colors.gray800} fontWeight="medium">
              v1.2.1
            </Text>
          </HStack>
          <HStack gap="2">
            <Text fontSize="sm" color={colors.gray600} minW="120px">
              后端服务：
            </Text>
            <Text fontSize="sm" color={colors.gray800} fontWeight="medium">
              http://localhost:12393
            </Text>
          </HStack>
          <HStack gap="2">
            <Text fontSize="sm" color={colors.gray600} minW="120px">
              功能状态：
            </Text>
            <Text fontSize="sm" color="green.600" fontWeight="medium">
              正常运行
            </Text>
          </HStack>
        </VStack>
      </Box>
    </VStack>
  );
};

export default SchoolDashboard;