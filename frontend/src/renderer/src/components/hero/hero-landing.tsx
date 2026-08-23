/**
 * Hero Landing Page Component
 * 学校数字人首页 - 全屏英雄页面
 * 明亮简洁风格设计
 */

import { useState } from 'react';
import { Box, Flex, HStack, Button, Text } from '@chakra-ui/react';
import { FiMenu, FiX } from 'react-icons/fi';
import { FiHome, FiBook, FiAward, FiUsers } from 'react-icons/fi';
import Navbar from './navbar';
import MobileMenu from './mobile-menu';
import DialogBox from './dialog-box';

// 明亮简洁风格配色
const lightColors = {
  bg: '#FAFAFA',
  primary: '#002FA7',
  text: '#121826',
  textSecondary: '#586174',
  accent: '#E8EEFF',
};

// 学校信息配置
const SCHOOL_CONFIG = {
  name: '智慧校园',
  tagline: '人工智能赋能教育创新',
  description: '与数字导师对话，探索知识的无限可能',
  navigation: [
    { id: 'home', label: '首页', icon: FiHome },
    { id: 'intro', label: '学校简介', icon: FiBook },
    { id: 'history', label: '校史', icon: FiBook },
    { id: 'achievements', label: '学校成就', icon: FiAward },
    { id: 'role-models', label: '学习标兵', icon: FiUsers },
  ]
};

export default function HeroLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <Box
      position="relative"
      h="100vh"
      w="full"
      overflow="hidden"
      bg={lightColors.bg}
      fontFamily="'Helvetica Neue', Arial, sans-serif"
    >
      {/* Navigation Bar */}
      <Navbar
        schoolName={SCHOOL_CONFIG.name}
        navigation={SCHOOL_CONFIG.navigation}
        onMobileMenuToggle={handleMobileMenuToggle}
        mobileMenuOpen={mobileMenuOpen}
      />

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={closeMobileMenu}
        navigation={SCHOOL_CONFIG.navigation}
      />

      {/* Main Content Area */}
      <Flex
        h="full"
        alignItems="center"
        justifyContent="space-between"
        px={{ base: 6, md: 12, lg: 16 }}
        pt={{ base: 20, md: 24 }}
        pb={{ base: 10, md: 16 }}
        gap={8}
      >
        {/* Left Side: Dialog Box */}
        <Box
          flex="1"
          maxWidth={{ base: '100%', md: '50%', lg: '45%' }}
          zIndex={10}
        >
          <DialogBox
            schoolName={SCHOOL_CONFIG.name}
            tagline={SCHOOL_CONFIG.tagline}
            description={SCHOOL_CONFIG.description}
          />
        </Box>

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
    </Box>
  );
}
