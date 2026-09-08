/**
 * Hero Landing Page Component
 * 对话界面（#/hero）- 由原首页迁移而来
 * 明亮简洁风格设计，直接显示对话界面；导航入口（学校简介/对话界面等）
 * 在桌面端中部导航与手机端右上角下拉菜单中，默认进入的新首页见 home-page.tsx
 */

import { useState } from 'react';
import { Box, Flex, IconButton } from '@chakra-ui/react';
import { FiSettings } from 'react-icons/fi';
import Navbar from './navbar';
import MobileMenu from './mobile-menu';
import DialogBox from './dialog-box';
import HeroSidebar from './hero-sidebar';
import { SCHOOL_CONFIG } from './school-config';
import { CampusTopicId } from '@/data/campus-knowledge';

// 学校配色方案 - 基于石实实验学校的设计
const schoolColors = {
  primary: '#1E5494',    // 深蓝色，代表知识和专业
  white: '#FFFFFF',
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
        /* 手机端：人物在右侧居中站立（Live2D 全屏穿透层），对话卡贴导航栏下方、
           占据左侧整高（人物本体压在卡片右缘上方，输入行 z20 保持可点） */
        pt={{ base: '88px', md: 24 }}
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
