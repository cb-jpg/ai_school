import { useState, useEffect } from 'react';
import { ModelInfo, useLive2DConfig } from '@/context/live2d-config-context';

export const useLive2dSettings = () => {
  const Live2DConfigContext = useLive2DConfig();

  const initialModelInfo: ModelInfo = {
    url: '',
    kScale: 0.5,
    initialXshift: 0,
    initialYshift: 0,
    emotionMap: {},
    scrollToResize: true,
  };

  const [modelInfo, setModelInfoState] = useState<ModelInfo>(
    Live2DConfigContext?.modelInfo || initialModelInfo,
  );
  const [originalModelInfo, setOriginalModelInfo] = useState<ModelInfo>(
    Live2DConfigContext?.modelInfo || initialModelInfo,
  );

  useEffect(() => {
    if (Live2DConfigContext?.modelInfo) {
      if (JSON.stringify(Live2DConfigContext.modelInfo) !== JSON.stringify(originalModelInfo)) {
        setOriginalModelInfo(Live2DConfigContext.modelInfo);
        setModelInfoState(Live2DConfigContext.modelInfo);
      }
    }
  }, [Live2DConfigContext?.modelInfo]);

  useEffect(() => {
    // url 为空的兜底对象不要推回 Provider：会覆盖真实模型配置（emotionMap 等）为最小值。
    // 只有上下文里已有有效模型、或用户确实改动开关字段时才同步。
    if (Live2DConfigContext && modelInfo?.url) {
      Live2DConfigContext.setModelInfo(modelInfo);
    }
  }, [modelInfo.pointerInteractive, modelInfo.scrollToResize]);

  const handleInputChange = (key: keyof ModelInfo, value: ModelInfo[keyof ModelInfo]): void => {
    setModelInfoState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (): void => {
    if (Live2DConfigContext && modelInfo) {
      setOriginalModelInfo(modelInfo);
    }
  };

  const handleCancel = (): void => {
    setModelInfoState(originalModelInfo);
    if (Live2DConfigContext && originalModelInfo) {
      Live2DConfigContext.setModelInfo(originalModelInfo);
    }
  };

  return {
    modelInfo,
    handleInputChange,
    handleSave,
    handleCancel,
  };
};
