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
} from 'react';

interface VolumeContextState {
  volume: number;
  setVolume: (volume: number) => void;
}

const VolumeContext = createContext<VolumeContextState | null>(null);

const DEFAULT_VOLUME = 80;

export function VolumeProvider({ children }: { children: ReactNode }) {
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  const contextValue = useCallback(
    (vol: number) => {
      const clampedVolume = Math.max(0, Math.min(100, vol));
      setVolume(clampedVolume);
    },
    []
  );

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
