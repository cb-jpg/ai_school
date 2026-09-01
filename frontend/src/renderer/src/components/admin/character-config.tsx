/**
 * 角色配置页面
 * 用于配置数字人角色名称、角色人设、用户名称和Live2D模型选择
 */

import { FC, useEffect, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Textarea,
  Badge,
} from '@chakra-ui/react';
import {
  FiUser,
  FiSettings,
  FiCheck,
  FiSave,
} from 'react-icons/fi';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';
import { useLive2DConfig } from '@/context/live2d-config-context';
import { useLive2dModels } from '@/hooks/live2d/use-live2d-models';
import type { Live2dCharacter } from '@/services/live2d-models-api';
import { toaster } from '@/components/ui/toaster';

import {
  fetchBackendCharacterConfig,
  saveBackendCharacterConfig,
} from '@/services/character-config-api';

// 角色配置接口
interface CharacterConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  createdAt: string;
}

// 用户配置接口
interface UserConfig {
  name: string;
  title: string;
  avatar: string;
}

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

// 默认角色配置
const defaultCharacterConfig: CharacterConfig = {
  id: 'default',
  name: '小石',
  description: '石实实验学校AI数字人',
  systemPrompt: `你是石实实验学校的AI数字人"小石"，是一位友善、专业、富有耐心的教育助手。

你的主要职责包括：
1. 回答学生关于学校知识、学习方法、课程内容的问题
2. 提供学习建议和指导
3. 协助教师进行教学辅助工作
4. 用温暖、鼓励的语气与学生交流

请始终保持：
- 友善和耐心的态度
- 专业准确的知识回答
- 鼓励性和支持性的语言
- 对学生的尊重和理解

在回答问题时，尽量结合学校的实际情况和校园文化。`,
  createdAt: new Date().toISOString(),
};

// 默认用户配置
const defaultUserConfig: UserConfig = {
  name: '管理员',
  title: '系统管理员',
  avatar: '',
};

// 数字人角色列表改为运行时从后端 /api/live2d-models/info 获取（见 useLive2dModels）

export const CharacterConfig: FC = () => {
  // Live2D配置hook
  const { setModelInfo } = useLive2DConfig();

  // 角色配置状态：以【后端当前生效值】为初始值，编辑后需显式保存
  const [characterConfig, setCharacterConfig] = useState<CharacterConfig>(
    defaultCharacterConfig
  );
  const [savedConfig, setSavedConfig] = useState<CharacterConfig>(
    defaultCharacterConfig
  );
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const configDirty =
    characterConfig.name !== savedConfig.name ||
    characterConfig.systemPrompt !== savedConfig.systemPrompt;

  // 用户配置状态（用户名称/身份仅用于界面显示，不参与 AI 行为）
  const [userConfig, setUserConfig] = useLocalStorage<UserConfig>(
    'userConfig',
    defaultUserConfig
  );

  // 数字人选择状态
  const [selectedAvatar, setSelectedAvatar] = useState('');

  // 获取Live2D角色列表（后端接口，会话内缓存）
  const {
    characters: live2dCharacters,
    loading: modelsLoading,
    error: modelsError,
    refresh: refreshModels,
  } = useLive2dModels();

  // 挂载时从后端读取当前生效的角色名称/人设
  useEffect(() => {
    let cancelled = false;
    fetchBackendCharacterConfig()
      .then((backend) => {
        if (cancelled) return;
        const loaded: CharacterConfig = {
          ...defaultCharacterConfig,
          name: backend.character_name || defaultCharacterConfig.name,
          systemPrompt: backend.persona_prompt || defaultCharacterConfig.systemPrompt,
        };
        setCharacterConfig(loaded);
        setSavedConfig(loaded);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        toaster.create({
          title: '读取角色配置失败',
          description: `${e instanceof Error ? e.message : String(e)}；请确认后端服务与登录状态`,
          type: 'error',
          duration: 4000,
        });
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 编辑角色名称/人设（本地暂存，点"保存"才写入后端）
  const handleCharacterConfigChange = (field: keyof CharacterConfig, value: string) => {
    setCharacterConfig((prev) => ({ ...prev, [field]: value }));
  };

  // 保存到后端：写入 conf.yaml 并热更新 LLM system prompt
  const handleSaveToBackend = async () => {
    if (!characterConfig.name.trim()) {
      toaster.create({
        title: '角色名称不能为空',
        type: 'error',
        duration: 2000,
      });
      return;
    }
    if (!characterConfig.systemPrompt.trim()) {
      toaster.create({
        title: '角色人设不能为空',
        type: 'error',
        duration: 2000,
      });
      return;
    }
    setConfigSaving(true);
    try {
      const message = await saveBackendCharacterConfig(
        characterConfig.name.trim(),
        characterConfig.systemPrompt
      );
      const savedNow: CharacterConfig = {
        ...characterConfig,
        name: characterConfig.name.trim(),
      };
      setSavedConfig(savedNow);
      setCharacterConfig(savedNow);
      toaster.create({
        title: message,
        description: '新的人设将应用于之后的新对话；进行中的对话保持原设定。',
        type: 'success',
        duration: 5000,
      });
    } catch (e) {
      toaster.create({
        title: '保存失败',
        description: e instanceof Error ? e.message : String(e),
        type: 'error',
        duration: 4000,
      });
    } finally {
      setConfigSaving(false);
    }
  };

  // 重置为"后端当前生效值"（放弃未保存的本地修改）
  const handleResetConfig = () => {
    setCharacterConfig(savedConfig);
    toaster.create({
      title: '已还原为当前生效的配置',
      type: 'info',
      duration: 2000,
    });
  };

  // 数字人选择处理
  const handleAvatarSelect = async (character: Live2dCharacter) => {
    setSelectedAvatar(character.id);

    try {
      // 使用相对路径，因为vite代理会处理到后端的转发
      // 参数来自 /api/live2d-models/info（含真实的 model3.json 路径与表情映射）
      // kScale使用后端配置值（如0.5），在Live2DConfigProvider中会乘以2得到最终值
      const newModelInfo = {
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
      setModelInfo(newModelInfo);

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

  // 实时更新用户配置
  const handleUserConfigChange = (field: keyof UserConfig, value: string) => {
    const updatedConfig = { ...userConfig, [field]: value };
    setUserConfig(updatedConfig);
  };

  return (
    <Box
      width="full"
      height={{ base: 'auto', md: 'full' }}
      display="flex"
      flexDirection={{ base: 'column', md: 'row' }}
      gap={{ base: '4', md: '6' }}
    >
      {/* 左侧：角色配置 */}
      <Box
        flex="1"
        bg="white"
        rounded="xl"
        border="1px solid"
        borderColor={colors.gray200}
        display="flex"
        flexDirection="column"
        height={{ base: 'auto', md: 'full' }}
        overflow="hidden"
      >
        {/* 标题栏 */}
        <Box
          p="4"
          borderBottom="1px solid"
          borderColor={colors.gray200}
          bg={colors.gray50}
        >
          <HStack justify="space-between">
            <HStack gap="3">
              <FiSettings style={{ width: '20px', height: '20px', color: colors.primary }} />
              <Text fontSize="md" fontWeight="semibold" color={colors.gray800}>
                数字人角色配置
              </Text>
            </HStack>
            <HStack gap="2">
              <Button
                size="sm"
                variant="ghost"
                color={colors.gray600}
                onClick={handleResetConfig}
              >
                重置默认
              </Button>
            </HStack>
          </HStack>
        </Box>

        {/* 配置内容 */}
        <Box
          flex="1"
          overflowY="auto"
          p="6"
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
          <VStack gap="6" align="stretch">
            {/* 数字人选择 */}
            <Box>
              <HStack gap="3" mb="3">
                <FiUser style={{ width: '18px', height: '18px', color: colors.primary }} />
                <Text fontSize="sm" fontWeight="semibold" color={colors.gray800}>
                  数字人选择
                </Text>
              </HStack>
              <VStack gap="2">
                {modelsLoading && (
                  <Text fontSize="xs" color={colors.gray600} py="2">
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
                  <Text fontSize="xs" color={colors.gray600} py="2">
                    后端未发现可用的 Live2D 模型
                  </Text>
                )}
                {live2dCharacters.map((character) => (
                  <Box
                    key={character.id}
                    p="3"
                    rounded="lg"
                    border="1px solid"
                    borderColor={selectedAvatar === character.id ? colors.primary : colors.gray200}
                    bg={selectedAvatar === character.id ? 'blue.50' : 'transparent'}
                    cursor="pointer"
                    onClick={() => handleAvatarSelect(character)}
                    _hover={{ borderColor: colors.primary, bg: 'blue.50' }}
                    transition="all 0.2s"
                  >
                    <HStack gap="3">
                      <Text fontSize="2xl">{character.preview}</Text>
                      <VStack alignItems="start" gap="0" flex="1">
                        <Text fontSize="sm" fontWeight="medium" color={colors.gray800}>
                          {character.name}
                        </Text>
                        <Text fontSize="xs" color={colors.gray600}>
                          {character.description}
                        </Text>
                      </VStack>
                      {selectedAvatar === character.id && (
                        <Badge bg={colors.primary} color="white" fontSize="9px" px="2" py="0.5" rounded="md">
                          <HStack gap="1" align="center">
                            <FiCheck style={{ width: '10px', height: '10px' }} />
                            <Text>当前</Text>
                          </HStack>
                        </Badge>
                      )}
                    </HStack>
                  </Box>
                ))}
              </VStack>
            </Box>

            <Box height="1px" bg={colors.gray200} my="2" />

            {/* 角色基本信息 */}
            <Box>
              <HStack justify="space-between" mb="3">
                <Text fontSize="sm" fontWeight="semibold" color={colors.gray800}>
                  角色基本信息
                </Text>
                {configLoading && (
                  <Text fontSize="2xs" color={colors.gray600}>
                    正在从后端读取…
                  </Text>
                )}
                {!configLoading && configDirty && (
                  <Badge bg="orange.100" color="orange.700" fontSize="9px" px="2" py="0.5" rounded="md">
                    未保存
                  </Badge>
                )}
              </HStack>
              <VStack gap="3" align="stretch">
                <Box>
                  <Text fontSize="xs" color={colors.gray600} mb="1">
                    角色名称
                  </Text>
                  <Input
                    value={characterConfig.name}
                    onChange={(e) => handleCharacterConfigChange('name', e.target.value)}
                    placeholder="请输入角色名称"
                    size="sm"
                  />
                </Box>

                <Box>
                  <Text fontSize="xs" color={colors.gray600} mb="1">
                    角色描述（仅用于界面展示）
                  </Text>
                  <Input
                    value={characterConfig.description}
                    onChange={(e) => handleCharacterConfigChange('description', e.target.value)}
                    placeholder="仅显示在界面上，不影响 AI 行为"
                    size="sm"
                  />
                </Box>
              </VStack>
            </Box>

            <Box height="1px" bg={colors.gray200} my="2" />

            {/* 角色人设 */}
            <Box>
              <Text fontSize="sm" fontWeight="semibold" color={colors.gray800} mb="3">
                角色人设（系统提示词）
              </Text>

              <Textarea
                value={characterConfig.systemPrompt}
                onChange={(e) => handleCharacterConfigChange('systemPrompt', e.target.value)}
                placeholder="请输入角色人设，这将定义数字人的性格、行为和回答风格"
                size="sm"
                minHeight="200px"
                fontFamily="monospace"
                fontSize="xs"
              />

              <HStack mt="3" justify="flex-end" align="center">
                {configDirty && (
                  <Button size="sm" variant="outline" onClick={handleResetConfig}>
                    还原
                  </Button>
                )}
                <Button
                  size="sm"
                  bg={colors.primary}
                  color="white"
                  _hover={{ bg: colors.primaryLight }}
                  disabled={!configDirty || configSaving || configLoading}
                  loading={configSaving}
                  loadingText="保存中…"
                  onClick={handleSaveToBackend}
                >
                  <FiSave />
                  保存到后端
                </Button>
              </HStack>
            </Box>

            {/* 配置提示 */}
            <Box
              p="3"
              bg="blue.50"
              border="1px solid"
              borderColor="blue.200"
              rounded="md"
            >
              <Text fontSize="xs" color="blue.700">
                💡 角色名称与人设保存后写入后端配置（conf.yaml），并即时对之后的新对话生效；
                进行中的对话仍使用保存前的设定。角色描述与用户名称仅用于界面展示。
              </Text>
            </Box>
          </VStack>
        </Box>
      </Box>

      {/* 右侧：用户配置（手机端堆叠到角色配置下方，占满宽度） */}
      <Box
        width={{ base: 'full', md: '300px' }}
        bg="white"
        rounded="xl"
        border="1px solid"
        borderColor={colors.gray200}
        display="flex"
        flexDirection="column"
        height={{ base: 'auto', md: 'full' }}
      >
        {/* 标题栏 */}
        <Box
          p="4"
          borderBottom="1px solid"
          borderColor={colors.gray200}
          bg={colors.gray50}
        >
          <HStack gap="3">
            <FiUser style={{ width: '16px', height: '16px', color: colors.primary }} />
            <Text fontSize="sm" fontWeight="semibold" color={colors.gray800}>
              用户配置
            </Text>
          </HStack>
        </Box>

        {/* 用户配置内容 */}
        <Box
          flex="1"
          overflowY="auto"
          p="4"
        >
          <VStack gap="4" align="stretch">
            {/* 用户名称 */}
            <Box>
              <Text fontSize="xs" color={colors.gray600} mb="2">
                用户名称
              </Text>
              <Input
                value={userConfig.name}
                onChange={(e) => handleUserConfigChange('name', e.target.value)}
                placeholder="请输入您的名称"
                size="sm"
              />
            </Box>

            {/* 用户身份 */}
            <Box>
              <Text fontSize="xs" color={colors.gray600} mb="2">
                身份/职称
              </Text>
              <Input
                value={userConfig.title}
                onChange={(e) => handleUserConfigChange('title', e.target.value)}
                placeholder="如：学生、教师、管理员"
                size="sm"
              />
            </Box>

            {/* 配置说明 */}
            <Box
              p="3"
              bg={colors.gray50}
              rounded="md"
            >
              <Text fontSize="10px" color={colors.gray600} lineHeight="1.4">
                用户配置会在对话中影响数字人对您的称呼和互动方式。
              </Text>
            </Box>

            {/* 当前配置预览 */}
            <Box
              p="3"
              bg={colors.primary}
              color="white"
              rounded="md"
              textAlign="center"
            >
              <Box
                width="12"
                height="12"
                rounded="full"
                bg="rgba(255,255,255,0.2)"
                display="flex"
                alignItems="center"
                justifyContent="center"
                margin="0 auto 2"
                fontSize="lg"
                fontWeight="semibold"
              >
                {userConfig.name.charAt(0) || '用'}
              </Box>
              <Text fontSize="sm" fontWeight="semibold">
                {userConfig.name || '未设置'}
              </Text>
              <Text fontSize="10px" opacity="0.8">
                {userConfig.title || '未设置身份'}
              </Text>
            </Box>
          </VStack>
        </Box>
      </Box>
    </Box>
  );
};

export default CharacterConfig;
