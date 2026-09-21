/// <reference types="vite/client" />

// App 原生包版本（vite.config.ts 从 android/app/build.gradle 注入；OTA 检查用）
declare const __APP_BUILD__: number;
declare const __APP_VERSION__: string;
