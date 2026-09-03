/**
 * Hero Landing Page Component
 * 学校数字人首页 - 全屏英雄页面
 * 明亮简洁风格设计
 * 直接显示对话界面，无需切换
 */

import { useState } from 'react';
import { Box, Flex, IconButton, Text } from '@chakra-ui/react';
import { FiSettings } from 'react-icons/fi';
import { FiHome, FiBook, FiClock, FiAward, FiUsers } from 'react-icons/fi';
import Navbar from './navbar';
import MobileMenu from './mobile-menu';
import DialogBox from './dialog-box';
import HeroSidebar from './hero-sidebar';
import { CampusTopicId } from '@/data/campus-knowledge';

// 学校配色方案 - 基于石实实验学校的设计
const schoolColors = {
  bg: '#F5F7FA',        // 浅灰背景，简洁明了
  primary: '#1E5494',    // 深蓝色，代表知识和专业
  secondary: '#FF6B35',  // 暖橙色，代表活力和成长
  accent: '#E8F0FE',     // 浅蓝色，用于高亮
  text: '#2D3748',       // 深灰色，主要文字
  textSecondary: '#718096', // 浅灰色，次要文字
  border: '#E2E8F0',     // 边框颜色
  white: '#FFFFFF',
};

// 学校信息配置 - 石实实验学校
const SCHOOL_CONFIG = {
  name: '石实实验学校',
  tagline: '以人为本，全面发展',
  description: '与AI数字人"小石"对话，探索知识的无限可能',
  navigation: [
    { id: 'home', label: '首页', icon: FiHome },
    { id: 'intro', label: '学校简介', icon: FiBook },
    { id: 'history', label: '校史', icon: FiClock },
    { id: 'achievements', label: '学校成就', icon: FiAward },
    { id: 'role-models', label: '学习标兵', icon: FiUsers },
  ]
};

interface HeroLandingProps {
  activeCampusTopic: CampusTopicId | null;
}

export default function HeroLanding({
  activeCampusTopic
}: HeroLandingProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <Box
      position="relative"
      h="100vh"
      w="full"
      overflow="hidden"
      css={{
        // 移除背景样式，由Background组件处理
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* Navigation Bar */}
      <Navbar
        schoolName={SCHOOL_CONFIG.name}
        navigation={SCHOOL_CONFIG.navigation}
        onMobileMenuToggle={handleMobileMenuToggle}
        mobileMenuOpen={mobileMenuOpen}
        onSettingsToggle={toggleSidebar}
      />

      {/* 手机端标题层：紧贴导航栏下方、靠左排布（人物初始站位在右侧），
          zIndex 低于 Live2D 层，人物可从标题上方经过 */}
      {!activeCampusTopic && (
        <Box
          display={{ base: 'block', md: 'none' }}
          position="absolute"
          top="96px"
          left={0}
          width="62%"
          zIndex={0}
          textAlign="left"
          pointerEvents="none"
          px={4}
        >
          <Text
            fontSize="xl"
            fontWeight="bold"
            color="#1E5494"
            lineHeight="1.3"
            css={{
              textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)',
            }}
          >
            {SCHOOL_CONFIG.tagline}
          </Text>
          <Text fontSize="xs" color={schoolColors.textSecondary} mt={1} lineHeight="1.5">
            {SCHOOL_CONFIG.description}
          </Text>
        </Box>
      )}

      {/* 设置按钮 - 打开右侧侧栏（手机端已移入导航栏；专题页打开时隐藏，避免浮在专题页上） */}
      {!activeCampusTopic && (
        <Box
          position="absolute"
          top={{ base: 20, md: 24 }}
          right={{ base: 4, md: 8, lg: 12 }}
          zIndex={20}
          display={{ base: 'none', md: 'block' }}
        >
          <IconButton
            aria-label="设置"
            size="lg"
            rounded="full"
            shadow="md"
            onClick={toggleSidebar}
            bg={schoolColors.white}
            color={schoolColors.primary}
            _hover={{
              bg: schoolColors.primary,
              color: 'white',
            }}
          >
            <FiSettings />
          </IconButton>
        </Box>
      )}

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={closeMobileMenu}
        navigation={SCHOOL_CONFIG.navigation}
      />

      {/* Main Content Area - 直接显示对话界面 */}
      <Flex
        h="full"
        alignItems="center"
        justifyContent="space-between"
        px={{ base: 6, md: 12, lg: 16 }}
        /* 手机端：上半屏 (42vh) 是 Live2D 人物区，对话区从其下方开始，避免重叠 */
        pt={{ base: '42vh', md: 24 }}
        pb={{ base: 4, md: 16 }}
        gap={8}
      >
        {/* Left Side: 对话界面 */}
        {!activeCampusTopic && (
          <Box
            flex="1"
            /* 手机端靠左收窄（92%），右侧留出人物空间；桌面端维持 600px 设计 */
            maxWidth={{ base: '92%', md: '600px' }}
            /* 手机端 zIndex 5：低于 Live2D 层(15)，人物可盖住卡片的状态行与
               消息区顶部；输入框区在 dialog-box 内部单独提升到 20 保证可点 */
            zIndex={{ base: 5, md: 10 }}
            h={{ base: 'full', md: 'auto' }}
          >
            <Box height={{ base: 'full', md: '75vh' }}>
              <DialogBox
                schoolName={SCHOOL_CONFIG.name}
                tagline={SCHOOL_CONFIG.tagline}
                description={SCHOOL_CONFIG.description}
              />
            </Box>
          </Box>
        )}

        {/* Right Side: Live2D Character Area (Transparent for Live2D background) */}
        <Box
          flex="1"
          maxWidth={{ base: '100%', md: '50%', lg: '55%' }}
          height="full"
          zIndex={5}
          pointerEvents="none"
          /* 手机端 Live2D 已是全屏背景，此空位不占宽度，避免把对话区挤成窄条 */
          display={{ base: 'none', md: 'flex' }}
          alignItems="center"
          justifyContent="center"
          ml={4}
        >
          {/* Empty space - Live2D renders as background from App.tsx */}
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
