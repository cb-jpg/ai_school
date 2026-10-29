/* eslint-disable no-sparse-arrays */
/* eslint-disable react-hooks/exhaustive-deps */
// eslint-disable-next-line object-curly-newline
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { wsService, MessageEvent } from '@/services/websocket-service';
import {
  WebSocketContext, HistoryInfo, defaultWsUrl, defaultBaseUrl,
  normalizeWsUrl, normalizeBaseUrl,
} from '@/context/websocket-context';
import { ModelInfo, useLive2DConfig } from '@/context/live2d-config-context';
import { useSubtitle } from '@/context/subtitle-context';
import { audioTaskQueue } from '@/utils/task-queue';
import { useAudioTask } from '@/components/canvas/live2d';
import { useBgUrl } from '@/context/bgurl-context';
import { useConfig } from '@/context/character-config-context';
import { useChatHistory } from '@/context/chat-history-context';
import { toaster } from '@/components/ui/toaster';
import { useVAD } from '@/context/vad-context';
import { AiState, useAiState } from "@/context/ai-state-context";
import { useLocalStorage } from '@/hooks/utils/use-local-storage';
import { useGroup } from '@/context/group-context';
import { useInterrupt } from '@/hooks/utils/use-interrupt';
import { useBrowser } from '@/context/browser-context';
import { useAuth } from '@/context/auth-context';
import { setGuestMode, useGuestMode } from '@/utils/guest-mode';
import { fetchLive2dModels } from '@/services/live2d-models-api';

function WebSocketHandler({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [wsState, setWsState] = useState<string>('CLOSED');
  const [storedWsUrl, persistWsUrl] = useLocalStorage<string>('wsUrl', defaultWsUrl);
  const [storedBaseUrl, persistBaseUrl] = useLocalStorage<string>('baseUrl', defaultBaseUrl);
  const wsUrl = normalizeWsUrl(storedWsUrl);
  const baseUrl = normalizeBaseUrl(storedBaseUrl);
  const setWsUrl = (url: string) => persistWsUrl(url);
  const setBaseUrl = (url: string) => persistBaseUrl(url);
  const { aiState, setAiState, backendSynthComplete, setBackendSynthComplete } = useAiState();
  const { modelInfo, setModelInfo } = useLive2DConfig();
  const { setSubtitleText } = useSubtitle();
  const { clearResponse, setForceNewMessage, appendHumanMessage, appendOrUpdateToolCallMessage } = useChatHistory();
  const { addAudioTask } = useAudioTask();
  const bgUrlContext = useBgUrl();
  const { confUid, setConfName, setConfUid, setConfigFiles } = useConfig();
  const [pendingModelInfo, setPendingModelInfo] = useState<ModelInfo | undefined>(undefined);
  // WS 模型推送的“对话页外暂存”（2026-10-27 双影报障修复）：真机上
  // releaseInstance+initializeLive2D 的 GL 全量重建是已知脆弱操作，
  // 用户在首页/栏目/新闻浏览时收到推送（kiosk 自动重登、断线重连、后台
  // 换模型）不就地换模型，暂存到进入对话页（#/hero）再应用。
  const pendingDialogModelRef = useRef<ModelInfo | undefined>(undefined);
  // setModelInfo 的去重需要当前模型 identity；避免把 modelInfo 塞进大回调依赖
  const modelUrlRef = useRef<string | undefined>(undefined);
  const { setSelfUid, setGroupMembers, setIsOwner } = useGroup();
  const { startMic, stopMic, autoStartMicOnConvEnd } = useVAD();
  const autoStartMicOnConvEndRef = useRef(autoStartMicOnConvEnd);
  const { interrupt } = useInterrupt();
  const { setBrowserViewData } = useBrowser();

  useEffect(() => {
    autoStartMicOnConvEndRef.current = autoStartMicOnConvEnd;
  }, [autoStartMicOnConvEnd]);

  useEffect(() => {
    if (storedWsUrl !== wsUrl) {
      console.info('[WebSocket] migrated legacy URL', { from: storedWsUrl, to: wsUrl });
      persistWsUrl(wsUrl);
    }
    if (storedBaseUrl !== baseUrl) {
      console.info('[WebSocket] migrated legacy base URL', { from: storedBaseUrl, to: baseUrl });
      persistBaseUrl(baseUrl);
    }
  }, [baseUrl, storedBaseUrl, storedWsUrl, wsUrl]);

  useEffect(() => {
    if (pendingModelInfo && confUid) {
      setModelInfo(pendingModelInfo);
      setPendingModelInfo(undefined);
    }
  }, [pendingModelInfo, setModelInfo, confUid]);

  useEffect(() => {
    modelUrlRef.current = modelInfo?.url;
  }, [modelInfo?.url]);

  // 同模型推送去重 + 对话页外暂存（2026-10-27 双影报障修复）
  const applyOrStashModel = useCallback((incoming: ModelInfo) => {
    // identity = 去协议/主机的路径（与 use-live2d-model 的身份比对同法）：
    // WS 每次重连都会推 set-model-and-conf，同模型重复推送不值得触发
    // 状态涟漪和加载闪烁
    const pathOf = (u: string) => {
      try {
        return new URL(u, window.location.origin).pathname;
      } catch {
        return u;
      }
    };
    const sameModel =
      !!modelUrlRef.current &&
      pathOf(incoming.url) === pathOf(modelUrlRef.current);
    if (sameModel) return;
    if (window.location.hash !== '#/hero') {
      pendingDialogModelRef.current = incoming;
      return;
    }
    setModelInfo(incoming);
  }, [setModelInfo]);

  // 进入对话页时应用暂存的模型推送（浏览中收到的推送在此刻才动画布）
  useEffect(() => {
    const flush = () => {
      if (window.location.hash !== '#/hero') return;
      const pending = pendingDialogModelRef.current;
      if (!pending) return;
      pendingDialogModelRef.current = undefined;
      setModelInfo(pending);
    };
    window.addEventListener('hashchange', flush);
    flush();
    return () => window.removeEventListener('hashchange', flush);
  }, [setModelInfo]);

  const {
    setCurrentHistoryUid, setMessages, setHistoryList,
  } = useChatHistory();
  // 连接建立后待执行的"恢复上次对话"标志（首连和每次重连都要恢复一次）
  const pendingRestoreRef = useRef(false);

  const handleControlMessage = useCallback((controlText: string) => {
    switch (controlText) {
      case 'start-mic':
        // 后端在连接建立时会无条件推送 start-mic（上游行为）。本产品要求麦克风
        // 只能由用户按键开启：首页/专题页没有对话输入区，若照做会出现"没人
        // 对话却在录音"（2026-09-09 用户反馈）。这里改为忽略，麦克风仅由
        // 输入框麦克风键 / 各页面显式交互开启。
        console.log('Ignored backend start-mic (mic is user-controlled in this app)');
        break;
      case 'stop-mic':
        console.log('Stopping microphone...');
        stopMic();
        break;
      case 'conversation-chain-start':
        setAiState('thinking-speaking');
        audioTaskQueue.clearQueue();
        clearResponse();
        break;
      case 'conversation-chain-end':
        audioTaskQueue.addTask(() => new Promise<void>((resolve) => {
          setAiState((currentState: AiState) => {
            if (currentState === 'thinking-speaking') {
              // Auto start mic if enabled
              if (autoStartMicOnConvEndRef.current) {
                startMic();
              }
              return 'idle';
            }
            return currentState;
          });
          resolve();
        }));
        break;
      default:
        console.warn('Unknown control command:', controlText);
    }
  }, [setAiState, clearResponse, setForceNewMessage, startMic, stopMic]);

  const handleWebSocketMessage = useCallback((message: MessageEvent) => {
    console.log('Received message from server:', message);
    switch (message.type) {
      case 'control':
        if (message.text) {
          handleControlMessage(message.text);
        }
        break;
      case 'set-model-and-conf':
        setAiState('loading');
        if (message.conf_name) {
          setConfName(message.conf_name);
        }
        if (message.conf_uid) {
          setConfUid(message.conf_uid);
          console.log('confUid', message.conf_uid);
        }
        if (message.client_uid) {
          setSelfUid(message.client_uid);
        }
        // Directly set model info instead of using pending
        if (message.model_info) {
          if (!message.model_info.url.startsWith("http")) {
            const modelUrl = baseUrl + message.model_info.url;
            // eslint-disable-next-line no-param-reassign
            message.model_info.url = modelUrl;
          }
          applyOrStashModel(message.model_info);
          console.log('Model info set:', message.model_info);
        }

        setAiState('idle');
        break;
      case 'full-text':
        // 连接问候语只进日志不进字幕条（2026-09-26 修复：连接后字幕条残留 Connection established）
        if (message.text && !/^connection established$/i.test(message.text.trim())) {
          setSubtitleText(message.text);
        }
        break;
      case 'rag-status':
        // 学校知识库检索状态（2026-10-14 用户要求关掉"已检索到 N 条相关资料"弹条，仅留状态不打扰）
        break;
      case 'web-status':
        // 联网检索（2026-09-20 需求 #4）：本次回答结合了网上最新信息
        if (message.used) {
          toaster.create({
            title: '已结合网上最新信息作答',
            type: 'info',
            duration: 2500,
          });
        }
        break;
      case 'config-files':
        if (message.configs) {
          setConfigFiles(message.configs);
        }
        break;
      case 'config-switched':
        setAiState('idle');
        setSubtitleText(t('notification.characterLoaded'));

        toaster.create({
          title: t('notification.characterSwitched'),
          type: 'success',
          duration: 2000,
        });

        // setModelInfo(undefined);

        wsService.sendMessage({ type: 'fetch-history-list' });
        wsService.sendMessage({ type: 'create-new-history' });
        break;
      case 'background-files':
        if (message.files) {
          bgUrlContext?.setBackgroundFiles(message.files);
        }
        break;
      case 'audio':
        if (aiState === 'interrupted' || aiState === 'listening') {
          console.log('Audio playback intercepted. Sentence:', message.display_text?.text);
        } else {
          console.log("actions", message.actions);
          addAudioTask({
            audioBase64: message.audio || '',
            volumes: message.volumes || [],
            sliceLength: message.slice_length || 0,
            displayText: message.display_text || null,
            expressions: message.actions?.expressions || null,
            forwarded: message.forwarded || false,
          });
        }
        break;
      case 'history-data':
        if (message.messages) {
          setMessages(message.messages);
        }
        break;
      case 'new-history-created':
        setAiState('idle');
        setSubtitleText(t('notification.newConversation'));
        // No need to open mic here
        if (message.history_uid) {
          setCurrentHistoryUid(message.history_uid);
          setMessages([]);
          const newHistory: HistoryInfo = {
            uid: message.history_uid,
            latest_message: null,
            timestamp: new Date().toISOString(),
          };
          setHistoryList((prev: HistoryInfo[]) => [newHistory, ...prev]);
          toaster.create({
            title: t('notification.newChatHistory'),
            type: 'success',
            duration: 2000,
          });
        }
        break;
      case 'history-deleted':
        toaster.create({
          title: message.success
            ? t('notification.historyDeleteSuccess')
            : t('notification.historyDeleteFail'),
          type: message.success ? 'success' : 'error',
          duration: 2000,
        });
        break;
      case 'history-list':
        if (message.histories) {
          setHistoryList(message.histories);
          // 每次连接建立后的首次 history-list：恢复上次对话而非开新对话。
          // 重连也要恢复——服务端每个连接的 context.history_uid 从 None 起步，
          // 不 fetch-and-set 回去的话，后续对话不会存盘、LLM 也没有之前记忆。
          if (pendingRestoreRef.current) {
            pendingRestoreRef.current = false;
            let savedUid: string | null = null;
            try {
              savedUid = localStorage.getItem('chatHistoryUid');
            } catch {
              // localStorage 不可用时视为无存档
            }
            const target = message.histories.find((h) => h.uid === savedUid)?.uid
              ?? message.histories[0]?.uid
              ?? null;
            if (target) {
              setCurrentHistoryUid(target);
              wsService.sendMessage({ type: 'fetch-and-set-history', history_uid: target });
            } else {
              wsService.sendMessage({ type: 'create-new-history' });
            }
          }
        }
        break;
      case 'user-input-transcription':
        console.log('user-input-transcription: ', message.text);
        if (message.text) {
          appendHumanMessage(message.text);
        }
        break;
      case 'error':
        toaster.create({
          title: message.message,
          type: 'error',
          duration: 2000,
        });
        break;
      case 'group-update':
        console.log('Received group-update:', message.members);
        if (message.members) {
          setGroupMembers(message.members);
        }
        if (message.is_owner !== undefined) {
          setIsOwner(message.is_owner);
        }
        break;
      case 'group-operation-result':
        toaster.create({
          title: message.message,
          type: message.success ? 'success' : 'error',
          duration: 2000,
        });
        break;
      case 'backend-synth-complete':
        setBackendSynthComplete(true);
        break;
      case 'conversation-chain-end':
        if (!audioTaskQueue.hasTask()) {
          setAiState((currentState: AiState) => {
            if (currentState === 'thinking-speaking') {
              return 'idle';
            }
            return currentState;
          });
        }
        break;
      case 'force-new-message':
        setForceNewMessage(true);
        break;
      case 'interrupt-signal':
        // Handle forwarded interrupt
        interrupt(false); // do not send interrupt signal to server
        break;
      case 'tool_call_status':
        if (message.tool_id && message.tool_name && message.status) {
          // If there's browser view data included, store it in the browser context
          if (message.browser_view) {
            console.log('Browser view data received:', message.browser_view);
            setBrowserViewData(message.browser_view);
          }

          appendOrUpdateToolCallMessage({
            id: message.tool_id,
            type: 'tool_call_status',
            role: 'ai',
            tool_id: message.tool_id,
            tool_name: message.tool_name,
            name: message.name,
            status: message.status as ('running' | 'completed' | 'error'),
            content: message.content || '',
            timestamp: message.timestamp || new Date().toISOString(),
          });
        } else {
          console.warn('Received incomplete tool_call_status message:', message);
        }
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }, [aiState, addAudioTask, appendHumanMessage, applyOrStashModel, baseUrl, bgUrlContext, setAiState, setConfName, setConfUid, setConfigFiles, setCurrentHistoryUid, setHistoryList, setMessages, setModelInfo, setSubtitleText, startMic, stopMic, setSelfUid, setGroupMembers, setIsOwner, backendSynthComplete, setBackendSynthComplete, clearResponse, handleControlMessage, appendOrUpdateToolCallMessage, interrupt, setBrowserViewData, t]);

  // 连接门禁：按身份三元组决定连不连（2026-10-29 游客模式扩展）——
  // 登录用户（user:<name>，带 user_token）/ 游客（'guest'，匿名连接，
  // 服务端不存档+名单类资料不检索+每日限次）/ 匿名浏览（null，不连）。
  // 必须消费 AuthContext（而非渲染时读 localStorage）：本组件不是 AuthContext
  // 消费者时，登录/登出不会引发重渲染，门禁 effect 不跑 → App 内登录后永远不连接。
  const { user: authUser } = useAuth();
  const authUsername = authUser?.username ?? null;
  const guestMode = useGuestMode();
  // 登录即退出游客模式：门禁/横幅都按登录态隐藏，残留的游客标记会让下次
  // 登出后直接以游客态落进对话页
  useEffect(() => {
    if (authUsername && guestMode) {
      setGuestMode(false);
    }
  }, [authUsername, guestMode]);
  // 身份变化即断开重连：登出、切账号、进出游客模式都走同一条路径；
  // 旧身份的对话存档不再适用，交给恢复逻辑回退（游客没有存档可回退）
  const activeIdentity = authUsername
    ? `user:${authUsername}`
    : guestMode
      ? 'guest'
      : null;
  const prevIdentityRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevIdentityRef.current !== activeIdentity) {
      if (prevIdentityRef.current !== null) {
        wsService.disconnect();
        try {
          localStorage.removeItem('chatHistoryUid');
        } catch {
          // ignore
        }
      }
      prevIdentityRef.current = activeIdentity;
    }
    if (!activeIdentity) {
      return;
    }
    wsService.connect(wsUrl);
  }, [wsUrl, activeIdentity]);

  // 模型兜底（2026-10-24 手机端「人物消失」修复，取代 2026-09-22 的仅匿名版）：
  // 原版 `if (authUsername) return` 让登录态的模型完全依赖 WS set-model-and-conf
  // 下发——手机真机 WS 可能因陈旧本地状态（wsUrl/令牌过期）静默连不上，模型
  // url 一直为空，人物永久空白（10-24 用户报障，服务器日志实证：/info 拉到、
  // /undefined/undefined.model3.json 401、无任何模型文件请求、无 WS 握手）。
  // 改为：无论登录与否，modelInfo.url 为空即兜底——匿名立即拉公开 /info；
  // 登录态给 WS 下发 6s 宽限，仍无模型再拉同一公开 /info 展示默认角色（仅展示，
  // 对话仍须 WS）。WS 恢复后 set-model-and-conf 推同模型时 use-live2d-model 按
  // 身份比对不重载，推异模型则正常覆盖。
  useEffect(() => {
    if (modelInfo?.url) return undefined;
    let cancelled = false;
    const applyDefault = () => {
      fetchLive2dModels()
        .then((characters) => {
          if (cancelled || characters.length === 0) return;
          // 默认角色与服务器当前角色一致（2026-10-16 起为自研「小石同学」校服版模型）；
          // 列表里没有时退回第一项
          const character =
            characters.find((item) => item.id === 'xiaoshi') ?? characters[0];
          setModelInfo({
            name: character.id,
            url: character.modelPath,
            kScale: character.kScale,
            initialXshift: character.initialXshift,
            initialYshift: character.initialYshift,
            idleMotionGroupName: character.idleMotionGroupName,
            emotionMap: character.emotionMap,
            tapMotions: character.tapMotions,
          });
        })
        .catch((error) => {
          console.warn('[WebSocket] default model fallback failed:', error);
        });
    };
    if (authUsername) {
      // 登录态：等 WS 推送 6s（连接+下发通常 1~2s），逾期才兜底
      const timer = window.setTimeout(applyDefault, 6000);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }
    applyDefault();
    return () => {
      cancelled = true;
    };
  }, [authUsername, modelInfo?.url, setModelInfo]);

  // 开场语音声明（合规 2026-10-14：音频模态显式标识）——进入对话页时播报一次
  // 「内容由 AI 生成」提示，走 static-narration 通道直接 TTS，不经 LLM。
  // 每页面加载至多一次；2026-10-19 起改到 #/hero 触发（用户报：登录重开 App
  // 落在首页就出声像"对话已开始"）——连接先开则进门即播，先在门户逛则
  // 进对话页那一刻播；后台管理页（#/main*）不播；延迟 1.2s 等连接收尾消息落定。
  const aiDisclaimerSentRef = useRef(false);
  const wsOpenRef = useRef(false);
  const maybeSendAiDisclaimer = useCallback(() => {
    if (aiDisclaimerSentRef.current) return;
    if (!wsOpenRef.current) return;
    if (!window.location.hash.startsWith('#/hero')) return;
    aiDisclaimerSentRef.current = true;
    window.setTimeout(() => {
      wsService.sendMessage({
        type: 'static-narration',
        title: '开场提示',
        segments: ['你好呀，我是小石同学。我的部分内容由人工智能生成，请注意甄别哦。'],
        narration_id: `ai-disclaimer-${Date.now()}`,
      });
    }, 1200);
  }, []);

  useEffect(() => {
    const stateSubscription = wsService.onStateChange((state) => {
      setWsState(state);
      if (state === 'OPEN') {
        pendingRestoreRef.current = true;
      }
      wsOpenRef.current = state === 'OPEN';
      maybeSendAiDisclaimer();
    });
    const messageSubscription = wsService.onMessage(handleWebSocketMessage);
    window.addEventListener('hashchange', maybeSendAiDisclaimer);
    return () => {
      stateSubscription.unsubscribe();
      messageSubscription.unsubscribe();
      window.removeEventListener('hashchange', maybeSendAiDisclaimer);
    };
  }, [wsUrl, handleWebSocketMessage, maybeSendAiDisclaimer]);

  const webSocketContextValue = useMemo(() => ({
    sendMessage: wsService.sendMessage.bind(wsService),
    wsState,
    reconnect: () => wsService.connect(wsUrl),
    wsUrl,
    setWsUrl,
    baseUrl,
    setBaseUrl,
  }), [wsState, wsUrl, baseUrl]);

  return (
    <WebSocketContext.Provider value={webSocketContextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export default WebSocketHandler;
