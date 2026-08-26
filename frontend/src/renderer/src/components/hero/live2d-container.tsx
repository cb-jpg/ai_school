/**
 * Live2D Container Component
 * Live2D 数字人容器 - 右侧人物展示区域
 */

import { memo, useRef } from 'react';
import { Box, Text, Flex, Spinner } from '@chakra-ui/react';
import { Live2D } from '../canvas/live2d';
import { useLive2DConfig } from '@/context/live2d-config-context';

interface Live2DContainerProps {
  showSidebar?: boolean;
}

const Live2DContainer = memo(({ showSidebar = false }: Live2DContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { modelInfo, isLoading } = useLive2DConfig();

  return (
    <Box
      ref={containerRef}
      position="relative"
      width="100%"
      height="100%"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="linear-gradient(135deg, #E8EEFF 0%, #F3F4F6 100%)"
      rounded="2xl"
      overflow="hidden"
    >
      {/* Loading State */}
      {isLoading && (
        <Flex
          position="absolute"
          inset={0}
          alignItems="center"
          justifyContent="center"
          flexDirection="column"
          gap={4}
          bg="rgba(255, 255, 255, 0.9)"
          zIndex={10}
        >
          <Spinner size="xl" color="#002FA7" borderWidth="4px" />
          <Text fontSize="sm" color="gray.600">加载虚拟形象中...</Text>
        </Flex>
      )}

      {/* Live2D Canvas - Full Container */}
      <Box
        position="absolute"
        top={0}
        left={0}
        width="100%"
        height="100%"
        pointerEvents="auto"
      >
        <Live2D showSidebar={showSidebar} />
      </Box>

      {/* Debug Info - Remove in production */}
      {!modelInfo && (
        <Box
          position="absolute"
          bottom={4}
          left={4}
          right={4}
          p={3}
          bg="rgba(255, 255, 255, 0.95)"
          rounded="lg"
          fontSize="xs"
          color="gray.600"
          textAlign="center"
        >
          等待虚拟形象模型加载...
        </Box>
      )}
    </Box>
  );
});

Live2DContainer.displayName = 'Live2DContainer';

export default Live2DContainer;
