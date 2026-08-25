import { Box, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { canvasStyles } from './canvas-styles';
import { useSubtitleDisplay } from '@/hooks/canvas/use-subtitle-display';
import { useSubtitle } from '@/context/subtitle-context';

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
      sx={{
        textAlign: 'center',
        padding: '0',
        borderRadius: '0',
        minWidth: 'auto',
        maxWidth: '100%',
        backgroundColor: 'transparent',
      }}
    >
      <Text
        sx={{
          color: '#1E5494',
          fontSize: { base: 'md', md: 'lg' },
          textAlign: 'center',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          fontWeight: 'medium',
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
        }}
      >
        {subtitleText}
      </Text>
    </Box>
  );
});

Subtitle.displayName = 'Subtitle';

export default Subtitle;
