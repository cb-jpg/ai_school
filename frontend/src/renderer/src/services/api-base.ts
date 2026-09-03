/**
 * 后端地址集中管理
 *
 * 三种运行环境：
 * 1. 服务器托管（页面由后端直接 serve）：同源，取 window.location
 * 2. 开发模式（vite dev server，端口非 12393）：回退 127.0.0.1:12393
 * 3. Capacitor 安卓 App：前端打包内置（origin 为 https://localhost），默认指向远程后端
 *
 * 所有原本使用相对路径的后端请求（fetch/img/模型资源）都应经 apiUrl() 拼接，
 * 否则在 App 内会打到 WebView 本地（404）。
 */
import { Capacitor } from '@capacitor/core';

export const LEGACY_WS_URL = 'ws://127.0.0.1:12393/client-ws';
export const LEGACY_BASE_URL = 'http://127.0.0.1:12393';

/** 安卓 App 内置前端默认指向的后端（可用 .env.web 的 VITE_REMOTE_SERVER 覆盖） */
const REMOTE_SERVER: string =
  (import.meta.env.VITE_REMOTE_SERVER as string | undefined) ||
  'http://183.36.243.124:12393';

const remoteWsUrl = (): string => `${REMOTE_SERVER.replace(/^http/, 'ws')}/client-ws`;

// ============ 访问令牌（服务端 system_config.access_token 门禁） ============

const TOKEN_STORAGE_KEY = 'accessToken';

/** 从地址栏 ?token= 读取并持久化到 localStorage，然后从地址栏移除（防截图/分享泄露） */
function consumeUrlToken(): string | null {
  if (typeof window === 'undefined' || !['http:', 'https:'].includes(window.location.protocol)) {
    return null;
  }
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
      url.searchParams.delete('token');
      window.history.replaceState(null, '', url.toString());
    }
  } catch {
    // 忽略：无地址栏环境（Capacitor/Electron）
  }
  return null;
}

/**
 * 当前访问令牌：地址栏 ?token= > localStorage > 构建期内置（安卓 App 打包用 VITE_ACCESS_TOKEN）。
 * 服务端未启用门禁时返回空串，所有拼接逻辑自动跳过。
 */
export function getAccessToken(): string {
  consumeUrlToken();
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (raw != null) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string' && parsed) return parsed;
    }
  } catch {
    // 存储损坏按未设置处理
  }
  return (import.meta.env.VITE_ACCESS_TOKEN as string | undefined) || '';
}

/** 给后端 URL 附加访问令牌（幂等；相对路径按当前后端地址解析） */
export function withToken(url: string): string {
  const token = getAccessToken();
  if (!token || !url) return url;
  try {
    const parsed = new URL(url, resolveApiBaseUrl());
    if (parsed.searchParams.has('token')) return url;
    parsed.searchParams.set('token', token);
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * 给 WebSocket URL 附加登录用户令牌（kb_token，见 services/auth.ts）。
 * 服务端在 /client-ws 握手时据此把聊天历史隔离到用户目录；直接读 localStorage
 * 以避免 api-base ↔ auth 循环导入。仅 WS 连接使用，勿放进通用 apiUrl()。
 */
export function withUserToken(url: string): string {
  let token: string | null = null;
  try {
    token = localStorage.getItem('kb_token');
  } catch {
    return url;
  }
  if (!token || !url) return url;
  try {
    const parsed = new URL(url, resolveApiBaseUrl());
    if (parsed.searchParams.has('user_token')) return url;
    parsed.searchParams.set('user_token', token);
    return parsed.toString();
  } catch {
    return url;
  }
}

export function getDefaultUrls(): { wsUrl: string; baseUrl: string } {
  if (typeof window !== 'undefined' && ['http:', 'https:'].includes(window.location.protocol)) {
    // Capacitor 原生环境：origin 是 https://localhost（无 :12393），走远程后端
    if (Capacitor.isNativePlatform()) {
      console.log('[api-base] Capacitor 原生环境，使用远程后端:', REMOTE_SERVER);
      return { wsUrl: remoteWsUrl(), baseUrl: REMOTE_SERVER };
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;

    // 检测是否在开发模式下运行（端口不是 12393）
    const isDevMode = !host.includes(':12393') && !host.includes('127.0.0.1:12393');

    if (isDevMode) {
      // 开发模式下，使用后端服务器的地址
      console.log('[WebSocket] 检测到开发模式，使用后端服务器地址');
      return {
        wsUrl: `${wsProtocol}//127.0.0.1:12393/client-ws`,
        baseUrl: 'http://127.0.0.1:12393',
      };
    }

    return {
      wsUrl: `${wsProtocol}//${host}/client-ws`,
      baseUrl: window.location.origin,
    };
  }
  return { wsUrl: LEGACY_WS_URL, baseUrl: LEGACY_BASE_URL };
}

/** 读取当前生效的后端地址（与 WebSocketProvider 持久化的 localStorage baseUrl 一致） */
export function resolveApiBaseUrl(): string {
  try {
    const raw = localStorage.getItem('baseUrl');
    if (raw != null) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string' && parsed) return parsed;
    }
  } catch {
    // JSON 解析失败按未存储处理
  }
  return getDefaultUrls().baseUrl;
}

/** 把后端相对路径拼成绝对地址（自动附带访问令牌）；已是绝对地址则原样返回 */
export function apiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return withToken(path);
  const base = resolveApiBaseUrl().replace(/\/+$/, '');
  return withToken(`${base}${path.startsWith('/') ? '' : '/'}${path}`);
}
