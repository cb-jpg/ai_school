/**
 * 认证上下文：当前登录用户（admin/editor）与登录/登出操作。
 * 监听 kb-unauthorized 事件（authFetch 收到 401 时触发）自动回到登录页。
 */
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  AuthUser, getStoredUser, clearAuth, login as apiLogin,
} from '@/services/auth';

interface AuthContextValue {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());

  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener('kb-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('kb-unauthorized', handleUnauthorized);
  }, []);

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
