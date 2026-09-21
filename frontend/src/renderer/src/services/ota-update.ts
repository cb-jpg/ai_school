/**
 * App 在线更新（OTA，2026-09-20 需求 #3）
 *
 * 机制：@capgo/capacitor-updater 手动模式。
 * 服务器 /app-releases/manifest.json 记录最新 web 包（version/version_code/sha256/notes），
 * App 启动时比对 __APP_BUILD__（本机原生包 versionCode，vite 构建期注入）：
 *   - manifest.version_code 更大 → 有热更可装
 *   - 手机端弹窗询问；kiosk（一体机无人值守）静默换包
 * 下载的 bundle 必须在启动稳定后调用 notifyAppReady()，否则插件判定启动失败自动回滚。
 *
 * 边界：OTA 只换 web 层。原生层改动（MainActivity、插件、权限、WebView 兼容）必须重打
 * APK——发布侧 scripts/pub_ota.py 会把 manifest.version_code 钉在当前原生 versionCode 上，
 * 原生升级后重发一次热更即可抬高基准。
 */
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { IS_KIOSK } from '@/utils/device-profile';
import { resolveApiBaseUrl } from '@/services/api-base';

export interface OtaManifest {
  version: string;
  version_code: number;
  notes: string;
  url: string;
  sha256: string;
  size: number;
  ts: number;
}

export interface OtaCheckResult {
  available: boolean;
  manifest?: OtaManifest;
}

/** 拉取服务器最新 manifest 并与本机构建号比较 */
export async function checkForOtaUpdate(): Promise<OtaCheckResult> {
  if (!Capacitor.isNativePlatform()) return { available: false }; // 浏览器/桌面端不参与
  const base = resolveApiBaseUrl();
  const resp = await fetch(`${base}/app-releases/manifest.json`, {
    cache: 'no-store',
  });
  if (!resp.ok) throw new Error(`manifest 拉取失败 HTTP ${resp.status}`);
  const manifest = (await resp.json()) as OtaManifest;
  if (!manifest?.version_code) throw new Error('manifest 格式异常');
  const localBuild = typeof __APP_BUILD__ === 'number' ? __APP_BUILD__ : 0;
  return { available: manifest.version_code > localBuild, manifest };
}

/**
 * 下载并应用热更包。
 * @param onProgress 下载进度回调（0~100）
 * @returns 是否已触发重载（kiosk 静默模式直接 reload；交互模式 set 后等下次启动或手动 reload）
 */
export async function applyOtaUpdate(
  manifest: OtaManifest,
  opts: { silent: boolean; onProgress?: (pct: number) => void },
): Promise<boolean> {
  const url = `${resolveApiBaseUrl()}${manifest.url}`;
  const bundle = await CapacitorUpdater.download({
    url,
    version: manifest.version,
  });
  opts.onProgress?.(100);
  // set() 之后不要执行后续逻辑（插件约定）：reload 由 set 内部触发或立即调用
  await CapacitorUpdater.set({ id: bundle.id });
  if (opts.silent) {
    // kiosk：无人值守，直接重载进新包（启动后 notifyAppReady 稳定，失败自动回滚）
    await CapacitorUpdater.reload();
    return true;
  }
  // 交互模式：set 已生效，下次启动进新包；为让用户立刻用上，也直接重载
  await CapacitorUpdater.reload();
  return true;
}

/** 应用启动稳定后调用：告知插件本包正常（否则 10s 内未上报会被判定启动失败而回滚） */
export async function notifyOtaReady(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await CapacitorUpdater.notifyAppReady();
  } catch (e) {
    console.warn('[OTA] notifyAppReady 失败（可忽略，仅热更场景有意义）:', e);
  }
}

export const otaSilentMode = IS_KIOSK;
