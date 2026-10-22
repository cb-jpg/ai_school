/* eslint-disable func-names */
/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAiState } from '@/context/ai-state-context';
import { useSubtitle } from '@/context/subtitle-context';
import { useChatHistory } from '@/context/chat-history-context';
import { useVolume } from '@/context/volume-context';
import { audioTaskQueue } from '@/utils/task-queue';
import { toaster } from '@/components/ui/toaster';
import { useWebSocket } from '@/context/websocket-context';
import { DisplayText } from '@/services/websocket-service';
import { useLive2DExpression } from '@/hooks/canvas/use-live2d-expression';

// Simple type alias for Live2D model
type Live2DModel = any;

interface AudioTaskOptions {
  audioBase64: string
  volumes: number[]
  sliceLength: number
  displayText?: DisplayText | null
  expressions?: string[] | number[] | null
  speaker_uid?: string
  forwarded?: boolean
}

// Multiple components consume this hook. Keep the active playback references
// shared so an interrupt issued from any consumer can stop the real audio task.
const currentAudioRef: { current: HTMLAudioElement | null } = { current: null };
const currentModelRef: { current: Live2DModel | null } = { current: null };
let finishCurrentPlayback: (() => void) | null = null;

// 最近一段播报（字幕条重播按钮用）：模块级持有，Subtitle 组件无需挂音频 hook。
interface LastSpokenSegment {
  audioBase64?: string
  expressions?: string[] | number[] | null
  text: string
}
const lastSpokenRef: { current: LastSpokenSegment | null } = { current: null };
let requestReplayFn: (() => void) | null = null;

/** 重播字幕条当前显示的那段话（带 Live2D 口型；由 useAudioTask 内部接线）。 */
export const replayLastSpokenSegment = () => {
  requestReplayFn?.();
};

// Global function to update volume of currently playing audio
export const updateCurrentAudioVolume = (volume: number) => {
  if (currentAudioRef.current) {
    currentAudioRef.current.volume = volume / 100;
  }
};

/**
 * Custom hook for handling audio playback tasks with Live2D lip sync
 */
export const useAudioTask = () => {
  const { t } = useTranslation();
  const { aiState, backendSynthComplete, setBackendSynthComplete } = useAiState();
  const { setSubtitleText } = useSubtitle();
  const { appendResponse, appendAIMessage } = useChatHistory();
  const { sendMessage } = useWebSocket();
  const { setExpression } = useLive2DExpression();
  const { volume } = useVolume();

  // State refs to avoid stale closures
  const stateRef = useRef({
    aiState,
    setSubtitleText,
    appendResponse,
    appendAIMessage,
    volume,
  });

  stateRef.current = {
    aiState,
    setSubtitleText,
    appendResponse,
    appendAIMessage,
    volume,
  };

  // 字幕条重播入口：走正常播放任务（口型/表情同真播报），displayText 置空
  // 避免字幕与聊天历史重复入库；无 PCM 的段（浏览器 TTS 兜底）走本地语音。
  requestReplayFn = () => {
    const seg = lastSpokenRef.current;
    if (!seg) return;
    if (seg.audioBase64) {
      addAudioTask({
        audioBase64: seg.audioBase64,
        volumes: [],
        sliceLength: 0,
        displayText: null,
        expressions: seg.expressions ?? null,
      });
    } else if (seg.text && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      const speakableText = seg.text
        .replace(/\[[^\]]+\]/g, '')
        .replace(/[\s.,!?，。！？'"“”‘’（）()【】\[\]]+/g, ' ')
        .trim();
      if (!speakableText) return;
      const model = (window as any).getLive2DManager?.()?.getModel(0);
      const utterance = new SpeechSynthesisUtterance(speakableText);
      utterance.lang = 'zh-CN';
      utterance.volume = stateRef.current.volume / 100;
      const voices = window.speechSynthesis.getVoices();
      utterance.voice = voices.find((voice) => voice.lang.toLowerCase() === 'zh-cn')
        || voices.find((voice) => voice.lang.toLowerCase().startsWith('zh'))
        || null;
      utterance.onstart = () => model?.setSpeaking(true, true);
      utterance.onend = () => model?.setSpeaking(false);
      utterance.onerror = () => model?.setSpeaking(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };

  /**
   * Stop current audio playback and lip sync
   */
  const stopCurrentAudioAndLipSync = useCallback(() => {
    currentModelRef.current?.setSpeaking(false);
    finishCurrentPlayback?.();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  /**
   * Handle audio playback with Live2D lip sync
   */
  const handleAudioPlayback = (options: AudioTaskOptions): Promise<void> => new Promise((resolve) => {
    const {
      aiState: currentAiState,
      setSubtitleText: updateSubtitle,
      appendResponse: appendText,
      appendAIMessage: appendAI,
    } = stateRef.current;

    // Skip if already interrupted
    if (currentAiState === 'interrupted') {
      console.warn('Audio playback blocked by interruption state.');
      resolve();
      return;
    }

    const { audioBase64, displayText, expressions, forwarded } = options;

    // Update display text
    if (displayText) {
      appendText(displayText.text);
      appendAI(displayText.text, displayText.name, displayText.avatar);
      // Subtitles are display text, not an audio side effect. Keep them visible
      // even when the server TTS provider fails and sends a silent payload.
      updateSubtitle(displayText.text);
      if (!forwarded) {
        sendMessage({
          type: "audio-play-start",
          display_text: displayText,
          forwarded: true,
        });
      }
    }

    try {
      const lappAdapter = (window as any).getLAppAdapter?.();
      if (lappAdapter && expressions?.[0] !== undefined) {
        setExpression(expressions[0], lappAdapter, `Set expression to: ${expressions[0]}`);
      }
      // Process audio if available
      if (audioBase64) {
        const audioDataUrl = `data:audio/wav;base64,${audioBase64}`;

        // Get Live2D manager and model
        const live2dManager = (window as any).getLive2DManager?.();
        if (!live2dManager) {
          console.error('Live2D manager not found');
          resolve();
          return;
        }

        const model = live2dManager.getModel(0);
        if (!model) {
          console.error('Live2D model not found at index 0');
          resolve();
          return;
        }
        console.log('Found model for audio playback');
        currentModelRef.current = model;

        if (!model._wavFileHandler) {
          console.warn('Model does not have _wavFileHandler for lip sync');
        } else {
          console.log('Model has _wavFileHandler available');
        }

        // Setup audio element
        const audio = new Audio(audioDataUrl);
        audio.volume = stateRef.current.volume / 100; // 设置音量 (0-1)

        // 动态监听音量变化并更新正在播放的音频
        const updateVolume = () => {
          const { volume: currentVolume } = stateRef.current;
          if (audio && currentAudioRef.current === audio) {
            audio.volume = currentVolume / 100;
          }
        };

        // 保存音量更新函数引用，以便音量context变化时调用
        (audio as any)._updateVolumeFromContext = updateVolume;

        currentAudioRef.current = audio;
        let isFinished = false;

        const cleanup = () => {
          if (currentAudioRef.current === audio) {
            audio.pause();
            model.setSpeaking(false);
            model._wavFileHandler?.releasePcmData();
            currentAudioRef.current = null;
            currentModelRef.current = null;
            finishCurrentPlayback = null;
          }
          if (!isFinished) {
            isFinished = true;
            resolve();
          }
        };
        finishCurrentPlayback = cleanup;

        // Enhance lip sync sensitivity
        const lipSyncScale = 2.0;

        audio.addEventListener('canplaythrough', () => {
          // Check for interruption before playback
          if (stateRef.current.aiState === 'interrupted' || currentAudioRef.current !== audio) {
            console.warn('Audio playback cancelled due to interruption or new audio');
            cleanup();
            return;
          }

          console.log('Starting audio playback with lip sync');
          audio.play().catch((err) => {
            console.error("Audio play error:", err);
            cleanup();
          });
          model.setSpeaking(true);

          // Setup lip sync
          if (model._wavFileHandler) {
            if (!model._wavFileHandler._initialized) {
              console.log('Applying enhanced lip sync');
              model._wavFileHandler._initialized = true;

              const originalUpdate = model._wavFileHandler.update.bind(model._wavFileHandler);
              model._wavFileHandler.update = function (deltaTimeSeconds: number) {
                const result = originalUpdate(deltaTimeSeconds);
                // @ts-ignore
                this._lastRms = Math.min(2.0, this._lastRms * lipSyncScale);
                return result;
              };
            }

            if (currentAudioRef.current === audio) {
              model._wavFileHandler.start(audioDataUrl);
            } else {
              console.warn('WavFileHandler start skipped - audio was stopped');
            }
          }
        }, { once: true });

        audio.addEventListener('ended', () => {
          console.log("Audio playback completed");
          cleanup();
        });

        audio.addEventListener('error', (error) => {
          console.error("Audio playback error:", error);
          cleanup();
        });

        audio.load();
      } else if (displayText?.text && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
        // Edge TTS can be unavailable in some regions. Use the browser's local
        // Chinese voice for silent payloads so a provider outage does not mute
        // the whole conversation.
        const speakableText = displayText.text
          .replace(/\[[^\]]+\]/g, '')
          .replace(/[\s.,!?，。！？'"“”‘’（）()【】\[\]]+/g, ' ')
          .trim();
        if (!speakableText) {
          resolve();
          return;
        }
        const utterance = new SpeechSynthesisUtterance(speakableText);
        utterance.lang = 'zh-CN';
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = stateRef.current.volume / 100; // 浏览器回退播报同样受音量控制
        const voices = window.speechSynthesis.getVoices();
        utterance.voice = voices.find((voice) => voice.lang.toLowerCase() === 'zh-cn')
          || voices.find((voice) => voice.lang.toLowerCase().startsWith('zh'))
          || null;
        let finished = false;
        const model = (window as any).getLive2DManager?.()?.getModel(0);
        const finish = () => {
          if (finished) return;
          finished = true;
          window.clearTimeout(timeout);
          if (finishCurrentPlayback === finish) {
            model?.setSpeaking(false);
            currentModelRef.current = null;
            finishCurrentPlayback = null;
          }
          resolve();
        };
        finishCurrentPlayback = finish;
        currentModelRef.current = model;
        utterance.onstart = () => {
          if (!finished) model?.setSpeaking(true, true);
        };
        const timeout = window.setTimeout(() => {
          if (finishCurrentPlayback === finish) window.speechSynthesis.cancel();
          finish();
        }, Math.min(30000, Math.max(5000, speakableText.length * 500)));
        utterance.onend = finish;
        utterance.onerror = (event) => {
          console.error('Browser speech synthesis error:', event.error);
          finish();
        };
        window.speechSynthesis.speak(utterance);
      } else {
        resolve();
      }
    } catch (error) {
      console.error('Audio playback setup error:', error);
      toaster.create({
        title: `${t('error.audioPlayback')}: ${error}`,
        type: "error",
        duration: 2000,
      });
      currentAudioRef.current = null;
      currentModelRef.current = null;
      resolve();
    }
  });

  // Handle backend synthesis completion
  useEffect(() => {
    let isMounted = true;

    const handleComplete = async () => {
      await audioTaskQueue.waitForCompletion();
      if (isMounted && backendSynthComplete) {
        stopCurrentAudioAndLipSync();
        sendMessage({ type: "frontend-playback-complete" });
        setBackendSynthComplete(false);
      }
    };

    handleComplete();

    return () => {
      isMounted = false;
    };
  }, [backendSynthComplete, sendMessage, setBackendSynthComplete, stopCurrentAudioAndLipSync]);

  /**
   * Add a new audio task to the queue
   */
  const addAudioTask = async (options: AudioTaskOptions) => {
    const { aiState: currentState } = stateRef.current;

    if (currentState === 'interrupted') {
      console.log('Skipping audio task due to interrupted state');
      return;
    }

    // 记录最近播报段，供字幕条重播按钮使用
    if (options.audioBase64 || options.displayText?.text) {
      lastSpokenRef.current = {
        audioBase64: options.audioBase64 || undefined,
        expressions: options.expressions ?? null,
        text: options.displayText?.text ?? '',
      };
    }

    console.log(`Adding audio task ${options.displayText?.text} to queue`);
    audioTaskQueue.addTask(() => handleAudioPlayback(options));
  };

  return {
    addAudioTask,
    appendResponse,
    stopCurrentAudioAndLipSync,
  };
};
