/**
 * Kiosk 诊断悬浮层（仅大屏一体机渲染）
 *
 * 一体机在现场只能靠拍照反馈问题，而排这类"整页错位/半截屏"最缺的就是
 * 设备实测数据（视口到底多大、--app-vh 算成多少、WebView 什么版本、
 * 网络连没连上）。把关键值直接画在屏幕左下角，拍一张照即可全回答。
 *
 * pointerEvents: none —— 完全不挡触摸操作；每秒刷新一次，值会动即说明
 * 渲染进程活着。末行的构建号用于现场确认装的是哪个包（v1.7/v1.8 曾因
 * 未 bump versionCode 而无法从外观区分）。
 */

import { memo, useEffect, useState } from 'react';
import { useWebSocket } from '@/context/websocket-context';
import {
  getKioskCssScale,
  KIOSK_LAYOUT_WIDTH,
  KIOSK_SCALE,
} from '@/utils/device-profile';

// 与 APK导出 的体验版版本号保持一致（每次出新包手动同步）
const APP_BUILD = 'v2.2-kiosk';

const KioskDiagnostics = memo(() => {
  const { wsState } = useWebSocket();
  const [info, setInfo] = useState('');

  useEffect(() => {
    const tick = () => {
      const vv = window.visualViewport;
      const appVh = getComputedStyle(document.documentElement)
        .getPropertyValue('--app-vh')
        .trim();
      const chromeM = /Chrome\/(\d+)/.exec(navigator.userAgent)?.[1] ?? '?';
      const de = document.documentElement;
      const b = document.body;
      setInfo(
        [
          `小石同学 ${APP_BUILD}`,
          `vp ${window.innerWidth}x${window.innerHeight}  vv ${Math.round(vv?.width ?? 0)}x${Math.round(vv?.height ?? 0)}`,
          `layout ${KIOSK_LAYOUT_WIDTH}x${appVh || '?'}  cssScale ×${getKioskCssScale().toFixed(2)}`,
          `scr ${window.screen.width}x${window.screen.height}  scale ×${KIOSK_SCALE.toFixed(2)}  dpr ${window.devicePixelRatio}`,
          `appVh ${appVh || '(未设置)'}`,
          `scroll ${de.scrollLeft},${de.scrollTop} / ${b.scrollLeft},${b.scrollTop}`,
          `Chrome/${chromeM}  ws:${wsState}`,
        ].join('\n'),
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [wsState]);

  return (
    <div
      style={{
        position: 'fixed',
        left: 4,
        bottom: 110,
        zIndex: 9999,
        pointerEvents: 'none',
        fontFamily: 'Menlo, Consolas, monospace',
        fontSize: 10,
        lineHeight: 1.6,
        color: '#00ff9d',
        background: 'rgba(0, 0, 0, 0.62)',
        padding: '6px 9px',
        borderRadius: 8,
        whiteSpace: 'pre',
        textAlign: 'left',
      }}
    >
      {info}
    </div>
  );
});

KioskDiagnostics.displayName = 'KioskDiagnostics';

export default KioskDiagnostics;
