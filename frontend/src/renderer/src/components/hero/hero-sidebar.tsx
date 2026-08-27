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
import { useVolume } from '@/context/volume-context';
import { useLive2dModels } from '@/hooks/live2d/use-live2d-models';
import type { Live2dCharacter } from '@/services/live2d-models-api';
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
  gray50: '#F7FAFC',
};

// 数字人角色列表改为运行时从后端 /api/live2d-models/info 获取（见 useLive2dModels）

// 背景图片列表：本地矢量背景由后端 /bg 静态目录提供（国内可离线可靠加载）
const BACKGROUNDS = [
  { id: 'default', name: '默认背景', url: '' },
  { id: 'camera', name: '摄像头背景', url: '' },
  { id: 'upload', name: '上传图片', url: '' },
  { id: 'school_building', name: '学校建筑', url: '/bg/school/campus_skyline.svg' },
  { id: 'library', name: '图书馆', url: '/bg/school/library_warm.svg' },
  { id: 'classroom', name: '教室', url: '/bg/school/classroom_bright.svg' },
  { id: 'campus_garden', name: '校园花园', url: '/bg/school/garden_green.svg' },
  { id: 'sports_field', name: '运动场', url: '/bg/school/sports_energy.svg' },
];

interface HeroSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HeroSidebar({ isOpen, onClose }: HeroSidebarProps) {
  const { historyList, currentHistoryUid, setMessages, setCurrentHistoryUid, setHistoryList } = useChatHistory();
  const { setModelInfo } = useLive2DConfig();
  const { sendMessage } = useWebSocket();
  const { setBackgroundUrl, addBackgroundFile, setUseCameraBackground } = useBgUrl();
  const { startBackgroundCamera, stopBackgroundCamera, isBackgroundStreaming } = useCamera();
  const { volume, setVolume } = useVolume();

  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [selectedBg, setSelectedBg] = useState('default');
  const sidebarRef = useRef<HTMLDivElement>(null);

  // 获取Live2D角色列表（后端接口，会话内缓存）
  const {
    characters: live2dCharacters,
    loading: modelsLoading,
    error: modelsError,
    refresh: refreshModels,
  } = useLive2dModels();

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

  const handleAvatarSelect = async (character: Live2dCharacter) => {
    setSelectedAvatar(character.id);

    try {
      // 使用相对路径，因为vite代理会处理到后端的转发
      // 参数来自 /api/live2d-models/info（含真实的 model3.json 路径与表情映射）
      const modelInfo = {
        name: character.id,
        url: character.modelPath,
        kScale: character.kScale,
        initialXshift: character.initialXshift,
        initialYshift: character.initialYshift,
        idleMotionGroupName: character.idleMotionGroupName,
        emotionMap: character.emotionMap,
        tapMotions: character.tapMotions,
      };

      // 设置模型信息
      setModelInfo(modelInfo);

      toaster.create({
        title: `已切换到 ${character.name}`,
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
        const targetUrl = bg.url || '';
        // 直接使用URL（已经是完整的URL）
        setBackgroundUrl(targetUrl);

        // 加载校验：预设图片加载失败时回退默认背景并提示，避免黑屏/裂图
        if (targetUrl && !targetUrl.startsWith('blob:') && !targetUrl.startsWith('data:')) {
          const probe = new Image();
          probe.onerror = () => {
            console.error('背景图片加载失败:', targetUrl);
            setBackgroundUrl('');
            setSelectedBg('default');
            toaster.create({
              title: '背景图片加载失败',
              description: '已恢复为默认背景',
              type: 'error',
              duration: 3000,
            });
          };
          probe.src = targetUrl;
        }
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
            size="sm"
            variant="ghost"
            color="white"
            _hover={{ bg: 'rgba(255, 255, 255, 0.1)' }}
            onClick={onClose}
          >
            <FiX />
          </IconButton>
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
              <FiUser size="4" color={schoolColors.primary} />
              <Text fontSize="sm" fontWeight="semibold" color={schoolColors.text}>
                数字人选择
              </Text>
            </HStack>
            <VStack gap="2">
              {modelsLoading && (
                <Text fontSize="xs" color={schoolColors.textSecondary} py="2">
                  正在加载角色列表…
                </Text>
              )}
              {modelsError && !modelsLoading && (
                <Box
                  p="3"
                  rounded="lg"
                  border="1px solid"
                  borderColor="#FED7D7"
                  bg="#FFF5F5"
                  width="100%"
                >
                  <Text fontSize="xs" color="#C53030">
                    角色列表加载失败：{modelsError}
                  </Text>
                  <Button size="xs" mt="2" onClick={refreshModels}>
                    重试
                  </Button>
                </Box>
              )}
              {!modelsLoading && !modelsError && live2dCharacters.length === 0 && (
                <Text fontSize="xs" color={schoolColors.textSecondary} py="2">
                  后端未发现可用的 Live2D 模型
                </Text>
              )}
              {live2dCharacters.map((character) => (
                <Box
                  key={character.id}
                  p="3"
                  rounded="lg"
                  border="1px solid"
                  borderColor={selectedAvatar === character.id ? schoolColors.primary : schoolColors.border}
                  bg={selectedAvatar === character.id ? schoolColors.accent : 'transparent'}
                  cursor="pointer"
                  onClick={() => handleAvatarSelect(character)}
                  _hover={{ borderColor: schoolColors.primary, bg: schoolColors.accent }}
                  transition="all 0.2s"
                >
                  <HStack gap="3">
                    <Text fontSize="2xl">{character.preview}</Text>
                    <VStack align="start" gap="0" flex="1">
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
              <FiVolume2 size="4" color={schoolColors.primary} />
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
              <FiImage size="4" color={schoolColors.primary} />
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
                    <FiCamera size="4" color={isBackgroundStreaming ? 'green.500' : schoolColors.textSecondary} />
                  )}
                  {bg.id === 'upload' && (
                    <FiUpload size="4" color={schoolColors.textSecondary} />
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
                <FiClock size="4" color={schoolColors.primary} />
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
                size="sm"
                colorScheme="blue"
                variant="outline"
                width="full"
                onClick={handleNewConversation}
              >
                <FiPlus />
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
                    <VStack align="start" gap="1">
                      <Text
                        fontSize="xs"
                        color={schoolColors.text}
                        fontWeight="medium"
                      >
                        {history.latest_message?.content || '空对话'}
                      </Text>
                      <HStack justify="space-between" width="full">
                        <Text fontSize="9px" color={schoolColors.textSecondary}>
                          {history.timestamp ? new Date(history.timestamp).toLocaleString() : '无时间'}
                        </Text>
                        <IconButton
                          aria-label="删除"
                          size="sm"
                          bg="red.100"
                          color="red.600"
                          _hover={{ bg: 'red.200', color: 'red.700' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteHistory(history.uid);
                          }}
                        >
                          <FiTrash2 />
                        </IconButton>
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
