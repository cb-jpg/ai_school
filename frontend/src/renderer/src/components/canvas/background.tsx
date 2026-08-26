import { Box, Image } from '@chakra-ui/react';
import { memo, useEffect, useRef } from 'react';
import { useCamera } from '@/context/camera-context';
import { useBgUrl } from '@/context/bgurl-context';

const Background = memo(({ children }: { children?: React.ReactNode }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    backgroundStream, isBackgroundStreaming, startBackgroundCamera, stopBackgroundCamera,
  } = useCamera();
  const { useCameraBackground, backgroundUrl } = useBgUrl();

  useEffect(() => {
    if (useCameraBackground) {
      startBackgroundCamera();
    } else {
      stopBackgroundCamera();
    }
  }, [useCameraBackground, startBackgroundCamera, stopBackgroundCamera]);

  useEffect(() => {
    if (videoRef.current && backgroundStream) {
      videoRef.current.srcObject = backgroundStream;
    }
  }, [backgroundStream]);

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      zIndex={0}
    >
      {useCameraBackground ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: isBackgroundStreaming ? 'block' : 'none',
            transform: 'scaleX(-1)',
          }}
        />
      ) : (
        backgroundUrl ? (
          <Image
            src={backgroundUrl}
            alt="background"
            width="100%"
            height="100%"
            objectFit="cover"
            position="absolute"
            top={0}
            left={0}
          />
        ) : (
          <Box
            width="100%"
            height="100%"
            bg="linear-gradient(135deg, rgba(30, 84, 148, 0.1) 0%, rgba(255, 107, 53, 0.05) 100%)"
            position="absolute"
            top={0}
            left={0}
          />
        )
      )}

      {/* 左侧虚化遮罩 - 右侧清晰，左侧渐变虚化 */}
      <Box
        position="absolute"
        top={0}
        left={0}
        width="45%"
        height="100%"
        bg="linear-gradient(to right, rgba(245, 247, 250, 0.95) 0%, rgba(245, 247, 250, 0.7) 50%, rgba(245, 247, 250, 0.2) 100%)"
        zIndex={1}
      />

      {/* 右侧保持清晰 */}
      <Box
        position="absolute"
        top={0}
        right={0}
        width="55%"
        height="100%"
        zIndex={1}
      />

      {children}
    </Box>
  );
});

Background.displayName = 'Background';

export default Background;
