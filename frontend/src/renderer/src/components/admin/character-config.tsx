/**
 * 角色配置页面
 * 用于配置数字人角色名称、角色人设和Live2D模型选择；
 * 管理员可在此切换对话模型接口（LLM API）；
 * 称呼与互动方式按登录账号角色自动生效（见右侧说明卡）。
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
  Image,
} from '@chakra-ui/react';
import {
  FiUser,
  FiSettings,
  FiCheck,
  FiSave,
  FiKey,
  FiZap,
} from 'react-icons/fi';
import { useAuth } from '@/context/auth-context';
import { useLive2DConfig } from '@/context/live2d-config-context';
import { useLive2dModels } from '@/hooks/live2d/use-live2d-models';
import { apiUrl } from '@/services/api-base';
import type { Live2dCharacter } from '@/services/live2d-models-api';
import { toaster } from '@/components/ui/toaster';

import {
  fetchBackendCharacterConfig,
  saveBackendCharacterConfig,
  fetchModelConfig,
  saveModelConfig,
  testModelConfig,
} from '@/services/character-config-api';
import type {
  ModelConfig,
  ModelConfigPayload,
  ModelProvider,
  ModelTestResult,
} from '@/services/character-config-api';

// 角色配置接口
interface CharacterConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  createdAt: string;
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

// 接口类型的显示名
const PROVIDER_LABELS: Record<ModelProvider, string> = {
  deepseek_llm: 'DeepSeek 官方',
  openai_compatible_llm: 'OpenAI 兼容接口',
};

// 数字人角色列表改为运行时从后端 /api/live2d-models/info 获取（见 useLive2dModels）

export const CharacterConfig: FC = () => {
  // Live2D配置hook
  const { setModelInfo } = useLive2DConfig();

  // 登录用户（模型接口管理仅管理员可见）
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.role === 'admin';

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

  // 模型接口状态（管理员）：后端当前生效值 + 表单编辑值
  const [currentModelCfg, setCurrentModelCfg] = useState<ModelConfig | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelSaving, setModelSaving] = useState(false);
  const [modelTesting, setModelTesting] = useState(false);
  const [modelProvider, setModelProvider] = useState<ModelProvider>('deepseek_llm');
  const [modelBaseUrl, setModelBaseUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [modelApiKey, setModelApiKey] = useState(''); // 留空 = 保留已存密钥
  const [testResult, setTestResult] = useState<ModelTestResult | null>(null);

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

  // 挂载/成为管理员时读取模型接口当前生效值
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setModelLoading(true);
    fetchModelConfig()
      .then((cfg) => {
        if (cancelled) return;
        setCurrentModelCfg(cfg);
        setModelProvider(cfg.provider);
        setModelBaseUrl(cfg.base_url || '');
        setModelName(cfg.model || '');
        setModelApiKey(''); // 密钥不回显，留空 = 保留
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        toaster.create({
          title: '读取模型接口配置失败',
          description: e instanceof Error ? e.message : String(e),
          type: 'error',
          duration: 4000,
        });
      })
      .finally(() => {
        if (!cancelled) setModelLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // 表单 → 请求体（温度固定 1.0 不暴露；密钥留空由后端保留旧值）
  const buildModelPayload = (): ModelConfigPayload => ({
    provider: modelProvider,
    base_url: modelBaseUrl.trim(),
    model: modelName.trim(),
    llm_api_key: modelApiKey.trim(),
    temperature: 1.0,
  });

  // 测试连接：用表单值（密钥留空回落已存密钥）发一次极小补全请求
  const handleTestModel = async () => {
    if (!modelName.trim()) {
      toaster.create({ title: '请先填写模型名称', type: 'error', duration: 2000 });
      return;
    }
    setModelTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testModelConfig(buildModelPayload()));
    } catch (e) {
      toaster.create({
        title: '测试请求失败',
        description: e instanceof Error ? e.message : String(e),
        type: 'error',
        duration: 4000,
      });
    } finally {
      setModelTesting(false);
    }
  };

  // 保存并生效：写入 conf.yaml + 热重建，新对话生效
  const handleSaveModel = async () => {
    if (!modelName.trim()) {
      toaster.create({ title: '模型名称不能为空', type: 'error', duration: 2000 });
      return;
    }
    if (modelProvider === 'openai_compatible_llm' && !modelBaseUrl.trim()) {
      toaster.create({
        title: 'OpenAI 兼容接口必须填写接口地址',
        type: 'error',
        duration: 2500,
      });
      return;
    }
    setModelSaving(true);
    try {
      const message = await saveModelConfig(buildModelPayload());
      // 重新读取生效值（刷新掩码等展示）
      const fresh = await fetchModelConfig();
      setCurrentModelCfg(fresh);
      setModelApiKey('');
      setTestResult(null);
      toaster.create({
        title: message,
        description: '新接口将应用于之后的新对话；进行中的对话保持原接口。',
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
      setModelSaving(false);
    }
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
                      {character.avatarUrl ? (
                        <Image
                          src={apiUrl(character.avatarUrl)}
                          alt={character.name}
                          boxSize="10"
                          rounded="full"
                          objectFit="cover"
                          border="1px solid"
                          borderColor={colors.gray200}
                          bg="white"
                          flexShrink={0}
                        />
                      ) : (
                        <Text fontSize="2xl">{character.preview}</Text>
                      )}
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
                进行中的对话仍使用保存前的设定。角色描述仅用于界面展示。
              </Text>
            </Box>
          </VStack>
        </Box>
      </Box>

      {/* 右侧：模型接口（管理员）+ 称呼与互动方式说明（手机端堆叠到角色配置下方） */}
      <Box
        width={{ base: 'full', md: '300px' }}
        display="flex"
        flexDirection="column"
        gap={{ base: '4', md: '6' }}
        height={{ base: 'auto', md: 'full' }}
      >
        {isAdmin && (
          <Box
            bg="white"
            rounded="xl"
            border="1px solid"
            borderColor={colors.gray200}
            display="flex"
            flexDirection="column"
            flexShrink={0}
          >
            {/* 标题栏 */}
            <Box
              p="4"
              borderBottom="1px solid"
              borderColor={colors.gray200}
              bg={colors.gray50}
            >
              <HStack gap="3">
                <FiKey style={{ width: '16px', height: '16px', color: colors.primary }} />
                <Text fontSize="sm" fontWeight="semibold" color={colors.gray800}>
                  模型接口（API）
                </Text>
              </HStack>
            </Box>

            {/* 模型接口内容 */}
            <Box flex="1" overflowY="auto" p="4">
              <VStack gap="3" align="stretch">
                {/* 当前生效值 */}
                <Box p="3" bg={colors.gray50} rounded="md">
                  <Text fontSize="10px" color={colors.gray600} mb="1">
                    当前生效
                  </Text>
                  {modelLoading ? (
                    <Text fontSize="xs" color={colors.gray600}>
                      正在读取…
                    </Text>
                  ) : currentModelCfg ? (
                    <VStack align="start" gap="0">
                      <Text fontSize="xs" color={colors.gray800} fontWeight="medium">
                        {PROVIDER_LABELS[currentModelCfg.provider]} · {currentModelCfg.model || '未设置'}
                      </Text>
                      <Text fontSize="10px" color={colors.gray600}>
                        密钥：{currentModelCfg.api_key_masked || '未设置'}
                      </Text>
                    </VStack>
                  ) : (
                    <Text fontSize="xs" color={colors.gray600}>
                      未能读取（请检查登录状态）
                    </Text>
                  )}
                </Box>

                {/* 接口类型 */}
                <Box>
                  <Text fontSize="xs" color={colors.gray600} mb="1">
                    接口类型
                  </Text>
                  <select
                    aria-label="接口类型"
                    value={modelProvider}
                    onChange={(e) => {
                      setModelProvider(e.target.value as ModelProvider);
                      setTestResult(null);
                    }}
                    style={{
                      width: '100%', fontSize: '13px', padding: '6px 8px',
                      border: `1px solid ${colors.gray200}`, borderRadius: '6px',
                      color: colors.gray800, background: 'white',
                    }}
                  >
                    {(Object.keys(PROVIDER_LABELS) as ModelProvider[]).map((p) => (
                      <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                    ))}
                  </select>
                </Box>

                {/* 接口地址 */}
                <Box>
                  <Text fontSize="xs" color={colors.gray600} mb="1">
                    接口地址
                  </Text>
                  <Input
                    value={modelBaseUrl}
                    onChange={(e) => setModelBaseUrl(e.target.value)}
                    placeholder={
                      modelProvider === 'deepseek_llm'
                        ? '留空使用官方地址 https://api.deepseek.com/v1'
                        : '必填，如 https://api.example.com/v1'
                    }
                    size="sm"
                  />
                </Box>

                {/* 模型名称 */}
                <Box>
                  <Text fontSize="xs" color={colors.gray600} mb="1">
                    模型名称
                  </Text>
                  <Input
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="如 deepseek-chat"
                    size="sm"
                  />
                </Box>

                {/* API 密钥 */}
                <Box>
                  <Text fontSize="xs" color={colors.gray600} mb="1">
                    API 密钥
                  </Text>
                  <Input
                    type="password"
                    value={modelApiKey}
                    onChange={(e) => setModelApiKey(e.target.value)}
                    placeholder={
                      currentModelCfg?.api_key_masked
                        ? `已设置（${currentModelCfg.api_key_masked}），留空保持不变`
                        : '请输入 API 密钥'
                    }
                    size="sm"
                  />
                </Box>

                {/* 测试连接 */}
                <HStack gap="2">
                  <Button
                    size="xs"
                    variant="outline"
                    color={colors.primary}
                    borderColor={colors.primary}
                    disabled={modelLoading}
                    loading={modelTesting}
                    loadingText="测试中…"
                    onClick={handleTestModel}
                  >
                    <FiZap />
                    测试连接
                  </Button>
                  {testResult && (
                    <Badge
                      bg={testResult.ok ? 'green.100' : 'red.100'}
                      color={testResult.ok ? 'green.700' : 'red.700'}
                      fontSize="9px"
                      px="2"
                      py="0.5"
                      rounded="md"
                    >
                      {testResult.ok
                        ? `连通（${testResult.latency_ms}ms）`
                        : '连接失败'}
                    </Badge>
                  )}
                </HStack>
                {testResult && (
                  <Box
                    p="2"
                    rounded="md"
                    bg={testResult.ok ? '#F0FFF4' : '#FFF5F5'}
                    border="1px solid"
                    borderColor={testResult.ok ? '#C6F6D5' : '#FED7D7'}
                  >
                    <Text
                      fontSize="10px"
                      color={testResult.ok ? '#276749' : '#C53030'}
                      lineHeight="1.4"
                      wordBreak="break-all"
                    >
                      {testResult.ok
                        ? `模型 ${testResult.model} 连接成功${testResult.reply_sample ? `，回复：${testResult.reply_sample}` : ''}`
                        : testResult.error || '连接失败'}
                    </Text>
                  </Box>
                )}

                {/* 保存 */}
                <Button
                  size="sm"
                  bg={colors.primary}
                  color="white"
                  _hover={{ bg: colors.primaryLight }}
                  disabled={modelLoading}
                  loading={modelSaving}
                  loadingText="保存中…"
                  onClick={handleSaveModel}
                >
                  <FiSave />
                  保存并生效
                </Button>

                {/* 说明 */}
                <Box p="3" bg={colors.gray50} rounded="md">
                  <Text fontSize="10px" color={colors.gray600} lineHeight="1.4">
                    更换为学校自己的 API：填入接口地址、模型名称与密钥，先「测试连接」
                    确认可用，再「保存并生效」。保存后写入服务器配置并对之后的新对话生效，
                    进行中的对话保持原接口；密钥仅存服务器，不回显完整内容。
                  </Text>
                </Box>
              </VStack>
            </Box>
          </Box>
        )}

        {/* 称呼与互动方式（只读规则说明，原「用户配置」卡片） */}
        <Box
          bg="white"
          rounded="xl"
          border="1px solid"
          borderColor={colors.gray200}
          display="flex"
          flexDirection="column"
          flex="1"
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
                称呼与互动方式
              </Text>
            </HStack>
          </Box>

          <Box flex="1" overflowY="auto" p="4">
            <VStack gap="3" align="stretch">
              <Text fontSize="10px" color={colors.gray600} lineHeight="1.4">
                系统按登录账号的角色自动选择数字人的称呼与互动风格，无需手动填写：
              </Text>
              {[
                { role: '学生账号', rule: '称呼「同学」，互动亲切、有鼓励性，解释通俗' },
                { role: '家长账号', rule: '称呼「家长」，围绕招生咨询与孩子在校学习生活' },
                { role: '教职工账号（管理员/编辑）', rule: '称呼「老师」，互动专业、简洁、直给' },
                { role: '一体机大屏 / 未登录访客', rule: '中性称呼「你」，不询问个人身份信息' },
              ].map((item) => (
                <Box key={item.role} p="2.5" bg={colors.gray50} rounded="md">
                  <Text fontSize="11px" color={colors.gray800} fontWeight="medium">
                    {item.role}
                  </Text>
                  <Text fontSize="10px" color={colors.gray600} mt="0.5" lineHeight="1.4">
                    {item.rule}
                  </Text>
                </Box>
              ))}
              <Box p="3" bg="blue.50" border="1px solid" borderColor="blue.200" rounded="md">
                <Text fontSize="10px" color="blue.700" lineHeight="1.4">
                  💡 需要调整整体语气与性格时，请编辑左侧「角色人设」；称呼规则随账号
                  角色自动叠加，与人设不冲突。
                </Text>
              </Box>
            </VStack>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default CharacterConfig;
