/**
 * 专题导航组件 - Topic Navigation
 * 在侧边栏中显示校园专题入口
 */

import {
  Box,
  Button,
  Flex,
  Text,
  VStack,
  Icon
} from '@chakra-ui/react';
import { useColorModeValue } from '@/components/ui/color-mode';
import {
  FiBook,
  FiAward,
  FiUsers
} from 'react-icons/fi';
import { useInterrupt } from '@/hooks/utils/use-interrupt';

const swissFont = '"Helvetica Neue", Arial, sans-serif';

interface Topic {
  id: string;
  title: string;
  icon: typeof FiBook;
  color: string;
  description: string;
}

const topics: Topic[] = [
  {
    id: 'history',
    title: '校史',
    icon: FiBook,
    color: '#002FA7',
    description: '了解学校发展历程'
  },
  {
    id: 'achievements',
    title: '学校成就',
    icon: FiAward,
    color: '#047857',
    description: '查看办学成果展示'
  },
  {
    id: 'role-models',
    title: '学习标兵',
    icon: FiUsers,
    color: '#B45309',
    description: '学习优秀学长经验'
  }
];

interface TopicNavProps {
  onNavigate?: (topicId: string) => void;
}

export default function TopicNav({ onNavigate }: TopicNavProps) {
  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const hoverBg = useColorModeValue('blue.50', 'blue.900');
  const { interrupt } = useInterrupt();

  const handleTopicClick = (topicId: string) => {
    // 切换界面时打断语音播报
    interrupt();

    // 更新 URL hash
    window.location.hash = `#/campus/${topicId}`;
    if (onNavigate) {
      onNavigate(topicId);
    }
  };

  return (
    <Box
      p="4"
      bg={bg}
      borderRadius="lg"
      border="1px solid"
      borderColor={borderColor}
      mb="4"
    >
      <Flex align="center" gap="2" mb="3">
        <Icon as={FiBook} color="#002FA7" boxSize="5" />
        <Text
          fontSize="sm"
          fontWeight="bold"
          color={textColor}
          fontFamily={swissFont}
        >
          📚 校园专题
        </Text>
      </Flex>

      <VStack gap="2" align="stretch">
        {topics.map((topic) => {
          const Icon = topic.icon;
          return (
            <Button
              key={topic.id}
              onClick={() => handleTopicClick(topic.id)}
              variant="ghost"
              justifyContent="flex-start"
              height="auto"
              py="3"
              px="4"
              borderRadius="md"
              _hover={{
                bg: hoverBg,
                transform: 'translateX(4px)'
              }}
              transition="all 0.2s ease"
            >
              <Flex align="center" gap="3" width="100%">
                <Box
                  p="2"
                  borderRadius="md"
                  bg={`${topic.color}10`}
                  color={topic.color}
                >
                  <Icon size="4" />
                </Box>
                <Box flex="1" textAlign="left">
                  <Text
                    fontSize="sm"
                    fontWeight="600"
                    color={textColor}
                    fontFamily={swissFont}
                  >
                    {topic.title}
                  </Text>
                  <Text
                    fontSize="xs"
                    color="gray.500"
                    fontFamily={swissFont}
                  >
                    {topic.description}
                  </Text>
                </Box>
              </Flex>
            </Button>
          );
        })}
      </VStack>
    </Box>
  );
}
