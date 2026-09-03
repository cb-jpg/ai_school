/**
 * 管理后台认证服务
 * token 存 localStorage；所有管理 API 请求经 authFetch 注入 Authorization。
 * 收到 401 时清除本地凭证并广播 kb-unauthorized 事件（AuthProvider 监听后回到登录页）。
 */

import { apiUrl } from '@/services/api-base';

const TOKEN_KEY = 'kb_token';
const USER_KEY = 'kb_user';

export interface AuthUser {
  username: string;
  role: 'admin' | 'editor' | 'user';
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const response = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const detail = await response
      .json()
      .then((data) => data?.detail)
      .catch(() => null);
    throw new Error(detail || `登录失败（${response.status}）`);
  }
  const data = await response.json();
  setAuth(data.token, data.user);
  return data.user as AuthUser;
}

/** 带认证的 fetch：相对路径自动拼接后端地址；401 时清除凭证并通知全局回到登录页 */
export async function authFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  // 相对路径在 App 内会打到 WebView 本地，统一解析为后端绝对地址
  const url = typeof input === 'string' ? apiUrl(input) : input;
  const response = await fetch(url, { ...init, headers });
  if (response.status === 401) {
    clearAuth();
    window.dispatchEvent(new Event('kb-unauthorized'));
    throw new Error('登录已过期，请重新登录');
  }
  return response;
}
