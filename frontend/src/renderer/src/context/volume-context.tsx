/**
 * 音量控制Context
 * 用于全局控制音频播放音量
 */

import {
  createContext,
  useContext,
  useCallback,
  ReactNode,
  useEffect,
} from 'react';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';

interface VolumeContextState {
  volume: number;
  setVolume: (volume: number) => void;
}

const VolumeContext = createContext<VolumeContextState | null>(null);

const DEFAULT_VOLUME = 80;

export function VolumeProvider({ children }: { children: ReactNode }) {
  // 音量持久化到 localStorage，避免每次启动都回到默认值
  const [volume, setVolumeState] = useLocalStorage<number>('ttsVolume', DEFAULT_VOLUME);

  // 动态导入音量更新函数（避免循环依赖）
  const updateAudioVolume = useCallback(async () => {
    try {
      const { updateCurrentAudioVolume } = await import('@/hooks/utils/use-audio-task');
      updateCurrentAudioVolume(volume);
    } catch (error) {
      console.error('Failed to update audio volume:', error);
    }
  }, [volume]);

  const setVolume = useCallback(
    (vol: number) => {
      const clampedVolume = Math.max(0, Math.min(100, vol));
      setVolumeState(clampedVolume);
    },
    [setVolumeState]
  );

  // 当音量变化时，更新正在播放的音频
  useEffect(() => {
    updateAudioVolume();
  }, [volume, updateAudioVolume]);

  return (
    <VolumeContext.Provider
      value={{
        volume,
        setVolume,
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
