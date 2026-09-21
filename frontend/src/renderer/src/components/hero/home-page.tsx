/**
 * Home Page Component
 * 学校数字人首页（官网化改版，2026-09-21；同日全站改版换石实官方绛红主题）
 * 视觉基调对齐省实式官网 + 石实 IP 官方色（见 site-theme.ts）：
 * 绛红校名横带（"石"字圆章 + 楷体校名 + 英文副标）→ 白色通栏栏目导航条
 * → 米白渐变内容区（学校简介+理念+亮点）→ 新闻/公告栏目（示例数据）→
 * 右侧偏大 Live2D 数字人 → 底部"开始对话"进入对话界面（#/hero）。
 * 页头（横带+导航条）由 SiteHeader 提供，与专题页/对话页同款。
 * 人物站位/大小由 use-live2d-model.ts 的 HOME_* 常量控制（右侧 78% 屏宽）。
 * 竖屏大屏（壁挂数字屏/竖放平板，portrait ≥768）：改为内容列限宽 840 居中 +
 *       字号按视口放大 + 人物居中站下方展示区（HOME_BOARD_* 常量），
 *       三端（手机/桌面横屏/竖屏大屏）各自独立形态。
 */

import { useState } from 'react';
import { Box, Flex, HStack, Text } from '@chakra-ui/react';
import { FiMessageCircle } from 'react-icons/fi';
import HeroSidebar from './hero-sidebar';
import SiteHeader from './site-header';
import { kaiFont, swissFont, siteTheme } from './site-theme';
import { useInterrupt } from '@/hooks/utils/use-interrupt';
import { usePortraitBoard } from '@/hooks/utils/use-portrait-board';
import { CampusTopicId } from '@/data/campus-knowledge';
import { PORTAL_ANNOUNCEMENTS, PORTAL_NEWS } from '@/data/portal-content';

// 亮点数据：南方+《佛山唯一！保送北大！》——"石实实验学校近年来第13位
// 因信息学特长保送进入清北的学子"，校领导最认可的硬成果
const HIGHLIGHT_COUNT = '13';

// 新闻/公告栏目：占位数据（事件真实、细节未获校方审核），首页展示前 3 条
const NEWS_COUNT = 3;
const ANNOUNCE_COUNT = 3;

interface HomePageProps {
  /** 进入指定专题页（由 App 提供，走 hash 路由） */
  onNavigateTopic?: (topicId: CampusTopicId) => void;
}

/** 板块标题：红字 + 短红下划线（省实官网式） */
function SectionTitle({ children, isPortraitBoard }: { children: string; isPortraitBoard: boolean }) {
  return (
    <Box mb={isPortraitBoard ? 3 : 2}>
      <Text
        as="span"
        color={siteTheme.red}
        fontWeight="bold"
        fontSize={isPortraitBoard ? '24px' : { base: '14px', md: '16px' }}
        letterSpacing="0.04em"
      >
        {children}
      </Text>
      <Box
        mt="3px"
        width={isPortraitBoard ? '56px' : '36px'}
        height={isPortraitBoard ? '4px' : '3px'}
        bg={siteTheme.red}
      />
    </Box>
  );
}

export default function HomePage({
  onNavigateTopic,
}: HomePageProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { interrupt } = useInterrupt();
  const isPortraitBoard = usePortraitBoard();

  // 进入对话界面：先打断可能进行中的播报，再切路由
  const goChat = () => {
    interrupt();
    window.location.hash = '#/hero';
  };

  const goTopic = (topicId: CampusTopicId) => {
    interrupt();
    if (onNavigateTopic) {
      onNavigateTopic(topicId);
      return;
    }
    window.location.hash = `#/campus/${topicId}`;
  };

  return (
    <Box
      position="relative"
      w="full"
      overflow="hidden"
      /* 大屏一体机：--app-vh 由 device-profile 视口守卫实测写入（kiosk ROM 的
         100vh 会缩水成半屏）；手机/桌面无该变量回退 100vh，行为不变 */
      style={{ height: 'var(--app-vh, 100vh)' }}
      css={{
        fontFamily: swissFont,
        background: siteTheme.wash,
      }}
    >
      {/* Content Column：z20 盖过 Live2D 穿透层(15)；页头入文档流，无需 pt 让位。
          竖屏大屏：整列限宽 840 居中（防 1272+ 宽拉伸），人物改居中站下方 */}
      <Flex
        direction="column"
        h="full"
        position="relative"
        zIndex={20}
        width={isPortraitBoard ? '100%' : undefined}
        maxWidth={isPortraitBoard ? '840px' : undefined}
        mx={isPortraitBoard ? 'auto' : undefined}
      >
        {/* 共享页头：绛红校名横带 + 白色通栏栏目导航条（与专题页/对话页同款） */}
        <SiteHeader
          activeNav="home"
          onNavigateTopic={goTopic}
          onGoChat={goChat}
          onOpenSettings={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* 学校简介块：无卡片边框，横向渐变右淡出（米白纸感基调），与背景融为一体。
            校名眉行与办学理念大标题不囿于左栏、可延展到人物侧（加白色光晕保可读）；
            下方内容仍在左侧窄栏多换行，不遮挡人物。轻重分明——校名(轻) /
            办学理念(重) / 校训·理念·价值观(轻) / 清北保送·扬长课程亮点(重) / App 简介(轻)。
            竖屏大屏：人物在下方居中，本块字号按视口放大（clamp 随屏宽 768~2160 连续缩放） */}
        <Box
          alignSelf="stretch"
          mt={isPortraitBoard ? 4 : { base: 1, md: 2 }}
          py={isPortraitBoard ? 6 : { base: 2, md: 3 }}
          pl={isPortraitBoard ? 8 : { base: 4, md: 12, lg: 16 }}
          pr={isPortraitBoard ? 10 : { base: 6, md: 10 }}
          background="linear-gradient(100deg, rgba(250, 247, 242, 0.95) 0%, rgba(250, 247, 242, 0.75) 32%, rgba(250, 247, 242, 0) 62%)"
        >
          {/* 宽区：校名 + 办学理念（延伸到右侧） */}
          <Box maxW={{ base: 'none', md: '760px' }}>
            <Text
              color={siteTheme.red}
              fontSize={isPortraitBoard ? '18px' : { base: '11px', md: '13px' }}
              fontWeight="600"
              letterSpacing="0.15em"
              lineHeight="1.6"
              textShadow="0 1px 6px rgba(255, 255, 255, 0.9)"
            >
              佛山市南海区石实实验学校 · AI校园数字人 · 小石
            </Text>

            <Text
              mt={isPortraitBoard ? 3 : { base: 1.5, md: 2 }}
              color={siteTheme.navy}
              fontFamily={kaiFont}
              fontSize={isPortraitBoard ? 'clamp(40px, 3.8vw, 56px)' : { base: '19px', md: '30px', lg: '34px' }}
              fontWeight="bold"
              lineHeight="1.35"
              textShadow="0 1px 8px rgba(255, 255, 255, 0.9), 0 0 18px rgba(255, 255, 255, 0.65)"
            >
              让每一个孩子都能成长、成才、成功
            </Text>
          </Box>

          {/* 窄栏：其余内容多换行（右侧留给人物；竖屏大屏人物在下方，放宽到 640 保阅读行长） */}
          <Box maxW={isPortraitBoard ? '640px' : { base: '212px', md: '520px' }}>
            <Text
              mt={isPortraitBoard ? 4 : { base: 1.5, md: 2 }}
              color={siteTheme.textBody}
              fontFamily={kaiFont}
              fontSize={isPortraitBoard ? '22px' : { base: '13px', md: '15px' }}
              lineHeight="1.7"
            >
              “扬长教育、人人出彩”
              <Box as="span" display="block">
                “以爱治校、尊重你我”
              </Box>
              <Box as="span" display="block">
                “任重道远、毋忘奋斗”
              </Box>
            </Text>

            {/* 亮点一：清北保送（据南方+公开报道） */}
            <Flex mt={isPortraitBoard ? 6 : { base: 3, md: 3 }} align="center" gap={isPortraitBoard ? 6 : { base: 3, md: 4 }}>
              <Text
                color={siteTheme.red}
                fontSize={isPortraitBoard ? 'clamp(56px, 5.5vw, 76px)' : { base: '44px', md: '52px' }}
                fontWeight="bold"
                lineHeight="1"
                flexShrink={0}
              >
                {HIGHLIGHT_COUNT}
              </Text>
              <Box maxW={{ base: '140px', md: 'none' }}>
                <Text
                  color={siteTheme.navy}
                  fontSize={isPortraitBoard ? '24px' : { base: '14px', md: '17px' }}
                  fontWeight="semibold"
                  lineHeight="1.5"
                >
                  位学子凭信息学特长
                  <Box as="span" display={isPortraitBoard ? 'block' : { base: 'block', md: 'inline' }}>
                    保送清华、北京大学
                  </Box>
                </Text>
                <Text
                  mt="3px"
                  color={siteTheme.textSecondary}
                  fontSize={isPortraitBoard ? '16px' : { base: '10px', md: '12px' }}
                  lineHeight="1.5"
                >
                  据南方+、南海区教育局公开报道
                </Text>
              </Box>
            </Flex>

            {/* 亮点二：扬长课程（学生视角的特色） */}
            <Flex mt={isPortraitBoard ? 4 : { base: 2, md: 2 }} align="center" gap={isPortraitBoard ? 6 : { base: 3, md: 4 }}>
              <Text
                color={siteTheme.red}
                fontSize={isPortraitBoard ? 'clamp(48px, 4.2vw, 64px)' : { base: '30px', md: '40px' }}
                fontWeight="bold"
                lineHeight="1"
                flexShrink={0}
              >
                100+
              </Text>
              <Box maxW={{ base: '132px', md: 'none' }}>
                <Text
                  color={siteTheme.navy}
                  fontSize={isPortraitBoard ? '24px' : { base: '14px', md: '17px' }}
                  fontWeight="semibold"
                  lineHeight="1.5"
                >
                  门扬长选修课
                </Text>
                <Text
                  mt="3px"
                  color={siteTheme.textSecondary}
                  fontSize={isPortraitBoard ? '16px' : { base: '10px', md: '12px' }}
                  lineHeight="1.5"
                >
                  每学期“大学式选课”，信息学、科创、体艺等任你选
                </Text>
              </Box>
            </Flex>

            {/* 分隔细线（收束亮点区） */}
            <Box
              mt={isPortraitBoard ? 6 : { base: 3, md: 3 }}
              width={isPortraitBoard ? '96px' : '64px'}
              height={isPortraitBoard ? '3px' : '2px'}
              bg="rgba(144, 27, 53, 0.35)"
            />
          </Box>
        </Box>

        {/* 新闻/公告栏目：省实官网式两栏（示例数据，事件真实、细节待校方审核）。
            全端双列；手机端每列收紧到 2 条可见（第 3 条 md 起显示）并隐藏
            分类/面向对象小字，保证定高页面里"开始对话"仍在首屏内 */}
        <Flex
          px={isPortraitBoard ? 8 : { base: 4, md: 12, lg: 16 }}
          pr={isPortraitBoard ? 10 : { base: 5, md: 10 }}
          mt={isPortraitBoard ? 4 : { base: 2, md: 3 }}
          gap={isPortraitBoard ? 10 : { base: 4, md: 10 }}
          direction="row"
        >
          {/* 学校新闻：红日期 + 标题 + 分类（荣誉喜报用青绿 chip） */}
          <Box flex={isPortraitBoard ? '1.2' : '1.15'} minW={0}>
            <SectionTitle isPortraitBoard={isPortraitBoard}>学校新闻</SectionTitle>
            {PORTAL_NEWS.slice(0, NEWS_COUNT).map((item, idx) => (
              <Flex
                key={item.id}
                align="flex-start"
                gap={isPortraitBoard ? 4 : { base: 2, md: 3 }}
                py={isPortraitBoard ? '10px' : { base: '3px', md: '5px' }}
                borderBottom="1px dashed"
                borderColor={siteTheme.hairline}
                display={idx === NEWS_COUNT - 1 && !isPortraitBoard
                  ? { base: 'none', md: 'flex' }
                  : 'flex'}
              >
                <Text
                  color={siteTheme.red}
                  fontSize={isPortraitBoard ? '17px' : { base: '10px', md: '12px' }}
                  fontWeight="600"
                  fontFamily={swissFont}
                  flexShrink={0}
                  pt="1px"
                >
                  {item.date}
                </Text>
                <Text
                  color={siteTheme.textBody}
                  fontSize={isPortraitBoard ? '19px' : { base: '11px', md: '13px' }}
                  lineHeight="1.5"
                  lineClamp={1}
                  flex="1"
                  minW={0}
                >
                  {item.title}
                </Text>
                <Box
                  flexShrink={0}
                  px={isPortraitBoard ? '10px' : '6px'}
                  py="1px"
                  borderRadius="sm"
                  fontSize={isPortraitBoard ? '14px' : { base: '9.5px', md: '10px' }}
                  display={isPortraitBoard ? 'block' : { base: 'none', md: 'block' }}
                  background={item.category === '荣誉喜报' ? siteTheme.tealWash : siteTheme.redWash}
                  color={item.category === '荣誉喜报' ? siteTheme.teal : siteTheme.red}
                >
                  {item.category}
                </Box>
              </Flex>
            ))}
          </Box>

          {/* 公告与通知：红wash 日期 chip + 标题 + 面向对象 */}
          <Box flex="1" minW={0}>
            <SectionTitle isPortraitBoard={isPortraitBoard}>公告与通知</SectionTitle>
            {PORTAL_ANNOUNCEMENTS.slice(0, ANNOUNCE_COUNT).map((item, idx) => (
              <Flex
                key={item.id}
                align="flex-start"
                gap={isPortraitBoard ? 4 : { base: 2, md: 3 }}
                py={isPortraitBoard ? '10px' : { base: '3px', md: '5px' }}
                borderBottom="1px dashed"
                borderColor={siteTheme.hairline}
                display={idx === ANNOUNCE_COUNT - 1 && !isPortraitBoard
                  ? { base: 'none', md: 'flex' }
                  : 'flex'}
              >
                <Box
                  flexShrink={0}
                  px={isPortraitBoard ? '10px' : '6px'}
                  py="1px"
                  borderRadius="sm"
                  background={siteTheme.redWash}
                  color={siteTheme.red}
                  fontSize={isPortraitBoard ? '14px' : { base: '9px', md: '10.5px' }}
                  fontWeight="600"
                  fontFamily={swissFont}
                  mt="1px"
                >
                  {item.date}
                </Box>
                <Box flex="1" minW={0}>
                  <Text
                    color={siteTheme.textBody}
                    fontSize={isPortraitBoard ? '19px' : { base: '11px', md: '13px' }}
                    lineHeight="1.5"
                    lineClamp={1}
                  >
                    {item.title}
                  </Text>
                </Box>
                <Text
                  flexShrink={0}
                  color={siteTheme.textSecondary}
                  fontSize={isPortraitBoard ? '14px' : { base: '9.5px', md: '10.5px' }}
                  pt="2px"
                  display={isPortraitBoard ? 'block' : { base: 'none', md: 'block' }}
                >
                  {item.audience}
                </Text>
              </Flex>
            ))}
          </Box>
        </Flex>
        <Text
          px={isPortraitBoard ? 8 : { base: 4, md: 12, lg: 16 }}
          mt={isPortraitBoard ? 2 : 1}
          color={siteTheme.textSecondary}
          fontSize={isPortraitBoard ? '14px' : { base: '9.5px', md: '10.5px' }}
        >
          新闻与公告为示例数据（事件来自公开报道），正式内容待校方审核后由后台发布流替换
        </Text>

        {/* 右侧留白：Live2D 数字人（右侧偏大站位）在此区域展示，画布由 App 渲染 */}
        <Box flex={1} minHeight={0} />

        {/* 开始对话：主行动按钮，进入对话界面（竖屏大屏：远距触控，按钮同步放大） */}
        <Box flexShrink={0} pb={isPortraitBoard ? 8 : { base: 2, md: 3 }} textAlign="center">
          <HStack justify="center">
            <Box
              as="button"
              onClick={goChat}
              aria-label="开始对话"
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              gap={isPortraitBoard ? '14px' : '10px'}
              height={isPortraitBoard ? '84px' : { base: '54px', md: '60px' }}
              px={isPortraitBoard ? 24 : { base: 10, md: 16 }}
              rounded="full"
              bg={siteTheme.red}
              color={siteTheme.paper}
              fontSize={isPortraitBoard ? '26px' : { base: 'lg', md: 'xl' }}
              fontWeight="semibold"
              boxShadow="0 10px 30px rgba(144, 27, 53, 0.35)"
              transition="all 0.2s ease"
              _hover={{ bg: siteTheme.redDark, transform: 'translateY(-2px)' }}
              _active={{ transform: 'scale(0.97)' }}
            >
              <FiMessageCircle size={isPortraitBoard ? 30 : 20} />
              开始对话
            </Box>
          </HStack>
          <HStack justify="center" mt={isPortraitBoard ? 4 : { base: 1.5, md: 2 }}>
            <Text
              fontSize={isPortraitBoard ? '17px' : { base: '11px', md: '12.5px' }}
              color={siteTheme.textBody}
              bg="rgba(255, 255, 255, 0.62)"
              px={isPortraitBoard ? 5 : 3}
              py={isPortraitBoard ? 2 : 1}
              rounded="full"
            >
              支持语音与文字提问，讲解过程可随时打断
            </Text>
          </HStack>
        </Box>
      </Flex>

      {/* 右侧设置侧栏 */}
      <HeroSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </Box>
  );
}
