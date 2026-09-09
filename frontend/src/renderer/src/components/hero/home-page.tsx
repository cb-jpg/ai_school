/**
 * Home Page Component
 * 学校数字人首页（验收展示页）
 * 布局：导航栏 → 专题选项行（可横滑）→ 左上学校简介块（渐变融入背景，
 *       校名/理念标题可延展到人物侧，其余内容左侧窄栏多换行）→
 *       右侧偏大 Live2D 数字人（穿透画布）→ 底部"开始对话"进入对话界面（#/hero）
 * 人物站位/大小由 use-live2d-model.ts 的 HOME_* 常量控制（右侧 78% 屏宽）。
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
          人物在右侧，内容在左上不与其相争 */}
      <Flex direction="column" h="full" position="relative" zIndex={20} pt={{ base: '92px', md: '110px' }}>
        {/* 专题选项行：与专题页同款（手机端横向滑动），行首"首页"与专题页一致，
            行尾附"对话"入口 */}
        <Box px={{ base: 3, md: 12, lg: 16 }}>
          <TopicTabRow
            onNavigateTopic={goTopic}
            leading={
              <Button
                data-testid="campus-nav-home"
                aria-label="回到学校首页"
                onClick={() => {
                  interrupt();
                  window.location.hash = '#/home';
                }}
                height="40px"
                px={{ base: '12px', lg: '16px' }}
                borderRadius="md"
                variant="ghost"
                color="#121826"
                fontFamily={campusColors.swissFont}
                fontWeight="500"
                fontSize="sm"
                flexShrink={0}
                _hover={{ background: campusColors.blueWash, color: campusColors.blue }}
                transition="all 200ms ease"
              >
                <HStack gap="8px">
                  <FiHome size={16} />
                  <Text>首页</Text>
                </HStack>
              </Button>
            }
            trailing={
              <Button
                aria-label="进入对话界面"
                onClick={goChat}
                height="40px"
                px="16px"
                borderRadius="md"
                variant="ghost"
                flexShrink={0}
                color="#586174"
                fontFamily={campusColors.swissFont}
                fontWeight="500"
                fontSize="sm"
                _hover={{ background: campusColors.blueWash, color: campusColors.blue }}
              >
                <FiMessageCircle size={16} style={{ marginRight: '8px' }} />
                对话
              </Button>
            }
          />
        </Box>

        {/* 学校简介块：无卡片边框，横向渐变右淡出，与背景融为一体。
            校名眉行与办学理念大标题不囿于左栏、可延展到人物侧（加白色光晕保可读）；
            下方内容仍在左侧窄栏多换行，不遮挡人物。轻重分明——校名(轻) /
            办学理念(重) / 校训·理念·价值观(轻) / 清北保送·扬长课程亮点(重) / App 简介(轻) */}
        <Box
          alignSelf="stretch"
          mt={{ base: 2, md: 4 }}
          py={{ base: 3, md: 5 }}
          pl={{ base: 4, md: 12, lg: 16 }}
          pr={{ base: 6, md: 10 }}
          background="linear-gradient(100deg, rgba(248, 250, 252, 0.96) 0%, rgba(248, 250, 252, 0.82) 42%, rgba(248, 250, 252, 0) 74%)"
        >
          {/* 宽区：校名 + 办学理念（延伸到右侧） */}
          <Box maxW={{ base: 'none', md: '760px' }}>
            <Text
              color={schoolColors.primary}
              fontSize={{ base: '11px', md: '13px' }}
              fontWeight="600"
              letterSpacing="0.15em"
              lineHeight="1.6"
              textShadow="0 1px 6px rgba(255, 255, 255, 0.9)"
            >
              佛山市南海区石实实验学校 · AI校园数字人
            </Text>

            <Text
              mt={{ base: 2, md: 2.5 }}
              color={schoolColors.text}
              fontSize={{ base: '19px', md: '30px', lg: '34px' }}
              fontWeight="bold"
              lineHeight="1.35"
              textShadow="0 1px 8px rgba(255, 255, 255, 0.9), 0 0 18px rgba(255, 255, 255, 0.65)"
            >
              让每一个孩子都能成长、成才、成功
            </Text>
          </Box>

          {/* 窄栏：其余内容多换行（右侧留给人物） */}
          <Box maxW={{ base: '212px', md: '520px' }}>
            <Text
              mt={{ base: 2, md: 2 }}
              color={schoolColors.textBody}
              fontSize={{ base: '13px', md: '15px' }}
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
            <Flex mt={{ base: 4, md: 4 }} align="center" gap={{ base: 3, md: 4 }}>
              <Text
                color={schoolColors.primary}
                fontSize={{ base: '44px', md: '52px' }}
                fontWeight="bold"
                lineHeight="1"
                flexShrink={0}
              >
                {HIGHLIGHT_COUNT}
              </Text>
              <Box maxW={{ base: '140px', md: 'none' }}>
                <Text
                  color={schoolColors.text}
                  fontSize={{ base: '14px', md: '17px' }}
                  fontWeight="semibold"
                  lineHeight="1.5"
                >
                  位学子凭信息学特长
                  <Box as="span" display={{ base: 'block', md: 'inline' }}>
                    保送清华、北京大学
                  </Box>
                </Text>
                <Text mt="3px" color={schoolColors.textSecondary} fontSize={{ base: '10px', md: '12px' }} lineHeight="1.5">
                  据南方+、南海区教育局公开报道
                </Text>
              </Box>
            </Flex>

            {/* 亮点二：扬长课程（学生视角的特色） */}
            <Flex mt={{ base: 3, md: 3 }} align="center" gap={{ base: 3, md: 4 }}>
              <Text
                color={schoolColors.primary}
                fontSize={{ base: '30px', md: '40px' }}
                fontWeight="bold"
                lineHeight="1"
                flexShrink={0}
              >
                100+
              </Text>
              <Box maxW={{ base: '132px', md: 'none' }}>
                <Text
                  color={schoolColors.text}
                  fontSize={{ base: '14px', md: '17px' }}
                  fontWeight="semibold"
                  lineHeight="1.5"
                >
                  门扬长选修课
                </Text>
                <Text mt="3px" color={schoolColors.textSecondary} fontSize={{ base: '10px', md: '12px' }} lineHeight="1.5">
                  每学期“大学式选课”，信息学、科创、体艺等任你选
                </Text>
              </Box>
            </Flex>

            {/* 分隔细线（收束亮点区） */}
            <Box mt={{ base: 4, md: 4 }} width="64px" height="2px" bg="rgba(30, 84, 148, 0.35)" />
          </Box>
        </Box>

        {/* 右侧留白：Live2D 数字人（右侧偏大站位）在此区域展示，画布由 App 渲染 */}
        <Box flex={1} minHeight={0} />

        {/* 开始对话：主行动按钮，进入对话界面 */}
        <Box flexShrink={0} pb={{ base: 2, md: 4 }} textAlign="center">
          <HStack justify="center">
            <Box
              as="button"
              onClick={goChat}
              aria-label="开始对话"
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              gap="10px"
              height={{ base: '54px', md: '60px' }}
              px={{ base: 10, md: 16 }}
              rounded="full"
              bg={schoolColors.primary}
              color={schoolColors.white}
              fontSize={{ base: 'lg', md: 'xl' }}
              fontWeight="semibold"
              boxShadow="0 10px 30px rgba(30, 84, 148, 0.35)"
              transition="all 0.2s ease"
              _hover={{ bg: '#1A4280', transform: 'translateY(-2px)' }}
              _active={{ transform: 'scale(0.97)' }}
            >
              <FiMessageCircle size={20} />
              开始对话
            </Box>
          </HStack>
          <HStack justify="center" mt={{ base: 2, md: 3 }}>
            <Text
              fontSize={{ base: '11px', md: '12.5px' }}
              color={schoolColors.textBody}
              bg="rgba(255, 255, 255, 0.62)"
              px={3}
              py={1}
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
