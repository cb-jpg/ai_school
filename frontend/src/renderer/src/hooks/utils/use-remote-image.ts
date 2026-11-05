/**
 * 远程 http 图片的 WebView 兼容加载（2026-11-05 v2.55）。
 *
 * 背景：部分一体机/手机 ROM 的 WebView 会静默拦截 <img> 加载 http:// 远程图
 * （请求不进网络栈、无任何报错；Live2D 画布纹理走 fetch/WebGL 不受影响）——
 * 表征为「模型切换列表里小石/小萌头像显示不出来」。canvas/background.tsx
 * 早已用 fetch→blob 同法绕过背景图，本 hook 把该手法抽成通用件。
 *
 * 策略：blob:/data:/同源地址直通；其余（跨源 http/https、相对路径按后端
 * 地址解析后为跨源）一律 fetch→objectURL 展示。模块级缓存避免重复拉取，
 * 会话生命周期内不 revoke（头像类图片总量小）。加载失败返回 null，
 * 调用方自行回退占位（emoji 等）。
 */
import { useEffect, useState } from 'react';
import { apiUrl } from '@/services/api-base';

/** absoluteUrl -> blob: URL（会话级缓存） */
const blobCache = new Map<string, string>();

function sameOrigin(absoluteUrl: string): boolean {
  try {
    return new URL(absoluteUrl, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function useRemoteImage(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setResolved(null);
      return undefined;
    }
    const absolute =
      url.startsWith('blob:') || url.startsWith('data:') ? url : apiUrl(url);
    if (absolute.startsWith('blob:') || absolute.startsWith('data:') || sameOrigin(absolute)) {
      setResolved(absolute);
      return undefined;
    }
    const cached = blobCache.get(absolute);
    if (cached) {
      setResolved(cached);
      return undefined;
    }
    let cancelled = false;
    fetch(absolute, { mode: 'cors' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        blobCache.set(absolute, objectUrl);
        setResolved(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setResolved(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return resolved;
}
