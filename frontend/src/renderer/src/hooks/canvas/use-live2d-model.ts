/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-use-before-define */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-nocheck
import { useEffect, useRef, useCallback, useState, RefObject } from "react";
import { ModelInfo } from "@/context/live2d-config-context";
import { resolveApiBaseUrl } from "@/services/api-base";
import { updateModelConfig } from '../../../WebSDK/src/lappdefine';
import { LAppDelegate } from '../../../WebSDK/src/lappdelegate';
import { LAppLive2DManager } from '../../../WebSDK/src/lapplive2dmanager';
import { initializeLive2D } from '@cubismsdksamples/main';
import { useMode } from '@/context/mode-context';
import { usePortraitBoard } from '@/hooks/utils/use-portrait-board';
import { isPhoneStyleViewport } from '@/utils/device-profile';

interface UseLive2DModelProps {
  modelInfo: ModelInfo | undefined;
  canvasRef: RefObject<HTMLCanvasElement>;
  /** 全屏穿透模式（hero 页）：画布 pointerEvents:none，触摸监听挂 window，
   *  仅当触点命中模型（anyhitTest/isHitOnModel）才 preventDefault 拦截处理，
   *  其余触摸完全放行给下层 UI（消息滚动/按钮/输入框均可正常操作） */
  touchThrough?: boolean;
  /** hero 页人物站位（手机 + 大屏一体机适配生效，见 isPhoneStyleViewport）：
   *  center=首页（banner 右侧）；column=栏目/新闻页（桌面：banner 之下内容区右侧）；
   *  right=对话界面（桌面恢复加载默认居中；两者站位在手机/一体机上一致） */
  heroAlign?: 'center' | 'right' | 'column';
}

interface Position {
  x: number;
  y: number;
}

// Thresholds for tap vs drag detection
const TAP_DURATION_THRESHOLD_MS = 200; // Max duration for a tap
const DRAG_DISTANCE_THRESHOLD_PX = 5; // Min distance to be considered a drag

// hero 全屏穿透模式的模型初始适配参数（真机校准值，Hiyori/荣耀X60Pro）：
// ⚠️ 竖屏画布下 Live2D 视图空间按【高度】等比映射，视图 X 的 ±1 不对应全屏宽！
//    屏宽比例 f 处 x_view = (2f-1)×画布宽高比（旧机 0.475 = 荣耀X60Pro 的宽高比；
//    一体机如 1080×1920 是 0.5625，横屏 >1，必须按实际画布换算，否则人物横向跑偏）；
//    屏高比例 g 处的 y_view = (1-2g)（y 上下翻转，负值=往下，±1 恒对应屏高，与宽高比无关）。
// 横坐标按【屏宽比例】存（2026-09-14 由荣耀X60Pro 视图坐标反算：f = 0.5 + x_view/0.95），
// 竖直位置/大小沿用屏高比例，任何宽高比下与手机校准值等价。
// 首页与对话界面站位（2026-09-09 四轮微调）：
//   首页 scale 0.88 ≈ 51% 屏高，横 73% 屏宽（用户定：标题"成功"的"成"字正下方），
//     y=-0.12 ≈ 人物中心在 56% 屏高；
//   对话界面 scale 0.80（比首页稍小），横 78.4% 屏宽（用户要求再右移，给左侧聊天让位）。
//   （聊天内容区右缩进 dialog-box 内已避开人物占位）
// 验证用 scripts/cdp_fb_dump.py 抓帧缓冲（CDP 整页截图拍不到 GL 图层！）。换角色如大小不合适改这些常量。
const HERO_FIT_FACTOR = 0.8;
const HERO_CENTER_Y = -0.12;
const HERO_OFFSET_F = 0.784; // 对话界面：78.4% 屏宽（原 x_view 0.27）
const HOME_FIT_FACTOR = 0.88;
const HOME_CENTER_Y = -0.12;
const HOME_OFFSET_F = 0.732; // 首页：73% 屏宽（原 x_view 0.22）

// 首页 hero banner 站位（2026-09-21 简化版省实改版）：手机/一体机（base 组）与
// 横屏桌面（新增适配，banner 形态改版后原默认居中站位会撞左侧红面板）都让人物
// 站在首页顶部 banner 照片右侧（用户手绘红圈位置）。banner 区 = 页头(~114px)
// + 40vh：fit 0.5 ≈ 29% 屏高，y=+0.34 → 人物中心在 33% 屏高（banner 中部），
// 底部落在 banner 下缘之上；x≈72% 屏宽（左侧红面板占 48%~56%，互不遮挡）。
const HOME_BANNER_FIT_FACTOR = 0.5;
const HOME_BANNER_CENTER_Y = 0.34;
const HOME_BANNER_OFFSET_F = 0.72;

// 桌面栏目/新闻页站位（2026-09-22 官网 v2 用户反馈修正）：画布是右侧 55% 竖条、
// 页面顶部有 ~128+132px 的不透明栏目 banner 条（页面 z30 盖过画布 z1）。人物若按
// 加载默认（满高居中）站，头肩正好被 banner 条盖住——用户反馈"照片挡到人物"。
// 改为：默认缩放 ×0.66、中线降到 64% 画布高（banner 条之下的内容区）、x 居画布
// 中线（≈72.5% 屏宽，内容卡右缘之外）。
const COLUMN_DESKTOP_SCALE_MUL = 0.66;
const COLUMN_DESKTOP_CENTER_Y = -0.28;
const COLUMN_DESKTOP_X_VIEW = 0;

// 竖屏大屏（桌面竖窗/竖放平板，usePortraitBoard 命中的全尺寸视口）站位初值
// （2026-09-15 桌面模拟定，待真机微调）。横坐标同样按【屏宽比例】存，由下方
// 宽高比换算统一处理（1272×2800 模拟下换算：视图 x 0.34 ≈ 87.4% 屏宽）：
//   首页：内容列(限宽 840 居中)在屏上半部，人物居中站下方展示区——
//     fit 0.95 ≈ 55% 屏高，50% 屏宽，y=-0.34 即人物中心 67% 屏高
//     （避开上方文字块与底部"开始对话"按钮）；
//   对话界面：对话卡 840 居中，人物右侧小比例——fit 0.6，87.4% 屏宽
//     （人物左缘轻压卡片右缘，与手机端"人物压卡片右缘"设计一致），
//     y=-0.18 即人物中心 59% 屏高。
// ⚠️ 大屏一体机不走这组：device-profile 已把一体机布局视口钉成手机宽(420)，
//    usePortraitBoard(≥768) 不命中，一体机与手机共用上方真机校准值。
const HERO_BOARD_FIT_FACTOR = 0.6;
const HERO_BOARD_CENTER_Y = -0.18;
const HERO_BOARD_OFFSET_F = 0.874; // 对话界面：87.4% 屏宽（原视图坐标 x=0.34）
const HOME_BOARD_FIT_FACTOR = 0.95;
const HOME_BOARD_CENTER_Y = -0.34;
const HOME_BOARD_OFFSET_F = 0.5; // 首页：50% 屏宽（原视图坐标 x=0）

function parseModelUrl(url: string): { baseUrl: string; modelDir: string; modelFileName: string } {
  try {
    console.log('[parseModelUrl] Parsing URL:', url);

    // 如果是相对路径，转换为后端绝对地址
    let absoluteUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      const base = resolveApiBaseUrl();
      absoluteUrl = `${base}${url.startsWith('/') ? url : '/' + url}`;
    }

    const urlObj = new URL(absoluteUrl);
    const { pathname } = urlObj;

    // Find the model3.json file
    const lastSlashIndex = pathname.lastIndexOf('/');
    if (lastSlashIndex === -1) {
      throw new Error('Invalid model URL format');
    }

    const fullFileName = pathname.substring(lastSlashIndex + 1);
    const modelFileName = fullFileName.replace('.model3.json', '');

    // baseUrl should be the server root (protocol + host)
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

    // modelDir should be the full directory path containing the model3.json
    // e.g., "/live2d-models/mao_pro/runtime" for "/live2d-models/mao_pro/runtime/mao_pro.model3.json"
    const modelDir = pathname.substring(0, lastSlashIndex);

    console.log('[parseModelUrl] Result:', { baseUrl, modelDir, modelFileName });
    return { baseUrl, modelDir, modelFileName };
  } catch (error) {
    console.error('[parseModelUrl] Error parsing model URL:', error, 'URL was:', url);
    return { baseUrl: '', modelDir: '', modelFileName: '' };
  }
}

export const playAudioWithLipSync = (audioPath: string, modelIndex = 0): Promise<void> => new Promise((resolve, reject) => {
  const live2dManager = window.LAppLive2DManager?.getInstance();
  if (!live2dManager) {
    reject(new Error('Live2D manager not initialized'));
    return;
  }

  const fullPath = `/Resources/${audioPath}`;
  const audio = new Audio(fullPath);

  audio.addEventListener('canplaythrough', () => {
    const model = live2dManager.getModel(modelIndex);
    if (model) {
      if (model._wavFileHandler) {
        model._wavFileHandler.start(fullPath);
        audio.play();
      } else {
        reject(new Error('Wav file handler not available on model'));
      }
    } else {
      reject(new Error(`Model index ${modelIndex} not found`));
    }
  });

  audio.addEventListener('ended', () => {
    resolve();
  });

  audio.addEventListener('error', () => {
    reject(new Error(`Failed to load audio: ${fullPath}`));
  });

  audio.load();
});

export const useLive2DModel = ({
  modelInfo,
  canvasRef,
  touchThrough = false,
  heroAlign = 'right',
}: UseLive2DModelProps) => {
  // 站位换算在适配时使用；页面切换（首页↔对话界面）会触发重新适配到对应站位
  const isHomeAlign = heroAlign === 'center';
  // 竖屏大屏（桌面竖窗/竖放平板的全尺寸视口）换用大屏站位常量（人物比例与
  // 站位按大屏排版）；手机与一体机（420 视口）用真机校准的 手机 组常量
  const isBoard = usePortraitBoard();
  const { mode } = useMode();
  const isPet = mode === 'pet';
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const dragStartPos = useRef<Position>({ x: 0, y: 0 }); // Screen coordinates at drag start
  const modelStartPos = useRef<Position>({ x: 0, y: 0 }); // Model coordinates at drag start
  const modelPositionRef = useRef<Position>({ x: 0, y: 0 });
  // 加载默认缩放捕获（桌面对话/栏目页"恢复默认"的目标值）：模型实例首次就绪时记一次，
  // 换模型（实例身份变化）自动重新捕获
  const baseScaleRef = useRef<number | null>(null);
  const baseModelRef = useRef<{ _modelMatrix?: unknown } | null>(null);
  const prevModelUrlRef = useRef<string | null>(null);
  const isHoveringModelRef = useRef(false);
  const electronApi = (window as any).electron;

  // --- State for Tap vs Drag ---
  const mouseDownTimeRef = useRef<number>(0);
  const mouseDownPosRef = useRef<Position>({ x: 0, y: 0 }); // Screen coords at mousedown
  const isPotentialTapRef = useRef<boolean>(false); // Flag for ongoing potential tap/drag action
  // ---

  useEffect(() => {
    const currentUrl = modelInfo?.url;
    const sdkScale = (window as any).LAppDefine?.CurrentKScale;
    const modelScale = modelInfo?.kScale !== undefined ? Number(modelInfo.kScale) : undefined;

    const needsUpdate = currentUrl &&
                        (currentUrl !== prevModelUrlRef.current ||
                         (sdkScale !== undefined && modelScale !== undefined && sdkScale !== modelScale));

    if (needsUpdate) {
      prevModelUrlRef.current = currentUrl;

      try {
        const { baseUrl, modelDir, modelFileName } = parseModelUrl(currentUrl);

        if (baseUrl && modelDir) {
          console.log('[useLive2DModel] Updating model config:', { baseUrl, modelDir, modelFileName });
          updateModelConfig(baseUrl, modelDir, modelFileName, Number(modelInfo.kScale));

          // Wait for canvas to be rendered before initializing Live2D
          setTimeout(() => {
            // Check if canvas exists before proceeding
            const canvasElement = document.getElementById('canvas');
            if (!canvasElement) {
              console.warn('[useLive2DModel] Canvas not found, skipping initialization');
              return;
            }

            // 释放现有实例
            if ((window as any).LAppLive2DManager?.releaseInstance) {
              console.log('[useLive2DModel] Releasing existing Live2D manager');
              (window as any).LAppLive2DManager.releaseInstance();
            }

            // 重新初始化Live2D
            console.log('[useLive2DModel] Reinitializing Live2D');
            try {
              initializeLive2D();
              // SPA 路由往返时组件重挂载，本 effect 重建 GL 链并重新绑定 canvas；
              // 通知 hero 适配逻辑重新执行初始站位
              window.dispatchEvent(new Event('live2d-rebound'));
            } catch (error) {
              console.error('[useLive2DModel] Error during Live2D initialization:', error);
            }
          }, 500);
        }
      } catch (error) {
        console.error('[useLive2DModel] Error processing model URL:', error);
      }
    }
  }, [modelInfo?.url, modelInfo?.kScale]);

  const getModelPosition = useCallback(() => {
    const adapter = (window as any).getLAppAdapter?.();
    if (adapter) {
      const model = adapter.getModel();
      if (model && model._modelMatrix) {
        const matrix = model._modelMatrix.getArray();
        return {
          x: matrix[12],
          y: matrix[13],
        };
      }
    }
    return { x: 0, y: 0 };
  }, []);

  const setModelPosition = useCallback((x: number, y: number) => {
    const adapter = (window as any).getLAppAdapter?.();
    if (adapter) {
      const model = adapter.getModel();
      if (model && model._modelMatrix) {
        const matrix = model._modelMatrix.getArray();

        const newMatrix = [...matrix];
        newMatrix[12] = x;
        newMatrix[13] = y;

        model._modelMatrix.setMatrix(newMatrix);
        modelPositionRef.current = { x, y };
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const currentPos = getModelPosition();
      modelPositionRef.current = currentPos;
      setPosition(currentPos);
    }, 500);

    return () => clearTimeout(timer);
  }, [modelInfo?.url, getModelPosition]);

  // --- hero 全屏穿透：模型就绪后适配到【当前页面】的目标站位（缩放+位置），用户仍可拖/捏 ---
  // 所有页面形态都归位（2026-09-22 官网 v2 用户反馈"每个页面人物位置偏移"的修复）：
  // 此前桌面端对话/栏目/新闻页直接跳过适配，从首页带过来的 banner 站位（小、高）
  // 会残留到后续页面。现在按 heroAlign 选目标：
  //   竖屏大屏(board) → HOME_BOARD_*/HERO_BOARD_*；
  //   手机·一体机(phoneStyle) → 首页 HOME_BANNER_* / 其余 HERO_*；
  //   桌面首页(center) → HOME_BANNER_*（banner 右侧）；
  //   桌面栏目·新闻(column) → 加载默认缩放×COLUMN_DESKTOP_SCALE_MUL、banner 条之下；
  //   桌面对话(right) → 恢复加载默认居中（v1 形态）。
  // "加载默认缩放"在模型实例首次就绪时捕获（换模型按实例识别自动重新捕获）。
  useEffect(() => {
    if (!touchThrough) return undefined;
    const isColumnAlign = heroAlign === 'column';
    // 目标站位：fitFactor（绝对视图缩放）与 xScreenFrac（屏宽比例，须全宽画布）
    // 为一组；桌面右侧 55% 画布（对话/栏目/新闻）改用 baseScaleMul×默认缩放与
    // 视图坐标 xViewStatic/yView
    let fitFactor: number | null = null;
    let xScreenFrac = 0.5;
    let baseScaleMul = 1;
    let xViewStatic = 0;
    let yView = 0;
    if (isBoard) {
      fitFactor = isHomeAlign ? HOME_BOARD_FIT_FACTOR : HERO_BOARD_FIT_FACTOR;
      xScreenFrac = isHomeAlign ? HOME_BOARD_OFFSET_F : HERO_BOARD_OFFSET_F;
      yView = isHomeAlign ? HOME_BOARD_CENTER_Y : HERO_BOARD_CENTER_Y;
    } else if (isPhoneStyleViewport()) {
      fitFactor = isHomeAlign ? HOME_BANNER_FIT_FACTOR : HERO_FIT_FACTOR;
      xScreenFrac = isHomeAlign ? HOME_BANNER_OFFSET_F : HERO_OFFSET_F;
      yView = isHomeAlign ? HOME_BANNER_CENTER_Y : HERO_CENTER_Y;
    } else if (isHomeAlign) {
      fitFactor = HOME_BANNER_FIT_FACTOR;
      xScreenFrac = HOME_BANNER_OFFSET_F;
      yView = HOME_BANNER_CENTER_Y;
    } else if (isColumnAlign) {
      baseScaleMul = COLUMN_DESKTOP_SCALE_MUL;
      xViewStatic = COLUMN_DESKTOP_X_VIEW;
      yView = COLUMN_DESKTOP_CENTER_Y;
    }
    // 桌面对话（else 隐含）：baseScaleMul=1 / x=0 / y=0 → 恢复加载默认居中
    let cancelled = false;
    let outerStop: (() => void) | null = null;

    // 模型初始化是异步的（initializeLive2D 在 500ms 后启动，模型加载还要更久），轮询就绪
    const startPoll = () => {
      const poll = setInterval(() => {
        if (cancelled) {
          clearInterval(poll);
          return;
        }
        const model = (window as any).getLAppAdapter?.()?.getModel?.();
        const matrix = model?._modelMatrix;
        if (!matrix) return;
        // canvas 位图未初始化（默认 300x150）时投影会按小画布计算，等 resize 完成。
        // 就绪判据 = 位图宽达到 clientWidth×dpr（2026-09-22 改：旧判据
        // `width <= clientWidth` 在 dpr=1 的桌面浏览器上永远成立，首页 banner
        // 站位适配被跳过，人物停在默认居中位）。
        const canvasEl = document.getElementById('canvas') as HTMLCanvasElement | null;
        if (!canvasEl) return;
        const expectedW = Math.round(canvasEl.clientWidth * (window.devicePixelRatio || 1));
        if (canvasEl.width < expectedW - 1) return;
        clearInterval(poll);
        clearTimeout(stop);
        try {
          // 先按当前实际画布尺寸重算投影（重建后可能按过渡尺寸建过投影），再适配站位
          LAppDelegate.getInstance()?.onResize?.();
          const current = matrix.getScaleX?.() || matrix.getArray()[0] || 1;
          // 加载默认缩放捕获：模型实例首次就绪的此刻即默认态（任何适配之前）
          if (baseModelRef.current !== model) {
            baseModelRef.current = model;
            baseScaleRef.current = current;
          }
          const base = baseScaleRef.current || 1;
          const targetScale = fitFactor !== null ? fitFactor : base * baseScaleMul;
          const ratio = targetScale / current;
          if (Math.abs(ratio - 1) > 0.001) {
            matrix.scaleRelative(ratio, ratio);
          }
          if (fitFactor !== null) {
            // 横坐标按实际画布宽高比换算（竖屏手机 0.475 / 一体机 0.5625 / 横屏 >1），
            // 屏宽比例 f 处 x_view = (2f-1)×宽高比，人物落在与手机校准一致的屏宽比例处
            const aspect = canvasEl.width / canvasEl.height;
            xViewStatic = (2 * xScreenFrac - 1) * aspect;
          }
          const arr = matrix.getArray();
          arr[12] = xViewStatic;
          arr[13] = yView;
          matrix.setMatrix(arr);
          modelPositionRef.current = { x: xViewStatic, y: yView };
        } catch (err) {
          console.error('[useLive2DModel] hero fit failed:', err);
        }
      }, 300);
      const stop = setTimeout(() => clearInterval(poll), 20000);
      return () => {
        clearInterval(poll);
        clearTimeout(stop);
      };
    };

    let cleanup = startPoll();
    // 路由往返（管理后台 → hero）触发 Live2D 链重建后，重新适配初始站位
    const onRebound = () => {
      cleanup();
      cancelled = false;
      cleanup = startPoll();
    };
    // 路由切换（首页↔对话界面↔专题页）必然伴随 hash 变化：无条件重启适配。
    // 仅靠 deps 变化重启在个别时序下会漏（真机报过"回首页人物不归位"），这里双保险
    let hashTimer: ReturnType<typeof setTimeout> | null = null;
    const onHashChange = () => {
      if (hashTimer) clearTimeout(hashTimer);
      // 防抖：等页面切换渲染稳定后再适配
      hashTimer = setTimeout(() => {
        onRebound();
      }, 350);
    };
    window.addEventListener('live2d-rebound', onRebound);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      cancelled = true;
      cleanup();
      outerStop?.();
      if (hashTimer) clearTimeout(hashTimer);
      window.removeEventListener('live2d-rebound', onRebound);
      window.removeEventListener('hashchange', onHashChange);
    };
    // heroAlign 变化（首页 ↔ 对话 ↔ 栏目/新闻）时重新适配站位；
    // 已适配过时比例≈1 不再缩放，只平移到目标站位
  }, [touchThrough, modelInfo?.url, heroAlign, isBoard, isHomeAlign]);

  const getCanvasScale = useCallback(() => {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) return { width: 1, height: 1, scale: 1 };

    const { width } = canvas;
    const { height } = canvas;
    const scale = width / canvas.clientWidth;

    return { width, height, scale };
  }, []);

  const screenToModelPosition = useCallback((screenX: number, screenY: number) => {
    const { width, height, scale } = getCanvasScale();

    const x = ((screenX * scale) / width) * 2 - 1;
    const y = -((screenY * scale) / height) * 2 + 1;

    return { x, y };
  }, [getCanvasScale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const adapter = (window as any).getLAppAdapter?.();
    if (!adapter || !canvasRef.current) return;

    const model = adapter.getModel();
    const view = LAppDelegate.getInstance().getView();
    if (!view || !model) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left; // Screen X relative to canvas
    const y = e.clientY - rect.top; // Screen Y relative to canvas

    // --- Check if click is on model ---
    // kiosk：rect 是缩放后物理尺寸，clientWidth 是缩放前布局宽——按后者换算命中点会放大 2.29×
    const scale = canvas.width / rect.width;
    const scaledX = x * scale;
    const scaledY = y * scale;
    const modelX = view._deviceToScreen.transformX(scaledX);
    const modelY = view._deviceToScreen.transformY(scaledY);

    const hitAreaName = model.anyhitTest(modelX, modelY);
    const isHitOnModel = model.isHitOnModel(modelX, modelY);
    // --- End Check ---

    if (hitAreaName !== null || isHitOnModel) {
      // Record potential tap/drag start
      mouseDownTimeRef.current = Date.now();
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY }; // Use clientX/Y for distance check
      isPotentialTapRef.current = true;
      setIsDragging(false); // Ensure dragging is false initially

      // Store initial model position IF drag starts later
      if (model._modelMatrix) {
        const matrix = model._modelMatrix.getArray();
        modelStartPos.current = { x: matrix[12], y: matrix[13] };
      }
    }
  }, [canvasRef, modelInfo]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const adapter = (window as any).getLAppAdapter?.();
    const view = LAppDelegate.getInstance().getView();
    const model = adapter?.getModel();

    // --- Start Drag Logic ---
    if (isPotentialTapRef.current && adapter && view && model && canvasRef.current) {
      const timeElapsed = Date.now() - mouseDownTimeRef.current;
      const deltaX = e.clientX - mouseDownPosRef.current.x;
      const deltaY = e.clientY - mouseDownPosRef.current.y;
      const distanceMoved = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Check if it's a drag (moved enough distance OR held long enough while moving slightly)
      if (distanceMoved > DRAG_DISTANCE_THRESHOLD_PX || (timeElapsed > TAP_DURATION_THRESHOLD_MS && distanceMoved > 1)) {
        isPotentialTapRef.current = false; // It's a drag, not a tap
        setIsDragging(true);

        // Set initial drag screen position using the position from mousedown
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        dragStartPos.current = {
          x: mouseDownPosRef.current.x - rect.left,
          y: mouseDownPosRef.current.y - rect.top,
        };
        // modelStartPos is already set in handleMouseDown
      }
    }
    // --- End Start Drag Logic ---

    // --- Continue Drag Logic ---
    if (isDragging && adapter && view && model && canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left; // Current screen X relative to canvas
      const currentY = e.clientY - rect.top; // Current screen Y relative to canvas

      // Convert screen delta to model delta
      // kiosk：rect 是缩放后物理尺寸，clientWidth 是缩放前布局宽——按后者换算命中点会放大 2.29×
    const scale = canvas.width / rect.width;
      const startScaledX = dragStartPos.current.x * scale;
      const startScaledY = dragStartPos.current.y * scale;
      const startModelX = view._deviceToScreen.transformX(startScaledX);
      const startModelY = view._deviceToScreen.transformY(startScaledY);

      const currentScaledX = currentX * scale;
      const currentScaledY = currentY * scale;
      const currentModelX = view._deviceToScreen.transformX(currentScaledX);
      const currentModelY = view._deviceToScreen.transformY(currentScaledY);

      const dx = currentModelX - startModelX;
      const dy = currentModelY - startModelY;

      const newX = modelStartPos.current.x + dx;
      const newY = modelStartPos.current.y + dy;

      // Use the adapter's setModelPosition method if available, otherwise update matrix directly
      if (adapter.setModelPosition) {
        adapter.setModelPosition(newX, newY);
      } else if (model._modelMatrix) {
        const matrix = model._modelMatrix.getArray();
        const newMatrix = [...matrix];
        newMatrix[12] = newX;
        newMatrix[13] = newY;
        model._modelMatrix.setMatrix(newMatrix);
      }

      modelPositionRef.current = { x: newX, y: newY };
      setPosition({ x: newX, y: newY }); // Update React state if needed for UI feedback
    }
    // --- End Continue Drag Logic ---

    // --- Pet Hover Logic (Unchanged) ---
    if (isPet && !isDragging && !isPotentialTapRef.current && electronApi && adapter && view && model && canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // kiosk：rect 是缩放后物理尺寸，clientWidth 是缩放前布局宽——按后者换算命中点会放大 2.29×
    const scale = canvas.width / rect.width;
      const scaledX = x * scale;
      const scaledY = y * scale;
      const modelX = view._deviceToScreen.transformX(scaledX);
      const modelY = view._deviceToScreen.transformY(scaledY);

      const currentHitState = model.anyhitTest(modelX, modelY) !== null || model.isHitOnModel(modelX, modelY);

      if (currentHitState !== isHoveringModelRef.current) {
        isHoveringModelRef.current = currentHitState;
        electronApi.ipcRenderer.send('update-component-hover', 'live2d-model', currentHitState);
      }
    }
    // --- End Pet Hover Logic ---
  }, [isPet, isDragging, electronApi, canvasRef]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const adapter = (window as any).getLAppAdapter?.();
    const model = adapter?.getModel();
    const view = LAppDelegate.getInstance().getView();

    if (isDragging) {
      // Finalize drag
      setIsDragging(false);
      if (adapter) {
        const currentModel = adapter.getModel(); // Re-get model in case adapter changed
        if (currentModel && currentModel._modelMatrix) {
          const matrix = currentModel._modelMatrix.getArray();
          const finalPos = { x: matrix[12], y: matrix[13] };
          modelPositionRef.current = finalPos;
          modelStartPos.current = finalPos; // Update base position for next potential drag
          setPosition(finalPos);
        }
      }
    } else if (isPotentialTapRef.current && adapter && model && view && canvasRef.current) {
      // --- Tap Motion Logic ---
      const timeElapsed = Date.now() - mouseDownTimeRef.current;
      const deltaX = e.clientX - mouseDownPosRef.current.x;
      const deltaY = e.clientY - mouseDownPosRef.current.y;
      const distanceMoved = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Check if it qualifies as a tap (short duration, minimal movement)
      if (timeElapsed < TAP_DURATION_THRESHOLD_MS && distanceMoved < DRAG_DISTANCE_THRESHOLD_PX) {
        const allowTapMotion = modelInfo?.pointerInteractive !== false;

        if (allowTapMotion && modelInfo?.tapMotions) {
          // Use mouse down position for hit testing
          const canvas = canvasRef.current;
          const rect = canvas.getBoundingClientRect();
          // kiosk：rect 是缩放后物理尺寸，clientWidth 是缩放前布局宽——按后者换算命中点会放大 2.29×
    const scale = canvas.width / rect.width;
          const downX = (mouseDownPosRef.current.x - rect.left) * scale;
          const downY = (mouseDownPosRef.current.y - rect.top) * scale;
          const modelX = view._deviceToScreen.transformX(downX);
          const modelY = view._deviceToScreen.transformY(downY);

          const hitAreaName = model.anyhitTest(modelX, modelY);
          // Trigger tap motion using the specific hit area name or null for general body tap
          model.startTapMotion(hitAreaName, modelInfo.tapMotions);
        }
      }
      // --- End Tap Motion Logic ---
    }

    // Reset potential tap flag regardless of outcome
    isPotentialTapRef.current = false;
  }, [isDragging, canvasRef, modelInfo]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      // If dragging and mouse leaves, treat it like a mouse up to end drag
      handleMouseUp({} as React.MouseEvent); // Pass a dummy event or adjust handleMouseUp signature
    }
    // Reset potential tap if mouse leaves before mouse up
    if (isPotentialTapRef.current) {
      isPotentialTapRef.current = false;
    }
    // --- Pet Hover Logic (Unchanged) ---
    if (isPet && electronApi && isHoveringModelRef.current) {
      isHoveringModelRef.current = false;
      electronApi.ipcRenderer.send('update-component-hover', 'live2d-model', false);
    }
  }, [isPet, isDragging, electronApi, handleMouseUp]);

  // --- 触摸支持（手机端）：单指拖动/点按复用鼠标逻辑，双指捏合缩放 ---
  // 用原生 touch 监听（非 React 合成事件）：React 17+ 在 root 上以 passive
  // 方式注册 touchstart/touchmove，合成事件里 preventDefault 无效，无法阻止
  // WebView 的页面缩放手势和 touchend 后的合成鼠标事件（后者会在捏合结束时
  // 触发一次拖动，表现为"人物抖动"）。
  const pinchStartDistRef = useRef(0);
  const pinchBaseScaleRef = useRef(1);
  const isPinchingRef = useRef(false); // 双指会话中：压制单指拖动/点按
  const waitAllUpRef = useRef(false); // 缩放已结束但仍有手指未抬起：抬起前不进入拖动

  // 缩放范围（相对捏合开始时的缩放倍数）
  const PINCH_MIN_FACTOR = 0.35;
  const PINCH_MAX_FACTOR = 3.0;

  const getModelScale = useCallback(() => {
    const model = (window as any).getLAppAdapter?.()?.getModel?.();
    return model?._modelMatrix?.getScaleX?.() || 1;
  }, []);

  /**
   * 捏合缩放：把缩放设为 捏合起始scale × 手指距离系数（带钳制）。
   * 必须走与拖动一致的取模型路径（getLAppAdapter）。WebSDK 存在多实例包装：
   * LAppLive2DManager.getInstance() 可能拿到未挂载模型的另一实例，缩放会
   * 静默失效（2026-09-01 真机踩坑）。
   * ⚠️ CubismMatrix44.scale(x,y) 是"绝对赋值 _tr[0]=x"而非乘法，直接传
   * 增量系数会把模型瞬间打到约 1 倍刻度再被覆盖——这就是此前双指缩放
   * 抖动且无法缩放的根因。相对缩放必须用 scaleRelative。
   */
  const applyPinchScale = useCallback((factor: number) => {
    const adapter = (window as any).getLAppAdapter?.();
    let model = adapter?.getModel?.();
    if (!model) {
      try {
        model = LAppLive2DManager.getInstance()?.getModel(0);
      } catch (err) {
        model = null;
      }
    }
    const matrix = model?._modelMatrix;
    if (!matrix) return;

    const base = pinchBaseScaleRef.current || 1;
    const clamped = Math.min(
      base * PINCH_MAX_FACTOR,
      Math.max(base * PINCH_MIN_FACTOR, base * factor),
    );
    const current = matrix.getScaleX?.() || 1;
    const ratio = clamped / current;
    if (Math.abs(ratio - 1) > 0.001) {
      matrix.scaleRelative(ratio, ratio);
    }
  }, []);

  // 原生 touch 事件分发器：通过 ref 调用最新的处理闭包（避免旧 isDragging 状态）
  const touchNativeRef = useRef<{
    start: (x: number, y: number) => void
    move: (x: number, y: number) => void
    end: (x: number, y: number) => void
    cancel: () => void
  }>({ start: () => {}, move: () => {}, end: () => {}, cancel: () => {} });

  useEffect(() => {
    touchNativeRef.current = {
      start: (x, y) => handleMouseDown({ clientX: x, clientY: y } as React.MouseEvent),
      move: (x, y) => handleMouseMove({ clientX: x, clientY: y } as React.MouseEvent),
      end: (x, y) => handleMouseUp({ clientX: x, clientY: y } as React.MouseEvent),
      cancel: () => handleMouseLeave(),
    };
  });

  useEffect(() => {
    // 穿透模式监听 window（画布 pointerEvents:none 收不到触摸）；
    // 普通模式维持原状挂 canvas
    const el: HTMLElement | Window | null = touchThrough ? window : canvasRef.current;
    if (!el) return undefined;
    const target = el as HTMLElement;

    // 穿透模式的触摸会话标记：命中模型后 start→end 之间的 move/end 才拦截
    const touchActiveRef = { current: false };
    // 首指是否命中模型（决定双指缩放会话是否启动）
    const startHitRef = { current: false };

    /** 触点是否落在模型上（与 handleMouseDown 同一套换算） */
    const hitTestAt = (clientX: number, clientY: number): boolean => {
      const canvas = canvasRef.current;
      if (!canvas) return false;
      const adapter = (window as any).getLAppAdapter?.();
      const view = LAppDelegate.getInstance().getView();
      const model = adapter?.getModel();
      if (!view || !model) return false;
      const rect = canvas.getBoundingClientRect();
      // kiosk：rect 是缩放后物理尺寸，clientWidth 是缩放前布局宽——按后者换算命中点会放大 2.29×
    const scale = canvas.width / rect.width;
      const modelX = view._deviceToScreen.transformX((clientX - rect.left) * scale);
      const modelY = view._deviceToScreen.transformY((clientY - rect.top) * scale);
      return model.anyhitTest(modelX, modelY) !== null || model.isHitOnModel(modelX, modelY);
    };

    const distBetween = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    // 暴露给 CDP 测试脚本定位人物（cdp_pinch_test.py 等）
    (window as any).__live2dHitTest = hitTestAt;

    const onStart = (e: TouchEvent) => {
      if (touchThrough) {
        // 穿透模式：首指未命中模型 → 完全放行给下层 UI
        if (e.touches.length === 1) {
          startHitRef.current = hitTestAt(e.touches[0].clientX, e.touches[0].clientY);
          if (!startHitRef.current) return;
          e.preventDefault(); // 命中模型：阻止下层滚动/合成点击
          touchActiveRef.current = true;
        } else if (e.touches.length >= 2) {
          // 双指：首指已命中（正在操作人物）则继续；否则任一新指命中也启动
          //（覆盖真实捏合手势中两指几乎同时落下的情形）
          if (!startHitRef.current && !touchActiveRef.current) {
            startHitRef.current =
              hitTestAt(e.touches[0].clientX, e.touches[0].clientY) ||
              hitTestAt(e.touches[1].clientX, e.touches[1].clientY);
            if (!startHitRef.current) return;
          }
          e.preventDefault();
        }
      }
      if (e.touches.length >= 2) {
        // 进入双指缩放：取消单指点按/拖动，开启缩放会话
        pinchStartDistRef.current = Math.max(1, distBetween(e.touches));
        pinchBaseScaleRef.current = getModelScale();
        isPinchingRef.current = true;
        waitAllUpRef.current = false;
        isPotentialTapRef.current = false;
        setIsDragging(false);
        e.preventDefault(); // 阻止 WebView 页面缩放手势
        return;
      }
      // 缩放会话收尾阶段（还有手指没抬起）不进入拖动，防止误触
      if (isPinchingRef.current || waitAllUpRef.current) return;
      touchNativeRef.current.start(e.touches[0].clientX, e.touches[0].clientY);
    };

    const onMove = (e: TouchEvent) => {
      if (isPinchingRef.current && e.touches.length >= 2) {
        e.preventDefault(); // 阻止页面缩放/滚动与 touchend 后的合成鼠标事件
        applyPinchScale(distBetween(e.touches) / pinchStartDistRef.current);
        return;
      }
      if (touchThrough && !touchActiveRef.current && !isPinchingRef.current && !waitAllUpRef.current) {
        return; // 无会话：放行（页面滚动等默认行为不受影响）
      }
      if (touchActiveRef.current || isPinchingRef.current || waitAllUpRef.current) {
        e.preventDefault();
      }
      if (e.touches.length === 1) {
        touchNativeRef.current.move(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (touchThrough && !touchActiveRef.current && !isPinchingRef.current && !waitAllUpRef.current) {
        return; // 无会话：放行（下层按钮/输入框正常接收 click/focus）
      }
      e.preventDefault(); // 阻止触摸结束后浏览器合成 mousedown/mousemove/mouseup
      if (isPinchingRef.current) {
        if (e.touches.length < 2) {
          // 双指缩放结束；若仍有手指留在屏幕上，等全部抬起前不进入拖动
          isPinchingRef.current = false;
          pinchStartDistRef.current = 0;
          isPotentialTapRef.current = false;
          setIsDragging(false);
          waitAllUpRef.current = e.touches.length > 0;
        }
        return;
      }
      if (waitAllUpRef.current) {
        if (e.touches.length === 0) waitAllUpRef.current = false;
        return;
      }
      const t = e.changedTouches[0];
      if (t) {
        touchNativeRef.current.end(t.clientX, t.clientY);
      } else {
        touchNativeRef.current.cancel();
      }
      if (e.touches.length === 0) {
        touchActiveRef.current = false;
        startHitRef.current = false;
      }
    };

    const onCancel = () => {
      // WebView 可能随时接管手势并下发 touchcancel（深度定制 ROM 常见），
      // 必须完整复位，否则残留状态会让后续手势错乱
      isPinchingRef.current = false;
      waitAllUpRef.current = false;
      pinchStartDistRef.current = 0;
      isPotentialTapRef.current = false;
      setIsDragging(false);
      touchActiveRef.current = false;
      startHitRef.current = false;
    };

    target.addEventListener('touchstart', onStart, { passive: false });
    target.addEventListener('touchmove', onMove, { passive: false });
    target.addEventListener('touchend', onEnd, { passive: false });
    target.addEventListener('touchcancel', onCancel, { passive: false });

    // 鼠标兜底（穿透模式全启用）：桌面浏览器画布 pointerEvents:none 收不到
    // 鼠标事件，须窗口级监听；kiosk 一体机红外屏部分以鼠标事件送达，同路
    // 一并覆盖。命中模型的按下才接管为拖动/点按（未命中完全放行给下层）；
    // 捕获阶段拦截并吞掉其后的 click，防止操作人物时误触下层按钮。
    const winCleanups: Array<() => void> = [];
    if (touchThrough) {
      let mouseSession = false;
      let suppressClickUntil = 0;
      const onMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return;
        if (!hitTestAt(e.clientX, e.clientY)) return;
        mouseSession = true;
        suppressClickUntil = 0;
        e.preventDefault();
        e.stopPropagation();
        touchNativeRef.current.start(e.clientX, e.clientY);
      };
      const onMouseMove = (e: MouseEvent) => {
        if (!mouseSession) return;
        touchNativeRef.current.move(e.clientX, e.clientY);
      };
      const onMouseUp = (e: MouseEvent) => {
        if (!mouseSession) return;
        mouseSession = false;
        suppressClickUntil = Date.now() + 350;
        e.stopPropagation();
        touchNativeRef.current.end(e.clientX, e.clientY);
      };
      const onClick = (e: MouseEvent) => {
        if (Date.now() >= suppressClickUntil) return;
        e.preventDefault();
        e.stopPropagation();
      };
      // 桌面特有：拖动中切窗/失焦会丢 mouseup，会话残留会让下次按下错乱
      const onBlur = () => {
        if (!mouseSession) return;
        mouseSession = false;
        touchNativeRef.current.cancel();
      };
      window.addEventListener('mousedown', onMouseDown, true);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp, true);
      window.addEventListener('click', onClick, true);
      window.addEventListener('blur', onBlur);
      winCleanups.push(
        () => window.removeEventListener('mousedown', onMouseDown, true),
        () => window.removeEventListener('mousemove', onMouseMove),
        () => window.removeEventListener('mouseup', onMouseUp, true),
        () => window.removeEventListener('click', onClick, true),
        () => window.removeEventListener('blur', onBlur),
      );
    }

    return () => {
      target.removeEventListener('touchstart', onStart);
      target.removeEventListener('touchmove', onMove);
      target.removeEventListener('touchend', onEnd);
      target.removeEventListener('touchcancel', onCancel);
      winCleanups.forEach((fn) => fn());
    };
  }, [canvasRef, getModelScale, applyPinchScale, setIsDragging, touchThrough]);

  useEffect(() => {
    if (!isPet && electronApi && isHoveringModelRef.current) {
      isHoveringModelRef.current = false;
    }
  }, [isPet, electronApi]);

  return {
    position,
    isDragging,
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
      // 触摸（拖动/捏合）改由组件内原生 touch 监听处理，见上方 useEffect
    },
  };
};
