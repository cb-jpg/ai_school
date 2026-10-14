import { Box, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { canvasStyles } from './canvas-styles';
import { useSubtitleDisplay } from '@/hooks/canvas/use-subtitle-display';
import { useSubtitle } from '@/context/subtitle-context';
import { siteTheme } from '@/components/hero/site-theme';

// Type definitions
interface SubtitleTextProps {
  text: string
}

// Reusable components
const SubtitleText = memo(({ text }: SubtitleTextProps) => (
  <Text data-testid="subtitle-text" {...canvasStyles.subtitle.text}>
    {text}
  </Text>
));

SubtitleText.displayName = 'SubtitleText';

// Main component
const Subtitle = memo((): JSX.Element | null => {
  const { subtitleText, isLoaded } = useSubtitleDisplay();
  const { showSubtitle } = useSubtitle();

  if (!isLoaded || !subtitleText || !showSubtitle) return null;

  return (
    <Box
      textAlign="center"
      padding="0"
      borderRadius="0"
      minWidth="auto"
      maxWidth="100%"
      backgroundColor="transparent"
    >
      {/* AI 生成内容显式标识（合规 2026-10-14：音频模态播放期间字幕条随行小标） */}
      <Box
        as="span"
        display="inline-block"
        verticalAlign="middle"
        mr={2}
        px={2}
        py="1px"
        rounded="full"
        bg="rgba(13, 34, 65, 0.55)"
        color="white"
        fontSize={{ base: '10px', md: '11px' }}
        lineHeight="1.5"
        data-testid="ai-generated-badge"
      >
        AI生成
      </Box>
      <Text
        as="span"
        color={siteTheme.navy}
        fontSize={{ base: 'md', md: 'lg' }}
        textAlign="center"
        lineHeight="1.6"
        whiteSpace="pre-wrap"
        fontWeight="medium"
        fontFamily="'Helvetica Neue', Arial, sans-serif"
        verticalAlign="middle"
      >
        {subtitleText}
      </Text>
    </Box>
  );
});

Subtitle.displayName = 'Subtitle';

export default Subtitle;
