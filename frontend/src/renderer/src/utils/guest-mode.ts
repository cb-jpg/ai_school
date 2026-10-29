import { useSyncExternalStore } from 'react';

/**
 * 游客模式（2026-10-29）：未登录也能进入对话页和小石同学聊天。
 * 服务端按匿名会话处理——对话不存档（刷新即清）、名单类知识条目不参与检索、
 * 每连接每日限次；登录用户不受影响。
 *
 * 状态被 App（门禁浮层/游客横幅）和 WebSocketHandler（连接门禁）两个
 * 互不为父子关系的组件消费，用 useSyncExternalStore + localStorage 持久化
 * 做跨组件共享：刷新页面后仍停留在游客态，与 wsUrl/modelInfo 等本地态同款行为。
 */
const STORAGE_KEY = 'guestMode';

let cached: boolean | null = null;
const listeners = new Set<() => void>();

function readGuestMode(): boolean {
  if (cached !== null) return cached;
  try {
    cached = localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    cached = false; // localStorage 不可用（隐私模式等）时仅当次会话内生效
  }
  return cached;
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

export function setGuestMode(value: boolean): void {
  cached = value;
  try {
    if (value) {
      localStorage.setItem(STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore：存储不可用时状态仍保存在内存里
  }
  emitChange();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // 其他标签页/窗口开关游客模式时跟随（storage 事件只在异源窗口触发）
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      cached = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useGuestMode(): boolean {
  return useSyncExternalStore(subscribe, readGuestMode, () => false);
}
