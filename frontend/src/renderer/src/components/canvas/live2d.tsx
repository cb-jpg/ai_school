/* eslint-disable no-shadow */
/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { memo, useRef, useEffect } from "react";
import { useLive2DConfig } from "@/context/live2d-config-context";
import { useIpcHandlers } from "@/hooks/utils/use-ipc-handlers";
import { useInterrupt } from "@/hooks/utils/use-interrupt";
import { useAudioTask } from "@/hooks/utils/use-audio-task";
import { useLive2DModel } from "@/hooks/canvas/use-live2d-model";
import { useLive2DResize } from "@/hooks/canvas/use-live2d-resize";
import { useAiState, AiStateEnum } from "@/context/ai-state-context";
import { useLive2DExpression } from "@/hooks/canvas/use-live2d-expression";
import { useForceIgnoreMouse } from "@/hooks/utils/use-force-ignore-mouse";
import { useMode } from "@/context/mode-context";

interface Live2DProps {
  showSidebar?: boolean;
  /** 全屏穿透模式（hero 页）：画布不拦截触摸，交互由 window 级 hitTest 处理 */
  touchThrough?: boolean;
}

export const Live2D = memo(
  ({ showSidebar, touchThrough }: Live2DProps): JSX.Element => {
    const { forceIgnoreMouse } = useForceIgnoreMouse();
    const { modelInfo } = useLive2DConfig();
    const { mode } = useMode();
    const internalContainerRef = useRef<HTMLDivElement>(null);
    const { aiState } = useAiState();
    const { resetExpression } = useLive2DExpression();
    const isPet = mode === 'pet';

    // Get canvasRef from useLive2DResize
    const { canvasRef } = useLive2DResize({
      containerRef: internalContainerRef,
      modelInfo,
      showSidebar,
    });

    // Pass canvasRef to useLive2DModel
    const { isDragging, handlers } = useLive2DModel({
      modelInfo,
      canvasRef,
      touchThrough,
    });

    // Setup hooks
    useIpcHandlers();
    useInterrupt();
    useAudioTask();

    // Reset expression to default when AI state becomes idle
    useEffect(() => {
      if (aiState === AiStateEnum.IDLE) {
        const lappAdapter = (window as any).getLAppAdapter?.();
        if (lappAdapter) {
          resetExpression(lappAdapter, modelInfo);
        }
      }
    }, [aiState, modelInfo, resetExpression]);

    // Expose setExpression for console testing
    // useEffect(() => {
    //   const testSetExpression = (expressionValue: string | number) => {
    //     const lappAdapter = (window as any).getLAppAdapter?.();
    //     if (lappAdapter) {
    //       setExpression(expressionValue, lappAdapter, `[Console Test] Set expression to: ${expressionValue}`);
    //     } else {
    //       console.error('[Console Test] LAppAdapter not found.');
    //     }
    //   };

    //   // Expose the function to the window object
    //   (window as any).testSetExpression = testSetExpression;
    //   console.log('[Debug] testSetExpression function exposed to window.');

    //   // Cleanup function to remove the function from window when the component unmounts
    //   return () => {
    //     delete (window as any).testSetExpression;
    //     console.log('[Debug] testSetExpression function removed from window.');
    //   };
    // }, [setExpression]);

    const handlePointerDown = (e: React.PointerEvent) => {
      handlers.onMouseDown(e);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
      if (!isPet) {
        return;
      }

      e.preventDefault();
      console.log(
        "[ContextMenu] (Pet Mode) Right-click detected, requesting menu...",
      );
      window.api?.showContextMenu?.();
    };

    const elemPointerEvents =
      isPet && forceIgnoreMouse ? "none" : touchThrough ? "none" : "auto";

    return (
      <div
        ref={internalContainerRef} // Ref for useLive2DResize if it observes this element
        id="live2d-internal-wrapper"
        style={{
          width: "100%",
          height: "100%",
          pointerEvents: elemPointerEvents,
          overflow: "hidden",
          position: "relative",
          cursor: isDragging ? "grabbing" : "default",
          // 手机端手势（拖动/捏合缩放）由组件处理，屏蔽浏览器默认的页面滚动/缩放；
          // 穿透模式下触摸走 window 监听（hitTest 放行/拦截），此处不屏蔽页面行为
          touchAction: touchThrough ? "auto" : "none",
        }}
        onPointerDown={handlePointerDown}
        onContextMenu={handleContextMenu}
        {...handlers}
      >
        <canvas
          id="canvas"
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            pointerEvents: elemPointerEvents,
            display: "block",
            cursor: isDragging ? "grabbing" : "default",
          }}
        />
      </div>
    );
  },
);

Live2D.displayName = "Live2D";

export { useInterrupt, useAudioTask };
