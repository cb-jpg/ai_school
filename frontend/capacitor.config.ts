import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shishi.ai',
  appName: '小石同学',
  webDir: 'dist/web',
  plugins: {
    // App 在线更新（OTA，需求 #3）：手动模式——由前端 services/ota-update.ts
    // 拉 /app-releases/manifest.json 决定何时下载换包，不用云端自动通道。
    CapacitorUpdater: {
      autoUpdate: false,
      // 直接删除（而非仅清理）本地旧包，避免占满存储
      resetWhenUpdate: true,
    },
  },
  android: {
    // 允许 https://localhost（App 内）访问远程 http:// 后端（混合内容放行）
    allowMixedContent: true,
    // 调试期允许 chrome://inspect 查看 WebView 控制台
    webContentsDebuggingEnabled: true,
  },
};

export default config;
