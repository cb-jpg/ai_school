#!/usr/bin/env node

const path = require('node:path');
const { app, BrowserWindow, session } = require('electron');

const projectRoot = path.resolve(__dirname, '..');
const audioFile = path.join(
  projectRoot,
  'models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/test_wavs/zh.wav',
);
const testHost = 'voice-test.local';
const testOrigin = `http://${testHost}:12393`;
const testMode = process.env.ASR_TEST_MODE || 'sherpa_onnx';

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('headless');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-proxy-server');
app.commandLine.appendSwitch('host-resolver-rules', `MAP ${testHost} 127.0.0.1`);
app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', testOrigin);
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('use-file-for-fake-audio-capture', audioFile);
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitFor(window, expression, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await window.webContents.executeJavaScript(`Boolean(${expression})`, true);
    if (result) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function run() {
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => permission === 'media');
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });

  const browserLogs = [];
  const window = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  window.webContents.on('console-message', (_event, level, message) => {
    if (/\[ASR\]|\[WebSocket\]|WebSocket is not open|Adding audio task|Starting audio playback|Audio playback completed|Audio play error/i.test(message)) {
      browserLogs.push({ level, message });
    }
  });

  await window.loadURL(testOrigin);
  await waitFor(window, 'document.querySelector("#verification-asr-mode")');

  // Reproduce the persisted setting from the old build, then confirm that the
  // new build migrates it to the page's actual host before connecting.
  await window.webContents.executeJavaScript(`
    localStorage.setItem('wsUrl', JSON.stringify('ws://127.0.0.1:12393/client-ws'));
    localStorage.setItem('baseUrl', JSON.stringify('http://127.0.0.1:12393'));
  `, true);
  await window.reload();
  await waitFor(window, 'document.querySelector("#verification-asr-mode")');
  await waitFor(window, 'document.body.innerText.includes("后端连接：已连接")', 45000);

  const environment = await window.webContents.executeJavaScript(`({
    origin: location.origin,
    secureContext: isSecureContext,
    mediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
    webSpeech: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    wsUrl: JSON.parse(localStorage.getItem('wsUrl')),
    baseUrl: JSON.parse(localStorage.getItem('baseUrl')),
  })`, true);
  const initialSubtitle = await window.webContents.executeJavaScript(
    'document.querySelector("[data-testid=\\"subtitle-text\\"]")?.textContent || ""',
    true,
  );

  await window.webContents.executeJavaScript(`(() => {
    const select = document.querySelector('#verification-asr-mode');
    select.value = ${JSON.stringify(testMode)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`, true);
  await sleep(500);

  await window.webContents.executeJavaScript(`
    document.querySelector('[aria-label="开始语音识别"]').click()
  `, true);
  await waitFor(window, 'document.querySelector("[aria-label=\\"停止语音识别\\"]")', 15000);
  await sleep(6500);
  await window.webContents.executeJavaScript(`
    document.querySelector('[aria-label="停止语音识别"]').click()
  `, true);

  await waitFor(
    window,
    'document.body.innerText.includes("识别完成") || document.body.innerText.includes("识别失败") || document.body.innerText.includes("未检测到清晰中文")',
    45000,
  );
  await waitFor(
    window,
    `(() => {
      const value = document.querySelector('[data-testid="subtitle-text"]')?.textContent?.trim() || '';
      return value && value !== 'Thinking...' && value !== ${JSON.stringify(initialSubtitle)};
    })()`,
    50000,
  );

  const playbackDeadline = Date.now() + 30000;
  while (
    Date.now() < playbackDeadline
    && !browserLogs.some(({ message }) => /Starting audio playback with lip sync|Audio play error/i.test(message))
  ) {
    await sleep(250);
  }

  const pageResult = await window.webContents.executeJavaScript(`(() => {
    const text = document.body.innerText;
    const subtitleText = document.querySelector('[data-testid="subtitle-text"]')?.textContent?.trim() || '';
    return {
      asrCompleted: text.includes('识别完成'),
      recognizedSample: text.includes('开放时间早上9点至下午5点'),
      subtitleText,
      subtitleUpdated: Boolean(subtitleText && subtitleText !== ${JSON.stringify(initialSubtitle)} && subtitleText !== 'Thinking...'),
      relevantText: text.split('\\n').filter((line) =>
        /ASR|识别|录音|后端连接|开放时间|错误/.test(line)
      ).slice(-30),
    };
  })()`, true);

  window.destroy();
  return {
    environment,
    testMode,
    pageResult: {
      ...pageResult,
      ttsPlaybackStarted: browserLogs.some(({ message }) => message.includes('Starting audio playback with lip sync')),
      ttsPlaybackError: browserLogs.some(({ message }) => /Audio play error/i.test(message)),
    },
    browserLogs,
  };
}

app.whenReady().then(async () => {
  try {
    const result = await run();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    app.exit(
      result.pageResult.asrCompleted
      && result.pageResult.recognizedSample
      && result.pageResult.subtitleUpdated
      && result.pageResult.ttsPlaybackStarted
      && !result.pageResult.ttsPlaybackError
        ? 0
        : 1,
    );
  } catch (error) {
    process.stderr.write(`${error.stack || error}\n`);
    app.exit(1);
  }
});
