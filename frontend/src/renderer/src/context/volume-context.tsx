/**
 * 音量控制Context
 * 用于全局控制音频播放音量
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from 'react';

interface VolumeContextState {
  volume: number;
  setVolume: (volume: number) => void;
}

const VolumeContext = createContext<VolumeContextState | null>(null);

const DEFAULT_VOLUME = 80;

export function VolumeProvider({ children }: { children: ReactNode }) {
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  // 动态导入音量更新函数（避免循环依赖）
  const updateAudioVolume = useCallback(async () => {
    try {
      const { updateCurrentAudioVolume } = await import('@/hooks/utils/use-audio-task');
      updateCurrentAudioVolume(volume);
    } catch (error) {
      console.error('Failed to update audio volume:', error);
    }
  }, [volume]);

  const contextValue = useCallback(
    (vol: number) => {
      const clampedVolume = Math.max(0, Math.min(100, vol));
      setVolume(clampedVolume);
    },
    []
  );

  // 当音量变化时，更新正在播放的音频
  useEffect(() => {
    updateAudioVolume();
  }, [volume, updateAudioVolume]);

  return (
    <VolumeContext.Provider
      value={{
        volume,
        setVolume: contextValue,
      }}
    >
      {children}
    </VolumeContext.Provider>
  );
}

export function useVolume() {
  const context = useContext(VolumeContext);
  if (!context) {
    throw new Error('useVolume must be used within a VolumeProvider');
  }
  return context;
}
