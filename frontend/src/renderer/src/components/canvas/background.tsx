import { Box, Image } from '@chakra-ui/react';
import { memo, useEffect, useRef, useState } from 'react';
import { useCamera } from '@/context/camera-context';
import { useBgUrl } from '@/context/bgurl-context';
import { apiUrl } from '@/services/api-base';

const Background = memo(({ children }: { children?: React.ReactNode }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [resolvedBgUrl, setResolvedBgUrl] = useState<string | null>(null);
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

  // 部分 ROM（实测 MagicOS）的 WebView 拦截 <img> 加载 http 图片（请求不进网络栈），
  // 与 Live2D 纹理同坑。改用 fetch 拿 blob 再走 objectURL 展示。
  useEffect(() => {
    if (useCameraBackground || !backgroundUrl) {
      setResolvedBgUrl(null);
      return undefined;
    }
    // 本地已生成的 blob:/data: 直接用，无需转手
    if (!backgroundUrl.startsWith('/') && !backgroundUrl.startsWith('http')) {
      setResolvedBgUrl(backgroundUrl);
      return undefined;
    }

    let cancelled = false;
    let createdUrl: string | null = null;
    const fullUrl = backgroundUrl.startsWith('/') ? apiUrl(backgroundUrl) : backgroundUrl;

    fetch(fullUrl, { mode: 'cors' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setResolvedBgUrl(createdUrl);
      })
      .catch((error) => {
        console.warn('[Background] 背景图加载失败，回退渐变底:', error);
        if (!cancelled) setResolvedBgUrl(null);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [useCameraBackground, backgroundUrl]);

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
        resolvedBgUrl ? (
          <Image
            src={resolvedBgUrl}
            alt="background"
            width="100%"
            height="100%"
            objectFit="cover"
            position="absolute"
            top={0}
            left={0}
            // 整体轻虚化：降低背景存在感、突出前景人物与对话（scale 防止模糊边缘露白）
            filter="blur(8px)"
            transform="scale(1.08)"
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
