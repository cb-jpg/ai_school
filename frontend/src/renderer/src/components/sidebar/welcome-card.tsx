/**
 * 欢迎卡片组件 - Welcome Card
 * 为新用户提供功能引导
 */

import {
  Box,
  Button,
  Flex,
  Text,
  VStack,
  Icon,
  HStack
} from '@chakra-ui/react';
import { useColorModeValue } from '@/components/ui/color-mode';
import {
  FiMessageCircle,
  FiMic,
  FiBook,
  FiHelpCircle,
  FiArrowRight
} from 'react-icons/fi';

const swissFont = '"Helvetica Neue", Arial, sans-serif';

interface WelcomeCardProps {
  onStartChat?: () => void;
  onOpenHelp?: () => void;
}

interface FeatureItem {
  icon: typeof FiMessageCircle;
  title: string;
  description: string;
}

const features: FeatureItem[] = [
  {
    icon: FiMessageCircle,
    title: '与数字人对话',
    description: '输入文字或语音提问'
  },
  {
    icon: FiMic,
    title: '语音互动',
    description: '按住麦克风说话'
  },
  {
    icon: FiBook,
    title: '校园专题',
    description: '浏览校史、成就、标兵'
  }
];

function FeatureItem({ feature }: { feature: FeatureItem }) {
  const Icon = feature.icon;
  const textColor = useColorModeValue('gray.700', 'gray.200');
  const iconBg = useColorModeValue('blue.50', 'blue.900');

  return (
    <Flex align="flex-start" gap="3">
      <Box
        p="2"
        borderRadius="md"
        bg={iconBg}
        color="#002FA7"
        flexShrink={0}
      >
        <Icon boxSize="4" />
      </Box>
      <Box>
        <Text
          fontSize="sm"
          fontWeight="600"
          color={textColor}
          fontFamily={swissFont}
          mb="1"
        >
          {feature.title}
        </Text>
        <Text
          fontSize="xs"
          color="gray.500"
          fontFamily={swissFont}
        >
          {feature.description}
        </Text>
      </Box>
    </Flex>
  );
}

export default function WelcomeCard({ onStartChat, onOpenHelp }: WelcomeCardProps) {
  const bg = useColorModeValue('blue.50', 'blue.900');
  const borderColor = useColorModeValue('blue.200', 'blue.700');
  const textColor = useColorModeValue('gray.800', 'gray.100');

  const handleStartChat = () => {
    // 聚焦到输入框
    const textarea = document.querySelector('textarea[placeholder*="message" i]');
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.focus();
    }
    onStartChat?.();
  };

  return (
    <Box
      p="5"
      bg={bg}
      borderRadius="lg"
      border="1px solid"
      borderColor={borderColor}
      mb="4"
    >
      {/* Greeting */}
      <Flex align="center" gap="2" mb="4">
        <Text fontSize="lg">👋</Text>
        <Text
          fontSize="base"
          fontWeight="bold"
          color={textColor}
          fontFamily={swissFont}
        >
          欢迎使用数字人
        </Text>
      </Flex>

      {/* Features */}
      <VStack gap="3" mb="4">
        {features.map((feature, index) => (
          <FeatureItem key={index} feature={feature} />
        ))}
      </VStack>

      {/* Action Buttons */}
      <HStack gap="2">
        <Button
          size="sm"
          onClick={handleStartChat}
          bg="#002FA7"
          color="white"
          _hover={{ bg: '#001F7A' }}
          fontFamily={swissFont}
          fontWeight="600"
          leftIcon={<FiMessageCircle size="14px" />}
        >
          开始对话
        </Button>
        <Button
          size="sm"
          variant="outline"
          borderColor={borderColor}
          onClick={onOpenHelp}
          fontFamily={swissFont}
          fontWeight="600"
          leftIcon={<FiHelpCircle size="14px" />}
        >
          使用帮助
        </Button>
      </HStack>
    </Box>
  );
}
