import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shishi.ai',
  appName: 'AI数字人',
  webDir: 'dist/web',
  android: {
    // 允许 https://localhost（App 内）访问远程 http:// 后端（混合内容放行）
    allowMixedContent: true,
    // 调试期允许 chrome://inspect 查看 WebView 控制台
    webContentsDebuggingEnabled: true,
  },
};

export default config;
