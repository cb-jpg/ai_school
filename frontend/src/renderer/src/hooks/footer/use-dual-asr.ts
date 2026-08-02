import { useCallback, useEffect, useRef, useState } from 'react';

export type AsrMode = 'auto' | 'web_speech' | 'sherpa_onnx';
export type AsrInputType = 'web_speech' | 'server_asr';
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
  | '识别失败';

type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: (audioTrack?: MediaStreamTrack) => void;
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

export class WebSpeechAsrAdapter {
  private recognition: RecognitionLike | null = null;

  private stopHandler: (() => void) | null = null;

  async start(
    language: string,
    interimResults: boolean,
    timeoutMs: number,
    onInterim: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (error: string) => void,
    permissionAlreadyGranted = false,
    audioTrack: MediaStreamTrack | null = null,
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
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let timer: number | undefined;
    let settled = false;
    let stopRequested = false;
    let finalTranscript = '';
    let interimTranscript = '';
    const clearTimer = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };
    const fail = (reason: string) => {
      if (settled) return;
      settled = true;
      clearTimer();
      if (this.recognition === recognition) this.recognition = null;
      this.stopHandler = null;
      onError(reason);
    };
    const finish = (text: string) => {
      const normalized = text.trim();
      if (!normalized || settled) return;
      settled = true;
      clearTimer();
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
      try {
        recognition.stop();
      } catch {
        recognition.abort();
      }
    };
    recognition.onstart = () => {};
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
      interimTranscript = interim;
      if (interim) onInterim(interim);
      if (finalText.trim()) {
        finish(finalText);
      }
    };
    recognition.onerror = (event) => {
      fail(event.error || 'unknown');
    };
    recognition.onend = () => {
      if (settled) return;
      if (finalTranscript.trim() || interimTranscript.trim()) {
        finish(finalTranscript || interimTranscript);
      } else if (!stopRequested) {
        fail('no-speech');
      } else {
        fail('stopped');
      }
    };
    // Start the watchdog before calling start(). Some Chromium builds can get
    // stuck before firing onstart/onerror, which would otherwise prevent the
    // automatic SenseVoice fallback forever.
    timer = window.setTimeout(() => {
      fail('timeout');
      recognition.abort();
    }, timeoutMs);
    recognition.start(audioTrack || undefined);
  }

  stop() {
    this.stopHandler?.();
    this.stopHandler = null;
    this.recognition = null;
  }
}

export class ServerAsrAdapter {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  async start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      throw new Error('audio-capture');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.startedAt = performance.now();
    this.recorder.start();
  }

  getAudioTrack(): MediaStreamTrack | null {
    return this.stream?.getAudioTracks()[0] || null;
  }

  private async finishRecording(): Promise<Blob> {
    if (!this.recorder) throw new Error('not-recording');
    const recorder = this.recorder;
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(this.chunks, { type: recorder.mimeType }));
      if (recorder.state === 'inactive') {
        resolve(new Blob(this.chunks, { type: recorder.mimeType }));
      } else {
        recorder.stop();
      }
    });
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    return blob;
  }

  async cancel() {
    if (!this.recorder) return;
    await this.finishRecording();
  }

  async stop(): Promise<string> {
    if (performance.now() - this.startedAt < 500) {
      await this.cancel();
      throw new Error('recording-too-short');
    }
    const blob = await this.finishRecording();

    const audioContext = new AudioContext();
    const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer());
    let sourceSamples = decoded.getChannelData(0);
    let loudestRms = 0;
    for (let channelIndex = 0; channelIndex < decoded.numberOfChannels; channelIndex += 1) {
      const channel = decoded.getChannelData(channelIndex);
      let sumSquares = 0;
      for (let index = 0; index < channel.length; index += 1) {
        sumSquares += channel[index] * channel[index];
      }
      const rms = Math.sqrt(sumSquares / Math.max(1, channel.length));
      if (rms > loudestRms) {
        loudestRms = rms;
        sourceSamples = channel;
      }
    }
    const targetRate = 16000;
    const samples = decoded.sampleRate === targetRate
      ? sourceSamples
      : Float32Array.from({ length: Math.round(sourceSamples.length * targetRate / decoded.sampleRate) }, (_, index) => {
        const sourceIndex = index * decoded.sampleRate / targetRate;
        const left = Math.floor(sourceIndex);
        const fraction = sourceIndex - left;
        return left + 1 < sourceSamples.length
          ? sourceSamples[left] * (1 - fraction) + sourceSamples[left + 1] * fraction
          : sourceSamples[left];
      });
    const wav = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(wav);
    const write = (offset: number, value: string) => value.split('').forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
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
    samples.forEach((sample, index) => view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * (sample < 0 ? 0x8000 : 0x7fff), true));
    await audioContext.close();

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
    } catch {
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
      webSpeech.current.stop();
      if (serverCaptureActive.current && !submitted.current) {
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
    if (mode === 'sherpa_onnx') {
      try {
        await runServerAsr();
      } catch (error) {
        setRecording(false);
        setStatus(error instanceof Error && error.message === 'audio-capture' ? '麦克风权限被拒绝' : '识别失败');
      }
      return;
    }

    let fallbackReady = false;
    let sharedAudioTrack: MediaStreamTrack | null = null;
    setActualPath('浏览器 Web Speech');
    setStatus('正在聆听');
    setRecording(true);
    if (mode === 'auto') {
      try {
        await serverAsr.current.start();
        serverCaptureActive.current = true;
        fallbackReady = true;
        sharedAudioTrack = serverAsr.current.getAudioTrack();
      } catch {
        serverCaptureActive.current = false;
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
        async (reason) => {
          if (submitted.current) return;
          setLastError(reason);
          if (mode === 'auto' && serverCaptureActive.current) {
            setStatus('已切换到本地识别');
            await runServerFallback();
          } else if (reason === 'stopped') {
            activeAsr.current = null;
            setRecording(false);
            setStatus('准备就绪');
          } else if (reason === 'unsupported') setStatus('当前浏览器不支持 Web Speech');
          else if (reason === 'not-allowed') setStatus('麦克风权限被拒绝');
          else setStatus('识别失败');
        },
        fallbackReady,
        sharedAudioTrack,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown';
      setLastError(reason);
      if (mode === 'auto' && serverCaptureActive.current) {
        activeAsr.current = 'server_asr';
        setActualPath('服务器 SenseVoice');
        setStatus('已切换到本地识别');
        fallbackTimer.current = window.setTimeout(() => {
          void runServerFallback();
        }, config.timeout * 1000);
      } else {
        activeAsr.current = null;
        setRecording(false);
        setStatus(error instanceof Error && error.message === 'unsupported' ? '当前浏览器不支持 Web Speech' : '识别失败');
      }
    }
  }, [clearFallbackTimer, commitText, config, mode, recording, runServerAsr, runServerFallback]);

  return { mode, setMode, status, interimText, actualPath, lastError, recording, start, stop };
}
