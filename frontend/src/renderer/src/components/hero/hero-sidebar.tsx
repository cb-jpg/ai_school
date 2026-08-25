/**
 * Hero Sidebar Component
 * Hero页面右侧侧栏 - 用户交互设置
 * 包含：数字人选择、历史记录、音量调节、背景切换等
 */

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Badge,
} from '@chakra-ui/react';
import {
  FiUser,
  FiClock,
  FiPlus,
  FiVolume2,
  FiImage,
  FiX,
  FiTrash2,
  FiCamera,
  FiUpload,
} from 'react-icons/fi';
import { Slider } from '@/components/ui/slider';
import { useChatHistory } from '@/context/chat-history-context';
import { useLive2DConfig } from '@/context/live2d-config-context';
import { useWebSocket } from '@/context/websocket-context';
import { useBgUrl } from '@/context/bgurl-context';
import { useCamera } from '@/context/camera-context';
import { useSwitchCharacter } from '@/hooks/utils/use-switch-character';
import { useVolume } from '@/context/volume-context';
import { toaster } from '@/components/ui/toaster';
import fileUploadDialog from '@/utils/file-upload-dialog';

// 学校配色方案
const schoolColors = {
  bg: '#F5F7FA',
  primary: '#1E5494',
  secondary: '#FF6B35',
  accent: '#E8F0FE',
  text: '#2D3748',
  textSecondary: '#718096',
  border: '#E2E8F0',
  white: '#FFFFFF',
};

// 数字人角色列表（从配置中获取）
const getAvatarCharacters = (configs: any[] | undefined) => {
  // 始终包含默认角色"小石"
  const defaultCharacter = {
    id: 'default',
    name: '小石',
    description: '石实实验学校AI数字人',
    filename: '',  // 空字符串表示使用当前配置
    preview: '🎓',
  };

  if (!configs || configs.length === 0) {
    return [defaultCharacter];
  }

  // 添加配置的角色
  const configCharacters = configs.map((conf: any, index: number) => ({
    id: conf.conf_uid || `character-${index}`,
    name: conf.conf_name || `角色 ${index + 1}`,
    description: conf.persona_prompt?.substring(0, 50) || '数字人角色',
    filename: conf.filename,
    preview: ['👨‍🏫', '👩‍🏫', '📚', '🎨'][index % 4],
  }));

  return [defaultCharacter, ...configCharacters];
};

// 背景图片列表
const BACKGROUNDS = [
  { id: 'default', name: '默认背景', url: '' },
  { id: 'camera', name: '摄像头背景', url: '' },
  { id: 'upload', name: '上传图片', url: '' },
  // 学校风格背景图片（需要添加到backgrounds目录）
  { id: 'school_building', name: '学校建筑', url: '/bg/school-building.jpg' },
  { id: 'library', name: '图书馆', url: '/bg/library.jpg' },
  { id: 'classroom', name: '教室', url: '/bg/classroom.jpg' },
  { id: 'campus_garden', name: '校园花园', url: '/bg/campus-garden.jpg' },
  { id: 'sports_field', name: '运动场', url: '/bg/sports-field.jpg' },
];

interface HeroSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HeroSidebar({ isOpen, onClose }: HeroSidebarProps) {
  const { historyList, currentHistoryUid, setMessages, setCurrentHistoryUid, setHistoryList } = useChatHistory();
  const { modelInfo, setModelInfo } = useLive2DConfig();
  const { sendMessage, baseUrl } = useWebSocket();
  const { backgroundUrl, setBackgroundUrl, backgroundFiles, addBackgroundFile, useCameraBackground, setUseCameraBackground } = useBgUrl();
  const { startBackgroundCamera, stopBackgroundCamera, isBackgroundStreaming } = useCamera();
  const { switchCharacter } = useSwitchCharacter();
  const { volume, setVolume } = useVolume();
  const { configs } = useLive2DConfig();

  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [selectedBg, setSelectedBg] = useState('default');
  const sidebarRef = useRef<HTMLDivElement>(null);

  // 获取数字人列表
  const avatarCharacters = getAvatarCharacters(configs);

  // 点击外部关闭侧栏
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    // 音量会自动应用到下次音频播放
    console.log('音量设置为:', val);
  };

  const handleAvatarSelect = (avatarId: string, filename: string) => {
    setSelectedAvatar(avatarId);
    if (filename && filename !== '') {
      // 只在有有效filename时才切换角色
      switchCharacter(filename);
      toaster.create({
        title: `已切换到 ${avatarId === 'default' ? '小石' : avatarId}`,
        type: 'success',
        duration: 2000,
      });
    } else {
      // 选择默认角色时不做任何操作
      console.log('使用当前角色配置');
    }
  };

  const handleBgSelect = async (bgId: string) => {
    setSelectedBg(bgId);

    if (bgId === 'camera') {
      // 摄像头背景
      if (isBackgroundStreaming) {
        stopBackgroundCamera();
        setUseCameraBackground(false);
      } else {
        try {
          await startBackgroundCamera();
          setUseCameraBackground(true);
          toaster.create({
            title: '摄像头背景已开启',
            type: 'success',
            duration: 2000,
          });
        } catch (error) {
          toaster.create({
            title: '无法开启摄像头背景',
            type: 'error',
            duration: 2000,
          });
        }
      }
    } else if (bgId === 'upload') {
      // 上传自定义背景
      try {
        const file = await fileUploadDialog('image/*');
        if (file) {
          const url = URL.createObjectURL(file);
          addBackgroundFile({ name: file.name, url });
          setBackgroundUrl(url);
          toaster.create({
            title: '背景图片已上传',
            type: 'success',
            duration: 2000,
          });
        }
      } catch (error) {
        toaster.create({
          title: '上传背景图片失败',
          type: 'error',
          duration: 2000,
        });
      }
    } else {
      // 预设背景
      const bg = BACKGROUNDS.find(b => b.id === bgId);
      if (bg) {
        // 关闭摄像头背景
        if (isBackgroundStreaming) {
          stopBackgroundCamera();
          setUseCameraBackground(false);
        }
        // 构建完整URL
        const fullUrl = bg.url ? `${baseUrl}${bg.url}` : '';
        setBackgroundUrl(fullUrl);
      }
    }
  };

  const handleNewConversation = () => {
    // 清空当前消息
    setMessages([]);
    setCurrentHistoryUid(null);

    // 发送创建新对话消息
    sendMessage({
      type: 'create-new-history',
    });

    toaster.create({
      title: '已开启新对话',
      type: 'success',
      duration: 2000,
    });
  };

  const handleLoadHistory = (uid: string) => {
    if (uid === currentHistoryUid) return;

    // 保存当前对话的最新消息
    if (currentHistoryUid) {
      // 这里可以添加保存当前对话的逻辑
    }

    // 加载选中的历史记录
    sendMessage({
      type: 'fetch-and-set-history',
      history_uid: uid,
    });

    setCurrentHistoryUid(uid);
  };

  const handleDeleteHistory = (uid: string) => {
    if (uid === currentHistoryUid) {
      toaster.create({
        title: '无法删除当前对话',
        type: 'warning',
        duration: 2000,
      });
      return;
    }

    sendMessage({
      type: 'delete-history',
      history_uid: uid,
    });

    // 从本地列表中移除
    setHistoryList(historyList.filter((history) => history.uid !== uid));

    toaster.create({
      title: '历史记录已删除',
      type: 'success',
      duration: 2000,
    });
  };

  return (
    <Box
      ref={sidebarRef}
      position="fixed"
      right={0}
      top={0}
      h="full"
      w="320px"
      bg={schoolColors.white}
      borderLeft="1px solid"
      borderColor={schoolColors.border}
      boxShadow="-4px 0 20px rgba(0, 0, 0, 0.1)"
      transform={isOpen ? 'translateX(0)' : 'translateX(100%)'}
      transition="transform 0.3s ease"
      zIndex={1000}
      overflow="hidden"
      display="flex"
      flexDirection="column"
    >
      {/* 顶部标题栏 */}
      <Box
        p="4"
        borderBottom="1px solid"
        borderColor={schoolColors.border}
        bg={schoolColors.primary}
        color="white"
      >
        <HStack justify="space-between">
          <Text fontSize="md" fontWeight="semibold">
            设置面板
          </Text>
          <IconButton
            aria-label="关闭"
            icon={<FiX />}
            size="sm"
            variant="ghost"
            color="white"
            _hover={{ bg: 'rgba(255, 255, 255, 0.1)' }}
            onClick={onClose}
          />
        </HStack>
      </Box>

      {/* 内容区域 */}
      <Box
        flex="1"
        overflow="auto"
        p="4"
        css={{
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            bg: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            bg: schoolColors.border,
            borderRadius: 'full',
          },
        }}
      >
        <VStack gap="6" align="stretch">
          {/* 数字人选择 */}
          <Box>
            <HStack gap="2" mb="3">
              <FiUser boxSize="4" color={schoolColors.primary} />
              <Text fontSize="sm" fontWeight="semibold" color={schoolColors.text}>
                数字人选择
              </Text>
            </HStack>
            <VStack gap="2">
              {avatarCharacters.map((avatar) => (
                <Box
                  key={avatar.id}
                  p="3"
                  rounded="lg"
                  border="1px solid"
                  borderColor={selectedAvatar === avatar.id ? schoolColors.primary : schoolColors.border}
                  bg={selectedAvatar === avatar.id ? schoolColors.accent : 'transparent'}
                  cursor="pointer"
                  onClick={() => handleAvatarSelect(avatar.id, avatar.filename)}
                  _hover={{ borderColor: schoolColors.primary, bg: schoolColors.accent }}
                  transition="all 0.2s"
                >
                  <HStack gap="3">
                    <Text fontSize="2xl">{avatar.preview}</Text>
                    <VStack align="start" spacing="0" flex="1">
                      <Text fontSize="sm" fontWeight="medium" color={schoolColors.text}>
                        {avatar.name}
                      </Text>
                      <Text fontSize="xs" color={schoolColors.textSecondary}>
                        {avatar.description}
                      </Text>
                    </VStack>
                    {selectedAvatar === avatar.id && (
                      <Badge bg={schoolColors.primary} color="white" fontSize="9px" px="2" py="0.5">
                        当前
                      </Badge>
                    )}
                  </HStack>
                </Box>
              ))}
            </VStack>
          </Box>

          <Box height="1px" bg={schoolColors.border} my="2" />

          {/* 播报音量 */}
          <Box>
            <HStack gap="2" mb="3">
              <FiVolume2 boxSize="4" color={schoolColors.primary} />
              <Text fontSize="sm" fontWeight="semibold" color={schoolColors.text}>
                播报音量
              </Text>
            </HStack>
            <Box px="2">
              <Slider
                defaultValue={[volume]}
                min={0}
                max={100}
                onValueChange={(details) => handleVolumeChange(details.value[0])}
                label="音量"
                showValue={true}
              />
            </Box>
          </Box>

          <Box height="1px" bg={schoolColors.border} my="2" />

          {/* 背景图片切换 */}
          <Box>
            <HStack gap="2" mb="3">
              <FiImage boxSize="4" color={schoolColors.primary} />
              <Text fontSize="sm" fontWeight="semibold" color={schoolColors.text}>
                背景图片
              </Text>
            </HStack>
            <VStack gap="2">
              {BACKGROUNDS.map((bg) => (
                <Box
                  key={bg.id}
                  p="2"
                  rounded="lg"
                  border="1px solid"
                  borderColor={selectedBg === bg.id ? schoolColors.primary : schoolColors.border}
                  cursor="pointer"
                  onClick={() => handleBgSelect(bg.id)}
                  _hover={{ borderColor: schoolColors.primary, bg: schoolColors.accent }}
                  transition="all 0.2s"
                  display="flex"
                  alignItems="center"
                  gap="2"
                >
                  {bg.id === 'camera' && (
                    <FiCamera boxSize="4" color={isBackgroundStreaming ? 'green.500' : schoolColors.textSecondary} />
                  )}
                  {bg.id === 'upload' && (
                    <FiUpload boxSize="4" color={schoolColors.textSecondary} />
                  )}
                  <Text
                    fontSize="sm"
                    fontWeight={selectedBg === bg.id ? 'medium' : 'normal'}
                    color={schoolColors.text}
                    flex="1"
                  >
                    {bg.name}
                  </Text>
                  {bg.id === 'camera' && isBackgroundStreaming && (
                    <Badge bg="green.500" color="white" fontSize="9px">
                      开启中
                    </Badge>
                  )}
                </Box>
              ))}
            </VStack>
          </Box>

          <Box height="1px" bg={schoolColors.border} my="2" />

          {/* 历史聊天记录 */}
          <Box>
            <HStack justify="space-between" mb="3">
              <HStack gap="2">
                <FiClock boxSize="4" color={schoolColors.primary} />
                <Text fontSize="sm" fontWeight="semibold" color={schoolColors.text}>
                  历史记录
                </Text>
              </HStack>
              <Badge bg={schoolColors.secondary} color="white" fontSize="9px">
                {historyList.length}
              </Badge>
            </HStack>
            <VStack gap="2">
              {/* 创建新对话按钮 */}
              <Button
                leftIcon={<FiPlus />}
                size="sm"
                colorScheme="blue"
                variant="outline"
                width="full"
                onClick={handleNewConversation}
              >
                开启新对话
              </Button>

              {/* 历史记录列表 */}
              {historyList.length === 0 ? (
                <Box
                  p="4"
                  textAlign="center"
                  bg={schoolColors.accent}
                  rounded="lg"
                >
                  <Text fontSize="xs" color={schoolColors.textSecondary}>
                    暂无历史记录
                  </Text>
                </Box>
              ) : (
                historyList.slice(0, 5).map((history) => (
                  <Box
                    key={history.uid}
                    p="3"
                    bg={schoolColors.gray50}
                    rounded="lg"
                    border="1px solid"
                    borderColor={history.uid === currentHistoryUid ? schoolColors.primary : schoolColors.border}
                    cursor="pointer"
                    onClick={() => handleLoadHistory(history.uid)}
                    _hover={{ borderColor: schoolColors.primary }}
                    transition="all 0.2s"
                  >
                    <VStack align="start" spacing="1">
                      <Text
                        fontSize="xs"
                        color={schoolColors.text}
                        fontWeight="medium"
                        noOfLines={1}
                      >
                        {history.latest_message?.content || '空对话'}
                      </Text>
                      <HStack justify="space-between" width="full">
                        <Text fontSize="9px" color={schoolColors.textSecondary}>
                          {history.timestamp ? new Date(history.timestamp).toLocaleString() : '无时间'}
                        </Text>
                        <IconButton
                          aria-label="删除"
                          icon={<FiTrash2 />}
                          size="sm"
                          bg="red.100"
                          color="red.600"
                          _hover={{ bg: 'red.200', color: 'red.700' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteHistory(history.uid);
                          }}
                        />
                      </HStack>
                    </VStack>
                  </Box>
                ))
              )}
              {historyList.length > 5 && (
                <Text fontSize="xs" color={schoolColors.textSecondary} textAlign="center">
                  ...还有 {historyList.length - 5} 个历史记录
                </Text>
              )}
            </VStack>
          </Box>
        </VStack>
      </Box>

      {/* 底部说明 */}
      <Box
        p="4"
        borderTop="1px solid"
        borderColor={schoolColors.border}
        bg={schoolColors.gray50}
      >
        <Text fontSize="xs" color={schoolColors.textSecondary} textAlign="center">
          石实实验学校 AI数字人
        </Text>
      </Box>
    </Box>
  );
}
