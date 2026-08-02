import { ChangeEvent, KeyboardEvent } from 'react';
import { useVAD } from '@/context/vad-context';
import { useTextInput } from '@/hooks/footer/use-text-input';
import { useInterrupt } from '@/hooks/utils/use-interrupt';
import { useAiState, AiStateEnum } from '@/context/ai-state-context';
import { useTriggerSpeak } from '@/hooks/utils/use-trigger-speak';
import { useProactiveSpeak } from '@/context/proactive-speak-context';
import { useDualAsr } from '@/hooks/footer/use-dual-asr';
import { useWebSocket } from '@/context/websocket-context';

export const useFooter = () => {
  const {
    inputText: inputValue,
    setInputText: handleChange,
    handleKeyPress: handleKey,
    handleCompositionStart,
    handleCompositionEnd,
    submitText,
  } = useTextInput();

  const { interrupt } = useInterrupt();
  const { startMic, stopMic, autoStartMicOn, micOn } = useVAD();
  const { setAiState, aiState } = useAiState();
  const { sendTriggerSignal } = useTriggerSpeak();
  const { settings } = useProactiveSpeak();
  const { wsState } = useWebSocket();
  const asr = useDualAsr(submitText);

  const handleMicToggle = async () => {
    if (asr.recording) {
      await asr.stop();
    } else {
      // The legacy VAD path is started automatically by the websocket
      // handshake. Stop it while the manual dual-ASR session owns the mic;
      // otherwise two recognizers can submit competing utterances.
      if (micOn) stopMic();
      await asr.start();
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    handleChange({ target: { value: e.target.value } } as ChangeEvent<HTMLInputElement>);
    setAiState(AiStateEnum.WAITING);
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    handleKey(e as any);
  };

  const handleInterrupt = () => {
    if (aiState === AiStateEnum.THINKING_SPEAKING) {
      interrupt();
      if (autoStartMicOn) {
        startMic();
      }
    } else if (settings.allowButtonTrigger) {
      sendTriggerSignal(-1);
    }
  };

  return {
    inputValue,
    handleInputChange,
    handleKeyPress,
    handleCompositionStart,
    handleCompositionEnd,
    handleInterrupt,
    handleMicToggle,
    micOn: asr.recording,
    asr: { ...asr, wsState },
  };
};
