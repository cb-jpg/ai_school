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

// 数字人角色列表（从Live2D模型中获取）
const getLive2DCharacters = () => {
  // 直接返回Live2D模型列表
  return [
    {
      id: 'mao_pro',
      name: 'Mao Pro',
      description: '猫咪角色',
      modelName: 'mao_pro',
      modelFileName: 'mao_pro',
      preview: '🐱',
    },
    {
      id: 'shizuku',
      name: 'Shizuku',
      description: '栀子',
      modelName: 'shizuku',
      modelFileName: 'shizuku',
      preview: '🌸',
    },
    {
      id: 'hiyori_pro',
      name: 'Hiyori Pro',
      description: '日葵 (专业版)',
      modelName: 'hiyori_pro',
      modelFileName: 'hiyori_pro_t11', // 修正实际的模型文件名
      preview: '👩‍🏫',
    },
  ];
};

// 背景图片列表
const BACKGROUNDS = [
  { id: 'default', name: '默认背景', url: '' },
  { id: 'camera', name: '摄像头背景', url: '' },
  { id: 'upload', name: '上传图片', url: '' },
  // 学校风格背景图片（使用在线免费图片资源）
  { id: 'school_building', name: '学校建筑', url: 'https://images.unsplash.com/photo-1562774053-701939374585?w=1920&q=80' },
  { id: 'library', name: '图书馆', url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1920&q=80' },
  { id: 'classroom', name: '教室', url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1920&q=80' },
  { id: 'campus_garden', name: '校园花园', url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80' },
  { id: 'sports_field', name: '运动场', url: 'https://images.unsplash.com/photo-1571896349842-6c5c1f7ce626?w=1920&q=80' },
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

  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [selectedBg, setSelectedBg] = useState('default');
  const sidebarRef = useRef<HTMLDivElement>(null);

  // 获取Live2D角色列表
  const live2dCharacters = getLive2DCharacters();

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

  const handleAvatarSelect = async (characterId: string, modelName: string, modelFileName: string) => {
    setSelectedAvatar(characterId);

    try {
      // 使用相对路径，因为vite代理会处理到后端的转发
      const modelInfo = {
        name: modelName,
        url: `/live2d-models/${modelName}/runtime/${modelFileName}.model3.json`,
        kScale: 1.0,
        initialXshift: 0,
        initialYshift: 0,
      };

      // 设置模型信息
      setModelInfo(modelInfo);

      toaster.create({
        title: `已切换到 ${modelName}`,
        type: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('切换模型失败:', error);
      toaster.create({
        title: '切换模型失败',
        description: String(error),
        type: 'error',
        duration: 3000,
      });
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
        // 直接使用URL（已经是完整的URL）
        setBackgroundUrl(bg.url || '');
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
              <FiUser style={{ width: '16px', height: '16px', color: schoolColors.primary }} />
              <Text fontSize="sm" fontWeight="semibold" color={schoolColors.text}>
                数字人选择
              </Text>
            </HStack>
            <VStack gap="2">
              {live2dCharacters.map((character) => (
                <Box
                  key={character.id}
                  p="3"
                  rounded="lg"
                  border="1px solid"
                  borderColor={selectedAvatar === character.id ? schoolColors.primary : schoolColors.border}
                  bg={selectedAvatar === character.id ? schoolColors.accent : 'transparent'}
                  cursor="pointer"
                  onClick={() => handleAvatarSelect(character.id, character.modelName, character.modelFileName)}
                  _hover={{ borderColor: schoolColors.primary, bg: schoolColors.accent }}
                  transition="all 0.2s"
                >
                  <HStack gap="3">
                    <Text fontSize="2xl">{character.preview}</Text>
                    <VStack align="start" spacing="0" flex="1">
                      <Text fontSize="sm" fontWeight="medium" color={schoolColors.text}>
                        {character.name}
                      </Text>
                      <Text fontSize="xs" color={schoolColors.textSecondary}>
                        {character.description}
                      </Text>
                    </VStack>
                    {selectedAvatar === character.id && (
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
              <FiVolume2 style={{ width: '16px', height: '16px', color: schoolColors.primary }} />
              <Text fontSize="sm" fontWeight="semibold" color={schoolColors.text}>
                播报音量
              </Text>
            </HStack>
            <Box px="2">
              <Slider
                value={[volume]}
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
              <FiImage style={{ width: '16px', height: '16px', color: schoolColors.primary }} />
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
                    <FiCamera style={{ width: '16px', height: '16px', color: isBackgroundStreaming ? 'green.500' : schoolColors.textSecondary }} />
                  )}
                  {bg.id === 'upload' && (
                    <FiUpload style={{ width: '16px', height: '16px', color: schoolColors.textSecondary }} />
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
                <FiClock style={{ width: '16px', height: '16px', color: schoolColors.primary }} />
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
                        <Box
                          as="button"
                          aria-label="删除"
                          width="20px"
                          height="20px"
                          borderRadius="full"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          color="gray.400"
                          _hover={{ bg: 'red.100', color: 'red.500' }}
                          transition="all 0.2s"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteHistory(history.uid);
                          }}
                        >
                          <FiX size={12} />
                        </Box>
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
