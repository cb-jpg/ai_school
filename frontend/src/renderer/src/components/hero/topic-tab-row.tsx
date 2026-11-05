/**
 * Topic Tab Row Component
 * 专题选项行（学校简介/校史/学校成就/学习标兵 + 附加动作按钮）
 * 与专题页（campus-knowledge）顶部导航同款式：手机端一行横向滑动、桌面端居右换行，
 * 滑动与点击效果保持一致；首页与新页面均可复用。
 */
import { useEffect, useRef } from 'react';
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
  return (
    <Button
      data-testid={`campus-nav-${topic.id}`}
      aria-current={active ? 'page' : undefined}
      aria-label={`进入${topic.navLabel}页面`}
      onClick={onClick}
      height={s.height}
      px={s.px}
      borderRadius="md"
      background={active ? activeBg : 'transparent'}
      color={active ? 'white' : siteTheme.navy}
      fontFamily={swissFont}
      fontWeight="500"
      fontSize={s.fontSize}
      flexShrink={0}
      _hover={{
        background: active ? activeBg : hoverWash,
        color: active ? 'white' : hoverInk,
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

  return (
    <Box
      flexShrink={0}
      px={s.rowPx}
      py={isPortraitBoard ? '12px' : { base: '8px', md: '10px' }}
      background={siteTheme.paper}
      // 2026-09-21 官网化改版：由悬浮卡片改为红横带下的通栏白导航条（省实式）
      borderBottom="1px solid"
      borderColor={siteTheme.hairline}
    >
      {/* 手机端/竖屏大屏一行横向滑动；桌面端保持换行布局（与专题页一致） */}
      <Flex
        ref={rowRef}
        align="center"
        justify={isPortraitBoard ? 'flex-start' : { base: 'flex-start', lg: 'flex-end' }}
        gap={s.rowGap}
        flexWrap={isPortraitBoard ? 'nowrap' : { base: 'nowrap', lg: 'wrap' }}
        overflowX={isPortraitBoard ? 'auto' : { base: 'auto', lg: 'visible' }}
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
