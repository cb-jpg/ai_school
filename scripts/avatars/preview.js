import { CubismFramework } from '/WebSDK/Framework/src/live2dcubismframework.ts';
import { CubismModelSettingJson } from '/WebSDK/Framework/src/cubismmodelsettingjson.ts';
import { CubismMatrix44 } from '/WebSDK/Framework/src/math/cubismmatrix44.ts';
import { LAppModel } from '/WebSDK/src/lappmodel.ts';
import { LAppPal } from '/WebSDK/src/lapppal.ts';

const $ = id => document.getElementById(id);
const canvas = $('canvas');
const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
const root = location.pathname.split('/scripts/avatars/')[0];
const labels = { neutral: '喜', anger: '怒', sadness: '哀', joy: '乐', surprise: '惊恐', bored: '无语', shy: '害羞', cry: '哭' };
let app, character, expression = 'neutral', textures = [], loading = false;
let audioContext, analyser, audioSource, audioUrl, originalRms, speech, mode = '';
let lastTime = performance.now();
const status = text => { $('status').textContent = text; };
const buffer = async url => {
  const response = await fetch(url);
  if (!response.ok) throw Error(`资源加载失败 (${response.status})`);
  return response.arrayBuffer();
};

function stop() {
  speech = null;
  window.speechSynthesis?.cancel();
  $('audio').pause();
  if (originalRms && app) app._wavFileHandler.getRms = originalRms;
  originalRms = null;
  app?._wavFileHandler.releasePcmData();
  app?.setSpeaking(false);
  mode = '';
  status(`当前表情：${labels[expression]}`);
}

function setExpression(name) {
  if (!app || loading || !(name in labels)) return;
  expression = name;
  app.setExpression(name);
  document.querySelectorAll('[data-expression]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.expression === name)));
  status(`当前表情：${labels[name]}`);
}

async function loadCharacter(name) {
  if (loading) return;
  loading = true;
  window.preview.ready = false;
  $('controls').disabled = true;
  document.querySelectorAll('[data-character]').forEach(button => { button.disabled = true; });
  stop();
  app?.release();
  app = null;
  textures.forEach(texture => gl.deleteTexture(texture));
  textures = [];
  character = name;
  status(`正在加载${name === 'xiaoshi' ? '小石' : '小萌'}…`);
  try {
    const base = `${root}/live2d-models/${name}/`;
    const settings = await buffer(`${base}${name}.model3.json`);
    const json = JSON.parse(new TextDecoder().decode(settings));
    app = new LAppModel();
    app._modelHomeDir = base;
    app._modelSetting = new CubismModelSettingJson(settings, settings.byteLength);
    app.loadModel(await buffer(base + json.FileReferences.Moc), true);
    for (const group of json.Groups) {
      const ids = group.Name === 'LipSync' ? app._lipSyncIds : group.Name === 'EyeBlink' ? app._eyeBlinkIds : null;
      group.Ids.forEach(id => ids?.pushBack(CubismFramework.getIdManager().getId(id)));
    }
    const physics = await buffer(base + json.FileReferences.Physics);
    app.loadPhysics(physics, physics.byteLength);
    for (const reference of json.FileReferences.Expressions) {
      const data = await buffer(base + reference.File);
      app._expressions.setValue(reference.Name, app.loadExpression(data, data.byteLength, reference.Name));
    }
    for (const group of ['Idle', 'Talk']) {
      for (const [i, reference] of json.FileReferences.Motions[group].entries()) {
        const data = await buffer(base + reference.File);
        const motion = app.loadMotion(data, data.byteLength, `${group}_${i}`);
        motion.setEffectIds(app._eyeBlinkIds, app._lipSyncIds);
        app._motions.setValue(`${group}_${i}`, motion);
      }
    }
    app.createRenderer();
    const renderer = app.getRenderer();
    renderer.startUp(gl);
    renderer.setIsPremultipliedAlpha(true);
    for (const [i, filename] of json.FileReferences.Textures.entries()) {
      const image = new Image();
      image.src = base + filename;
      await image.decode();
      const texture = gl.createTexture();
      textures.push(texture);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      renderer.bindTexture(i, texture);
    }
    app._state = 22; // CompleteSetup, after assets and textures have loaded.
    const startMotion = app.startRandomMotion.bind(app);
    app.startRandomMotion = (...args) => $('animate').checked ? startMotion(...args) : -1;
    loading = false;
    $('controls').disabled = false;
    $('yaw').value = $('pitch').value = 0;
    setExpression(expression);
    document.querySelectorAll('[data-character]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.character === name)));
    window.preview.ready = true;
  } catch (error) {
    status(`人物加载失败：${error.message}。请刷新页面重试。`);
    app?.release(); app = null;
  } finally {
    loading = false;
    document.querySelectorAll('[data-character]').forEach(button => { button.disabled = false; });
  }
}

function startDemo() {
  stop(); mode = 'demo'; app.setSpeaking(true, true);
  status('口型演示中；可以继续切换表情');
}

$('demo').onclick = startDemo;
$('stop').onclick = stop;
$('speak').onclick = () => {
  stop();
  const text = $('speech-text').value.trim();
  if (!text) { status('先输入一段试听文字。'); return; }
  if (!('speechSynthesis' in window)) { status('浏览器不支持朗读，可以使用口型演示或上传音频。'); return; }
  speech = new SpeechSynthesisUtterance(text);
  const utterance = speech;
  utterance.lang = 'zh-CN';
  utterance.voice = speechSynthesis.getVoices().find(voice => voice.lang.toLowerCase().startsWith('zh')) || null;
  utterance.onstart = () => { if (speech === utterance) { mode = 'speech'; app.setSpeaking(true, true); status('正在朗读；可以继续切换表情'); } };
  utterance.onend = () => { if (speech === utterance) stop(); };
  utterance.onerror = () => { if (speech === utterance) { stop(); status('朗读未能启动，请使用口型演示或上传音频。'); } };
  speechSynthesis.speak(utterance);
};

$('audio-file').onchange = () => {
  stop();
  const file = $('audio-file').files[0];
  if (!file) return;
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = URL.createObjectURL(file);
  $('audio').src = audioUrl;
  $('audio').hidden = false;
  status('音频已准备好，点击播放器开始测试。');
};
$('audio').onplay = async () => {
  speech = null; window.speechSynthesis?.cancel();
  try {
    if (!audioContext) {
      audioContext = new AudioContext(); analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      audioSource = audioContext.createMediaElementSource($('audio'));
      audioSource.connect(analyser); analyser.connect(audioContext.destination);
    }
    await audioContext.resume();
    if ($('audio').paused) return;
    const data = new Float32Array(analyser.fftSize);
    originalRms ||= app._wavFileHandler.getRms.bind(app._wavFileHandler);
    app._wavFileHandler.getRms = () => {
      analyser.getFloatTimeDomainData(data);
      return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
    };
    mode = 'audio'; app.setSpeaking(true); status('正在随音频音量驱动口型');
  } catch (error) { stop(); status(`音频无法播放：${error.message}`); }
};
$('audio').onpause = () => { if (mode === 'audio') stop(); };
$('audio').onended = stop;
$('audio').onerror = () => { stop(); status('浏览器无法读取这段音频，请改用 WAV 或 MP3。'); };
$('reset').onclick = () => { $('yaw').value = $('pitch').value = 0; app.setDragging(0, 0); };
$('animate').checked = !matchMedia('(prefers-reduced-motion: reduce)').matches;
$('animate').onchange = () => {
  if (!$('animate').checked) {
    app._motionManager.stopAllMotions();
    app._motionManager.updateMotion(app._model, 0);
    const p = app._model.getModel().parameters;
    p.values.set(p.defaultValues); app._model.saveParameters();
  }
};
function turn() { app?.setDragging(Number($('yaw').value) / 30, Number($('pitch').value) / 30); }
['yaw', 'pitch'].forEach(id => { $(id).oninput = turn; });
canvas.onpointerdown = event => { if (app && !loading) { canvas.setPointerCapture(event.pointerId); drag(event); } };
canvas.onpointermove = event => { if (canvas.hasPointerCapture(event.pointerId)) drag(event); };
function drag(event) {
  const rect = canvas.getBoundingClientRect();
  $('yaw').value = Math.round(Math.max(-30, Math.min(30, ((event.clientX - rect.left) / rect.width - .5) * 90)));
  $('pitch').value = Math.round(Math.max(-30, Math.min(30, (.5 - (event.clientY - rect.top) / rect.height) * 90)));
  turn();
}
document.querySelectorAll('[data-character]').forEach(button => { button.onclick = () => loadCharacter(button.dataset.character); });
document.querySelectorAll('[data-expression]').forEach(button => { button.onclick = () => setExpression(button.dataset.expression); });
window.preview = { ready: false, loadCharacter, setExpression, startDemo, stop, get app() { return app; }, get character() { return character; }, get expression() { return expression; } };

const matrix = new CubismMatrix44();
matrix.scale(.98, .98);
function frame(now) {
  const delta = Math.min((now - lastTime) / 1000, .05); lastTime = now;
  if (app && !loading) {
    const size = Math.round(canvas.clientWidth * Math.min(devicePixelRatio, 2));
    if (canvas.width !== size) canvas.width = canvas.height = size;
    LAppPal.s_deltaTime = delta;
    app.update();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const renderer = app.getRenderer();
    renderer.setMvpMatrix(matrix);
    renderer.setRenderState(null, [0, 0, canvas.width, canvas.height]);
    renderer.drawModel();
  }
  requestAnimationFrame(frame);
}
if (!gl) {
  status('浏览器未启用 WebGL，请打开硬件加速后刷新，或换用 Chrome / Edge。');
} else {
  CubismFramework.startUp(); CubismFramework.initialize();
  loadCharacter('xiaoshi'); requestAnimationFrame(frame);
}
