/**
 * App 在线更新启动钩子（2026-09-20 需求 #3）。
 *
 * - 挂载 6s 后 notifyAppReady()：热更包若 10s 内不上报，插件判定启动失败自动回滚。
 * - 挂载 5s 后检查 /app-releases/manifest.json（错开启动高峰，不与 Live2D 抢资源）：
 *     - 一体机（otaSilentMode）：无人值守，静默下载换包，失败自动回滚；
 *     - 手机端：toast 询问，点「立即更新」才下载重载；
 *     - 浏览器/桌面端：service 内直接短路，不发起请求。
 * 检查/下载失败一律只 console.warn，不打扰正常使用（现场可能离线）。
 */
import { useEffect } from 'react';
import { toaster } from '@/components/ui/toaster';
import {
  applyOtaUpdate,
  checkForOtaUpdate,
  notifyOtaReady,
  otaSilentMode,
  type OtaManifest,
} from '@/services/ota-update';

export function useOtaUpdate(): void {
  // notifyAppReady：新热更包启动稳定后上报（普通包上报也无害，插件仅记录）
  useEffect(() => {
    const t = window.setTimeout(() => {
      void notifyOtaReady();
    }, 6000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        let manifest: OtaManifest | undefined;
        try {
          const res = await checkForOtaUpdate();
          if (!res.available) return;
          manifest = res.manifest;
        } catch (e) {
          console.warn('[OTA] 检查更新失败（服务器不可达？忽略）:', e);
          return;
        }
        if (!manifest) return;

        if (otaSilentMode) {
          try {
            await applyOtaUpdate(manifest, { silent: true });
            // reload 后进入新包；失败由插件自动回滚
          } catch (e) {
            console.warn('[OTA] 静默换包失败:', e);
          }
          return;
        }

        // 手机端：询问后更新（15s 不点则本次跳过，下次启动再问）
        toaster.create({
          type: 'info',
          title: `发现新版本 ${manifest.version}`,
          description: manifest.notes || '有可用的更新',
          duration: 15000,
          meta: { closable: true },
          action: {
            label: '立即更新',
            onClick: () => {
              void (async () => {
                const loading = toaster.create({
                  type: 'loading',
                  title: '正在下载更新…',
                  duration: Infinity,
                });
                try {
                  await applyOtaUpdate(manifest!, { silent: false });
                  toaster.dismiss(loading); // reload 已触发，通常执行不到这里
                } catch (e) {
                  toaster.dismiss(loading);
                  toaster.create({
                    type: 'error',
                    title: '更新失败',
                    description: String(e),
                    duration: 6000,
                  });
                }
              })();
            },
          },
        });
      })();
    }, 5000);
    return () => window.clearTimeout(timer);
  }, []);
}
