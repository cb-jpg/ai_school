import { useCallback, useState } from 'react';
import { useWebSocket } from '@/context/websocket-context';
import { useAiState } from '@/context/ai-state-context';
import { useInterrupt } from '@/components/canvas/live2d';
import { useChatHistory } from '@/context/chat-history-context';
import { useVAD } from '@/context/vad-context';
import { useMediaCapture } from '@/hooks/utils/use-media-capture';

export function useTextInput() {
  const [inputText, setInputText] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const wsContext = useWebSocket();
  const { aiState, setAiState } = useAiState();
  const { interrupt } = useInterrupt();
  const { appendHumanMessage } = useChatHistory();
  const { stopMic, autoStopMic } = useVAD();
  const { captureAllMedia } = useMediaCapture();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };

  const submitText = useCallback(async (text: string, inputType = 'text') => {
    if (!text.trim() || !wsContext) return;
    if (aiState === 'thinking-speaking') {
      interrupt();
    }

    const images = await captureAllMedia();

    const utteranceId = crypto.randomUUID();
    const sent = wsContext.sendMessage({
      type: 'text-input',
      text: text.trim(),
      images,
      utterance_id: utteranceId,
      input_type: inputType,
    });
    if (!sent) {
      throw new Error(`websocket-not-open: ${wsContext.wsState}`);
    }
    appendHumanMessage(text.trim());

    setAiState('thinking-speaking');
    if (autoStopMic) stopMic();
    setInputText('');
  }, [aiState, appendHumanMessage, autoStopMic, captureAllMedia, inputText, interrupt, setAiState, stopMic, wsContext]);

  const handleSend = async () => {
    try {
      await submitText(inputText, 'text');
    } catch (error) {
      console.error('Failed to submit text:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCompositionStart = () => setIsComposing(true);
  const handleCompositionEnd = () => setIsComposing(false);

  return {
    inputText,
    setInputText: handleInputChange,
    handleSend,
    submitText,
    handleKeyPress,
    handleCompositionStart,
    handleCompositionEnd,
  };
}
