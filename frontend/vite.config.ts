import { defineConfig, normalizePath } from 'vite';
import path from 'path';
import fs from 'fs';
import react from '@vitejs/plugin-react-swc';

// 从 android/app/build.gradle 读原生包版本，作为前端构建期常量注入（单一版本源）。
// OTA 检查用 __APP_BUILD__（versionCode）与服务器 manifest.version_code 比大小。
function readAndroidVersion(): { build: number; name: string } {
  try {
    const gradle = fs.readFileSync(
      path.resolve(__dirname, 'android/app/build.gradle'),
      'utf-8',
    );
    const code = gradle.match(/versionCode\s+(\d+)/)?.[1];
    const name = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
    if (code && name) return { build: parseInt(code, 10), name };
  } catch { /* 非 Android 环境或文件缺失时用兜底值 */ }
  return { build: 0, name: 'dev' };
}

const androidVersion = readAndroidVersion();

const createConfig = async (outDir: string) => ({
  define: {
    __APP_BUILD__: JSON.stringify(androidVersion.build),
    __APP_VERSION__: JSON.stringify(androidVersion.name),
  },
  plugins: [
    (await import('vite-plugin-static-copy')).viteStaticCopy({
      targets: [
        {
          src: normalizePath(path.resolve(__dirname, 'node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js')),
          dest: './libs/',
        },
        {
          src: normalizePath(path.resolve(__dirname, 'node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx')),
          dest: './libs/',
        },
        {
          src: normalizePath(path.resolve(__dirname, 'node_modules/@ricky0123/vad-web/dist/silero_vad_legacy.onnx')),
          dest: './libs/',
        },
        {
          src: normalizePath(path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/*.wasm')),
          dest: './libs/',
        },
        {
          src: normalizePath(path.resolve(__dirname, 'src/renderer/WebSDK/Core/live2dcubismcore.js')),
          dest: './libs/',
        },
      ],
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/renderer/src"),
      "@framework": path.resolve(__dirname, "./src/renderer/WebSDK/Framework/src"),
      "@cubismsdksamples": path.resolve(__dirname, "./src/renderer/WebSDK/src"),
      "@motionsyncframework": path.resolve(
        __dirname,
        "./src/renderer/MotionSync/Framework/src",
      ),
      "@motionsync": path.resolve(__dirname, "./src/renderer/MotionSync/src"),
      "/src": path.resolve(__dirname, "./src/renderer/src"),
    },
  },
  root: path.join(__dirname, "src/renderer"),
  publicDir: path.join(__dirname, "src/renderer/public"),
  // env 文件放在 frontend/ 根（.env.web / .env.web.local）。
  // 不设置时 envDir 默认跟 root（src/renderer），导致 .env.* 从未被加载。
  envDir: __dirname,
  base: "./",
  server: {
    port: 3000,
    proxy: {
      // Proxy WebSocket connections to backend
      '/client-ws': {
        target: 'ws://localhost:12393',
        ws: true,
        changeOrigin: true,
      },
      // Proxy HTTP requests to backend
      '/api': {
        target: 'http://localhost:12393',
        changeOrigin: true,
      },
      // Proxy health check and other backend routes
      '/health': {
        target: 'http://localhost:12393',
        changeOrigin: true,
      },
      // Proxy Live2D model files to backend
      '/live2d-models': {
        target: 'http://localhost:12393',
        changeOrigin: true,
      },
      // Proxy background images to backend
      '/bg': {
        target: 'http://localhost:12393',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.join(__dirname, outDir),
    emptyOutDir: true,
    assetsDir: "assets",
    rollupOptions: {
      input: {
        main: path.join(__dirname, "src/renderer/index.html"),
      },
    },
  },
  ssr: {
    noExternal: ['vite-plugin-static-copy'],
  },
});

export default defineConfig(async ({ mode }) => {
  if (mode === 'web') {
    return createConfig('dist/web');
  }
  return createConfig('dist/renderer');
});
