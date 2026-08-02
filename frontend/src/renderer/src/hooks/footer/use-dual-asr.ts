import { useCallback, useEffect, useRef, useState } from 'react';

export type AsrMode = 'auto' | 'web_speech' | 'sherpa_onnx';
export type AsrInputType = 'web_speech' | 'server_asr';
export type AsrEnvironment = {
  origin: string;
  secureContext: boolean;
  mediaDevices: boolean;
  webSpeech: boolean;
};
export type AsrStatus =
  | '准备就绪'
  | '正在聆听'
  | '正在识别'
  | '识别完成'
  | '已切换到本地识别'
  | '麦克风权限被拒绝'
  | '当前浏览器不支持 Web Speech'
  | '录音太短，请重试'
  | '未检测到清晰中文，请重试'
  | '需要 HTTPS 或 localhost'
  | '浏览器没有提供麦克风 API'
  | '识别失败';

type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

type RecognitionConstructor = new () => RecognitionLike;

const getRecognitionConstructor = (): RecognitionConstructor | null => {
  const browserWindow = window as any;
  return browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition || null;
};

const describeError = (error: unknown) => {
  if (error instanceof DOMException) return `${error.name}: ${error.message}`;
  if (error instanceof Error) return error.message;
  return String(error || 'unknown');
};

export class WebSpeechAsrAdapter {
  private recognition: RecognitionLike | null = null;

  private stopHandler: (() => void) | null = null;

  private finalTranscript = '';

  private restartTimer: number | undefined;

  getFinalTranscript() {
    return this.finalTranscript.trim();
  }

  async start(
    language: string,
    interimResults: boolean,
    timeoutMs: number,
    onInterim: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (error: string) => void,
    permissionAlreadyGranted = false,
  ) {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) throw new Error('unsupported');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('audio-capture');

    this.stop();

    if (!permissionAlreadyGranted) {
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());
    }

    const recognition = new Recognition();
    this.recognition = recognition;
    recognition.lang = language;
    recognition.interimResults = interimResults;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    let timer: number | undefined;
    let settled = false;
    let stopRequested = false;
    let finalTranscript = '';
    const clearTimer = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };
    const clearRestartTimer = () => {
      if (this.restartTimer !== undefined) {
        window.clearTimeout(this.restartTimer);
        this.restartTimer = undefined;
      }
    };
    const fail = (reason: string) => {
      if (settled) return;
      settled = true;
      clearTimer();
      clearRestartTimer();
      if (this.recognition === recognition) this.recognition = null;
      this.stopHandler = null;
      onError(reason);
    };
    const finish = (text: string) => {
      const normalized = text.trim();
      if (!normalized || settled) return;
      settled = true;
      clearTimer();
      clearRestartTimer();
      if (this.recognition === recognition) this.recognition = null;
      this.stopHandler = null;
      onFinal(normalized);
      try {
        recognition.stop();
      } catch {
        recognition.abort();
      }
    };
    this.stopHandler = () => {
      stopRequested = true;
      clearRestartTimer();
      try {
        recognition.stop();
      } catch {
        recognition.abort();
      }
    };
    recognition.onresult = (event) => {
      let interim = '';
      let finalText = finalTranscript;
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript || '';
        if (result.isFinal) finalText += text;
        else interim += text;
      }
      finalTranscript = finalText;
      this.finalTranscript = finalText;
      const displayText = [finalText.trim(), interim.trim()].filter(Boolean).join(' ');
      if (displayText) onInterim(displayText);
      // A Chrome final result can represent only the first phrase before a
      // short pause. Commit only after the user explicitly stops recording.
      if (stopRequested && finalText.trim()) {
        finish(finalText);
      }
    };
    recognition.onerror = (event) => {
      const reason = event.error || 'unknown';
      if (stopRequested && ['aborted', 'no-speech'].includes(reason)) return;
      fail(reason);
    };
    recognition.onend = () => {
      if (settled) return;
      if (stopRequested) {
        if (finalTranscript.trim()) finish(finalTranscript);
        else fail('stopped');
        return;
      }

      // Chromium can end a continuous session after silence. Restart it and
      // retain the accumulated transcript while the button is still active.
      clearRestartTimer();
      this.restartTimer = window.setTimeout(() => {
        this.restartTimer = undefined;
        if (settled || stopRequested) return;
        try {
          recognition.start();
        } catch {
          this.restartTimer = window.setTimeout(() => {
            this.restartTimer = undefined;
            if (settled || stopRequested) return;
            try {
              recognition.start();
            } catch {
              fail('restart-failed');
            }
          }, 250);
        }
      }, 80);
    };
    // Start the watchdog before calling start(). Some Chromium builds can get
    // stuck before firing onstart/onerror, which would otherwise prevent the
    // automatic SenseVoice fallback forever.
    timer = window.setTimeout(() => {
      fail('timeout');
      recognition.abort();
    }, timeoutMs);
    this.finalTranscript = '';
    recognition.onstart = () => {
      clearTimer();
    };
    recognition.start();
  }

  stop() {
    this.stopHandler?.();
    this.stopHandler = null;
    this.recognition = null;
    return this.getFinalTranscript();
  }
}

/**
 * Collects the complete microphone session as PCM and uploads it only when
 * the user explicitly ends recording. This avoids MediaRecorder container
 * timing and prevents Web Speech's short pauses from truncating the fallback.
 */
export class ServerAsrAdapter {
  private stream: MediaStream | null = null;

  private audioContext: AudioContext | null = null;

  private source: MediaStreamAudioSourceNode | null = null;

  private processor: ScriptProcessorNode | null = null;

  private gainNode: GainNode | null = null;

  private chunks: Int16Array[] = [];

  private sampleRate = 48000;

  private recording = false;

  private startedAt = 0;

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('audio-capture');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.stream = stream;
    const AudioContextConstructor = (window.AudioContext
      || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AudioContextConstructor) {
      stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      throw new Error('audio-capture');
    }

    this.chunks = [];
    const audioContext = new AudioContextConstructor();
    await audioContext.resume();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0;
    this.audioContext = audioContext;
    this.sampleRate = audioContext.sampleRate;
    this.source = source;
    this.processor = processor;
    this.gainNode = gainNode;
    processor.onaudioprocess = (event) => {
      if (!this.recording) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(input.length);
      for (let index = 0; index < input.length; index += 1) {
        const sample = Math.max(-1, Math.min(1, input[index]));
        pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }
      this.chunks.push(pcm);
    };
    source.connect(processor);
    processor.connect(gainNode);
    gainNode.connect(audioContext.destination);
    this.startedAt = performance.now();
    this.recording = true;
    console.info('[ASR] server PCM capture started', {
      sampleRate: this.sampleRate,
    });
  }

  getAudioTrack(): MediaStreamTrack | null {
    return this.stream?.getAudioTracks()[0] || null;
  }

  private async cleanupMedia() {
    this.recording = false;
    try { this.processor?.disconnect(); } catch { /* already disconnected */ }
    try { this.source?.disconnect(); } catch { /* already disconnected */ }
    try { this.gainNode?.disconnect(); } catch { /* already disconnected */ }
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.audioContext) {
      try { await this.audioContext.close(); } catch { /* already closed */ }
    }
    this.processor = null;
    this.source = null;
    this.gainNode = null;
    this.audioContext = null;
    this.stream = null;
  }

  async cancel() {
    if (!this.stream && !this.audioContext) return;
    await this.cleanupMedia();
    this.chunks = [];
    console.info('[ASR] server PCM capture cancelled');
  }

  async stop(): Promise<string> {
    if (!this.stream && !this.audioContext) throw new Error('not-recording');
    const sampleRate = this.sampleRate;
    const capturedChunks = this.chunks;
    this.chunks = [];
    await this.cleanupMedia();

    const totalSamples = capturedChunks.reduce((total, chunk) => total + chunk.length, 0);
    const duration = totalSamples / sampleRate;
    console.info('[ASR] server PCM capture stopped', {
      duration: duration.toFixed(2),
      samples: totalSamples,
      sampleRate,
    });
    if (performance.now() - this.startedAt < 500 || duration < 0.5 || totalSamples === 0) {
      throw new Error('recording-too-short');
    }

    const pcm = new Int16Array(totalSamples);
    let offset = 0;
    capturedChunks.forEach((chunk) => {
      pcm.set(chunk, offset);
      offset += chunk.length;
    });
    const sourceSamples = Float32Array.from(pcm, (sample) => sample / 32768);
    const targetRate = 16000;
    const samples = sampleRate === targetRate
      ? sourceSamples
      : Float32Array.from({ length: Math.round(sourceSamples.length * targetRate / sampleRate) }, (_, index) => {
        const sourceIndex = index * sampleRate / targetRate;
        const left = Math.floor(sourceIndex);
        const fraction = sourceIndex - left;
        return left + 1 < sourceSamples.length
          ? sourceSamples[left] * (1 - fraction) + sourceSamples[left + 1] * fraction
          : sourceSamples[left];
      });

    const wav = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(wav);
    const write = (offsetValue: number, value: string) => value.split('').forEach((char, index) => view.setUint8(offsetValue + index, char.charCodeAt(0)));
    write(0, 'RIFF');
    view.setUint32(4, wav.byteLength - 8, true);
    write(8, 'WAVE');
    write(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, targetRate, true);
    view.setUint32(28, targetRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    samples.forEach((sample, index) => {
      const clipped = Math.max(-1, Math.min(1, sample));
      view.setInt16(44 + index * 2, clipped * (clipped < 0 ? 0x8000 : 0x7fff), true);
    });

    const response = await fetch('/asr', {
      method: 'POST',
      body: (() => {
        const form = new FormData();
        form.append('file', new Blob([wav], { type: 'audio/wav' }), 'recording.wav');
        return form;
      })(),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.code || 'server-asr');
    }
    const result = await response.json();
    if (!result.text?.trim()) throw new Error('empty-result');
    return result.text.trim();
  }
}

export function useDualAsr(onText: (text: string, inputType: AsrInputType) => void | Promise<void>) {
  const [mode, setMode] = useState<AsrMode>('auto');
  const [status, setStatus] = useState<AsrStatus>('准备就绪');
  const [interimText, setInterimText] = useState('');
  const [actualPath, setActualPath] = useState('');
  const [lastError, setLastError] = useState('');
  const [recording, setRecording] = useState(false);
  const [config, setConfig] = useState({ language: 'zh-CN', timeout: 15, interimResults: true });
  const webSpeech = useRef(new WebSpeechAsrAdapter());
  const serverAsr = useRef(new ServerAsrAdapter());
  const activeAsr = useRef<AsrInputType | null>(null);
  const serverCaptureActive = useRef(false);
  const submitted = useRef(false);
  const fallbackTask = useRef<Promise<void> | null>(null);
  const fallbackTimer = useRef<number | null>(null);
  const environment: AsrEnvironment = {
    origin: window.location.origin,
    secureContext: window.isSecureContext,
    mediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
    webSpeech: Boolean(getRecognitionConstructor()),
  };

  useEffect(() => {
    fetch('/verification/config')
      .then((response) => response.json())
      .then((value) => {
        setMode(value.asr_mode || 'auto');
        setConfig({
          language: value.web_speech_language || 'zh-CN',
          timeout: Number(value.web_speech_timeout_seconds || 15),
          interimResults: value.web_speech_interim_results !== false,
        });
      })
      .catch(() => setStatus('识别失败'));
  }, []);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimer.current !== null) {
      window.clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
  }, []);

  const commitText = useCallback(async (text: string, inputType: AsrInputType) => {
    if (submitted.current || !text.trim()) return;
    submitted.current = true;
    clearFallbackTimer();
    activeAsr.current = null;
    setRecording(false);
    setInterimText('');
    setLastError('');
    try {
      await onText(text.trim(), inputType);
      setStatus('识别完成');
    } catch (error) {
      setLastError(`submit: ${describeError(error)}`);
      setStatus('识别失败');
    }
  }, [clearFallbackTimer, onText]);

  const runServerFallback = useCallback(() => {
    if (fallbackTask.current) return fallbackTask.current;
    const task = (async () => {
      if (submitted.current || !serverCaptureActive.current) return;
      serverCaptureActive.current = false;
      clearFallbackTimer();
      activeAsr.current = 'server_asr';
      setActualPath('服务器 SenseVoice');
      setStatus('正在识别');
      setRecording(false);
      setInterimText('');
      try {
        const text = await serverAsr.current.stop();
        await commitText(text, 'server_asr');
      } catch (error) {
        activeAsr.current = null;
        if (error instanceof Error && error.message === 'recording-too-short') {
          setStatus('录音太短，请重试');
        } else if (error instanceof Error && ['no-speech', 'unexpected-language'].includes(error.message)) {
          setStatus('未检测到清晰中文，请重试');
        } else {
          setStatus('识别失败');
        }
      }
    })();
    fallbackTask.current = task;
    void task.finally(() => {
      if (fallbackTask.current === task) fallbackTask.current = null;
    });
    return task;
  }, [clearFallbackTimer, commitText]);

  const runServerAsr = useCallback(async () => {
    submitted.current = false;
    setRecording(true);
    setActualPath('服务器 SenseVoice');
    setStatus('正在聆听');
    await serverAsr.current.start();
    serverCaptureActive.current = true;
    activeAsr.current = 'server_asr';
  }, []);

  const stop = useCallback(async () => {
    if (!recording) return;
    if (activeAsr.current === 'web_speech') {
      const browserText = webSpeech.current.stop();
      if (browserText && !submitted.current) {
        const shouldCancelFallback = serverCaptureActive.current;
        serverCaptureActive.current = false;
        if (shouldCancelFallback) {
          await serverAsr.current.cancel().catch(() => {});
        }
        await commitText(browserText, 'web_speech');
      } else if (serverCaptureActive.current && !submitted.current) {
        await runServerFallback();
      } else if (!submitted.current) {
        activeAsr.current = null;
        setStatus('准备就绪');
        setRecording(false);
        setInterimText('');
      }
      return;
    }
    if (serverCaptureActive.current) {
      await runServerFallback();
    }
  }, [recording, runServerFallback]);

  const start = useCallback(async () => {
    if (recording) return;
    submitted.current = false;
    fallbackTask.current = null;
    clearFallbackTimer();
    setInterimText('');
    setLastError('');
    const browserEnvironment: AsrEnvironment = {
      origin: window.location.origin,
      secureContext: window.isSecureContext,
      mediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
      webSpeech: Boolean(getRecognitionConstructor()),
    };
    console.info('[ASR] browser environment', browserEnvironment);
    if (!browserEnvironment.secureContext) {
      setRecording(false);
      setStatus('需要 HTTPS 或 localhost');
      setLastError(`insecure-context: ${browserEnvironment.origin}`);
      return;
    }
    if (!browserEnvironment.mediaDevices) {
      setRecording(false);
      setStatus('浏览器没有提供麦克风 API');
      setLastError('navigator.mediaDevices.getUserMedia unavailable');
      return;
    }
    if (mode === 'sherpa_onnx') {
      try {
        await runServerAsr();
      } catch (error) {
        setRecording(false);
        const reason = describeError(error);
        setLastError(reason);
        setStatus(/NotAllowedError|PermissionDenied|audio-capture/.test(reason) ? '麦克风权限被拒绝' : '识别失败');
      }
      return;
    }

    let fallbackReady = false;
    setActualPath('浏览器 Web Speech');
    setStatus('正在聆听');
    setRecording(true);
    if (mode === 'auto') {
      try {
        await serverAsr.current.start();
        serverCaptureActive.current = true;
        fallbackReady = true;
      } catch (error) {
        serverCaptureActive.current = false;
        const reason = describeError(error);
        console.error('[ASR] server fallback capture failed', error);
        setLastError(`server-capture: ${reason}`);
      }
    }

    try {
      activeAsr.current = 'web_speech';
      await webSpeech.current.start(
        config.language,
        config.interimResults,
        config.timeout * 1000,
        (text) => { setStatus('正在识别'); setInterimText(text); },
        (text) => {
          if (fallbackTask.current || submitted.current) return;
          const shouldCancelFallback = serverCaptureActive.current;
          serverCaptureActive.current = false;
          if (shouldCancelFallback) {
            void serverAsr.current.cancel().catch(() => {});
          }
          void commitText(text, 'web_speech');
        },
        (reason) => {
          if (submitted.current || fallbackTask.current) return;
          setLastError(reason);
          if (mode === 'auto' && serverCaptureActive.current) {
            activeAsr.current = 'server_asr';
            setActualPath('服务器 SenseVoice');
            setStatus('已切换到本地识别');
          } else if (reason === 'stopped') {
            activeAsr.current = null;
            setRecording(false);
            setStatus('准备就绪');
          } else if (reason === 'unsupported') setStatus('当前浏览器不支持 Web Speech');
          else if (reason === 'not-allowed') setStatus('麦克风权限被拒绝');
          else setStatus('识别失败');
        },
        fallbackReady,
      );
    } catch (error) {
      const reason = describeError(error);
      setLastError(reason);
      if (mode === 'auto' && serverCaptureActive.current) {
        activeAsr.current = 'server_asr';
        setActualPath('服务器 SenseVoice');
        setStatus('已切换到本地识别');
      } else {
        activeAsr.current = null;
        setRecording(false);
        setStatus(error instanceof Error && error.message === 'unsupported' ? '当前浏览器不支持 Web Speech' : '识别失败');
      }
    }
  }, [clearFallbackTimer, commitText, config, mode, recording, runServerAsr, runServerFallback]);

  return {
    mode,
    setMode,
    status,
    interimText,
    actualPath,
    lastError,
    recording,
    environment,
    start,
    stop,
  };
}
