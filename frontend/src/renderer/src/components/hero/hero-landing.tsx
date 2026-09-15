/**
 * Hero Landing Page Component
 * 对话界面（#/hero）- 由原首页迁移而来
 * 明亮简洁风格设计，直接显示对话界面；导航入口（学校简介/对话界面等）
 * 在桌面端中部导航与手机端右上角下拉菜单中，默认进入的新首页见 home-page.tsx
 */

import { useEffect, useRef, useState } from 'react';
import { Box, Flex, IconButton } from '@chakra-ui/react';
import { FiSettings } from 'react-icons/fi';
import Navbar from './navbar';
import MobileMenu from './mobile-menu';
import DialogBox from './dialog-box';
import HeroSidebar from './hero-sidebar';
import { SCHOOL_CONFIG } from './school-config';
import { usePortraitBoard } from '@/hooks/utils/use-portrait-board';
import { CampusTopicId } from '@/data/campus-knowledge';
import { IS_KIOSK } from '@/utils/device-profile';

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
  // 竖屏大屏：对话卡限宽 840 居中、铺满高度（手机竖屏同款形态放大），人物右侧小站位
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

  // 软键盘压缩布局：部分 WebView 在 adjustResize 下 100vh 不随窗口缩小，
  // 输入框会被键盘挡住。用 visualViewport 实测可见高度直接压根容器，
  // 键盘弹出时整页缩到可见区（输入框自然升到键盘上方），收起即复原。
  // 大屏一体机不走此启发式（kiosk ROM 的 vv.height 会随机缩水导致误判常驻、
  // 页面永久缩成半截——改由 device-profile 的 --app-vh 守卫实测压根）。
  const [kbViewport, setKbViewport] = useState<number | null>(null);
  const maxVvHeight = useRef(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || IS_KIOSK) return undefined;
    maxVvHeight.current = vv.height;
    const onVvResize = () => {
      // 距最大可见高度收缩超过阈值视为键盘弹出（忽略双指缩放的轻微变化）
      const keyboardOpen = maxVvHeight.current - vv.height > 120;
      if (keyboardOpen) {
        setKbViewport(vv.height);
      } else {
        maxVvHeight.current = Math.max(maxVvHeight.current, vv.height);
        setKbViewport(null);
      }
      // 键盘弹出/收起时浏览器会把 body 滚到输入框（overflow:hidden 仍可被
      // 程序化滚动），收起后滚动量残留 → 整页永久上移、顶部导航被裁。
      // 布局已由上方压缩自行露出输入框，这个滚动只会帮倒忙，一律归零
      //（横向同理：触摸拖动残留 scrollLeft 会让整页左移、文字被屏边裁切）
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.documentElement.scrollLeft = 0;
      document.body.scrollTop = 0;
      document.body.scrollLeft = 0;
    };
    vv.addEventListener('resize', onVvResize);
    return () => vv.removeEventListener('resize', onVvResize);
  }, []);

  return (
    <Box
      position="relative"
      w="full"
      overflow="hidden"
      /* 大屏一体机：--app-vh 实测高度（见 device-profile）；手机/桌面回退 100vh。
         键盘压缩态（仅手机启发式）仍直接以实测可见高覆盖 */
      style={{ height: kbViewport ? `${kbViewport}px` : 'var(--app-vh, 100vh)' }}
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

      {/* 设置按钮 - 打开右侧侧栏（手机端已移入导航栏，竖屏大屏同；专题页打开时隐藏，避免浮在专题页上） */}
      {!activeCampusTopic && (
        <Box
          position="absolute"
          top={{ base: 20, md: 24 }}
          right={{ base: 4, md: 8, lg: 12 }}
          zIndex={20}
          display={isPortraitBoard ? 'none' : { base: 'none', md: 'block' }}
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

      {/* Main Content Area - 直接显示对话界面（竖屏大屏：对话卡限宽 840 居中） */}
      <Flex
        h="full"
        alignItems="center"
        justifyContent={isPortraitBoard ? 'center' : undefined}
        px={isPortraitBoard ? '24px' : { base: 3, md: 12, lg: 16 }}
        /* 手机端：人物右侧大站位与首页一致（Live2D 全屏穿透层），对话卡贴导航栏下方、
           占据整宽（人物本体压在卡片右缘上方，输入行 z20 保持可点）；竖屏大屏同形态 */
        pt={isPortraitBoard ? '150px' : { base: '88px', md: 24 }}
        pb={isPortraitBoard ? 10 : { base: 4, md: 16 }}
      >
        {/* 对话界面：不再特意在右侧留白给人物（展示功能已由新首页承担），
           对话卡恢复正常宽度：手机端满宽，桌面端 680px 常规阅读宽度，竖屏大屏 840px 居中 */}
        {!activeCampusTopic && (
          <Box
            flex="1"
            maxWidth={isPortraitBoard ? '840px' : { base: '100%', md: '680px' }}
            /* 手机端/竖屏大屏 zIndex 5：低于 Live2D 层(15)，人物可盖住卡片的状态行与
               消息区顶部；输入框区在 dialog-box 内部单独提升到 20 保证可点 */
            zIndex={isPortraitBoard ? 5 : { base: 5, md: 10 }}
            h={isPortraitBoard ? 'full' : { base: 'full', md: 'auto' }}
          >
            <Box height={isPortraitBoard ? 'full' : { base: 'full', md: '75vh' }}>
              <DialogBox
                description={SCHOOL_CONFIG.description}
              />
            </Box>
          </Box>
        )}
      </Flex>

      {/* 右侧设置侧栏 */}
      <HeroSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </Box>
  );
}
