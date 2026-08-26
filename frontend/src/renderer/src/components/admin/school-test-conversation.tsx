/**
 * 石实实验学校 - 测试对话页面
 * 管理员测试数字人问答效果的专用页面
 */

import { FC, useState, useRef, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Badge,
  IconButton,
} from '@chakra-ui/react';
import { Avatar } from '@/components/ui/avatar';
import {
  FiSend,
  FiMic,
  FiMicOff,
  FiVolume2,
  FiVolumeX,
  FiSettings,
  FiClock,
} from 'react-icons/fi';
import { Live2D } from '../canvas/live2d';
import Subtitle from '../canvas/subtitle';
import { useWebSocket } from '@/context/websocket-context';
import { useVAD } from '@/context/vad-context';
import { useChatHistory } from '@/context/chat-history-context';
import '@/styles/school-theme.css';

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

// 主测试对话组件
export const SchoolTestConversation: FC = () => {
  const { messages, historyList, currentHistoryUid } = useChatHistory();
  const { micOn, startMic, stopMic } = useVAD();
  const [inputText, setInputText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { wsState } = useWebSocket();
  const isConnected = wsState === 'OPEN' || wsState === 'CONNECTING';

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 发送消息
  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    // 这里应该通过WebSocket发送消息
    // 实际实现需要使用WebSocket发送文本输入
    setInputText('');
  };

  // 切换麦克风状态
  const handleToggleMic = () => {
    if (micOn) {
      stopMic();
    } else {
      startMic();
    }
  };

  // 切换静音状态
  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    // 这里应该控制实际的音频播放
  };

  return (
    <Box
      width="full"
      height="full"
      display="flex"
      gap="6"
    >
      {/* 左侧：数字人展示区 */}
      <Box
        flex="1"
        bg="white"
        rounded="xl"
        border="1px solid"
        borderColor={colors.gray200}
        overflow="hidden"
        position="relative"
        className="school-avatar-preview"
      >
        {/* 数字人画布 */}
        <Box
          width="full"
          height="full"
          position="relative"
          bg="linear-gradient(135deg, rgba(26, 77, 143, 0.05) 0%, rgba(212, 165, 32, 0.05) 100%)"
        >
          <Live2D showSidebar={false} />

          {/* 状态指示器 */}
          <Box
            position="absolute"
            top="4"
            left="4"
            display="flex"
            gap="2"
          >
            <Badge
              bg={isConnected ? 'green.500' : 'red.500'}
              color="white"
              px="3"
              py="1"
              rounded="full"
              fontSize="xs"
            >
              {isConnected ? '已连接' : '未连接'}
            </Badge>
            {micOn && (
              <Badge
                bg={colors.accent}
                color="white"
                px="3"
                py="1"
                rounded="full"
                fontSize="xs"
                animation="pulse"
              >
                麦克风开启
              </Badge>
            )}
          </Box>

          {/* 字幕显示 */}
          <Box
            position="absolute"
            bottom="8"
            left="50%"
            transform="translateX(-50%)"
            width="80%"
          >
            <Subtitle />
          </Box>
        </Box>

        {/* 控制按钮 */}
        <Box
          position="absolute"
          top="4"
          right="4"
          display="flex"
          flexDirection="column"
          gap="2"
        >
          <IconButton
            aria-label="设置"
            size="sm"
            variant="ghost"
            color={colors.gray600}
            bg="white"
            rounded="full"
            shadow="sm"
          >
            <FiSettings />
          </IconButton>
          <IconButton
            aria-label="静音"
            size="sm"
            variant="ghost"
            color={colors.gray600}
            bg="white"
            rounded="full"
            shadow="sm"
            onClick={handleToggleMute}
          >
            {isMuted ? <FiVolumeX /> : <FiVolume2 />}
          </IconButton>
        </Box>
      </Box>

      {/* 右侧：聊天面板 */}
      <Box
        width="400px"
        bg="white"
        rounded="xl"
        border="1px solid"
        borderColor={colors.gray200}
        display="flex"
        flexDirection="column"
        height="full"
      >
        {/* 聊天标题 */}
        <Box
          p="4"
          borderBottom="1px solid"
          borderColor={colors.gray200}
          className="school-header"
        >
          <HStack gap="3" justify="space-between">
            <HStack gap="3">
              <Avatar
                size="sm"
                bg={colors.primary}
                color="white"
                name="小石"
              />
              <VStack align="start" gap="0">
                <Text fontSize="sm" fontWeight="semibold" color={colors.gray800}>
                  小石 - 测试对话
                </Text>
                <Text fontSize="xs" color={colors.gray600}>
                  管理员测试模式
                </Text>
              </VStack>
            </HStack>
            <IconButton
              aria-label="对话历史"
              size="sm"
              variant="ghost"
              color={colors.gray600}
              onClick={() => setShowHistory(!showHistory)}
            >
              <FiClock />
            </IconButton>
          </HStack>
        </Box>

        {/* 消息列表 */}
        <Box
          flex="1"
          overflowY="auto"
          p="4"
          css={{
            '&::-webkit-scrollbar': {
              width: '4px',
            },
            '&::-webkit-scrollbar-track': {
              bg: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              bg: colors.gray200,
              borderRadius: 'full',
            },
          }}
        >
          <VStack gap="4" align="stretch">
            {messages.length === 0 ? (
              <Box textAlign="center" py="8">
                <Text fontSize="sm" color={colors.gray600}>
                  开始对话测试...
                </Text>
              </Box>
            ) : (
              messages.map((message) => (
                <HStack
                  key={message.id}
                  gap="3"
                  justify={message.role === 'human' ? 'flex-end' : 'flex-start'}
                >
                  {message.role === 'ai' && (
                    <Avatar
                      size="xs"
                      bg={colors.primary}
                      color="white"
                      name="小石"
                    />
                  )}
                  <Box
                    maxW="80%"
                    p="3"
                    rounded="lg"
                    bg={
                      message.role === 'human'
                        ? colors.primary
                        : colors.gray100
                    }
                    color={
                      message.role === 'human'
                        ? 'white'
                        : colors.gray800
                    }
                  >
                    <Text fontSize="sm">{message.content}</Text>
                  </Box>
                  {message.role === 'human' && (
                    <Avatar
                      size="xs"
                      bg={colors.gray600}
                      color="white"
                      name="管理员"
                    />
                  )}
                </HStack>
              ))
            )}
            <div ref={messagesEndRef} />
          </VStack>
        </Box>

        {/* 历史记录面板 */}
        {showHistory && (
          <Box
            borderTop="1px solid"
            borderColor={colors.gray200}
            p="4"
            bg={colors.gray50}
            maxHeight="200px"
            overflowY="auto"
          >
            <Text fontSize="sm" fontWeight="semibold" color={colors.gray800} mb="3">
              对话历史记录 ({historyList.length}个会话)
            </Text>
            {historyList.length === 0 ? (
              <Text fontSize="xs" color={colors.gray600}>
                暂无历史记录
              </Text>
            ) : (
              <VStack gap="2" align="stretch">
                {historyList.map((history) => (
                  <Box
                    key={history.uid}
                    p="3"
                    bg="white"
                    rounded="lg"
                    border="1px solid"
                    borderColor={history.uid === currentHistoryUid ? colors.primary : colors.gray200}
                    cursor="pointer"
                    _hover={{ borderColor: colors.primaryLight }}
                    onClick={() => {
                      // 这里应该加载选中的历史记录
                      console.log('加载历史记录:', history.uid);
                    }}
                  >
                    <Text fontSize="xs" color={colors.gray800} fontWeight="medium">
                      {history.latest_message?.content || '空对话'}
                    </Text>
                    <Text fontSize="9px" color={colors.gray600} mt="1">
                      {history.timestamp ? new Date(history.timestamp).toLocaleString() : '无时间'}
                    </Text>
                  </Box>
                ))}
              </VStack>
            )}
          </Box>
        )}

        {/* 输入区域 */}
        <Box
          p="4"
          borderTop="1px solid"
          borderColor={colors.gray200}
        >
          <VStack gap="3">
            {/* 文本输入 */}
            <HStack gap="2">
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="输入您的问题..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSendMessage();
                  }
                }}
                className="school-search-box"
              />
              <Button
                colorScheme="blue"
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                px="4"
              >
                <FiSend />
              </Button>
            </HStack>

            {/* 语音控制 */}
            <HStack justify="space-between">
              <Text fontSize="xs" color={colors.gray600}>
                语音输入
              </Text>
              <IconButton
                aria-label="麦克风"
                size="sm"
                variant={micOn ? 'solid' : 'ghost'}
                bg={micOn ? colors.secondary : 'transparent'}
                color={micOn ? 'white' : colors.gray600}
                _hover={{ bg: micOn ? colors.secondary : colors.gray100 }}
                onClick={handleToggleMic}
              >
                {micOn ? <FiMic /> : <FiMicOff />}
              </IconButton>
            </HStack>

            {/* 麦克风状态提示 */}
            {micOn && (
              <Box
                p="2"
                bg="red.50"
                border="1px solid"
                borderColor="red.200"
                rounded="md"
              >
                <Text fontSize="xs" color="red.600" textAlign="center">
                  🎤 麦克风已开启 - 点击麦克风图标关闭
                </Text>
              </Box>
            )}
          </VStack>
        </Box>
      </Box>
    </Box>
  );
};

export default SchoolTestConversation;
