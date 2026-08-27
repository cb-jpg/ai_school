/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable react-hooks/rules-of-hooks */
import { Stack, Box, Text, Button, HStack } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { settingStyles } from './setting-styles';
import { useLive2dSettings } from '@/hooks/sidebar/setting/use-live2d-settings';
import { SwitchField, InputField } from './common';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';
import {
  fetchBackendCharacterConfig,
  saveBackendCharacterConfig,
} from '@/services/character-config-api';

interface live2DProps {
  onSave?: (callback: () => void) => () => void
  onCancel?: (callback: () => void) => () => void
}

// 角色配置接口
interface CharacterConfig {
  name: string;
  description: string;
  systemPrompt: string;
}

// 用户配置接口
interface UserConfig {
  name: string;
  title: string;
}

function live2D({ onSave, onCancel }: live2DProps): JSX.Element {
  const { t } = useTranslation();
  const {
    modelInfo,
    handleInputChange,
    handleSave,
    handleCancel,
  } = useLive2dSettings();

  // 角色配置状态：从后端读取当前生效值，编辑后点"保存到后端"写回 conf.yaml
  const [characterConfig, setCharacterConfig] = useState<CharacterConfig>({
    name: '小石',
    description: '石实实验学校AI数字人',
    systemPrompt: '你是石实实验学校的AI数字人"小石"，是一位友善、专业、富有耐心的教育助手。',
  });
  const [savedConfig, setSavedConfig] = useState<CharacterConfig>({
    name: '小石',
    description: '石实实验学校AI数字人',
    systemPrompt: '你是石实实验学校的AI数字人"小石"，是一位友善、专业、富有耐心的教育助手。',
  });
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const configDirty =
    characterConfig.name !== savedConfig.name ||
    characterConfig.systemPrompt !== savedConfig.systemPrompt;

  // 挂载时从后端读取当前生效的角色名称/人设
  useEffect(() => {
    let cancelled = false;
    fetchBackendCharacterConfig()
      .then((backend) => {
        if (cancelled) return;
        const loaded: CharacterConfig = {
          name: backend.character_name || '小石',
          description: '石实实验学校AI数字人',
          systemPrompt: backend.persona_prompt,
        };
        setCharacterConfig(loaded);
        setSavedConfig(loaded);
      })
      .catch(() => {
        // 未登录或后端不可达时保持默认占位；管理后台页有更完整的错误提示
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveCharacterToBackend = async (): Promise<void> => {
    setConfigSaving(true);
    try {
      await saveBackendCharacterConfig(characterConfig.name.trim(), characterConfig.systemPrompt);
      const savedNow: CharacterConfig = {
        ...characterConfig,
        name: characterConfig.name.trim(),
      };
      setSavedConfig(savedNow);
      setCharacterConfig(savedNow);
    } catch (e) {
      console.error('保存角色配置失败:', e);
      alert(`保存角色配置失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setConfigSaving(false);
    }
  };

  // 用户配置状态
  const [userConfig, setUserConfig] = useLocalStorage<UserConfig>(
    'userConfig',
    {
      name: '管理员',
      title: '系统管理员',
    }
  );

  useEffect(() => {
    if (!onSave || !onCancel) return;

    const cleanupSave = onSave(handleSave);
    const cleanupCancel = onCancel(handleCancel);

    return (): void => {
      cleanupSave?.();
      cleanupCancel?.();
    };
  }, [onSave, onCancel]);

  return (
    <Stack {...settingStyles.common.container}>
      <SwitchField
        label={t('settings.live2d.pointerInteractive')}
        checked={modelInfo.pointerInteractive ?? false}
        onChange={(checked) => handleInputChange('pointerInteractive', checked)}
      />

      <SwitchField
        label={t('settings.live2d.scrollToResize')}
        checked={modelInfo.scrollToResize ?? true}
        onChange={(checked) => handleInputChange('scrollToResize', checked)}
      />

      {/* 角色配置部分 */}
      <Box height="1px" bg="gray.200" my="4" />

      <Text fontSize="sm" fontWeight="semibold" color="gray.700">
        角色形象配置
      </Text>

      <InputField
        label="角色名称"
        value={characterConfig.name}
        onChange={(value) => setCharacterConfig({ ...characterConfig, name: value as string })}
        placeholder="请输入角色名称，如：小石"
      />

      <InputField
        label="角色描述（仅用于界面展示）"
        value={characterConfig.description}
        onChange={(value) => setCharacterConfig({ ...characterConfig, description: value as string })}
        placeholder="仅显示在界面上，不影响 AI 行为"
      />

      <InputField
        label="角色人设（系统提示词）"
        value={characterConfig.systemPrompt}
        onChange={(value) => setCharacterConfig({ ...characterConfig, systemPrompt: value as string })}
        placeholder="请输入角色人设，这将定义数字人的性格和行为"
        textarea
        rows={4}
      />

      <HStack justify="flex-end" align="center">
        {configLoading && (
          <Text fontSize="xs" color="gray.500">
            正在从后端读取…
          </Text>
        )}
        {!configLoading && configDirty && (
          <Text fontSize="xs" color="orange.600">
            有未保存的修改
          </Text>
        )}
        <Button
          size="sm"
          colorScheme="blue"
          disabled={!configDirty || configSaving || configLoading}
          onClick={() => void handleSaveCharacterToBackend()}
        >
          {configSaving ? '保存中…' : '保存到后端'}
        </Button>
      </HStack>
      <Text fontSize="2xs" color="gray.500">
        人设保存后对之后的新对话生效；进行中的对话保持原设定。
      </Text>

      <Box height="1px" bg="gray.200" my="4" />

      <Text fontSize="sm" fontWeight="semibold" color="gray.700">
        用户信息配置
      </Text>

      <InputField
        label="用户名称"
        value={userConfig.name}
        onChange={(value) => setUserConfig({ ...userConfig, name: value as string })}
        placeholder="请输入您的名称"
      />

      <InputField
        label="用户身份"
        value={userConfig.title}
        onChange={(value) => setUserConfig({ ...userConfig, title: value as string })}
        placeholder="如：学生、教师、管理员"
      />
    </Stack>
  );
}

export default live2D;
