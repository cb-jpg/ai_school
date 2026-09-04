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
import { useSidebar } from '@/hooks/sidebar/use-sidebar';

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
  const { createNewHistory } = useSidebar();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const prevMessageCountRef = useRef(messages.length);

  // 继续对话时自动收起历史面板（新消息一到即收）
  useEffect(() => {
    if (showHistory && messages.length > prevMessageCountRef.current) {
      setShowHistory(false);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, showHistory]);

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

  // 是否已输入内容：决定输入框右侧显示发送键（有内容）还是麦克风（空）
  const hasInputText = textInput.inputText.trim().length > 0;

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

      <VStack gap={{ base: 3, md: 6 }} align="stretch" flex={1} overflow="hidden">
        {/* Status Indicator（手机端排在标题下方，order 见各块；胶囊底衬提升在人物/渐变上的可读性） */}
        <HStack
          gap={2}
          mb={{ base: 2, md: 4 }}
          justify="space-between"
          order={{ base: 1, md: 0 }}
        >
          <HStack
            gap={2}
            bg="rgba(255, 255, 255, 0.82)"
            backdropFilter="blur(6px)"
            borderRadius="full"
            px={3}
            py={1.5}
            boxShadow="sm"
            border="1px solid"
            borderColor="rgba(226, 232, 240, 0.8)"
          >
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
              <Text fontSize="xs" color="orange.600" ml={1}>
                (模型未配置)
              </Text>
            )}
          </HStack>
          <HStack
            gap={1}
            bg="rgba(255, 255, 255, 0.82)"
            backdropFilter="blur(6px)"
            borderRadius="full"
            px={2}
            py={1}
            boxShadow="sm"
            border="1px solid"
            borderColor="rgba(226, 232, 240, 0.8)"
          >
            <IconButton
              aria-label="新对话"
              size="sm"
              variant="ghost"
              color={schoolColors.textSecondary}
              onClick={() => {
                // 创建新对话：打断播报 + 通知后端开新会话
                createNewHistory();
                setShowHistory(false);
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

        {/* 标题块：手机端作为对话卡头部（紧贴导航栏下方），桌面端维持原设计 */}
        <Box order={{ base: 0, md: 1 }} px={{ base: 1, md: 0 }}>
          <Text
            fontSize={{ base: 'lg', sm: '4xl', md: '5xl' }}
            fontWeight="bold"
            color={schoolColors.text}
            mb={{ base: 1, sm: 3 }}
            style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif' }}
          >
            {tagline}
          </Text>

          <Text
            fontSize={{ base: 'xs', sm: 'base', md: 'lg' }}
            color={schoolColors.textSecondary}
            maxW={{ base: 'sm', sm: 'lg', md: 'xl' }}
            mb={{ base: 2, sm: 5 }}
            display={{ base: 'none', sm: 'block' }}
          >
            {description}
          </Text>
        </Box>

        {/* Messages Container —— 手机端顶部渐变：与上方人物区融合，人物仿佛站进卡片 */}
        <Box
          flex={1}
          overflowY="auto"
          bg={{ base: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 64px, #FFFFFF 112px)', md: schoolColors.white }}
          rounded={{ base: '2xl', md: 'xl' }}
          p={4}
          border="1px solid"
          borderColor={{ base: 'transparent', md: schoolColors.border }}
          boxShadow={{ base: 'sm', md: 'sm' }}
          order={2}
        >
          <VStack gap={3} align="stretch">
            {messages.map((msg, index) => (
              <Box
                key={index}
                bg={msg.role === 'human' ? schoolColors.userBubble : schoolColors.assistantBubble}
                color={msg.role === 'human' ? 'white' : schoolColors.text}
                p={3}
                rounded="2xl"
                /* 内角收小形成气泡尾巴方向感 */
                borderBottomRightRadius={msg.role === 'human' ? 'sm' : '2xl'}
                borderBottomLeftRadius={msg.role === 'human' ? '2xl' : 'sm'}
                alignSelf={msg.role === 'human' ? 'flex-end' : 'flex-start'}
                maxWidth="84%"
                fontSize="sm"
                lineHeight="1.6"
                wordBreak="break-word"
                boxShadow={msg.role === 'human' ? 'none' : 'sm'}
              >
                {removeEmojiTags(msg.content)}
              </Box>
            ))}

            {/* 思考占位：仅等首句期间显示（服务端 full-text 先发 "Thinking..."）。
                句子文本会流式并入上方最后一个 AI 气泡（use-audio-task 的 appendAI），
                若再渲染 subtitle 气泡，当前句会同时出现两遍（句级气泡重叠），
                播完后字幕停在最后一句还会留下永久重复气泡——故只在思考阶段占位 */}
            {aiState === AiStateEnum.THINKING_SPEAKING && subtitleText === 'Thinking...' && (
              <Box
                bg={schoolColors.assistantBubble}
                color={schoolColors.textSecondary}
                p={3}
                rounded="2xl"
                borderBottomLeftRadius="sm"
                alignSelf="flex-start"
                maxWidth="84%"
                fontSize="sm"
                lineHeight="1.6"
                wordBreak="break-word"
                boxShadow="sm"
              >
                思考中…
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
              mt={2}
              bg={schoolColors.accent}
              rounded="xl"
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

        {/* Input Area —— zIndex 20：浮于 Live2D 层(15)之上，人物再怎么下移也不挡输入。
            输入框与对话卡同宽；右侧悬浮麦克风，开始输入时原地切换为发送键 */}
        <Box
          order={3}
          position="relative"
          zIndex={20}
        >
          <Textarea
            value={textInput.inputText}
            onChange={(e) => textInput.setInputText({ target: { value: e.target.value } } as React.ChangeEvent<HTMLInputElement>)}
            onKeyDown={(e) => textInput.handleKeyPress(e as unknown as React.KeyboardEvent<HTMLInputElement>)}
            placeholder="输入您的问题..."
            bg={schoolColors.white}
            color={schoolColors.text}
            border="1px solid"
            borderColor={schoolColors.border}
            rounded="2xl"
            p={3}
            pr={16}
            width="full"
            resize="none"
            height="auto"
            minHeight="48px"
            maxHeight="120px"
            boxShadow="sm"
            _placeholder={{ color: 'gray.400' }}
            _focus={{
              borderColor: schoolColors.primary,
              outline: 'none',
              boxShadow: '0 0 0 2px rgba(0, 47, 167, 0.1)'
            }}
          />

          {/* 麦克风 / 发送 切换键（悬浮于输入框右缘居中） */}
          {hasInputText ? (
            <Box
              as="button"
              onClick={handleSendMessage}
              aria-label="发送"
              position="absolute"
              right={2}
              top="50%"
              transform="translateY(-50%)"
              width="40px"
              height="40px"
              rounded="full"
              bg={schoolColors.primary}
              color="white"
              display="flex"
              alignItems="center"
              justifyContent="center"
              transition="all 0.2s ease"
              _hover={{ bg: '#1A4280' }}
              _active={{ transform: 'translateY(-50%) scale(0.92)' }}
              style={{ cursor: 'pointer' }}
            >
              <IoSend size={18} />
            </Box>
          ) : (
            <Box
              as="button"
              onClick={async () => {
                try {
                  if (micOn) {
                    stopMic();
                  } else {
                    await startMic();
                  }
                } catch (error) {
                  console.error('麦克风切换失败:', error);
                }
              }}
              aria-label={micOn ? '停止录音' : '开始录音'}
              position="absolute"
              right={2}
              top="50%"
              transform="translateY(-50%)"
              width="40px"
              height="40px"
              rounded="full"
              bg={micOn ? schoolColors.secondary : schoolColors.primary}
              color="white"
              display="flex"
              alignItems="center"
              justifyContent="center"
              transition="all 0.2s ease"
              _hover={{ bg: micOn ? '#E55A2D' : '#1A4280' }}
              _active={{ transform: 'translateY(-50%) scale(0.92)' }}
              style={{ cursor: 'pointer' }}
            >
              {micOn ? <BsMicFill size={18} /> : <BsMic size={18} />}
            </Box>
          )}
        </Box>

        {/* 麦克风自动停止设置 —— 同输入区，保持可点 */}
        <HStack
          gap={3}
          fontSize="xs"
          color={schoolColors.textSecondary}
          order={4}
          position="relative"
          zIndex={20}
        >
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
