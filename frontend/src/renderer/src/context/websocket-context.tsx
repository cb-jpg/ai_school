/* eslint-disable react/jsx-no-constructed-context-values */
import React, {
  useContext, useCallback, useEffect,
} from 'react';
import { wsService } from '@/services/websocket-service';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';

const LEGACY_WS_URL = 'ws://127.0.0.1:12393/client-ws';
const LEGACY_BASE_URL = 'http://127.0.0.1:12393';

const getDefaultUrls = () => {
  if (typeof window !== 'undefined' && ['http:', 'https:'].includes(window.location.protocol)) {
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
};

const defaults = getDefaultUrls();
const DEFAULT_WS_URL = defaults.wsUrl;
const DEFAULT_BASE_URL = defaults.baseUrl;

const LEGACY_WS_URLS = new Set([
  LEGACY_WS_URL,
  'ws://localhost:12393/client-ws',
]);
const LEGACY_BASE_URLS = new Set([
  LEGACY_BASE_URL,
  'http://localhost:12393',
]);

export const normalizeWsUrl = (value: string) => (
  DEFAULT_WS_URL !== LEGACY_WS_URL && LEGACY_WS_URLS.has(value) ? DEFAULT_WS_URL : value
);

export const normalizeBaseUrl = (value: string) => (
  DEFAULT_BASE_URL !== LEGACY_BASE_URL && LEGACY_BASE_URLS.has(value) ? DEFAULT_BASE_URL : value
);

export interface HistoryInfo {
  uid: string;
  latest_message: {
    role: 'human' | 'ai';
    timestamp: string;
    content: string;
  } | null;
  timestamp: string | null;
}

interface WebSocketContextProps {
  sendMessage: (message: object) => boolean;
  wsState: string;
  reconnect: () => void;
  wsUrl: string;
  setWsUrl: (url: string) => void;
  baseUrl: string;
  setBaseUrl: (url: string) => void;
}

export const WebSocketContext = React.createContext<WebSocketContextProps>({
  sendMessage: wsService.sendMessage.bind(wsService),
  wsState: 'CLOSED',
  reconnect: () => wsService.connect(DEFAULT_WS_URL),
  wsUrl: DEFAULT_WS_URL,
  setWsUrl: () => {},
  baseUrl: DEFAULT_BASE_URL,
  setBaseUrl: () => {},
});

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

export const defaultWsUrl = DEFAULT_WS_URL;
export const defaultBaseUrl = DEFAULT_BASE_URL;

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [storedWsUrl, setStoredWsUrl] = useLocalStorage('wsUrl', DEFAULT_WS_URL);
  const [storedBaseUrl, setStoredBaseUrl] = useLocalStorage('baseUrl', DEFAULT_BASE_URL);
  const wsUrl = normalizeWsUrl(storedWsUrl);
  const baseUrl = normalizeBaseUrl(storedBaseUrl);
  const setWsUrl = useCallback((url: string) => setStoredWsUrl(url), [setStoredWsUrl]);
  const setBaseUrl = useCallback((url: string) => setStoredBaseUrl(url), [setStoredBaseUrl]);

  useEffect(() => {
    if (storedWsUrl !== wsUrl) setStoredWsUrl(wsUrl);
    if (storedBaseUrl !== baseUrl) setStoredBaseUrl(baseUrl);
  }, [baseUrl, storedBaseUrl, storedWsUrl, wsUrl]);

  const handleSetWsUrl = useCallback((url: string) => {
    setWsUrl(url);
    wsService.connect(url);
  }, [setWsUrl]);

  const value = {
    sendMessage: wsService.sendMessage.bind(wsService),
    wsState: 'CLOSED',
    reconnect: () => wsService.connect(wsUrl),
    wsUrl,
    setWsUrl: handleSetWsUrl,
    baseUrl,
    setBaseUrl,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
