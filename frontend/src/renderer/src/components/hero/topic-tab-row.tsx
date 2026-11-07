/**
 * Topic Tab Row Component
 * 专题选项行（学校简介/校史/学校成就/学习标兵 + 附加动作按钮）
 * 与专题页（campus-knowledge）顶部导航同款式：手机端一行横向滑动、桌面端居右换行，
 * 滑动与点击效果保持一致；首页与新页面均可复用。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, Button, Flex, HStack, Text } from '@chakra-ui/react';
import { FiBookOpen, FiClock, FiAward, FiUsers } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { CampusTopic, CampusTopicId, campusTopics } from '@/data/campus-knowledge';
import { usePortraitBoard } from '@/hooks/utils/use-portrait-board';
import { IS_KIOSK, isPhoneStyleViewport } from '@/utils/device-profile';
import { swissFont, siteTheme } from './site-theme';

/**
 * 页头导航按钮尺寸（2026-11-05 测试反馈视频2「菜单栏缩小字体，弄成一页版」，
 * 一体机和 App 都要改）：手机/一体机（phone-style base）压缩到 420 布局宽内
 * 放下「首页 + 学校概况/办学成果/招生咨询 + 新闻中心 + 对话」全部按钮。
 * 预算：4 字钮≈54px×4 + 带图标钮≈48px×2 + 间隙 5×5 + 行留白 2×6 ≈ 349px
 * ≤ 375（iPhone SE 最窄），一体机 420 与手机 390/393 都一页放满，不再横滑；
 * 竖屏壁挂大屏与桌面端尺寸不变。
 */
export function navSizing(isPortraitBoard: boolean) {
  const compact = !isPortraitBoard && isPhoneStyleViewport();
  return {
    height: isPortraitBoard ? '54px' : compact ? '34px' : '40px',
    px: isPortraitBoard ? '20px' : compact ? '5px' : '16px',
    fontSize: isPortraitBoard ? '19px' : compact ? '11px' : 'sm',
    icon: isPortraitBoard ? 22 : compact ? 12 : 16,
    /** 按钮内部图标与文字间距 */
    innerGap: isPortraitBoard ? '10px' : compact ? '4px' : '8px',
    /** 行内按钮间距 */
    rowGap: isPortraitBoard ? '10px' : compact ? '5px' : '8px',
    /** 行容器左右留白 */
    rowPx: isPortraitBoard ? '20px' : compact ? '6px' : { base: '12px', md: '20px', lg: '24px' },
  };
}

/**
 * 滑动红框指示器开关（2026-11-06 用户反馈：选中红框改为来回平滑滑动，
 * 选项本身不动）：手机/一体机/竖屏大屏（单行形态）开启；lg+ 桌面换行布局
 * 不开（跨行滑动轨迹怪异，维持按钮自身红底）。kiosk 陷阱同 NavDropdown：
 * 一体机的 Chakra lg 断点被顶到 9992px 永远不达，但裸 matchMedia 看物理
 * 视口（1080）会为 true——必须先排除 IS_KIOSK 再信 matchMedia。
 */
export function navIndicatorOn(isPortraitBoard: boolean): boolean {
  if (isPortraitBoard) return true;
  if (IS_KIOSK) return true;
  if (typeof window === 'undefined') return false;
  return !window.matchMedia('(min-width: 1024px)').matches;
}

/** 滑动红框几何（模块级跨实例记忆，2026-11-07 用户反馈「点首页/对话没有
 *  滑动动画」）：页头 SiteHeader 在首页/对话/栏目页/新闻页是各自页面的独立
 *  实例（home-page/hero-landing/campus-knowledge/App 各渲染一份），切路由时
 *  整个页头重挂载、pillSeenRef 归零 → 直接定位无动画。把上一次 pill 存进
 *  模块级变量：新实例首帧先画在旧位置（过渡已开启），下一帧 rAF 再实测真实
 *  位置 → 跨重挂载照样滑过去。key=包裹盒布局宽：手机(~378)与一体机(scale
 *  子树布局宽 ~240)坐标不通用，宽度不同不互借。 */
type PillRect = { left: number; top: number; width: number; height: number };
let savedPill: { key: number; pill: PillRect } | null = null;

const topicIcons: Record<CampusTopicId, IconType> = {
  intro: FiBookOpen,
  history: FiClock,
  achievements: FiAward,
  'role-models': FiUsers,
};

export function TopicTabButton({
  topic,
  active,
  onClick,
  // 主题色：全站官网化后默认石实绛红（2026-09-21 全站改版）
  activeBg = siteTheme.red,
  hoverWash = siteTheme.redWash,
  hoverInk = siteTheme.red,
}: {
  topic: CampusTopic;
  active: boolean;
  onClick: () => void;
  activeBg?: string;
  hoverWash?: string;
  hoverInk?: string;
}) {
  const Icon = topicIcons[topic.id];
  // 竖屏大屏：按钮放大（壁挂数字屏远距离触控/观看）
  const isPortraitBoard = usePortraitBoard();
  const s = navSizing(isPortraitBoard);
  // 滑动红框模式：红底由 TopicTabRow 的滑动指示器承担，按钮自身透明
  const flat = navIndicatorOn(isPortraitBoard);
  return (
    <Button
      data-testid={`campus-nav-${topic.id}`}
      aria-current={active ? 'page' : undefined}
      aria-label={`进入${topic.navLabel}页面`}
      onClick={onClick}
      height={s.height}
      px={s.px}
      borderRadius="md"
      position="relative"
      zIndex={flat ? 1 : undefined}
      background={active && !flat ? activeBg : 'transparent'}
      color={active ? 'white' : siteTheme.navy}
      fontFamily={swissFont}
      fontWeight="500"
      fontSize={s.fontSize}
      flexShrink={0}
      /* flat 模式 hover/active 全透明：手机点按后 :hover 粘住不消，近白
         redWash 底会画在透明按钮上盖住 z0 红框（2026-11-07 用户反馈
         「有层白色盖在上面」），红底只由滑动指示器承担 */
      _hover={{
        background: active && !flat ? activeBg : flat ? 'transparent' : hoverWash,
        color: active ? 'white' : hoverInk,
      }}
      _active={{
        background: active && !flat ? activeBg : flat ? 'transparent' : hoverWash,
      }}
      transition="all 200ms ease"
    >
      <HStack gap={s.innerGap}>
        <Icon size={s.icon} />
        <Text>{topic.navLabel}</Text>
      </HStack>
    </Button>
  );
}

interface TopicTabRowProps {
  /** 当前激活的专题（首页无专题传 null） */
  activeTopicId?: CampusTopicId | null;
  /** items 未传（默认专题按钮组）时必传；传 items 时可省 */
  onNavigateTopic?: (topicId: CampusTopicId) => void;
  /** 行首附加按钮（如首页的"首页"） */
  leading?: React.ReactNode;
  /** 行尾附加按钮（如首页的"对话界面"） */
  trailing?: React.ReactNode;
  /** 2026-09-21 官网 v2：自定义导航项（栏目下拉/新闻中心），替换默认专题按钮组。
          页头用 TopicTabRow 只为复用行壳与 kiosk JS 拖滑兜底 */
  items?: React.ReactNode;
}

export default function TopicTabRow({
  activeTopicId = null,
  onNavigateTopic,
  leading,
  trailing,
  items,
}: TopicTabRowProps) {
  // 竖屏大屏：整行按手机端"单行横滑"形态放大展示（内容列限宽内一行放不下时仍可滑）
  const isPortraitBoard = usePortraitBoard();
  const s = navSizing(isPortraitBoard);
  // 滑动红框指示器（2026-11-06 用户反馈）：单行形态开启
  const flat = navIndicatorOn(isPortraitBoard);

  // 一体机兜底：Chrome 95 在 transform:scale() 包装盒内不认触摸横滑手势，
  // overflowX:auto 的行真实手指划不动（CDP 完整手势可滚、原始触摸序列
  // 不触发合成器滚动，2026-09-17 真机实锤）。kiosk 用 JS 拖滑兜底——真实
  // 触摸事件必然送达监听器，直接改 scrollLeft；手机端原生惯性滚动不受影响。
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rowRef.current;
    if (!IS_KIOSK || !el) return undefined;
    let startX = 0;
    let startScroll = 0;
    let active = false;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        active = false;
        return;
      }
      active = true;
      startX = e.touches[0].clientX;
      startScroll = el.scrollLeft;
    };
    const onMove = (e: TouchEvent) => {
      if (!active || e.touches.length !== 1) return;
      el.scrollLeft = startScroll - (e.touches[0].clientX - startX);
    };
    const onEnd = () => {
      active = false;
    };
    el.addEventListener('touchstart', onStart, { passive: true, capture: true });
    el.addEventListener('touchmove', onMove, { passive: true, capture: true });
    el.addEventListener('touchend', onEnd, { passive: true, capture: true });
    return () => {
      el.removeEventListener('touchstart', onStart, true);
      el.removeEventListener('touchmove', onMove, true);
      el.removeEventListener('touchend', onEnd, true);
    };
  }, []);

  /* ── 滑动红框指示器（2026-11-06 用户反馈）──────────────────────────
     选中红底改为独立绝对定位 pill（zIndex 0，按钮 zIndex 1 压其上），切换
     选中项时 pill 以 transform/left+width 过渡平滑滑到新按钮下方，选项
     本身纹丝不动。测量用 getBoundingClientRect 差值 ÷ 包裹盒实际缩放比
     （一体机 --kiosk-css-scale 的 transform:scale 会放大视觉坐标，gBCR 差
     ÷ scale 还原为布局 px，pill 与按钮同处缩放子树内，布局 px 自洽）。
     无 framer-motion 依赖；纯 CSS transition GPU 合成不卡顿（Chrome 95 也支持）。 */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<PillRect | null>(null);
  const pillSeenRef = useRef(false);

  const measurePill = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const btn = wrap.querySelector<HTMLButtonElement>('button[aria-current="page"]');
    if (!btn) {
      if (pillSeenRef.current) {
        pillSeenRef.current = false;
        setPill(null);
      }
      return;
    }
    const wr = wrap.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const scale =
      wr.width > 0 && wrap.offsetWidth > 0 ? wr.width / wrap.offsetWidth : 1;
    const next = {
      left: (br.left - wr.left) / scale,
      top: (br.top - wr.top) / scale,
      width: br.width / scale,
      height: br.height / scale,
    };
    savedPill = { key: wrap.offsetWidth, pill: next };
    pillSeenRef.current = true;
    setPill((prev) =>
      prev &&
      Math.abs(prev.left - next.left) < 0.5 &&
      Math.abs(prev.top - next.top) < 0.5 &&
      Math.abs(prev.width - next.width) < 0.5 &&
      Math.abs(prev.height - next.height) < 0.5
        ? prev
        : next
    );
  }, []);

  // aria-current 随 activeNav 渲染移动后测量；字体加载/窗口缩放/横滑都会
  // 改变按钮几何，一并重测。items/leading/trailing 每次父组件渲染都是新
  // JSX（依赖变化即触发），measurePill 幂等去重，无多余渲染。
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    // 本实例首次测量：有跨页记忆（模块级 savedPill）先画旧位置、下一帧
    // rAF 再实测 → 重挂载也有滑动动画；无记忆（冷加载）直接定位，避免
    // 从 0 处飞入。pillSeenRef 置位后此分支不再进（后续渲染只重测）。
    if (!pillSeenRef.current && wrap) {
      const saved =
        savedPill && savedPill.key === wrap.offsetWidth ? savedPill.pill : null;
      if (saved) {
        pillSeenRef.current = true;
        setPill(saved);
        requestAnimationFrame(() => measurePill());
      } else {
        measurePill();
      }
    } else {
      measurePill();
    }
    const row = rowRef.current;
    window.addEventListener('resize', measurePill);
    row?.addEventListener('scroll', measurePill, { passive: true });
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined' && wrap) {
      ro = new ResizeObserver(() => measurePill());
      ro.observe(wrap);
    }
    // 字体晚到会改文字宽度 → 到位后重测一次
    document.fonts?.ready?.then(() => measurePill()).catch(() => {});
    return () => {
      window.removeEventListener('resize', measurePill);
      row?.removeEventListener('scroll', measurePill);
      ro?.disconnect();
    };
  }, [measurePill, activeTopicId, leading, trailing, items, flat]);

  return (
    <Box
      ref={wrapRef}
      position={flat ? 'relative' : undefined}
      flexShrink={0}
      px={s.rowPx}
      py={isPortraitBoard ? '12px' : { base: '8px', md: '10px' }}
      background={siteTheme.paper}
      // 2026-09-21 官网化改版：由悬浮卡片改为红横带下的通栏白导航条（省实式）
      borderBottom="1px solid"
      borderColor={siteTheme.hairline}
    >
      {/* 滑动红框（2026-11-06）：位置完全由测量驱动，mounted 后才有 → 无首帧跳变。
          2026-11-07 修「很卡」：动画从 left/top/width 改为 transform translate3d +
          width——transform 走合成器不逐帧重排（老内核上 left 动画是主因），width
          是绝对定位出流元素仅自身重排。zIndex 保持 0（按钮 z1 之下）：按钮文字
          必须浮在红框上方才可读；「白色盖住红框」的根因是手机点按后 :hover 粘住
          不消、近白 redWash hover 底画在透明按钮上——flat 模式 hover/active 已改
          全透明（按钮与 NavDropdown/首页/对话四处），底色源头清除。 */}
      {flat && pill && (
        <Box
          data-testid="nav-slide-indicator"
          aria-hidden="true"
          position="absolute"
          left={0}
          top={0}
          borderRadius="md"
          background={siteTheme.red}
          zIndex={0}
          pointerEvents="none"
          style={{
            transform: `translate3d(${pill.left}px, ${pill.top}px, 0)`,
            width: pill.width,
            height: pill.height,
            willChange: 'transform, width',
            transition: pillSeenRef.current
              ? 'transform 260ms cubic-bezier(0.4, 0, 0.2, 1), width 260ms cubic-bezier(0.4, 0, 0.2, 1)'
              : 'none',
          }}
        />
      )}
      {/* 手机端/竖屏大屏一行横向滑动；桌面端保持换行布局（与专题页一致）。
          2026-11-06 用户反馈「菜单栏还是可以左右滑动」：压缩预算本就 ≤375
          一页放满，base 直接 overflowX hidden 钉死不滑动（竖屏大屏保留 auto） */}
      <Flex
        ref={rowRef}
        align="center"
        /* 单行 flat 模式（手机/一体机）内容居中：一页版内容宽 ≤ 视口，flex-start
           右侧留白肉眼可见（一体机 ~50px），用户反馈「菜单栏不太对称」——居中
           后左右留白均等。竖屏大屏内容可能溢出（保持滚动）与桌面 lg+ 换行右对齐
           布局不变。注意 flat 时 base overflowX hidden，若极窄视口溢出会两侧裁切
           （预算 349≤375，正常机型不会发生） */
        justify={
          isPortraitBoard
            ? 'flex-start'
            : { base: flat ? 'center' : 'flex-start', lg: 'flex-end' }
        }
        gap={s.rowGap}
        flexWrap={isPortraitBoard ? 'nowrap' : { base: 'nowrap', lg: 'wrap' }}
        overflowX={isPortraitBoard ? 'auto' : { base: 'hidden', lg: 'visible' }}
        css={{ '&::-webkit-scrollbar': { display: 'none' } }}
      >
        {leading}
        {items ?? campusTopics.map((topic) => (
          <TopicTabButton
            key={topic.id}
            topic={topic}
            active={activeTopicId === topic.id}
            onClick={() => onNavigateTopic?.(topic.id)}
          />
        ))}
        {trailing}
      </Flex>
    </Box>
  );
}
