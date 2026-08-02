import { Box } from '@chakra-ui/react';
import { AsrMode } from '@/hooks/footer/use-dual-asr';

type AsrControlsProps = {
  mode: AsrMode;
  setMode: (mode: AsrMode) => void;
  status: string;
  interimText: string;
  actualPath: string;
  lastError: string;
  recording: boolean;
};

export function AsrControls({ mode, setMode, status, interimText, actualPath, lastError, recording }: AsrControlsProps) {
  return (
    <Box
      display="flex"
      alignItems="center"
      gap="8px"
      mt="8px"
      px="8px"
      minHeight="30px"
      flexWrap="wrap"
      fontSize="12px"
      color="whiteAlpha.900"
      bg="whiteAlpha.100"
      borderRadius="8px"
    >
      <label htmlFor="verification-asr-mode">ASR</label>
      <select
        id="verification-asr-mode"
        aria-label="ASR mode"
        value={mode}
        onChange={(event) => setMode(event.target.value as AsrMode)}
        style={{ background: '#242424', color: 'white', border: '1px solid #666', padding: '4px' }}
      >
        <option value="auto">自动选择</option>
        <option value="web_speech">浏览器语音识别</option>
        <option value="sherpa_onnx">服务器本地识别</option>
      </select>
      <span>{recording ? '正在录音；说完后可再次点击绿色麦克风结束' : status}</span>
      {actualPath && <span>本轮 ASR：{actualPath}</span>}
      {lastError && <span style={{ color: '#FEB2B2' }}>Web Speech 错误：{lastError}</span>}
      {interimText && <span style={{ opacity: 0.65 }}>临时：{interimText}</span>}
      <span style={{ opacity: 0.65 }}>浏览器语音识别服务可能由浏览器供应商提供。</span>
    </Box>
  );
}
