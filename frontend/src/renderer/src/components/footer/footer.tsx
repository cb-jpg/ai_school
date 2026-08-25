/* eslint-disable react/require-default-props */
import {
  Box, Textarea, IconButton, HStack,
} from '@chakra-ui/react';
import { BsMicFill, BsMicMuteFill, BsPaperclip } from 'react-icons/bs';
import { IoHandRightSharp } from 'react-icons/io5';
import { FiChevronDown } from 'react-icons/fi';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { InputGroup } from '@/components/ui/input-group';
import { footerStyles } from './footer-styles';
import AIStateIndicator from './ai-state-indicator';
import { useFooter } from '@/hooks/footer/use-footer';
import { AsrControls } from './asr-controls';

// Type definitions
interface FooterProps {
  isCollapsed?: boolean
  onToggle?: () => void
}

interface ToggleButtonProps {
  isCollapsed: boolean
  onToggle?: () => void
}

interface ActionButtonsProps {
  micOn: boolean
  onMicToggle: () => void
  onInterrupt: () => void
}

interface MessageInputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onCompositionStart: () => void
  onCompositionEnd: () => void
  micOn?: boolean
  onMicToggle?: () => void
}

// Reusable components
const ToggleButton = memo(({ isCollapsed, onToggle }: ToggleButtonProps) => (
  <Box
    {...footerStyles.footer.toggleButton}
    onClick={onToggle}
    color="whiteAlpha.500"
    style={{
      transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
    }}
  >
    <FiChevronDown />
  </Box>
));

ToggleButton.displayName = 'ToggleButton';

const ActionButtons = memo(({ micOn, onMicToggle, onInterrupt }: ActionButtonsProps) => (
  <HStack gap={2}>
    <IconButton
      aria-label={micOn ? '停止语音识别' : '开始语音识别'}
      title={micOn ? '停止语音识别' : '开始语音识别'}
      bg={micOn ? 'green.500' : 'red.500'}
      {...footerStyles.footer.actionButton}
      onClick={onMicToggle}
      _hover={{ transform: 'scale(1.05)', transition: 'all 0.2s' }}
      _active={{ scale: 0.95 }}
    >
      <Box as="span" display="flex" alignItems="center" justifyContent="center" fontSize="20px">
        {micOn ? <BsMicFill style={{ fontSize: '20px' }} /> : <BsMicMuteFill style={{ fontSize: '20px' }} />}
      </Box>
    </IconButton>
    <IconButton
      aria-label="Raise hand"
      bg="yellow.500"
      {...footerStyles.footer.actionButton}
      onClick={onInterrupt}
      _hover={{ transform: 'scale(1.05)', transition: 'all 0.2s' }}
      _active={{ scale: 0.95 }}
    >
      <IoHandRightSharp style={{ fontSize: '20px' }} />
    </IconButton>
  </HStack>
));

ActionButtons.displayName = 'ActionButtons';

const MessageInput = memo(({
  value,
  onChange,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  micOn = false,
  onMicToggle,
}: MessageInputProps) => {
  const { t } = useTranslation();

  return (
    <InputGroup flex={1}>
      <Box position="relative" width="100%" display="flex" alignItems="center" gap="2">
        {/* Left side - Attachment icon and input */}
        <Box position="relative" flex={1} display="flex" alignItems="center">
          <IconButton
            aria-label="Attach file"
            variant="ghost"
            {...footerStyles.footer.attachButton}
          >
            <BsPaperclip size={18} />
          </IconButton>
          <Textarea
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            placeholder={t('footer.typeYourMessage')}
            {...footerStyles.footer.input}
            paddingRight="60px" // 确保右侧有足够空间
          />
        </Box>

        {/* Right side - Microphone button - 绝对定位在输入框右侧 */}
        <IconButton
          aria-label={micOn ? '停止语音识别' : '开始语音识别'}
          title={micOn ? '停止语音识别' : '开始语音识别'}
          bg={micOn ? 'green.500' : 'red.500'}
          width="45px"
          height="45px"
          minWidth="45px"
          minHeight="45px"
          borderRadius="10px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          onClick={onMicToggle}
          _hover={{ transform: 'scale(1.05)', transition: 'all 0.2s' }}
          _active={{ scale: 0.95 }}
          color="white"
          padding={0}
          position="relative"
          zIndex={10}
        >
          {micOn ? (
            <BsMicFill style={{ fontSize: '22px', color: 'white' }} />
          ) : (
            <BsMicMuteFill style={{ fontSize: '22px', color: 'white' }} />
          )}
        </IconButton>
      </Box>
    </InputGroup>
  );
});

MessageInput.displayName = 'MessageInput';

// Main component
function Footer({ isCollapsed = false, onToggle }: FooterProps): JSX.Element {
  const {
    inputValue,
    handleInputChange,
    handleKeyPress,
    handleCompositionStart,
    handleCompositionEnd,
    handleInterrupt,
    handleMicToggle,
    micOn,
    asr,
  } = useFooter();

  return (
    <Box {...footerStyles.footer.container(isCollapsed)}>
      <ToggleButton isCollapsed={isCollapsed} onToggle={onToggle} />

      <Box pt="0" px="4">
        <HStack width="100%" gap={4}>
          <Box>
            <Box mb="1.5">
              <AIStateIndicator />
            </Box>
            <ActionButtons
              micOn={micOn}
              onMicToggle={handleMicToggle}
              onInterrupt={handleInterrupt}
            />
          </Box>

          <MessageInput
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            micOn={micOn}
            onMicToggle={handleMicToggle}
          />
        </HStack>
        <AsrControls {...asr} />
      </Box>
    </Box>
  );
}

export default Footer;
