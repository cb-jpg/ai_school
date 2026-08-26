/**
 * Hero Landing Page Component
 * 学校数字人首页 - 全屏英雄页面
 * 明亮简洁风格设计
 * 直接显示对话界面，无需切换
 */

import { useState } from 'react';
import { Box, Flex, IconButton } from '@chakra-ui/react';
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
      bg={schoolColors.bg}
      css={{
        // 添加虚化背景效果
        backgroundImage: 'linear-gradient(135deg, rgba(30, 84, 148, 0.03) 0%, rgba(255, 107, 53, 0.02) 100%), url("data:image/svg+xml,%3Csvg width=\'80\' height=\'80\' viewBox=\'0 0 80 80\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%231E5494\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M40 40c0-21.5-17.5-39-39-39S2 18.5 2 40s17.5 39 39 39 39-17.5 39-39zm-1 0c0-20.4-16.6-37-37-37S3 19.6 3 40s16.6 37 37 37 37-16.6 37-37z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        backgroundSize: '100% 100%, 80px 80px',
        backgroundPosition: 'center, center',
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* Navigation Bar */}
      <Navbar
        schoolName={SCHOOL_CONFIG.name}
        navigation={SCHOOL_CONFIG.navigation}
        onMobileMenuToggle={handleMobileMenuToggle}
        mobileMenuOpen={mobileMenuOpen}
      />

      {/* 设置按钮 - 打开右侧侧栏 */}
      <Box
        position="absolute"
        top={{ base: 20, md: 24 }}
        right={{ base: 4, md: 8, lg: 12 }}
        zIndex={20}
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
        pt={{ base: 20, md: 24 }}
        pb={{ base: 10, md: 16 }}
        gap={8}
      >
        {/* Left Side: 对话界面 */}
        {!activeCampusTopic && (
          <Box
            flex="1"
            maxWidth="600px"
            zIndex={10}
          >
            <Box height="75vh">
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
          display="flex"
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
