/**
 * 设备形态判定（大屏一体机适配）
 *
 * 问题背景：安卓触控一体机（21.5"~32" 立式/壁挂 kiosk）的系统密度通常是
 * mdpi(160dpi)=1.0，WebView 视口宽度=物理像素（1080/1920 起步），远超手机
 * 的 360~430px。所有 `innerWidth >= 768` / Chakra `md:` 断点都会把一体机
 * 当成"桌面端"，走桌面布局并跳过手机端调好的 Live2D 站位适配，UI 全乱。
 *
 * 两轮适配：
 *   v1.7 断点顶飞（IS_KIOSK 时 Chakra sm+ 断点不可达）+ textZoom 钉 100，
 *        解决"被当桌面端"；但 px 定版的手机 UI 铺在 1080 宽视口上仍然字小如蚁。
 *   v2.0 视口缩放：meta 钉 width=420，Chromium 按手机宽排版再整体 ×2.57
 *        放大铺满物理屏（文字重排光栅化保持清晰）；dpr 钉成放大倍数使
 *        Live2D 画布按物理像素 1:1 渲染不发糊；--app-vh 守卫换算成 CSS px。
 *
 * 判定标准：触摸屏（maxTouchPoints>0）且视口短边 ≥640px —— 手机/平板之外
 * 的大屏触摸设备（kiosk）。桌面预览（Electron/浏览器）无触摸不受影响；
 * 手机（视口短边 <640）不受影响。
 */

/** 视口短边 ≥640px 的触摸设备 ⇒ 大屏一体机（kiosk）。
 *  必须在下面的视口缩放（meta 改写）之前调用——改写后 innerWidth 变手机宽，
 *  该判定将不再成立（所以 IS_KIOSK 只在模块加载时求值一次）。 */
export const isLargeTouchViewport = (): boolean => {
  if (typeof window === 'undefined') return false;
  const touchPoints = navigator.maxTouchPoints ?? 0;
  if (touchPoints <= 0) return false;
  return Math.min(window.innerWidth, window.innerHeight) >= 640;
};

/** 是否按"手机竖屏"那套样式渲染（真手机 + 大屏一体机都算）。
 *  一体机复用手机端调好的布局与人物站位，不再走桌面断点。 */
export const isPhoneStyleViewport = (): boolean => {
  if (typeof window === 'undefined') return true;
  return window.innerWidth < 768 || isLargeTouchViewport();
};

/** 模块加载时判定一次（WebView 里视口不会中途换设备；桌面预览固定 false） */
export const IS_KIOSK = isLargeTouchViewport();

// ── 大屏一体机视口缩放（2026-09-14 二轮适配）────────────────────────────
// v1.7 只解决了"断点顶飞走手机样式"，但一体机密度 1.0 时视口宽=物理像素
// （1080×1920 CSS px 起），手机端按 px 定版的 UI（11~19px 字、212px 窄栏）
// 原样铺在巨幅视口上——实机照片实录：全部内容缩在左上角、字小如蚁。
// 参考 report-web（同校另一 App，一体机显示正常）：它没有任何缩放黑科技，
// 是靠 max-width 居中列 + 响应式断点做到"任意视口下整齐但偏小"，那是
// 近距离手机应用的取舍；展示一体机需要的是"手机版放大铺满"，于是直接
// 把布局视口钉成手机宽度，让 Chromium 整体放大铺满物理屏：
//   <meta viewport width=420> ⇒ 以 420×~746 CSS px 排版，initial-scale=
//   屏宽/420≈2.57，文字按最终比例重排光栅化（同浏览器缩放，清晰不糊），
//   站位/断点/键盘等全部手机既有逻辑原样生效。
const KIOSK_LAYOUT_WIDTH = 420;
/** 物理放大倍数 = 屏宽(DIP) / 布局视口宽；1080 屏 ≈ 2.571。 */
export const KIOSK_SCALE =
  IS_KIOSK && typeof window !== 'undefined'
    ? window.screen.width / KIOSK_LAYOUT_WIDTH
    : 1;

if (IS_KIOSK) {
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    // ⚠️ 不能带 maximum-scale=1（v1.9 曾写入）：它会把 fit-width 的
    // initial-scale(≈2.57) 钳回 1，页面又缩回左上角。锁捏合靠
    // user-scalable=no 已足够。
    meta.setAttribute(
      'content',
      `width=${KIOSK_LAYOUT_WIDTH}, user-scalable=no, viewport-fit=cover`,
    );
  }
  // Live2D 画布分辨率 = clientWidth(420) × dpr。把 dpr 钉成放大倍数后，
  // 画布后备存储 ≈ 物理像素宽，人物 1:1 原生渲染而非 2.57× 拉伸发糊。
  // lappdelegate.ts / use-live2d-resize.ts 均在 resize 时读取该值，触摸
  // 命中换算（canvas.width/clientWidth）也随之自动一致。
  try {
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      get: () => KIOSK_SCALE,
    });
  } catch {
    /* 极老内核 defineProperty 失败：仅人物清晰度降级为放大糊，布局不受影响 */
  }
}

// ── 大屏一体机视口高度守卫（2026-09-14 一体机实机踩坑）──────────────────
// 现象：一体机上页面只画出上半截（首页止于 ~50%、对话页 ~79%），下半屏全是
// 背景——kiosk ROM 的 WebView 视口上报不可靠（innerHeight/visualViewport.height
// 随机缩水），100vh/键盘收缩逻辑跟着受害。
// 方案：周期性把 max(innerHeight, vv.height, screen.height/缩放-120) 写入
// --app-vh，页面根容器（首页/对话页/hero 图层）改用该变量。screen.height 是
// 唯一不随 ROM 视口 bug 缩水的源；注意其单位是物理像素，v2.0 起布局视口已是
// 手机宽（420 CSS px），须除以 KIOSK_SCALE 换算成 CSS px 再作底线（v1.9 在
// 物理像素=CSS px 的世界里写 -120，换视口后不除会得到 7 倍高的荒谬值）。
// -120 为底部系统栏余量（误差落在底部渐变收束区，宁可少画一点由窗口背景
// #E3D2D0 无缝补上，也不能缩成半截）。
// 仅 IS_KIOSK 生效；手机/桌面 --app-vh 不存在，var() 回退 100vh 行为不变。
const startKioskViewportGuard = (): void => {
  const w = window as unknown as Record<string, unknown>;
  if (w.__kioskVhGuard) return; // 防重复初始化
  w.__kioskVhGuard = true;

  const apply = () => {
    const vvH = window.visualViewport?.height ?? 0;
    const screenCssH = (window.screen?.height ?? 0) / KIOSK_SCALE;
    // 视口缩放已生效（innerWidth 已变手机宽）时，结果再封顶到一整屏 CSS 高：
    // 兜住模块初始化早于 meta 重排、innerHeight 仍按物理像素上报的首帧
    //（否则首帧 --app-vh≈1850px，页面根部高出视口一倍半）
    const capped = window.innerWidth <= KIOSK_LAYOUT_WIDTH + 1;
    const h = Math.min(
      Math.max(window.innerHeight, vvH, screenCssH - 120),
      capped ? screenCssH : Number.POSITIVE_INFINITY,
    );
    document.documentElement.style.setProperty('--app-vh', `${Math.round(h)}px`);
  };

  window.addEventListener('resize', apply);
  window.visualViewport?.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  document.addEventListener('visibilitychange', apply);
  apply();
  // kiosk ROM 常丢 resize 事件：低频兜底轮询
  setInterval(apply, 1500);
};

if (IS_KIOSK) startKioskViewportGuard();

// kiosk 禁捏合缩放已并入上方视口缩放块的 meta（user-scalable=no）：
// v1.9 的 maximum-scale=1.0 与 v2.0 的 fit-width 放大冲突，已移除。
