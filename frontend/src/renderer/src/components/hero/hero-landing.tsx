/**
 * Hero Landing Page Component
 * 对话界面（#/hero）- 由原首页迁移而来
 * 2026-09-21 全站官网化：页头换 SiteHeader（绛红校名横带 + 白色通栏栏目导航条，
 * 与首页/栏目页/新闻中心同款）；同日官网 v2 后本页只承担对话界面——栏目/新闻
 * 已迁往独立路由（#/campus/<栏目>/<文章>、#/news），由 App 直接渲染对应页面。
 */

import { useEffect, useRef, useState } from 'react';
import { Box, Flex } from '@chakra-ui/react';
import SiteHeader from './site-header';
import DialogBox from './dialog-box';
import HeroSidebar from './hero-sidebar';
import { SCHOOL_CONFIG } from './school-config';
import { swissFont } from './site-theme';
import { usePortraitBoard } from '@/hooks/utils/use-portrait-board';
import { CampusTopicId } from '@/data/campus-knowledge';
import { IS_KIOSK } from '@/utils/device-profile';

interface HeroLandingProps {
  activeCampusTopic: CampusTopicId | null;
}

export default function HeroLanding({
  activeCampusTopic
}: HeroLandingProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 竖屏大屏：对话卡限宽 840 居中、铺满高度（手机竖屏同款形态放大），人物右侧小站位
  const isPortraitBoard = usePortraitBoard();

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
    <Flex
      direction="column"
      position="relative"
      w="full"
      overflow="hidden"
      /* 大屏一体机：--app-vh 实测高度（见 device-profile）；手机/桌面回退 100vh。
         键盘压缩态（仅手机启发式）仍直接以实测可见高覆盖 */
      style={{ height: kbViewport ? `${kbViewport}px` : 'var(--app-vh, 100vh)' }}
      css={{
        // 移除背景样式，由Background组件处理
        fontFamily: swissFont,
      }}
    >
      {/* 共享页头：绛红校名横带 + 白色通栏栏目导航条（与首页/栏目页/新闻中心同款）。
          2026-09-21 官网 v2：栏目/新闻页改为独立路由（#/campus/<栏目>/<文章>、#/news），
          本页只承担对话界面，激活项恒为「对话」；z30 盖过 Live2D 穿透层(15)，
          手机端人物不会压住页头（原 Navbar 同层级） */}
      <Box position="relative" zIndex={30} flexShrink={0}>
        <SiteHeader
          activeNav="dialog"
          onNavigateColumn={(columnId, articleId) => {
            window.location.hash = `#/campus/${columnId}${articleId ? `/${articleId}` : ''}`;
          }}
          onNavigateNews={() => {
            window.location.hash = '#/news';
          }}
          onGoChat={() => {
            window.location.hash = '#/hero';
          }}
          onOpenSettings={toggleSidebar}
        />
      </Box>

      {/* Main Content Area - 直接显示对话界面（竖屏大屏：对话卡限宽 840 居中）。
          页头已在文档流中，不再需要旧绝对定位 Navbar 的 pt 让位。
          专题页打开时本区为空（内容在覆盖层）。 */}
      {!activeCampusTopic && (
        <Flex
          flex="1"
          minHeight={0}
          alignItems="center"
          justifyContent={isPortraitBoard ? 'center' : undefined}
          px={isPortraitBoard ? '24px' : { base: 3, md: 12, lg: 16 }}
          /* 手机端：人物右侧大站位与首页一致（Live2D 全屏穿透层），对话卡贴导航栏下方、
             占据整宽（人物本体压在卡片右缘上方，输入行 z20 保持可点）；竖屏大屏同形态 */
          pt={isPortraitBoard ? '12px' : { base: 2, md: 4 }}
          pb={isPortraitBoard ? 10 : { base: 4, md: 16 }}
        >
          {/* 对话界面：不再特意在右侧留白给人物（展示功能已由新首页承担），
             对话卡恢复正常宽度：手机端满宽，桌面端 680px 常规阅读宽度，竖屏大屏 840px 居中 */}
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
        </Flex>
      )}

      {/* 右侧设置侧栏 */}
      <HeroSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </Flex>
  );
}
