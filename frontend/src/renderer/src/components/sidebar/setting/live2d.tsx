/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable react-hooks/rules-of-hooks */
import { Stack, Box, Text, createToaster } from '@chakra-ui/react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { settingStyles } from './setting-styles';
import { useLive2dSettings } from '@/hooks/sidebar/setting/use-live2d-settings';
import { SwitchField, InputField } from './common';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';

const toaster = createToaster({
  placement: 'top-end',
  overlap: true,
  max: 3
});

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

  // 角色配置状态
  const [characterConfig, setCharacterConfig] = useLocalStorage<CharacterConfig>(
    'characterConfig',
    {
      name: '小石',
      description: '石实实验学校AI数字人',
      systemPrompt: '你是石实实验学校的AI数字人"小石"，是一位友善、专业、富有耐心的教育助手。',
    }
  );

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
        label="角色描述"
        value={characterConfig.description}
        onChange={(value) => setCharacterConfig({ ...characterConfig, description: value as string })}
        placeholder="请输入角色描述"
      />

      <InputField
        label="角色人设（系统提示词）"
        value={characterConfig.systemPrompt}
        onChange={(value) => setCharacterConfig({ ...characterConfig, systemPrompt: value as string })}
        placeholder="请输入角色人设，这将定义数字人的性格和行为"
        textarea
        rows={4}
      />

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
