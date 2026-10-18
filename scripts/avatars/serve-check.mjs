// Run from any directory after npm ci in frontend; visit the printed check URL.
import { fileURLToPath } from 'node:url';
import { createServer, loadConfigFromFile } from '../../frontend/node_modules/vite/dist/node/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { config } = await loadConfigFromFile(
  { command: 'serve', mode: 'development' }, `${root}frontend/vite.config.ts`,
);
config.configFile = false;
config.server = { ...config.server, host: '127.0.0.1', port: 3020, strictPort: true, watch: null, fs: { allow: [root] } };
const server = await createServer(config);
await server.listen();
console.log(`人物预览：http://127.0.0.1:3020/@fs${root}scripts/avatars/preview.html`);
console.log(`自动检查：http://127.0.0.1:3020/@fs${root}scripts/avatars/runtime-check.html`);
