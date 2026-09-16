/**
 * 认证上下文：当前登录用户（admin/editor）与登录/登出操作。
 * 监听 kb-unauthorized 事件（authFetch 收到 401 时触发）自动回到登录页。
 */
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import {
  AuthUser, getStoredUser, clearAuth, login as apiLogin,
} from '@/services/auth';
import { IS_KIOSK } from '@/utils/device-profile';

interface AuthContextValue {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// 一体机自动登录：展机无人值守，不能每次重启/令牌过期都让人到触摸屏上手输
// 账号密码。凭据在构建期经 VITE_KIOSK_USERNAME / VITE_KIOSK_PASSWORD 注入
// （frontend/.env.web.local，专用低权限账号）；未配置时本逻辑完全不生效。
const KIOSK_USERNAME = import.meta.env.VITE_KIOSK_USERNAME as string | undefined;
const KIOSK_PASSWORD = import.meta.env.VITE_KIOSK_PASSWORD as string | undefined;
const KIOSK_AUTOLOGIN_RETRY_MS = 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  // 自动登录失败后的定时重试（后端暂时不可达时展机可自愈，而不是卡在登录页）
  const [retryTick, setRetryTick] = useState(0);
  const lastAttemptAt = useRef(0);

  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener('kb-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('kb-unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    if (user || !IS_KIOSK || !KIOSK_USERNAME || !KIOSK_PASSWORD) return undefined;
    // 冷却期内不重试（token 过期被 401 清空与手动登出都走这里，防失败风暴）
    if (Date.now() - lastAttemptAt.current < KIOSK_AUTOLOGIN_RETRY_MS) return undefined;
    lastAttemptAt.current = Date.now();
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    apiLogin(KIOSK_USERNAME, KIOSK_PASSWORD)
      .then((loggedIn) => {
        if (!cancelled) setUser(loggedIn);
      })
      .catch((err: unknown) => {
        console.warn('[auth] 一体机自动登录失败，60s 后重试：', err instanceof Error ? err.message : err);
        if (!cancelled) {
          retryTimer = setTimeout(() => setRetryTick((t) => t + 1), KIOSK_AUTOLOGIN_RETRY_MS);
        }
      });
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [user, retryTick]);

  const login = async (username: string, password: string) => {
    const loggedIn = await apiLogin(username, password);
    setUser(loggedIn);
    return loggedIn;
  };

  const logout = () => {
    clearAuth();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
