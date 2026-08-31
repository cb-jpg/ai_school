/**
 * Dialog Box Component
 * 对话框组件 - 左侧主要交互区域
 * 集成现有的对话系统，明亮简洁风格
 */

import { memo, useRef, useEffect, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Textarea,
  IconButton,
  Flex,
  Spinner,
} from '@chakra-ui/react';
import { Switch } from '@/components/ui/switch';
import { BsMicFill, BsMic } from 'react-icons/bs';
import { FiClock, FiPlus } from 'react-icons/fi';
import { IoSend } from 'react-icons/io5';
import { Alert } from '@/components/ui/alert';
import { useTextInput } from '@/hooks/footer/use-text-input';
import { useWebSocket } from '@/context/websocket-context';
import { useAiState, AiStateEnum } from '@/context/ai-state-context';
import { useSubtitleDisplay } from '@/hooks/canvas/use-subtitle-display';
import { useVAD } from '@/context/vad-context';
import { useChatHistory } from '@/context/chat-history-context';
import { useLive2DConfig } from '@/context/live2d-config-context';

// 移除 emoji 表情符号，只保留纯文本
function removeEmojiTags(text: string): string {
  // 移除 [joy]、[smile] 等表情标签
  return text.replace(/\[[a-z_]+\]/gi, '');
}

// 学校配色方案 - 基于石实实验学校的设计
const schoolColors = {
  bg: '#F5F7FA',        // 浅灰背景，简洁明了
  primary: '#1E5494',    // 深蓝色，代表知识和专业
  secondary: '#FF6B35',  // 暖橙色，代表活力和成长
  accent: '#E8F0FE',     // 浅蓝色，用于高亮
  text: '#2D3748',       // 深灰色，主要文字
  textSecondary: '#718096', // 浅灰色，次要文字
  border: '#E2E8F0',     // 边框颜色
  white: '#FFFFFF',
  userBubble: '#1E5494', // 用户消息气泡
  assistantBubble: '#F3F4F6', // AI回复气泡
};

interface DialogBoxProps {
  schoolName: string;
  tagline: string;
  description: string;
}

const DialogBox = memo(({ tagline, description }: DialogBoxProps) => {
  const textInput = useTextInput();
  const { wsState } = useWebSocket();
  const { aiState } = useAiState();
  const { subtitleText } = useSubtitleDisplay();
  const { micOn, startMic, stopMic, autoStopMic, setAutoStopMic } = useVAD();
  const { messages, historyList } = useChatHistory();
  const { modelInfo, isLoading: modelLoading } = useLive2DConfig();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);

  // 确保麦克风不会自动启动（仅在首次加载时执行）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (micOn) {
        console.log('麦克风已自动启动，正在关闭...');
        try {
          stopMic();
        } catch (error) {
          console.error('关闭麦克风时出错:', error);
        }
      }
    }, 100); // 延迟执行，确保 VAD 完全初始化

    return () => clearTimeout(timer);
  }, []); // 只在组件挂载时执行一次

  // 调试：打印 modelInfo 和 WebSocket 状态
  useEffect(() => {
    console.log('[DialogBox Debug] wsState:', wsState);
    console.log('[DialogBox Debug] modelInfo:', modelInfo);
    if (modelInfo?.url) {
      console.log('[DialogBox Debug] Model URL:', modelInfo.url);
    }
  }, [wsState, modelInfo]);

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
    if (wsState !== 'OPEN' && wsState !== 'CONNECTING') return '等待连接...';
    if (modelLoading) return '加载模型中...';
    if (!modelInfo && wsState === 'OPEN') return '等待模型配置...';
    switch (aiState) {
      case AiStateEnum.THINKING_SPEAKING: return '思考中...';
      case AiStateEnum.LISTENING: return '聆听中...';
      case AiStateEnum.IDLE: return '在线';
      default: return '';
    }
  };

  const getStatusColor = () => {
    if (wsState !== 'OPEN' && wsState !== 'CONNECTING') return '#E53E3E'; // 红色
    if (modelLoading) return '#ECC94B'; // 黄色
    if (!modelInfo && wsState === 'OPEN') return '#DD6B20'; // 橙色
    switch (aiState) {
      case AiStateEnum.THINKING_SPEAKING: return '#1E5494'; // 深蓝色
      case AiStateEnum.LISTENING: return '#FF6B35'; // 暖橙色
      case AiStateEnum.IDLE: return '#48BB78'; // 绿色
      default: return '#718096'; // 灰色
    }
  };

  return (
    <Flex
      flexDirection="column"
      h="full"
      /* 手机端人物区占上半屏，对话区填剩余高度；桌面端保持 75vh/500px 设计 */
      maxHeight={{ base: 'none', md: '75vh' }}
      minHeight={{ base: '0px', md: '500px' }}
    >
      {/* Connection Status Alert */}
      {wsState !== 'OPEN' && (
        <Alert status="warning" mb={4} title="正在连接服务器..." endElement={<Spinner size="sm" />}>
          请确保后端服务器正在运行 (端口12393)
        </Alert>
      )}

      <VStack gap={6} align="stretch" flex={1} overflow="hidden">
        {/* Status Indicator */}
        <HStack gap={2} mb={4} justify="space-between">
          <HStack gap={2}>
            <Box
              w={2}
              h={2}
              rounded="full"
              bg={getStatusColor()}
            />
            <Text fontSize="sm" color={schoolColors.textSecondary}>
              {getStatusText()}
            </Text>
            {wsState === 'OPEN' && !modelInfo && (
              <Text fontSize="xs" color="orange.600" ml={2}>
                (模型未配置)
              </Text>
            )}
          </HStack>
          <HStack gap={2}>
            <IconButton
              aria-label="新对话"
              size="sm"
              variant="ghost"
              color={schoolColors.textSecondary}
              onClick={() => {
                // 创建新对话的逻辑
                console.log('创建新对话');
              }}
            >
              <FiPlus />
            </IconButton>
            <IconButton
              aria-label="对话历史"
              size="sm"
              variant="ghost"
              color={schoolColors.textSecondary}
              onClick={() => setShowHistory(!showHistory)}
            >
              <FiClock />
            </IconButton>
          </HStack>
        </HStack>

        <Box>
          <Text
            fontSize={{ base: '2xl', sm: '4xl', md: '5xl' }}
            fontWeight="bold"
            color={schoolColors.text}
            mb={3}
            style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif' }}
          >
            {tagline}
          </Text>

          <Text
            fontSize={{ base: 'sm', sm: 'base', md: 'lg' }}
            color={schoolColors.textSecondary}
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
          bg={schoolColors.white}
          rounded="xl"
          p={4}
          border="1px solid"
          borderColor={schoolColors.border}
          boxShadow="sm"
        >
          <VStack gap={3} align="stretch">
            {messages.map((msg, index) => (
              <Box
                key={index}
                bg={msg.role === 'human' ? schoolColors.userBubble : schoolColors.assistantBubble}
                color={msg.role === 'human' ? 'white' : schoolColors.text}
                p={3}
                rounded="lg"
                alignSelf={msg.role === 'human' ? 'flex-end' : 'flex-start'}
                maxWidth="80%"
                fontSize="sm"
              >
                {removeEmojiTags(msg.content)}
              </Box>
            ))}

            {/* Show current AI response */}
            {subtitleText && (
              <Box
                bg={schoolColors.assistantBubble}
                color={schoolColors.text}
                p={3}
                rounded="lg"
                alignSelf="flex-start"
                maxWidth="80%"
                fontSize="sm"
              >
                {removeEmojiTags(subtitleText)}
              </Box>
            )}

            <div ref={messagesEndRef} />
          </VStack>

          {/* 历史记录面板 */}
          {showHistory && (
            <Box
              borderTop="1px solid"
              borderColor={schoolColors.border}
              p={3}
              bg={schoolColors.accent}
              maxHeight="120px"
              overflowY="auto"
            >
              <Text fontSize="xs" fontWeight="semibold" color={schoolColors.text} mb={2}>
                对话历史 ({historyList.length}个会话)
              </Text>
              {historyList.length === 0 ? (
                <Text fontSize="xs" color={schoolColors.textSecondary}>
                  暂无历史记录
                </Text>
              ) : (
                <VStack gap="1" align="stretch">
                  {historyList.slice(0, 3).map((history) => (
                    <Box
                      key={history.uid}
                      p={2}
                      bg="white"
                      rounded="md"
                      fontSize="xs"
                      color={schoolColors.text}
                    >
                      {history.latest_message?.content || '空对话'}
                    </Box>
                  ))}
                  {historyList.length > 3 && (
                    <Text fontSize="xs" color={schoolColors.textSecondary} textAlign="center">
                      ...还有 {historyList.length - 3} 个会话
                    </Text>
                  )}
                </VStack>
              )}
            </Box>
          )}
        </Box>

        {/* Input Area */}
        <HStack gap={3} alignItems="center">
          <Textarea
            value={textInput.inputText}
            onChange={(e) => textInput.setInputText({ target: { value: e.target.value } } as React.ChangeEvent<HTMLInputElement>)}
            onKeyDown={(e) => textInput.handleKeyPress(e as unknown as React.KeyboardEvent<HTMLInputElement>)}
            placeholder="输入您的问题..."
            bg={schoolColors.white}
            color={schoolColors.text}
            border="1px solid"
            borderColor={schoolColors.border}
            rounded="lg"
            p={3}
            flex={1}
            resize="none"
            height="auto"
            minHeight="48px"
            maxHeight="120px"
            _placeholder={{ color: 'gray.400' }}
            _focus={{
              borderColor: schoolColors.primary,
              outline: 'none',
              boxShadow: '0 0 0 2px rgba(0, 47, 167, 0.1)'
            }}
          />

          {/* 精美的动画麦克风按钮 */}
          {/* 麦克风按钮 */}
          <Box
            as="button"
            onClick={async () => {
              console.log('麦克风点击前状态:', micOn);
              try {
                if (micOn) {
                  stopMic();
                  console.log('调用 stopMic');
                } else {
                  await startMic();
                  console.log('调用 startMic');
                }
              } catch (error) {
                console.error('麦克风切换失败:', error);
              }
            }}
            width="48px"
            height="48px"
            rounded="full"
            bg={micOn ? schoolColors.secondary : schoolColors.primary}
            color="white"
            display="flex"
            alignItems="center"
            justifyContent="center"
            transition="all 0.3s ease"
            _hover={{
              bg: micOn ? '#E55A2D' : '#1A4280',
              transform: 'scale(1.05)',
            }}
            _active={{
              transform: 'scale(0.95)',
            }}
            style={{ cursor: 'pointer' }}
          >
            {micOn ? <BsMicFill size={20} /> : <BsMic size={20} />}
          </Box>

          {/* 发送按钮 */}
          <Box
            as="button"
            onClick={handleSendMessage}
            width="48px"
            height="48px"
            rounded="full"
            bg={schoolColors.primary}
            color="white"
            display="flex"
            alignItems="center"
            justifyContent="center"
            transition="all 0.3s ease"
            _hover={{
              bg: '#1A4280',
              transform: 'scale(1.05)',
            }}
            _active={{
              transform: 'scale(0.95)',
            }}
            style={{ cursor: 'pointer' }}
          >
            <IoSend size={20} />
          </Box>
        </HStack>

        {/* 麦克风自动停止设置 */}
        <HStack gap={3} fontSize="xs" color={schoolColors.textSecondary}>
          <Switch
            checked={autoStopMic}
            onCheckedChange={(e) => setAutoStopMic(e.checked)}
          />
          <Text>对话结束后自动停止麦克风</Text>
        </HStack>
      </VStack>
    </Flex>
  );
});

DialogBox.displayName = 'DialogBox';

export default DialogBox;
