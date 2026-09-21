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
import { IS_KIOSK } from '@/utils/device-profile';

const swissFont = '"Helvetica Neue", Arial, sans-serif';
const ink = '#121826';
const blue = '#002FA7';
const blueWash = '#E8EEFF';
const hairline = '#E5E7EB';
const paper = '#FFFFFF';

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
  // 主题色：默认专题蓝；首页门户化后传校旗红（2026-09-21 官网化改版）
  activeBg = blue,
  hoverWash = blueWash,
  hoverInk = blue,
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
  return (
    <Button
      data-testid={`campus-nav-${topic.id}`}
      aria-current={active ? 'page' : undefined}
      aria-label={`进入${topic.navLabel}页面`}
      onClick={onClick}
      height={isPortraitBoard ? '54px' : '40px'}
      px={isPortraitBoard ? '20px' : { base: '12px', lg: '16px' }}
      borderRadius="md"
      background={active ? activeBg : 'transparent'}
      color={active ? 'white' : ink}
      fontFamily={swissFont}
      fontWeight="500"
      fontSize={isPortraitBoard ? '19px' : 'sm'}
      flexShrink={0}
      _hover={{
        background: active ? activeBg : hoverWash,
        color: active ? 'white' : hoverInk,
      }}
      transition="all 200ms ease"
    >
      <HStack gap={isPortraitBoard ? '10px' : '8px'}>
        <Icon size={isPortraitBoard ? 22 : 16} />
        <Text>{topic.navLabel}</Text>
      </HStack>
    </Button>
  );
}

interface TopicTabRowProps {
  /** 当前激活的专题（首页无专题传 null） */
  activeTopicId?: CampusTopicId | null;
  onNavigateTopic: (topicId: CampusTopicId) => void;
  /** 行首附加按钮（如首页的"首页"） */
  leading?: React.ReactNode;
  /** 行尾附加按钮（如首页的"对话界面"） */
  trailing?: React.ReactNode;
}

export default function TopicTabRow({
  activeTopicId = null,
  onNavigateTopic,
  leading,
  trailing,
}: TopicTabRowProps) {
  // 竖屏大屏：整行按手机端"单行横滑"形态放大展示（内容列限宽内一行放不下时仍可滑）
  const isPortraitBoard = usePortraitBoard();

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
      px={isPortraitBoard ? '20px' : { base: '12px', md: '20px', lg: '24px' }}
      py={isPortraitBoard ? '12px' : { base: '8px', md: '10px' }}
      background={paper}
      // 2026-09-21 官网化改版：由悬浮卡片改为红横带下的通栏白导航条（省实式）
      borderBottom="1px solid"
      borderColor={hairline}
    >
      {/* 手机端/竖屏大屏一行横向滑动；桌面端保持换行布局（与专题页一致） */}
      <Flex
        ref={rowRef}
        align="center"
        justify={isPortraitBoard ? 'flex-start' : { base: 'flex-start', lg: 'flex-end' }}
        gap={isPortraitBoard ? '10px' : '8px'}
        flexWrap={isPortraitBoard ? 'nowrap' : { base: 'nowrap', lg: 'wrap' }}
        overflowX={isPortraitBoard ? 'auto' : { base: 'auto', lg: 'visible' }}
        css={{ '&::-webkit-scrollbar': { display: 'none' } }}
      >
        {leading}
        {campusTopics.map((topic) => (
          <TopicTabButton
            key={topic.id}
            topic={topic}
            active={activeTopicId === topic.id}
            onClick={() => onNavigateTopic(topic.id)}
          />
        ))}
        {trailing}
      </Flex>
    </Box>
  );
}
