/**
 * 角色配置页面
 * 用于配置数字人角色名称、角色人设、用户名称和Live2D模型选择
 */

import { FC, useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Textarea,
  Badge,
  IconButton,
  createToaster,
} from '@chakra-ui/react';
import {
  FiSave,
  FiRefreshCw,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiUser,
  FiSettings,
  FiCheck,
} from 'react-icons/fi';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';
import { useLive2DConfig } from '@/context/live2d-config-context';

const toaster = createToaster({
  placement: 'top-end',
  overlap: true,
  max: 3
});

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

export const CharacterConfig: FC = () => {
  // Live2D配置hook
  const { modelInfo, setModelInfo } = useLive2DConfig();

  // 角色配置状态
  const [characterConfig, setCharacterConfig] = useLocalStorage<CharacterConfig>(
    'characterConfig',
    defaultCharacterConfig
  );

  // 用户配置状态
  const [userConfig, setUserConfig] = useLocalStorage<UserConfig>(
    'userConfig',
    defaultUserConfig
  );

  // 数字人选择状态
  const [selectedAvatar, setSelectedAvatar] = useState('');

  // 获取Live2D角色列表
  const live2dCharacters = getLive2DCharacters();

  // 实时更新角色配置（立即应用）
  const handleCharacterConfigChange = (field: keyof CharacterConfig, value: string) => {
    const updatedConfig = { ...characterConfig, [field]: value };
    setCharacterConfig(updatedConfig);

    toaster.create({
      title: '角色配置已更新',
      type: 'success',
      duration: 1000,
    });
  };

  // 重置配置
  const handleResetConfig = () => {
    setCharacterConfig(defaultCharacterConfig);
    toaster.create({
      title: '配置已重置为默认值',
      type: 'info',
      duration: 2000,
    });
  };

  // 数字人选择处理
  const handleAvatarSelect = async (characterId: string, modelName: string, modelFileName: string) => {
    setSelectedAvatar(characterId);

    try {
      // 使用相对路径，因为vite代理会处理到后端的转发
      // kScale设置为0.5，在Live2DConfigProvider中会乘以2得到最终值1.0
      const newModelInfo = {
        name: modelName,
        url: `/live2d-models/${modelName}/runtime/${modelFileName}.model3.json`,
        kScale: 0.5,
        initialXshift: 0,
        initialYshift: 0,
      };

      // 设置模型信息
      setModelInfo(newModelInfo);

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

  // 保存用户配置
  const handleSaveUserConfig = () => {
    if (!userConfig.name.trim()) {
      toaster.create({
        title: '用户名称不能为空',
        type: 'error',
        duration: 2000,
      });
      return;
    }

    toaster.create({
      title: '用户配置已保存',
      type: 'success',
      duration: 2000,
    });
  };

  // 实时更新用户配置
  const handleUserConfigChange = (field: keyof UserConfig, value: string) => {
    const updatedConfig = { ...userConfig, [field]: value };
    setUserConfig(updatedConfig);
  };

  return (
    <Box width="full" height="full" display="flex" gap="6">
      {/* 左侧：角色配置 */}
      <Box
        flex="1"
        bg="white"
        rounded="xl"
        border="1px solid"
        borderColor={colors.gray200}
        display="flex"
        flexDirection="column"
        height="full"
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
                {live2dCharacters.map((character) => (
                  <Box
                    key={character.id}
                    p="3"
                    rounded="lg"
                    border="1px solid"
                    borderColor={selectedAvatar === character.id ? colors.primary : colors.gray200}
                    bg={selectedAvatar === character.id ? 'blue.50' : 'transparent'}
                    cursor="pointer"
                    onClick={() => handleAvatarSelect(character.id, character.modelName, character.modelFileName)}
                    _hover={{ borderColor: colors.primary, bg: 'blue.50' }}
                    transition="all 0.2s"
                  >
                    <HStack gap="3">
                      <Text fontSize="2xl">{character.preview}</Text>
                      <VStack align="start" spacing="0" flex="1">
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
              <Text fontSize="sm" fontWeight="semibold" color={colors.gray800} mb="3">
                角色基本信息
              </Text>
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
                    角色描述
                  </Text>
                  <Input
                    value={characterConfig.description}
                    onChange={(e) => handleCharacterConfigChange('description', e.target.value)}
                    placeholder="请输入角色描述"
                    size="sm"
                  />
                </Box>
              </VStack>
            </Box>

            <Box height="1px" bg={colors.gray200} my="2" />

            {/* 角色人设 */}
            <Box>
              <HStack justify="space-between" mb="3">
                <Text fontSize="sm" fontWeight="semibold" color={colors.gray800}>
                  角色人设（系统提示词）
                </Text>
              </HStack>

              <Textarea
                value={characterConfig.systemPrompt}
                onChange={(e) => handleCharacterConfigChange('systemPrompt', e.target.value)}
                placeholder="请输入角色人设，这将定义数字人的性格、行为和回答风格"
                size="sm"
                minHeight="200px"
                fontFamily="monospace"
                fontSize="xs"
              />
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
                💡 角色人设会影响数字人的回答风格和内容。请根据学校特色和教育需求进行定制。
              </Text>
            </Box>
          </VStack>
        </Box>
      </Box>

      {/* 右侧：用户配置 */}
      <Box
        width="300px"
        bg="white"
        rounded="xl"
        border="1px solid"
        borderColor={colors.gray200}
        display="flex"
        flexDirection="column"
        height="full"
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
