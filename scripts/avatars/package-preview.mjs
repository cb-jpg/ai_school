// Build a self-contained preview that also works when opened with file://.
// Usage: node scripts/avatars/package-preview.mjs /path/to/new-output-directory
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from '../../frontend/node_modules/esbuild/lib/main.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const sdk = path.join(root, 'frontend/src/renderer/WebSDK');
if (!process.argv[2]) throw Error('Specify a new output directory.');
const output = path.resolve(process.argv[2]);
if (existsSync(output)) throw Error('Choose a new output directory to preserve previous packages.');

const assets = {};
for (const name of ['xiaoshi', 'xiaomeng']) {
  const directory = path.join(root, 'live2d-models', name);
  const manifest = `${name}.model3.json`;
  const model = JSON.parse(await readFile(path.join(directory, manifest), 'utf8'));
  const files = new Set([manifest]);
  function collect(value) {
    if (typeof value === 'string' && /\.(json|moc3|png|jpe?g|wav|mp3)$/i.test(value)) files.add(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  }
  collect(model.FileReferences);
  for (const file of files) {
    assets[`./live2d-models/${name}/${file}`] = (await readFile(path.join(directory, file))).toString('base64');
  }
}

// Only the standalone build substitutes embedded resources. The development preview
// keeps loading the current runtime assets from the server as before.
let source = await readFile(path.join(here, 'preview.js'), 'utf8');
function replaceOnce(from, to) {
  if (source.split(from).length !== 2) throw Error(`Preview changed; update packaging substitution: ${from}`);
  source = source.replace(from, to);
}
replaceOnce("const root = location.pathname.split('/scripts/avatars/')[0];", "const root = '.';");
replaceOnce('await fetch(url)', 'await fetch(assetURL(url))');
replaceOnce('image.src = base + filename;', 'image.src = assetURL(base + filename);');
source = source.replaceAll("from '/WebSDK/", "from '@school-sdk/");
source = `
const embeddedAssets = JSON.parse(document.getElementById('embedded-assets').textContent);
const embeddedURLs = new Map();
function assetURL(key) {
  if (!embeddedURLs.has(key)) {
    if (!(key in embeddedAssets)) throw Error('Missing packaged resource: ' + key);
    const bytes = Uint8Array.from(atob(embeddedAssets[key]), c => c.charCodeAt(0));
    const type = /\\.png$/i.test(key) ? 'image/png' : /\\.jpe?g$/i.test(key) ? 'image/jpeg' : 'application/octet-stream';
    embeddedURLs.set(key, URL.createObjectURL(new Blob([bytes], { type })));
    delete embeddedAssets[key];
  }
  return embeddedURLs.get(key);
}
` + source;
const bundled = await build({
  stdin: { contents: source, resolveDir: here, sourcefile: 'preview.js', loader: 'js' },
  absWorkingDir: root,
  bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2020', minify: true,
  legalComments: 'inline',
  alias: { '@school-sdk': sdk, '@framework': path.join(sdk, 'Framework/src') },
});
const core = await readFile(path.join(sdk, 'Core/live2dcubismcore.min.js'), 'utf8');
const css = await readFile(path.join(here, 'preview.css'), 'utf8');
const inlineScript = text => text.replace(/<\/script/gi, '<\\/script');
let html = await readFile(path.join(here, 'preview.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="./preview.css">', () => `<style>${css}</style>`)
  .replace('<a href="./runtime-check.html">运行自动检查</a>', '<span>离线分享版</span>')
  .replace('<script src="/WebSDK/Core/live2dcubismcore.min.js"></script>', () => `<script>${inlineScript(core)}</script>`)
  .replace('<script type="module" src="./preview.js"></script>', () =>
    `<script id="embedded-assets" type="application/json">${JSON.stringify(assets)}</script>\n<script>${inlineScript(bundled.outputFiles[0].text)}</script>`);
await mkdir(path.join(output, 'licenses'), { recursive: true });
await writeFile(path.join(output, '小石与小萌-表情预览.html'), html);
for (const [file, label] of [
  ['Core/LICENSE.md', 'Live2D-Core-LICENSE.md'],
  ['Framework/LICENSE.md', 'Live2D-Framework-LICENSE.md'],
]) await copyFile(path.join(sdk, file), path.join(output, 'licenses', label));
if (existsSync(path.join(root, 'LICENSE'))) await copyFile(path.join(root, 'LICENSE'), path.join(output, 'licenses/Project-LICENSE'));
await writeFile(path.join(output, '打开方法.txt'), `小石与小萌 · 表情预览（独立分享版）

1. 先解压整个压缩包。
2. 用电脑上的 Chrome 或 Edge 打开“小石与小萌-表情预览.html”（双击或拖进浏览器）。
3. 可切换两个人物、8 种表情，拖动转头，开关自动动作，演示口型或上传本机音频。

模型、贴图、动作与运行库均已内嵌，无需 Python、Node.js、项目代码或服务器。
“朗读这段话”使用浏览器/系统语音，能否离线朗读取决于本机中文语音；没有语音时可点“口型演示”。
这是人物效果演示，不包含 AI 问答、登录或 APP 后端。上传的音频只在当前浏览器中处理。
请在解压后用浏览器打开，不要使用聊天软件的附件预览窗口。
手机对本地 HTML 的支持因浏览器而异；需要手机直接点链接查看时，可将此 HTML 上传到静态网站。

分享时请一并保留 licenses 目录中的原项目和 Live2D 运行库许可说明。
`);
console.log(`Packaged ${Object.keys(assets).length} resources: ${output}`);
