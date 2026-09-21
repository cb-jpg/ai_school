/**
 * Home Page Component
 * 学校数字人首页（官网化改版，2026-09-21）
 * 视觉基调对齐省实式官网：红色校名横带（"石"字圆章 + 楷体校名 + 英文副标）
 *       → 白色通栏栏目导航条（首页 + 四大专题 + 对话入口）→ 米白渐变内容区。
 * 布局：红横带 → 导航条（可横滑）→ 左上学校简介块（渐变融入背景，
 *       校名/理念标题可延展到人物侧，其余内容左侧窄栏多换行）→
 *       右侧偏大 Live2D 数字人（穿透画布）→ 底部"开始对话"进入对话界面（#/hero）
 * 人物站位/大小由 use-live2d-model.ts 的 HOME_* 常量控制（右侧 78% 屏宽）。
 * 竖屏大屏（壁挂数字屏/竖放平板，portrait ≥768）：改为内容列限宽 840 居中 +
 *       字号按视口放大 + 人物居中站下方展示区（HOME_BOARD_* 常量），
 *       三端（手机/桌面横屏/竖屏大屏）各自独立形态。
 */

import { useState } from 'react';
import { Box, Button, Flex, HStack, Text } from '@chakra-ui/react';
import { FiMessageCircle, FiHome, FiSettings } from 'react-icons/fi';
import HeroSidebar from './hero-sidebar';
import TopicTabRow from './topic-tab-row';
import { SCHOOL_CONFIG } from './school-config';
import { useInterrupt } from '@/hooks/utils/use-interrupt';
import { usePortraitBoard } from '@/hooks/utils/use-portrait-board';
import { CampusTopicId } from '@/data/campus-knowledge';

// 官网化配色：校旗红（红横带/激活态/主按钮）+ 墨灰正文 + 米白纸感底
const siteColors = {
  red: '#9B1B22',
  redDark: '#7A1218',
  redWash: '#F6E8E8',
  wash: '#FAF7F2',
  white: '#FFFFFF',
};

// 文字层级（与专题页一致的墨灰色系）
const textColors = {
  text: '#1F2937',          // 主要文字（深灰）
  textBody: '#4B5563',      // 正文（中灰）
  textSecondary: '#6B7280', // 次要文字（浅灰）
};

const kaiFont = "'STKaiti','KaiTi','楷体','Noto Serif SC',serif";
const swissFont = '"Helvetica Neue", Arial, sans-serif';

// 亮点数据：南方+《佛山唯一！保送北大！》——"石实实验学校近年来第13位
// 因信息学特长保送进入清北的学子"，校领导最认可的硬成果
const HIGHLIGHT_COUNT = '13';

interface HomePageProps {
  /** 进入指定专题页（由 App 提供，走 hash 路由） */
  onNavigateTopic?: (topicId: CampusTopicId) => void;
}

export default function HomePage({
  onNavigateTopic,
}: HomePageProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { interrupt } = useInterrupt();
  const isPortraitBoard = usePortraitBoard();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

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

  const goAdmin = () => {
    interrupt();
    window.location.hash = '#/main';
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
        background: siteColors.wash,
      }}
    >
      {/* Content Column：z20 盖过 Live2D 穿透层(15)；红横带与导航条入文档流，
          不再需要悬浮导航的 pt 让位。
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
        {/* 红色校名横带（省实式官网头部）："石"字圆章 + 楷体校名 + 英文副标；
            右侧后台入口 + 设置齿轮（HeroSidebar 触发） */}
        <Flex
          align="center"
          justify="space-between"
          gap={isPortraitBoard ? 4 : { base: 2, md: 3 }}
          bg={siteColors.red}
          color={siteColors.white}
          px={isPortraitBoard ? 6 : { base: 3, md: 5 }}
          py={isPortraitBoard ? '14px' : { base: '7px', md: '10px' }}
          flexShrink={0}
        >
          <HStack
            gap={isPortraitBoard ? '14px' : { base: '10px', md: '14px' }}
            align="center"
            minW={0}
          >
            {/* "石"字圆章 */}
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
            <Box
              as="button"
              onClick={goAdmin}
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
            {/* 设置齿轮：打开 HeroSidebar（模型/语音等设置） */}
            <Box
              as="button"
              onClick={toggleSidebar}
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

        {/* 白色通栏栏目导航条：行首"首页"（红色激活态）与专题页一致，
            行尾附"对话"入口；手机端/竖屏大屏横向滑动（kiosk 兜底在组件内） */}
        <TopicTabRow
          onNavigateTopic={goTopic}
          leading={
            <Button
              data-testid="campus-nav-home"
              aria-label="回到学校首页"
              aria-current="page"
              onClick={() => {
                interrupt();
                window.location.hash = '#/home';
              }}
              height={isPortraitBoard ? '54px' : '40px'}
              px={isPortraitBoard ? '20px' : { base: '12px', lg: '16px' }}
              borderRadius="md"
              /* 首页上此按钮恒为当前页：红底白字（官网化激活态） */
              background={siteColors.red}
              color="white"
              fontFamily={swissFont}
              fontWeight="500"
              fontSize={isPortraitBoard ? '19px' : 'sm'}
              flexShrink={0}
              _hover={{ background: siteColors.red, color: 'white' }}
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
              onClick={goChat}
              height={isPortraitBoard ? '54px' : '40px'}
              px={isPortraitBoard ? '20px' : '16px'}
              borderRadius="md"
              variant="ghost"
              flexShrink={0}
              color="#586174"
              fontFamily={swissFont}
              fontWeight="500"
              fontSize={isPortraitBoard ? '19px' : 'sm'}
              _hover={{ background: siteColors.redWash, color: siteColors.red }}
            >
              <FiMessageCircle size={isPortraitBoard ? 22 : 16} style={{ marginRight: '8px' }} />
              对话
            </Button>
          }
        />

        {/* 学校简介块：无卡片边框，横向渐变右淡出（米白纸感基调），与背景融为一体。
            校名眉行与办学理念大标题不囿于左栏、可延展到人物侧（加白色光晕保可读）；
            下方内容仍在左侧窄栏多换行，不遮挡人物。轻重分明——校名(轻) /
            办学理念(重) / 校训·理念·价值观(轻) / 清北保送·扬长课程亮点(重) / App 简介(轻)。
            竖屏大屏：人物在下方居中，本块字号按视口放大（clamp 随屏宽 768~2160 连续缩放） */}
        <Box
          alignSelf="stretch"
          mt={isPortraitBoard ? 6 : { base: 2, md: 4 }}
          py={isPortraitBoard ? 8 : { base: 3, md: 5 }}
          pl={isPortraitBoard ? 8 : { base: 4, md: 12, lg: 16 }}
          pr={isPortraitBoard ? 10 : { base: 6, md: 10 }}
          background="linear-gradient(100deg, rgba(250, 247, 242, 0.95) 0%, rgba(250, 247, 242, 0.75) 32%, rgba(250, 247, 242, 0) 62%)"
        >
          {/* 宽区：校名 + 办学理念（延伸到右侧） */}
          <Box maxW={{ base: 'none', md: '760px' }}>
            <Text
              color={siteColors.red}
              fontSize={isPortraitBoard ? '18px' : { base: '11px', md: '13px' }}
              fontWeight="600"
              letterSpacing="0.15em"
              lineHeight="1.6"
              textShadow="0 1px 6px rgba(255, 255, 255, 0.9)"
            >
              佛山市南海区石实实验学校 · AI校园数字人 · 小石
            </Text>

            <Text
              mt={isPortraitBoard ? 4 : { base: 2, md: 2.5 }}
              color={textColors.text}
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
              mt={isPortraitBoard ? 5 : { base: 2, md: 2 }}
              color={textColors.textBody}
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
            <Flex mt={isPortraitBoard ? 8 : { base: 4, md: 4 }} align="center" gap={isPortraitBoard ? 6 : { base: 3, md: 4 }}>
              <Text
                color={siteColors.red}
                fontSize={isPortraitBoard ? 'clamp(56px, 5.5vw, 76px)' : { base: '44px', md: '52px' }}
                fontWeight="bold"
                lineHeight="1"
                flexShrink={0}
              >
                {HIGHLIGHT_COUNT}
              </Text>
              <Box maxW={{ base: '140px', md: 'none' }}>
                <Text
                  color={textColors.text}
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
                  color={textColors.textSecondary}
                  fontSize={isPortraitBoard ? '16px' : { base: '10px', md: '12px' }}
                  lineHeight="1.5"
                >
                  据南方+、南海区教育局公开报道
                </Text>
              </Box>
            </Flex>

            {/* 亮点二：扬长课程（学生视角的特色） */}
            <Flex mt={isPortraitBoard ? 6 : { base: 3, md: 3 }} align="center" gap={isPortraitBoard ? 6 : { base: 3, md: 4 }}>
              <Text
                color={siteColors.red}
                fontSize={isPortraitBoard ? 'clamp(48px, 4.2vw, 64px)' : { base: '30px', md: '40px' }}
                fontWeight="bold"
                lineHeight="1"
                flexShrink={0}
              >
                100+
              </Text>
              <Box maxW={{ base: '132px', md: 'none' }}>
                <Text
                  color={textColors.text}
                  fontSize={isPortraitBoard ? '24px' : { base: '14px', md: '17px' }}
                  fontWeight="semibold"
                  lineHeight="1.5"
                >
                  门扬长选修课
                </Text>
                <Text
                  mt="3px"
                  color={textColors.textSecondary}
                  fontSize={isPortraitBoard ? '16px' : { base: '10px', md: '12px' }}
                  lineHeight="1.5"
                >
                  每学期“大学式选课”，信息学、科创、体艺等任你选
                </Text>
              </Box>
            </Flex>

            {/* 分隔细线（收束亮点区） */}
            <Box
              mt={isPortraitBoard ? 8 : { base: 4, md: 4 }}
              width={isPortraitBoard ? '96px' : '64px'}
              height={isPortraitBoard ? '3px' : '2px'}
              bg="rgba(155, 27, 34, 0.35)"
            />
          </Box>
        </Box>

        {/* 右侧留白：Live2D 数字人（右侧偏大站位）在此区域展示，画布由 App 渲染 */}
        <Box flex={1} minHeight={0} />

        {/* 开始对话：主行动按钮，进入对话界面（竖屏大屏：远距触控，按钮同步放大） */}
        <Box flexShrink={0} pb={isPortraitBoard ? 10 : { base: 2, md: 4 }} textAlign="center">
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
              bg={siteColors.red}
              color={siteColors.white}
              fontSize={isPortraitBoard ? '26px' : { base: 'lg', md: 'xl' }}
              fontWeight="semibold"
              boxShadow="0 10px 30px rgba(155, 27, 34, 0.35)"
              transition="all 0.2s ease"
              _hover={{ bg: siteColors.redDark, transform: 'translateY(-2px)' }}
              _active={{ transform: 'scale(0.97)' }}
            >
              <FiMessageCircle size={isPortraitBoard ? 30 : 20} />
              开始对话
            </Box>
          </HStack>
          <HStack justify="center" mt={isPortraitBoard ? 5 : { base: 2, md: 3 }}>
            <Text
              fontSize={isPortraitBoard ? '17px' : { base: '11px', md: '12.5px' }}
              color={textColors.textBody}
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
