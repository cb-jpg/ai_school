#!/usr/bin/env node

const fs = require('node:fs');
const { app, BrowserWindow, session } = require('electron');

const testOrigin = 'http://127.0.0.1:12393';
const screenshotPath = process.env.CAMPUS_SCREENSHOT || '/tmp/live2d-campus-knowledge.png';

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('headless');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-dev-shm-usage');
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

async function click(window, testId) {
  await window.webContents.executeJavaScript(`
    document.querySelector('[data-testid="${testId}"]').click()
  `, true);
}

async function stopNarrationIfVisible(window) {
  const visible = await window.webContents.executeJavaScript(
    'Boolean(document.querySelector(\'[data-testid="campus-stop-narration"]\'))',
    true,
  );
  if (visible) {
    await click(window, 'campus-stop-narration');
    await sleep(500);
  }
}

async function run() {
  await session.defaultSession.clearStorageData({ storages: ['localstorage'] });

  const browserLogs = [];
  const window = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  window.webContents.on('console-message', (_event, level, message) => {
    if (/static narration|Starting audio playback|Audio playback completed|Stopping current audio|Audio play error|\[WebSocket\]/i.test(message)) {
      browserLogs.push({ level, message });
    }
  });

  await window.loadURL(testOrigin);
  await waitFor(window, 'document.querySelector(\'[data-testid="campus-navigation"]\')');
  await waitFor(window, 'document.body.innerText.includes("后端连接：已连接")', 45000);

  const optionCount = await window.webContents.executeJavaScript(
    'document.querySelectorAll(\'[data-testid^="campus-nav-"]\').length',
    true,
  );

  await click(window, 'campus-nav-history');
  await waitFor(window, 'location.hash === "#/campus/history"');
  await waitFor(window, 'document.querySelector(\'[data-testid="campus-topic-page"]\')?.dataset.topic === "history"');
  await sleep(900);

  const historyLayout = await window.webContents.executeJavaScript(`(() => {
    const page = document.querySelector('[data-testid="campus-topic-page"]').getBoundingClientRect();
    const canvas = document.querySelector('#canvas').getBoundingClientRect();
    return {
      page: { left: page.left, right: page.right, width: page.width },
      canvas: { left: canvas.left, right: canvas.right, width: canvas.width },
      separated: page.right <= canvas.left + 24,
      title: document.querySelector('[data-testid="campus-topic-title"]')?.textContent?.trim(),
      sectionCount: document.querySelectorAll('[data-testid^="campus-section-"]').length,
    };
  })()`, true);

  const image = await window.webContents.capturePage();
  fs.writeFileSync(screenshotPath, image.toPNG());

  const playbackDeadline = Date.now() + 60000;
  while (
    Date.now() < playbackDeadline
    && !browserLogs.some(({ message }) => message.includes('Starting audio playback with lip sync'))
    && !browserLogs.some(({ message }) => /Audio play error/i.test(message))
  ) {
    await sleep(250);
  }

  const historySubtitle = await window.webContents.executeJavaScript(
    'document.querySelector(\'[data-testid="subtitle-text"]\')?.textContent?.trim() || ""',
    true,
  );
  await stopNarrationIfVisible(window);

  await click(window, 'campus-nav-achievements');
  await waitFor(window, 'location.hash === "#/campus/achievements"');
  await waitFor(window, 'document.querySelector(\'[data-testid="campus-topic-page"]\')?.dataset.topic === "achievements"');
  const achievementTitle = await window.webContents.executeJavaScript(
    'document.querySelector(\'[data-testid="campus-topic-title"]\')?.textContent?.trim()',
    true,
  );
  await stopNarrationIfVisible(window);

  await click(window, 'campus-nav-role-models');
  await waitFor(window, 'location.hash === "#/campus/role-models"');
  await waitFor(window, 'document.querySelector(\'[data-testid="campus-topic-page"]\')?.dataset.topic === "role-models"');
  const roleModelTitle = await window.webContents.executeJavaScript(
    'document.querySelector(\'[data-testid="campus-topic-title"]\')?.textContent?.trim()',
    true,
  );
  await stopNarrationIfVisible(window);

  await click(window, 'campus-close');
  await waitFor(window, '!document.querySelector(\'[data-testid="campus-topic-page"]\')');
  const returnedToConversation = await window.webContents.executeJavaScript(
    '!location.hash',
    true,
  );

  const result = {
    optionCount,
    pagesVisited: ['history', 'achievements', 'role-models'],
    historyLayout,
    historySubtitle,
    achievementTitle,
    roleModelTitle,
    returnedToConversation,
    ttsPlaybackStarted: browserLogs.some(({ message }) => message.includes('Starting audio playback with lip sync')),
    ttsPlaybackError: browserLogs.some(({ message }) => /Audio play error/i.test(message)),
    activeAudioStopped: browserLogs.some(({ message }) => message.includes('Stopping current audio and lip sync')),
    screenshotPath,
    browserLogs,
  };

  window.destroy();
  return result;
}

app.whenReady().then(async () => {
  try {
    const result = await run();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    app.exit(
      result.optionCount === 3
      && result.historyLayout.separated
      && result.historyLayout.sectionCount >= 4
      && result.ttsPlaybackStarted
      && !result.ttsPlaybackError
      && result.activeAudioStopped
      && result.returnedToConversation
        ? 0
        : 1,
    );
  } catch (error) {
    process.stderr.write(`${error.stack || error}\n`);
    app.exit(1);
  }
});
