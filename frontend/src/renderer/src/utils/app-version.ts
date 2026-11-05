/**
 * 当前应用版本（2026-11-05）：构建期由 vite.config.ts define 从
 * android/app/build.gradle 的 versionName/versionCode 注入。
 * 此前「关于」页与后台仪表盘硬编码 npm 包版本 1.2.1（与实际发版无关），统一改引此处。
 * 热更版本比对见 services/ota-update.ts（__APP_BUILD__ ↔ manifest.version_code）。
 */
export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';

export const APP_BUILD: number = typeof __APP_BUILD__ === 'number' ? __APP_BUILD__ : 0;
