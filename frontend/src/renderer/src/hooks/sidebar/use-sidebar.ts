import { useState, useCallback } from 'react';
import { useWebSocket } from '@/context/websocket-context';
import { useInterrupt } from '@/components/canvas/live2d';
import { useChatHistory } from '@/context/chat-history-context';
import { useMode, ModeType } from '@/context/mode-context';

export const useSidebar = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { sendMessage } = useWebSocket();
  const { interrupt } = useInterrupt();
  const { currentHistoryUid, messages, updateHistoryList } = useChatHistory();
  const { setMode, mode, isElectron } = useMode();

  const onSettingsOpen = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const onSettingsClose = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const createNewHistory = (): void => {
    if (currentHistoryUid && messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      updateHistoryList(currentHistoryUid, latestMessage);
    }

    interrupt();
    sendMessage({
      type: 'create-new-history',
    });
  };

  return {
    settingsOpen,
    onSettingsOpen,
    onSettingsClose,
    createNewHistory,
    setMode,
    currentMode: mode,
    isElectron,
  };
};
