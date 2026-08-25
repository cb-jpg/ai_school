import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { normalizePath } from 'vite';

// Custom middleware to serve live2d-models from parent directory
function serveLive2DModels() {
  return {
    name: 'serve-live2d-models',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url.startsWith('/live2d-models')) {
          const fs = require('fs');
          const path = require('path');
          const filePath = path.resolve(__dirname, '..', req.url.substring(1));

          if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath);
            const contentType = ext === '.json' ? 'application/json' :
                               ext === '.png' ? 'image/png' :
                               ext === '.moc3' ? 'application/octet-stream' :
                               'application/octet-stream';

            res.setHeader('Content-Type', contentType);
            res.setHeader('Access-Control-Allow-Origin', '*');
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
            return;
          }
        }
        next();
      });
    }
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        "@framework": resolve("src/renderer/WebSDK/Framework/src"),
        "@cubismsdksamples": resolve("src/renderer/WebSDK/src"),
        "@motionsyncframework": resolve(
          "src/renderer/MotionSync/Framework/src",
        ),
        "@motionsync": resolve("src/renderer/MotionSync/src"),
        "/src": resolve("src/renderer/src"),
      },
    },
    server: {
      fs: {
        // Allow serving files from parent directories
        strict: false,
      },
    },
    publicDir: 'src/renderer/public',
    plugins: [
      serveLive2DModels(),
      viteStaticCopy({
        targets: [
          {
            src: normalizePath(resolve(__dirname, 'node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js')),
            dest: './libs/',
          },
          {
            src: normalizePath(resolve(__dirname, 'node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx')),
            dest: './libs/',
          },
          {
            src: normalizePath(resolve(__dirname, 'node_modules/@ricky0123/vad-web/dist/silero_vad_legacy.onnx')),
            dest: './libs/',
          },
          {
            src: normalizePath(resolve(__dirname, 'node_modules/onnxruntime-web/dist/*.wasm')),
            dest: './libs/',
          },
          {
            src: normalizePath(resolve(__dirname, 'src/renderer/WebSDK/Core/live2dcubismcore.js')),
            dest: './libs/'
          },
          // Copy live2d-models from project root
          {
            src: normalizePath(resolve(__dirname, '../live2d-models')),
            dest: './'
          }
        ],
      }),
      react(),
    ],
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.message.includes('onnxruntime')) {
            return;
          }
          warn(warning);
        },
      },
    },
  },
});
