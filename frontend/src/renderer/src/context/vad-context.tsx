/* eslint-disable no-use-before-define */
import {
  createContext, useContext, useRef, useCallback, useEffect, useReducer, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { MicVAD } from '@ricky0123/vad-web';
import { useInterrupt } from '@/components/canvas/live2d';
import { audioTaskQueue } from '@/utils/task-queue';
import { useSendAudio } from '@/hooks/utils/use-send-audio';
import { SubtitleContext } from './subtitle-context';
import { AiStateContext, type AiState } from './ai-state-context';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';
import { IS_KIOSK } from '@/utils/device-profile';
import { toaster } from '@/components/ui/toaster';

/**
 * VAD settings configuration interface
 * @interface VADSettings
 */
export interface VADSettings {
  /** Threshold for positive speech detection (0-100) */
  positiveSpeechThreshold: number;

  /** Threshold for negative speech detection (0-100) */
  negativeSpeechThreshold: number;

  /** Number of frames for speech redemption */
  redemptionFrames: number;
}

/**
 * VAD context state interface
 * @interface VADState
 */
interface VADState {
  /** Auto stop mic feature state */
  autoStopMic: boolean;

  /** Microphone active state */
  micOn: boolean;

  /** Set microphone state */
  setMicOn: (value: boolean) => void;

  /** Set Auto stop mic state */
  setAutoStopMic: (value: boolean) => void;

  /** Start microphone and VAD */
  startMic: () => Promise<void>;

  /** Stop microphone and VAD */
  stopMic: () => void;

  /** 按住说话松开：把缓冲中的语音送出后再收音（push-to-talk 用） */
  releaseMic: (timeoutMs?: number) => void;

  /** 按住说话按住/松开标记：按住期间 speech-end 不触发自动收音 */
  setMicHold: (holding: boolean) => void;

  /** Previous speech probability value */
  previousTriggeredProbability: number;

  /** Set previous speech probability */
  setPreviousTriggeredProbability: (value: number) => void;

  /** VAD settings configuration */
  settings: VADSettings;

  /** Update VAD settings */
  updateSettings: (newSettings: VADSettings) => void;

  /** Auto start microphone when AI starts speaking */
  autoStartMicOn: boolean;

  /** Set auto start microphone state */
  setAutoStartMicOn: (value: boolean) => void;

  /** Auto start microphone when conversation ends */
  autoStartMicOnConvEnd: boolean;

  /** Set auto start microphone when conversation ends state */
  setAutoStartMicOnConvEnd: (value: boolean) => void;
}

/**
 * Default values and constants
 */
const DEFAULT_VAD_SETTINGS: VADSettings = {
  positiveSpeechThreshold: 50,
  negativeSpeechThreshold: 35,
  redemptionFrames: 35,
};

const DEFAULT_VAD_STATE = {
  micOn: false,
  autoStopMic: false,
  autoStartMicOn: false,
  autoStartMicOnConvEnd: false,
};

/**
 * Create the VAD context
 */
export const VADContext = createContext<VADState | null>(null);

/**
 * VAD Provider Component
 * Manages voice activity detection and microphone state
 *
 * @param {Object} props - Provider props
 * @param {React.ReactNode} props.children - Child components
 */
export function VADProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  // Refs for VAD instance and state
  const vadRef = useRef<MicVAD | null>(null);
  const previousTriggeredProbabilityRef = useRef(0);
  const previousAiStateRef = useRef<AiState>('idle');
  /* 按住说话代际守卫（2026-11-06 说明.txt：录音按钮改按住录音）：快速点按-
   松开时，startMic 的异步初始化（首次要拉模型）可能在松开之后才完成——
   若不设防，迟到的新 VAD 会把麦克风重新打开并卡在「无人说话」状态。
   每次 start/stop 递增代数，迟到的初始化发现自己代数过期即自毁。 */
  const micGenRef = useRef(0);
  // 按住说话进行中（push-to-talk）：按住期间 speech-end 的自动收音要让路，
  // 否则说到一半的句间停顿（>redemptionFrames）会把麦克风掐断、后半句全丢
  const micHoldRef = useRef(false);

  // Persistent state management (改为不持久化，每次重新启动时默认关闭)
  const [micOn, setMicOn] = useState(DEFAULT_VAD_STATE.micOn);
  const autoStopMicRef = useRef(true);
  // 一体机默认开：立式机是路人即问即走场景，说完话必须自动收音（11.5 测试反馈「不会自动停止接收声音」），
  // 且 UI 上一体机不渲染该开关——这里只定默认值， speech-end 处另有 IS_KIOSK 强制兜底
  const [autoStopMic, setAutoStopMicState] = useLocalStorage(
    'autoStopMic',
    IS_KIOSK ? true : DEFAULT_VAD_STATE.autoStopMic,
  );
  const [settings, setSettings] = useLocalStorage<VADSettings>(
    'vadSettings',
    DEFAULT_VAD_SETTINGS,
  );
  const [autoStartMicOn, setAutoStartMicOnState] = useLocalStorage(
    'autoStartMicOn',
    DEFAULT_VAD_STATE.autoStartMicOn,
  );
  const autoStartMicRef = useRef(false);
  const [autoStartMicOnConvEnd, setAutoStartMicOnConvEndState] = useLocalStorage(
    'autoStartMicOnConvEnd',
    DEFAULT_VAD_STATE.autoStartMicOnConvEnd,
  );
  const autoStartMicOnConvEndRef = useRef(false);

  // Force update mechanism for ref updates
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  // External hooks and contexts
  const { interrupt } = useInterrupt();
  const { sendAudioPartition } = useSendAudio();
  const { setSubtitleText } = useContext(SubtitleContext)!;
  const { aiState, setAiState } = useContext(AiStateContext)!;

  // Refs for callback stability
  const interruptRef = useRef(interrupt);
  const sendAudioPartitionRef = useRef(sendAudioPartition);
  const aiStateRef = useRef<AiState>(aiState);
  const setSubtitleTextRef = useRef(setSubtitleText);
  const setAiStateRef = useRef(setAiState);

  const isProcessingRef = useRef(false);

  // Update refs when dependencies change
  useEffect(() => {
    aiStateRef.current = aiState;
  }, [aiState]);

  useEffect(() => {
    interruptRef.current = interrupt;
  }, [interrupt]);

  useEffect(() => {
    sendAudioPartitionRef.current = sendAudioPartition;
  }, [sendAudioPartition]);

  useEffect(() => {
    setSubtitleTextRef.current = setSubtitleText;
  }, [setSubtitleText]);

  useEffect(() => {
    setAiStateRef.current = setAiState;
  }, [setAiState]);

  useEffect(() => {
    autoStopMicRef.current = autoStopMic;
  }, []);

  useEffect(() => {
    autoStartMicRef.current = autoStartMicOn;
  }, []);

  useEffect(() => {
    autoStartMicOnConvEndRef.current = autoStartMicOnConvEnd;
  }, []);

  /**
   * Update previous triggered probability and force re-render
   */
  const setPreviousTriggeredProbability = useCallback((value: number) => {
    previousTriggeredProbabilityRef.current = value;
    forceUpdate();
  }, []);

  /**
   * Handle speech start event (initial detection)
   */
  const handleSpeechStart = useCallback(() => {
    console.log('Speech started - entering listening state');
    // Save current AI state before changing to listening
    previousAiStateRef.current = aiStateRef.current;
    isProcessingRef.current = true;
    setAiStateRef.current('listening');
  }, []);

  /**
   * Handle real speech start event (confirmed speech)
   */
  const handleSpeechRealStart = useCallback(() => {
    console.log('Real speech confirmed - interrupting AI if needed');
    if (aiStateRef.current === 'thinking-speaking') {
      interruptRef.current();
    }
  }, []);

  /**
   * Handle frame processing event
   */
  const handleFrameProcessed = useCallback((probs: { isSpeech: number }) => {
    if (probs.isSpeech > previousTriggeredProbabilityRef.current) {
      setPreviousTriggeredProbability(probs.isSpeech);
    }
  }, []);

  /**
   * Handle speech end event
   */
  const handleSpeechEnd = useCallback((audio: Float32Array) => {
    if (!isProcessingRef.current) return;
    console.log('Speech ended');
    audioTaskQueue.clearQueue();

    if ((autoStopMicRef.current || IS_KIOSK) && !micHoldRef.current) {
      // 一体机无条件自动收音：即使本地存储残留过 OFF 也强制生效（11.5 测试反馈）。
      // 按住说话（2026-11-06）例外：手指还按着就继续听，松开由 releaseMic 收音
      stopMic();
    } else {
      console.log('Auto stop mic is OFF (or push-to-talk held), keeping mic active');
    }

    setPreviousTriggeredProbability(0);
    sendAudioPartitionRef.current(audio);
    isProcessingRef.current = false;
  }, []);

  /**
   * Handle VAD misfire event
   */
  const handleVADMisfire = useCallback(() => {
    if (!isProcessingRef.current) return;
    console.log('VAD misfire detected');
    setPreviousTriggeredProbability(0);
    isProcessingRef.current = false;

    // Restore previous AI state and show helpful misfire message
    setAiStateRef.current(previousAiStateRef.current);
    setSubtitleTextRef.current(t('error.vadMisfire'));
  }, [t]);

  /**
   * Update VAD settings and restart if active
   */
  const updateSettings = useCallback((newSettings: VADSettings) => {
    setSettings(newSettings);
    if (vadRef.current) {
      stopMic();
      setTimeout(() => {
        startMic();
      }, 100);
    }
  }, []);

  /**
   * Initialize new VAD instance
   * @param gen 代际号（startMic 传入）；初始化是异步的，期间若用户已松开
   *        （stopMic 递增代数），迟到的实例直接销毁，不再接管麦克风
   */
  const initVAD = async (gen: number) => {
    const newVAD = await MicVAD.new({
      model: "v5",
      preSpeechPadFrames: 20,
      positiveSpeechThreshold: settings.positiveSpeechThreshold / 100,
      negativeSpeechThreshold: settings.negativeSpeechThreshold / 100,
      redemptionFrames: settings.redemptionFrames,
      baseAssetPath: './libs/',
      onnxWASMBasePath: './libs/',
      onSpeechStart: handleSpeechStart,
      onSpeechRealStart: handleSpeechRealStart,
      onFrameProcessed: handleFrameProcessed,
      onSpeechEnd: handleSpeechEnd,
      onVADMisfire: handleVADMisfire,
    });

    if (micGenRef.current !== gen) {
      console.log('VAD init superseded (released during init) — discarding');
      try {
        newVAD.destroy();
      } catch {
        /* 销毁失败不致命 */
      }
      return;
    }
    vadRef.current = newVAD;
    newVAD.start();
  };

  /**
   * Start microphone and VAD processing
   */
  const startMic = useCallback(async () => {
    const gen = ++micGenRef.current;
    try {
      if (!vadRef.current) {
        console.log('Initializing VAD');
        await initVAD(gen);
      } else {
        console.log('Starting VAD');
        vadRef.current.start();
      }
      if (micGenRef.current === gen) {
        setMicOn(true);
      }
    } catch (error) {
      console.error('Failed to start VAD:', error);
      if (micGenRef.current !== gen) return;
      const errName = (error as { name?: string })?.name ?? '';
      let hintKey = '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        hintKey = 'error.vadMicPermissionDenied';
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        hintKey = 'error.vadNoMicDevice';
      }
      const hint = hintKey ? `（${t(hintKey)}）` : '';
      toaster.create({
        title: `${t('error.failedStartVAD')}: ${error}${hint}`,
        type: 'error',
        duration: 8000,
      });
    }
  }, [t]);

  /**
   * Stop microphone and VAD processing
   */
  const stopMic = useCallback(() => {
    micGenRef.current += 1; // 作废所有在途的 startMic 初始化
    console.log('Stopping VAD');
    if (vadRef.current) {
      vadRef.current.pause();
      vadRef.current.destroy();
      vadRef.current = null;
      console.log('VAD stopped and destroyed successfully');
      setPreviousTriggeredProbability(0);
    } else {
      console.log('VAD instance not found');
    }
    setMicOn(false);
    isProcessingRef.current = false;
  }, []);

  /**
   * 按住说话·松开收音（2026-11-06 说明.txt：录音按钮改按住录音，像手机输入法）。
   * stopMic 直接 pause+destroy，缓冲中尚未判完句尾的语音会被丢弃（onSpeechEnd
   * 不再触发）。松开时若 VAD 正处语句中，等它因静默（redemptionFrames）自然
   * 触发 onSpeechEnd 把语音送出后再收音；超时兜底强停（用户一直出声不放的
   * 极端情形，等价于把截断处的语音送出）。未在语句中（按住期间没说话/误触发）
   * 立即收音。
   */
  const releaseMic = useCallback(
    (timeoutMs = 1600) => {
      micHoldRef.current = false;
      if (!vadRef.current || !isProcessingRef.current) {
        stopMic();
        return;
      }
      const started = Date.now();
      const timer = window.setInterval(() => {
        if (!isProcessingRef.current || Date.now() - started > timeoutMs) {
          window.clearInterval(timer);
          stopMic();
        }
      }, 80);
    },
    [stopMic],
  );

  /** 按住说话按住标记：进入/退出按住态（松开走 releaseMic，会一并清标记） */
  const setMicHold = useCallback((holding: boolean) => {
    micHoldRef.current = holding;
  }, []);

  /**
   * Set Auto stop mic state
   */
  const setAutoStopMic = useCallback((value: boolean) => {
    autoStopMicRef.current = value;
    setAutoStopMicState(value);
    forceUpdate();
  }, []);

  const setAutoStartMicOn = useCallback((value: boolean) => {
    autoStartMicRef.current = value;
    setAutoStartMicOnState(value);
    forceUpdate();
  }, []);

  const setAutoStartMicOnConvEnd = useCallback((value: boolean) => {
    autoStartMicOnConvEndRef.current = value;
    setAutoStartMicOnConvEndState(value);
    forceUpdate();
  }, []);

  // Memoized context value
  const contextValue = useMemo(
    () => ({
      autoStopMic: autoStopMicRef.current,
      micOn,
      setMicOn,
      setAutoStopMic,
      startMic,
      stopMic,
      releaseMic,
      setMicHold,
      previousTriggeredProbability: previousTriggeredProbabilityRef.current,
      setPreviousTriggeredProbability,
      settings,
      updateSettings,
      autoStartMicOn: autoStartMicRef.current,
      setAutoStartMicOn,
      autoStartMicOnConvEnd: autoStartMicOnConvEndRef.current,
      setAutoStartMicOnConvEnd,
    }),
    [
      micOn,
      startMic,
      stopMic,
      releaseMic,
      settings,
      updateSettings,
    ],
  );

  return (
    <VADContext.Provider value={contextValue}>
      {children}
    </VADContext.Provider>
  );
}

/**
 * Custom hook to use the VAD context
 * @throws {Error} If used outside of VADProvider
 */
export function useVAD() {
  const context = useContext(VADContext);

  if (!context) {
    throw new Error('useVAD must be used within a VADProvider');
  }

  return context;
}
