import { Box, Image } from '@chakra-ui/react';
import { memo, useEffect, useRef, useState } from 'react';
import { useCamera } from '@/context/camera-context';
import { useBgUrl } from '@/context/bgurl-context';
import { apiUrl } from '@/services/api-base';
// 内置默认背景：大沥太平校区跑道（校方《数据清单·芝兰玉树》画册照片，已打包进前端）
import defaultCampusBg from '@/assets/school/campus-track.jpg';

const Background = memo(({ children, splitLayout = true }: { children?: React.ReactNode; /** 桌面端左右分屏遮罩（对话界面用）；首页等居中布局传 false 关闭 */ splitLayout?: boolean }) => {
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
          <>
            {/* 默认背景：校园实景照片重虚化（未配置自定义背景时的兜底）。
                同为打包资源（同源 https://localhost），不受 APK WebView 拦 http 图片影响 */}
            <Image
              src={defaultCampusBg}
              alt="background"
              width="100%"
              height="100%"
              objectFit="cover"
              position="absolute"
              top={0}
              left={0}
              filter="blur(16px) brightness(1.06)"
              transform="scale(1.12)"
            />
            {/* 浅色纱罩：保证前景文字/人物可读，维持明亮简洁风 */}
            <Box
              position="absolute"
              top={0}
              left={0}
              width="100%"
              height="100%"
              bg="rgba(248, 250, 252, 0.55)"
            />
          </>
        )
      )}

      {/* 左侧虚化遮罩 - web 端左右分屏设计的一部分；App 手机端无分屏布局，隐藏 */}
      <Box
        position="absolute"
        top={0}
        left={0}
        width="45%"
        height="100%"
        bg="linear-gradient(to right, rgba(245, 247, 250, 0.95) 0%, rgba(245, 247, 250, 0.7) 50%, rgba(245, 247, 250, 0.2) 100%)"
        zIndex={1}
        display={{ base: 'none', md: splitLayout ? 'block' : 'none' }}
      />

      {/* 右侧保持清晰 */}
      <Box
        position="absolute"
        top={0}
        right={0}
        width="55%"
        height="100%"
        zIndex={1}
        display={{ base: 'none', md: splitLayout ? 'block' : 'none' }}
      />

      {children}
    </Box>
  );
});

Background.displayName = 'Background';

export default Background;
