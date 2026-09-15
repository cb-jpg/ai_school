/**
 * Home Page Component
 * 学校数字人首页（验收展示页）
 * 布局：导航栏 → 专题选项行（可横滑）→ 左上学校简介块（渐变融入背景，
 *       校名/理念标题可延展到人物侧，其余内容左侧窄栏多换行）→
 *       右侧偏大 Live2D 数字人（穿透画布）→ 底部"开始对话"进入对话界面（#/hero）
 * 人物站位/大小由 use-live2d-model.ts 的 HOME_* 常量控制（右侧 78% 屏宽）。
 * 竖屏大屏（壁挂数字屏/竖放平板，portrait ≥768）：改为内容列限宽 840 居中 +
 *       字号按视口放大 + 人物居中站下方展示区（HOME_BOARD_* 常量），
 *       三端（手机/桌面横屏/竖屏大屏）各自独立形态。
 */

import { useState } from 'react';
import { Box, Button, Flex, HStack, Text } from '@chakra-ui/react';
import { FiMessageCircle, FiHome } from 'react-icons/fi';
import Navbar from './navbar';
import MobileMenu from './mobile-menu';
import HeroSidebar from './hero-sidebar';
import TopicTabRow from './topic-tab-row';
import { SCHOOL_CONFIG } from './school-config';
import { useInterrupt } from '@/hooks/utils/use-interrupt';
import { usePortraitBoard } from '@/hooks/utils/use-portrait-board';
import { CampusTopicId } from '@/data/campus-knowledge';

// 学校配色方案 - 与对话界面一致
const schoolColors = {
  primary: '#1E5494',    // 深蓝色，代表知识和专业
  text: '#1F2937',       // 主要文字（深灰）
  textBody: '#4B5563',   // 正文（中灰）
  textSecondary: '#6B7280', // 次要文字（浅灰）
  white: '#FFFFFF',
};

// 专题页同款配色（选项行与专题页视觉统一）
const campusColors = {
  blue: '#002FA7',
  blueWash: '#E8EEFF',
  swissFont: '"Helvetica Neue", Arial, sans-serif',
};

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { interrupt } = useInterrupt();
  const isPortraitBoard = usePortraitBoard();

  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

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

  return (
    <Box
      position="relative"
      h="100vh"
      w="full"
      overflow="hidden"
      css={{
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* Navigation Bar（首页由顶部选项行承担导航，隐藏桌面端中部导航避免重复） */}
      <Navbar
        schoolName={SCHOOL_CONFIG.name}
        navigation={SCHOOL_CONFIG.navigation}
        hideCenterNav
        onMobileMenuToggle={handleMobileMenuToggle}
        mobileMenuOpen={mobileMenuOpen}
        onSettingsToggle={toggleSidebar}
      />

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={closeMobileMenu}
        navigation={SCHOOL_CONFIG.navigation}
      />

      {/* Content Column：z20 盖过 Live2D 穿透层(15)；pt 避开悬浮导航栏(手机~88px)；
          人物在右侧，内容在左上不与其相争。
          竖屏大屏：整列限宽 840 居中（防 1272+ 宽拉伸），人物改居中站下方 */}
      <Flex
        direction="column"
        h="full"
        position="relative"
        zIndex={20}
        pt={isPortraitBoard ? '150px' : { base: '92px', md: '110px' }}
        width={isPortraitBoard ? '100%' : undefined}
        maxWidth={isPortraitBoard ? '840px' : undefined}
        mx={isPortraitBoard ? 'auto' : undefined}
      >
        {/* 专题选项行：与专题页同款（手机端横向滑动），行首"首页"与专题页一致，
            行尾附"对话"入口 */}
        <Box px={isPortraitBoard ? 0 : { base: 3, md: 12, lg: 16 }}>
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
                /* 首页上此按钮恒为当前页：与专题页 TopicNavigationButton 激活态同款（蓝底白字） */
                background={campusColors.blue}
                color="white"
                fontFamily={campusColors.swissFont}
                fontWeight="500"
                fontSize={isPortraitBoard ? '19px' : 'sm'}
                flexShrink={0}
                _hover={{ background: campusColors.blue, color: 'white' }}
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
                fontFamily={campusColors.swissFont}
                fontWeight="500"
                fontSize={isPortraitBoard ? '19px' : 'sm'}
                _hover={{ background: campusColors.blueWash, color: campusColors.blue }}
              >
                <FiMessageCircle size={isPortraitBoard ? 22 : 16} style={{ marginRight: '8px' }} />
                对话
              </Button>
            }
          />
        </Box>

        {/* 学校简介块：无卡片边框，横向渐变右淡出，与背景融为一体。
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
          background="linear-gradient(100deg, rgba(248, 250, 252, 0.94) 0%, rgba(248, 250, 252, 0.72) 32%, rgba(248, 250, 252, 0) 62%)"
        >
          {/* 宽区：校名 + 办学理念（延伸到右侧） */}
          <Box maxW={{ base: 'none', md: '760px' }}>
            <Text
              color={schoolColors.primary}
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
              color={schoolColors.text}
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
              color={schoolColors.textBody}
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
                color={schoolColors.primary}
                fontSize={isPortraitBoard ? 'clamp(56px, 5.5vw, 76px)' : { base: '44px', md: '52px' }}
                fontWeight="bold"
                lineHeight="1"
                flexShrink={0}
              >
                {HIGHLIGHT_COUNT}
              </Text>
              <Box maxW={{ base: '140px', md: 'none' }}>
                <Text
                  color={schoolColors.text}
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
                  color={schoolColors.textSecondary}
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
                color={schoolColors.primary}
                fontSize={isPortraitBoard ? 'clamp(48px, 4.2vw, 64px)' : { base: '30px', md: '40px' }}
                fontWeight="bold"
                lineHeight="1"
                flexShrink={0}
              >
                100+
              </Text>
              <Box maxW={{ base: '132px', md: 'none' }}>
                <Text
                  color={schoolColors.text}
                  fontSize={isPortraitBoard ? '24px' : { base: '14px', md: '17px' }}
                  fontWeight="semibold"
                  lineHeight="1.5"
                >
                  门扬长选修课
                </Text>
                <Text
                  mt="3px"
                  color={schoolColors.textSecondary}
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
              bg="rgba(30, 84, 148, 0.35)"
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
              bg={schoolColors.primary}
              color={schoolColors.white}
              fontSize={isPortraitBoard ? '26px' : { base: 'lg', md: 'xl' }}
              fontWeight="semibold"
              boxShadow="0 10px 30px rgba(30, 84, 148, 0.35)"
              transition="all 0.2s ease"
              _hover={{ bg: '#1A4280', transform: 'translateY(-2px)' }}
              _active={{ transform: 'scale(0.97)' }}
            >
              <FiMessageCircle size={isPortraitBoard ? 30 : 20} />
              开始对话
            </Box>
          </HStack>
          <HStack justify="center" mt={isPortraitBoard ? 5 : { base: 2, md: 3 }}>
            <Text
              fontSize={isPortraitBoard ? '17px' : { base: '11px', md: '12.5px' }}
              color={schoolColors.textBody}
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
