/**
 * Home Page Component
 * 学校数字人首页（验收展示页）
 * 布局：导航栏 → 专题选项行（可横滑）→ 学校简介卡 → Live2D 数字人（中部居中，穿透画布）
 *       → 底部"开始对话"进入对话界面
 * 对话界面即原 hero-landing（#/hero），本页为默认进入的新首页（#/home）。
 */

import { useState } from 'react';
import { Box, Button, Flex, HStack, Text } from '@chakra-ui/react';
import { FiMessageCircle } from 'react-icons/fi';
import Navbar from './navbar';
import MobileMenu from './mobile-menu';
import HeroSidebar from './hero-sidebar';
import TopicTabRow from './topic-tab-row';
import { SCHOOL_CONFIG } from './school-config';
import { useInterrupt } from '@/hooks/utils/use-interrupt';
import { CampusTopicId, campusTopicMap, demoSchool } from '@/data/campus-knowledge';

// 学校配色方案 - 与对话界面一致
const schoolColors = {
  primary: '#1E5494',    // 深蓝色，代表知识和专业
  text: '#2D3748',       // 深灰色，主要文字
  textSecondary: '#718096', // 浅灰色，次要文字
  white: '#FFFFFF',
};

// 专题页同款配色（选项行与专题页视觉统一）
const campusColors = {
  blue: '#002FA7',
  blueWash: '#E8EEFF',
  swissFont: '"Helvetica Neue", Arial, sans-serif',
};

// 学校简介数据来源：与"学校简介"专题页同一份（campusTopicMap.intro）
const introTopic = campusTopicMap.intro;
// 一句话简介：摘自专题页"学校概况"小节的事实信息
const introLine = '全日制寄宿制民办实验学校，始建于1999年，坐落于佛山市南海区大沥镇。';

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

      {/* Content Column：z20 盖过 Live2D 穿透层(15)，保证选项行/简介/按钮始终可点 */}
      <Flex
        direction="column"
        h="full"
        px={{ base: 3, md: 12, lg: 16 }}
        pt={{ base: '92px', md: 28 }}
        pb={{ base: 4, md: 8 }}
        position="relative"
        zIndex={20}
      >
        {/* 专题选项行：与专题页同款（手机端横向滑动），行尾附"对话界面"入口 */}
        <TopicTabRow
          onNavigateTopic={goTopic}
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
              对话界面
            </Button>
          }
        />

        {/* 学校简介卡：验收方进入首屏即可见 */}
        <Box
          flexShrink={0}
          mt={{ base: 3, md: 6 }}
          px={{ base: 4, md: 8 }}
          py={{ base: 4, md: 6 }}
          bg="rgba(255, 255, 255, 0.88)"
          backdropFilter="blur(8px)"
          borderRadius={{ base: 'xl', md: '2xl' }}
          border="1px solid"
          borderColor="rgba(226, 232, 240, 0.9)"
          boxShadow="sm"
          textAlign={{ base: 'left', md: 'center' }}
        >
          <Text
            color={schoolColors.primary}
            fontSize={{ base: '11px', md: '13px' }}
            fontWeight="600"
            letterSpacing="0.12em"
          >
            {demoSchool.name}
          </Text>

          <Text
            mt={{ base: 1.5, md: 2 }}
            color={schoolColors.text}
            fontSize={{ base: '17px', md: '28px', lg: '34px' }}
            fontWeight="bold"
            lineHeight="1.3"
          >
            {demoSchool.slogan}
          </Text>

          <Text
            mt={{ base: 1.5, md: 2 }}
            color={schoolColors.textSecondary}
            fontSize={{ base: '12px', md: '14px' }}
            lineHeight="1.6"
            maxW={{ md: '640px', lg: '760px' }}
            mx={{ md: 'auto' }}
          >
            {introLine}
          </Text>

          {/* 关键数据：与学校简介专题页同一组 stats */}
          <Flex
            mt={{ base: 3, md: 5 }}
            justify={{ base: 'flex-start', md: 'center' }}
            gap={{ base: 8, md: 14 }}
          >
            {introTopic.stats.map((stat) => (
              <Box key={stat.label}>
                <Text
                  color={schoolColors.primary}
                  fontSize={{ base: '16px', md: '22px' }}
                  fontWeight="bold"
                  lineHeight="1.2"
                >
                  {stat.value}
                </Text>
                <Text color={schoolColors.textSecondary} fontSize={{ base: '10px', md: '12px' }} mt="2px">
                  {stat.label}
                </Text>
              </Box>
            ))}
          </Flex>
        </Box>

        {/* 中部留白：Live2D 数字人（居中站位）在此区域展示，画布由 App 渲染 */}
        <Box flex={1} minHeight={0} />

        {/* 开始对话：主行动按钮，进入对话界面 */}
        <Box flexShrink={0} textAlign="center">
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
          <Text
            mt={{ base: 2, md: 3 }}
            fontSize={{ base: '11px', md: '13px' }}
            color={schoolColors.textSecondary}
          >
            支持语音与文字提问，讲解过程可随时打断
          </Text>
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
