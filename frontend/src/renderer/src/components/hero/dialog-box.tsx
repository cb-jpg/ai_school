/**
 * Dialog Box Component
 * 对话框组件 - 左侧主要交互区域
 * 集成现有的对话系统，明亮简洁风格
 */

import { memo, useRef, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Textarea,
  Button,
  IconButton,
  Badge,
  Flex,
  Switch,
} from '@chakra-ui/react';
import { BsMicFill, BsMicMuteFill, BsMic } from 'react-icons/bs';
import { IoSend } from 'react-icons/io5';
import { FiArrowRight } from 'react-icons/fi';
import { useTextInput } from '@/hooks/footer/use-text-input';
import { useWebSocket } from '@/context/websocket-context';
import { useAiState, AiStateEnum } from '@/context/ai-state-context';
import { useSubtitleDisplay } from '@/hooks/canvas/use-subtitle-display';
import { useVAD } from '@/context/vad-context';
import { useChatHistory } from '@/context/chat-history-context';

// 明亮简洁风格配色
const lightColors = {
  bg: '#FAFAFA',
  primary: '#002FA7',
  text: '#121826',
  textSecondary: '#586174',
  border: '#E5E7EB',
  white: '#FFFFFF',
  userBubble: '#002FA7',
  assistantBubble: '#F3F4F6',
};

interface DialogBoxProps {
  schoolName: string;
  tagline: string;
  description: string;
}

const DialogBox = memo(({ schoolName, tagline, description }: DialogBoxProps) => {
  const textInput = useTextInput();
  const { wsState } = useWebSocket();
  const { aiState } = useAiState();
  const { subtitleText } = useSubtitleDisplay();
  const { micOn, startMic, stopMic, autoStopMic, setAutoStopMic } = useVAD();
  const { messages } = useChatHistory();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 确保麦克风不会自动启动（仅在首次加载时执行）
  useEffect(() => {
    if (micOn) {
      console.log('麦克风已自动启动，正在关闭...');
      stopMic();
    }
  }, []); // 只在组件挂载时执行一次

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, subtitleText]);

  const handleSendMessage = () => {
    if (textInput.inputText.trim()) {
      // 使用现有的 submitText 发送消息
      textInput.submitText(textInput.inputText);
    }
  };

  const getStatusText = () => {
    if (wsState !== 'connected') return '等待连接...';
    switch (aiState) {
      case AiStateEnum.THINKING_SPEAKING: return '思考中...';
      case AiStateEnum.LISTENING: return '聆听中...';
      case AiStateEnum.IDLE: return '在线';
      default: return '';
    }
  };

  return (
    <Flex
      flexDirection="column"
      h="full"
      maxHeight="calc(100vh - 160px)"
    >
      <VStack spacing={6} align="stretch" flex={1} overflow="hidden">
        {/* Welcome Badge */}
        <Box>
          <HStack spacing={2} mb={4}>
            <Badge
              bg="blue.50"
              color="blue.700"
              px={3}
              py={1}
              rounded="md"
              fontSize={{ base: 'xs', sm: 'sm' }}
            >
              人工智能 · 教育创新
            </Badge>

            {/* Status Indicator */}
            <HStack spacing={2}>
              <Box
                w={2}
                h={2}
                rounded="full"
                bg={wsState === 'connected' ? 'green.500' : 'gray.400'}
              />
              <Text fontSize="sm" color={lightColors.textSecondary}>
                {getStatusText()}
              </Text>
            </HStack>
          </HStack>

          <Text
            fontSize={{ base: '2xl', sm: '4xl', md: '5xl' }}
            fontWeight="bold"
            leadingTight={1.1}
            color={lightColors.text}
            mb={3}
            style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif' }}
          >
            {tagline}
          </Text>

          <Text
            fontSize={{ base: 'sm', sm: 'base', md: 'lg' }}
            leading="relaxed"
            color={lightColors.textSecondary}
            maxW={{ base: 'sm', sm: 'lg', md: 'xl' }}
            mb={{ base: 4, sm: 5 }}
          >
            {description}
          </Text>
        </Box>

        {/* Messages Container */}
        <Box
          flex={1}
          overflowY="auto"
          bg={lightColors.white}
          rounded="xl"
          p={4}
          border="1px solid"
          borderColor={lightColors.border}
          boxShadow="sm"
        >
          <VStack spacing={3} align="stretch">
            {messages.map((msg, index) => (
              <Box
                key={index}
                bg={msg.role === 'human' ? lightColors.userBubble : lightColors.assistantBubble}
                color={msg.role === 'human' ? 'white' : lightColors.text}
                p={3}
                rounded="lg"
                alignSelf={msg.role === 'human' ? 'flex-end' : 'flex-start'}
                maxWidth="80%"
                fontSize="sm"
              >
                {msg.content}
              </Box>
            ))}

            {/* Show current AI response */}
            {subtitleText && (
              <Box
                bg={lightColors.assistantBubble}
                color={lightColors.text}
                p={3}
                rounded="lg"
                alignSelf="flex-start"
                maxWidth="80%"
                fontSize="sm"
              >
                {subtitleText}
              </Box>
            )}

            <div ref={messagesEndRef} />
          </VStack>
        </Box>

        {/* Input Area */}
        <HStack spacing={3}>
          <Textarea
            value={textInput.inputText}
            onChange={(e) => textInput.setInputText({ target: { value: e.target.value } } as React.ChangeEvent<HTMLInputElement>)}
            onKeyDown={textInput.handleKeyPress}
            placeholder="输入您的问题..."
            bg={lightColors.white}
            color={lightColors.text}
            border="1px solid"
            borderColor={lightColors.border}
            rounded="lg"
            p={3}
            flex={1}
            resize="none"
            height="auto"
            minHeight="48px"
            maxHeight="120px"
            _placeholder={{ color: 'gray.400' }}
            _focus={{
              borderColor: lightColors.primary,
              outline: 'none',
              boxShadow: '0 0 0 2px rgba(0, 47, 167, 0.1)'
            }}
          />

          <IconButton
            aria-label={micOn ? '停止录音' : '开始录音'}
            icon={micOn ? <BsMicFill size={20} /> : <BsMicMuteFill size={20} />}
            onClick={micOn ? stopMic : startMic}
            bg={micOn ? 'green.500' : 'gray.100'}
            color={micOn ? 'white' : 'gray.600'}
            _hover={{ bg: micOn ? 'green.600' : 'gray.200' }}
            rounded="lg"
            size={12}
            title={micOn ? '点击停止录音' : '点击开始录音'}
          />

          <IconButton
            aria-label="发送消息"
            icon={<IoSend size={20} />}
            onClick={handleSendMessage}
            bg={lightColors.primary}
            color="white"
            _hover={{ bg: 'blue.800' }}
            rounded="lg"
            size={12}
            isDisabled={!textInput.inputText.trim()}
          />
        </HStack>

        {/* Microphone Settings - Always Visible */}
        <Box
          bg="blue.50"
          p={3}
          rounded="lg"
          border="1px solid"
          borderColor="blue.100"
        >
          <HStack spacing={4} justify="space-between">
            <HStack spacing={3}>
              <BsMic size={16} color="#002FA7" />
              <Text fontSize="sm" fontWeight="medium" color="#002FA7">
                麦克风控制
              </Text>
            </HStack>

            <HStack spacing={4}>
              <HStack spacing={2}>
                <Text fontSize="sm" color="gray.600">
                  说话后自动关闭
                </Text>
                <Switch
                  isChecked={autoStopMic}
                  onChange={(e) => setAutoStopMic(e.target.checked)}
                  size="sm"
                  colorScheme="blue"
                />
              </HStack>

              <Text fontSize="xs" color="gray.500" whiteSpace="nowrap">
                {autoStopMic ? '✓ 已开启' : '✗ 已关闭'}
              </Text>
            </HStack>
          </HStack>
        </Box>

        {/* Quick Actions */}
        <HStack spacing={3} display={{ base: 'none', md: 'flex' }}>
          <Button
            variant="ghost"
            color={lightColors.textSecondary}
            size="sm"
            leftIcon={<FiArrowRight size={16} />}
            _hover={{ bg: 'gray.50' }}
            onClick={() => window.location.hash = '#/campus/intro'}
          >
            了解学校简介
          </Button>
          <Button
            variant="ghost"
            color={lightColors.textSecondary}
            size="sm"
            leftIcon={<FiArrowRight size={16} />}
            _hover={{ bg: 'gray.50' }}
            onClick={() => window.location.hash = '#/campus/role-models'}
          >
            查看学习标兵
          </Button>
        </HStack>
      </VStack>
    </Flex>
  );
});

DialogBox.displayName = 'DialogBox';

export default DialogBox;

