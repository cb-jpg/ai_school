/**
 * Site Header Component
 * 全站共享页头（2026-09-21 全站官网化）：绛红校名横带 + 白色通栏栏目导航条。
 * 首页（home-page）/ 专题页（campus-knowledge）/ 对话页（hero-landing）三处共用，
 * 保证三个页面同款页头；栏目激活态由 activeNav 决定（红底白字）。
 * 横带：石字圆章 + 楷体校名 + 英文副标 + 后台管理入口 + 设置齿轮；
 * 导航行：首页 + 四大专题 + 对话入口（TopicTabRow，含 kiosk JS 拖滑兜底）。
 */
import { Box, Button, Flex, HStack, Text } from '@chakra-ui/react';
import { FiHome, FiMessageCircle, FiSettings } from 'react-icons/fi';
import TopicTabRow from './topic-tab-row';
import { SCHOOL_CONFIG } from './school-config';
import { kaiFont, swissFont, siteTheme } from './site-theme';
import { useInterrupt } from '@/hooks/utils/use-interrupt';
import { usePortraitBoard } from '@/hooks/utils/use-portrait-board';
import { CampusTopicId } from '@/data/campus-knowledge';

export type SiteNavActive = 'home' | 'dialog' | CampusTopicId;

interface SiteHeaderProps {
  /** 当前激活栏目（红底白字） */
  activeNav: SiteNavActive;
  /** 进入指定专题页 */
  onNavigateTopic: (topicId: CampusTopicId) => void;
  /** 进入对话界面（先打断播报再切路由由内部处理） */
  onGoChat: () => void;
  /** 设置齿轮回调（打开 HeroSidebar） */
  onOpenSettings: () => void;
  /** 是否显示"后台管理"入口（默认显示） */
  showAdmin?: boolean;
}

export default function SiteHeader({
  activeNav,
  onNavigateTopic,
  onGoChat,
  onOpenSettings,
  showAdmin = true,
}: SiteHeaderProps) {
  const { interrupt } = useInterrupt();
  const isPortraitBoard = usePortraitBoard();

  const goHash = (hash: string) => {
    interrupt();
    window.location.hash = hash;
  };

  const goTopic = (topicId: CampusTopicId) => {
    interrupt();
    onNavigateTopic(topicId);
  };

  return (
    <>
      {/* 绛红校名横带："石"字圆章 + 楷体校名 + 英文副标；右侧后台入口 + 设置齿轮 */}
      <Flex
        align="center"
        justify="space-between"
        gap={isPortraitBoard ? 4 : { base: 2, md: 3 }}
        bg={siteTheme.red}
        color={siteTheme.paper}
        px={isPortraitBoard ? 6 : { base: 3, md: 5 }}
        py={isPortraitBoard ? '14px' : { base: '7px', md: '10px' }}
        flexShrink={0}
      >
        <HStack
          gap={isPortraitBoard ? '14px' : { base: '10px', md: '14px' }}
          align="center"
          minW={0}
        >
          {/* "石"字圆章（校徽矢量图到位前的占位章） */}
          <Box
            flexShrink={0}
            display="flex"
            alignItems="center"
            justifyContent="center"
            width={isPortraitBoard ? '52px' : { base: '36px', md: '42px' }}
            height={isPortraitBoard ? '52px' : { base: '36px', md: '42px' }}
            borderRadius="full"
            border="2px solid rgba(255, 255, 255, 0.85)"
            fontFamily={kaiFont}
            fontWeight="bold"
            fontSize={isPortraitBoard ? '28px' : { base: '19px', md: '23px' }}
            lineHeight="1"
          >
            石
          </Box>
          <Box minW={0}>
            <Text
              fontFamily={kaiFont}
              fontWeight="bold"
              fontSize={isPortraitBoard ? '28px' : { base: '17px', md: '22px' }}
              letterSpacing="0.08em"
              lineHeight="1.15"
              whiteSpace="nowrap"
            >
              {SCHOOL_CONFIG.name}
            </Text>
            <Text
              display={isPortraitBoard ? 'block' : { base: 'none', md: 'block' }}
              fontSize={isPortraitBoard ? '13px' : { base: '8.5px', md: '10px' }}
              letterSpacing="0.22em"
              opacity={0.85}
              mt="2px"
              whiteSpace="nowrap"
            >
              SHISHI EXPERIMENTAL SCHOOL · 扬长教育 人人出彩
            </Text>
          </Box>
        </HStack>

        <HStack gap={isPortraitBoard ? 3 : 2} flexShrink={0}>
          {/* 后台管理：进入管理界面（#/main，未登录由 App 登录门禁接管） */}
          {showAdmin && (
            <Box
              as="button"
              onClick={() => goHash('#/main')}
              aria-label="进入后台管理"
              display={isPortraitBoard ? 'block' : { base: 'none', md: 'block' }}
              fontSize={isPortraitBoard ? '18px' : { base: '12.5px', md: '13px' }}
              opacity={0.92}
              px={isPortraitBoard ? 3 : 2}
              py={1}
              borderRadius="md"
              whiteSpace="nowrap"
              transition="all 0.2s ease"
              _hover={{ opacity: 1, background: 'rgba(255, 255, 255, 0.14)' }}
            >
              后台管理
            </Box>
          )}
          {/* 设置齿轮：打开 HeroSidebar（模型/语音等设置） */}
          <Box
            as="button"
            onClick={onOpenSettings}
            aria-label="打开设置"
            display="flex"
            alignItems="center"
            justifyContent="center"
            p={isPortraitBoard ? '10px' : '7px'}
            borderRadius="full"
            transition="all 0.2s ease"
            _hover={{ background: 'rgba(255, 255, 255, 0.16)' }}
          >
            <FiSettings size={isPortraitBoard ? 26 : 18} />
          </Box>
        </HStack>
      </Flex>

      {/* 白色通栏栏目导航条：首页（行首）+ 四大专题 + 对话入口（行尾） */}
      <TopicTabRow
        activeTopicId={activeNav === 'dialog' || activeNav === 'home' ? null : activeNav}
        onNavigateTopic={goTopic}
        leading={
          <Button
            data-testid="campus-nav-home"
            aria-label="回到学校首页"
            aria-current={activeNav === 'home' ? 'page' : undefined}
            onClick={() => goHash('#/home')}
            height={isPortraitBoard ? '54px' : '40px'}
            px={isPortraitBoard ? '20px' : { base: '12px', lg: '16px' }}
            borderRadius="md"
            background={activeNav === 'home' ? siteTheme.red : 'transparent'}
            color={activeNav === 'home' ? 'white' : '#586174'}
            fontFamily={swissFont}
            fontWeight="500"
            fontSize={isPortraitBoard ? '19px' : 'sm'}
            flexShrink={0}
            _hover={{
              background: activeNav === 'home' ? siteTheme.red : siteTheme.redWash,
              color: activeNav === 'home' ? 'white' : siteTheme.red,
            }}
            transition="all 200ms ease"
          >
            <HStack gap={isPortraitBoard ? '10px' : '8px'}>
              <FiHome size={isPortraitBoard ? 22 : 16} />
              <Text>首页</Text>
            </HStack>
          </Button>
        }
        trailing={
          <Button
            aria-label="进入对话界面"
            aria-current={activeNav === 'dialog' ? 'page' : undefined}
            onClick={() => {
              interrupt();
              onGoChat();
            }}
            height={isPortraitBoard ? '54px' : '40px'}
            px={isPortraitBoard ? '20px' : '16px'}
            borderRadius="md"
            variant="ghost"
            flexShrink={0}
            background={activeNav === 'dialog' ? siteTheme.red : 'transparent'}
            color={activeNav === 'dialog' ? 'white' : '#586174'}
            fontFamily={swissFont}
            fontWeight="500"
            fontSize={isPortraitBoard ? '19px' : 'sm'}
            _hover={{
              background: activeNav === 'dialog' ? siteTheme.red : siteTheme.redWash,
              color: activeNav === 'dialog' ? 'white' : siteTheme.red,
            }}
          >
            <FiMessageCircle size={isPortraitBoard ? 22 : 16} style={{ marginRight: '8px' }} />
            对话
          </Button>
        }
      />
    </>
  );
}
