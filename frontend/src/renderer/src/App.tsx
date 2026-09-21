/* eslint-disable no-shadow */
// import { StrictMode } from 'react';
import { Box, ChakraProvider, createSystem, defaultConfig, defineTokens } from "@chakra-ui/react";

// v2→v3 迁移兼容：项目大量组件直接用 px 字面量（如 fontSize="14px"、size="20px"），
// v3 类型只认 token。这里把常用 px 值注册为 token，类型合法且运行时值不变。
const tokens = defineTokens({
  fontSizes: Object.fromEntries(
    [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 32, 36].map((px) => [
      `${px}px`,
      { value: `${px}px` },
    ]),
  ),
});
// 大屏一体机适配（isLargeTouchViewport 判定见 utils/device-profile.ts）：
// 一体机 WebView 视口宽=物理像素（≥768），默认断点会把一体机当"桌面端"，
// 全部 md:/lg: 样式生效、手机端调好的布局与人物站位全部失效，UI 大乱。
// 这里把桌面断点顶到不可达（sm 及以上永不命中），一体机全局走手机端(base)样式；
// 手机（视口<768）本来就是 base，桌面/浏览器无触摸不受影响。
const system = createSystem(defaultConfig, {
  theme: {
    tokens,
    ...(IS_KIOSK
      ? {
          breakpoints: {
            sm: '9991px',
            md: '9992px',
            lg: '9993px',
            xl: '9994px',
            '2xl': '9995px',
          },
        }
      : {}),
  },
});
import { useState, useEffect, useRef } from "react";
// 导入工作台字体
import "@/styles/admin-fonts.css";
import { IS_KIOSK, KIOSK_LAYOUT_WIDTH } from "@/utils/device-profile";
// import Canvas from './components/canvas/canvas'; // Likely unused now
import Footer from "./components/footer/footer";
import { AiStateProvider } from "./context/ai-state-context";
import { Live2DConfigProvider } from "./context/live2d-config-context";
import { SubtitleProvider } from "./context/subtitle-context";
import { BgUrlProvider } from "./context/bgurl-context";
import { layoutStyles } from "./layout";
import WebSocketHandler from "./services/websocket-handler";
import { CameraProvider } from "./context/camera-context";
import { ChatHistoryProvider } from "./context/chat-history-context";
import { VolumeProvider } from "./context/volume-context";
import { CharacterConfigProvider } from "./context/character-config-context";
import { Toaster } from "./components/ui/toaster";
import { VADProvider } from "./context/vad-context";
import { Live2D } from "./components/canvas/live2d";
import TitleBar from "./components/electron/title-bar";
import { InputSubtitle } from "./components/electron/input-subtitle";
import { ProactiveSpeakProvider } from "./context/proactive-speak-context";
import { ScreenCaptureProvider } from "./context/screen-capture-context";
import { GroupProvider } from "./context/group-context";
import { BrowserProvider } from "./context/browser-context";
import { KnowledgeProvider } from "./context/knowledge-context";
import { AdminProvider, useAdmin } from "./context/admin-context";
import { AuthProvider, useAuth } from "./context/auth-context";
// eslint-disable-next-line import/no-extraneous-dependencies, import/newline-after-import
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import Background from "./components/canvas/background";
import WebSocketStatus from "./components/canvas/ws-status";
import Subtitle from "./components/canvas/subtitle";
import { ModeProvider, useMode } from "./context/mode-context";
import CampusKnowledge from "./components/campus/campus-knowledge";
import { CampusTopicId, isCampusTopicId } from "./data/campus-knowledge";
import HeroLanding from "./components/hero/hero-landing";
import HomePage from "./components/hero/home-page";
import KnowledgeAdmin from "./components/admin/knowledge-admin";
import { DocumentKnowledge } from "./components/admin/document-knowledge";
import { SystemLogs } from "./components/admin/system-logs";
import ModernSidebar from "./components/admin/modern-sidebar";
import { SchoolAdminLayout } from "./components/admin/school-admin-layout";
import { SchoolDashboard } from "./components/admin/school-dashboard";
import { SchoolTestConversation } from "./components/admin/school-test-conversation";
import { ModernMainWorkspace } from "./components/admin/modern-workspace";
import AppLoginPage from "./components/auth/app-login-page";
import UnansweredQuestions from "./components/admin/unanswered-questions";
import UserManagement from "./components/admin/user-management";
import { CharacterConfig } from "./components/admin/character-config";
import { usePortraitBoard } from "./hooks/utils/use-portrait-board";
import { useOtaUpdate } from "./hooks/use-ota-update";

// 定义路由类型
type AppRoute = 'hero' | 'main' | 'campus' | 'main-admin';
type MainRoute = 'dashboard' | 'test-conversation' | 'knowledge-admin' | 'workspace' | string;
// hero 模式下的两个页面：home=新首页（默认），chat=对话界面（原首页迁移至 #/hero）
type HeroView = 'home' | 'chat';

const getCurrentRoute = (): AppRoute => {
  if (typeof window === 'undefined') return 'main-admin';
  const hash = window.location.hash;

  // Main admin workspace routes
  if (hash.startsWith('#/main') || hash === '#/main' || hash === '#/main/') {
    return 'main-admin';
  }

  // Hero landing page route - include campus routes as hero mode
  if (hash === '#/home' || hash === '#/hero' || hash === '#/landing' || hash === '' || hash === '#/' || hash.startsWith('#/campus/')) {
    return 'hero';
  }

  // Default to admin workspace
  return 'main-admin';
};

// hero 模式下的页面视图：#/hero 为对话界面，其余（#/home、空 hash、专题页兜底）为新首页
const readHeroView = (): HeroView => {
  if (typeof window === 'undefined') return 'home';
  const hash = window.location.hash;
  if (hash === '#/hero' || hash === '#/landing') return 'chat';
  return 'home';
};

const getCurrentMainRoute = (): MainRoute => {
  if (typeof window === 'undefined') return 'dashboard';
  const hash = window.location.hash;
  const match = hash.match(/^#\/main\/([^/?#]+)/);
  return match?.[1] || 'dashboard';
};

const readCampusTopicFromLocation = (): CampusTopicId | null => {
  if (typeof window === 'undefined') return null;
  const match = window.location.hash.match(/^#\/campus\/([^/?#]+)/);
  const topicId = match?.[1] || '';
  return isCampusTopicId(topicId) ? topicId : null;
};

function AppContent(): JSX.Element {
  const [showSidebar, setShowSidebar] = useState(true);
  const [isFooterCollapsed, setIsFooterCollapsed] = useState(false);
  const [activeCampusTopic, setActiveCampusTopic] = useState<CampusTopicId | null>(
    readCampusTopicFromLocation,
  );
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => getCurrentRoute());
  const [currentMainRoute, setCurrentMainRoute] = useState<MainRoute>(() => getCurrentMainRoute());
  const [heroView, setHeroView] = useState<HeroView>(() => readHeroView());
  // 未登录用户在专题页点「讲解」时弹出的登录浮层（浏览不中断，登录后自动回到原页面）
  const [authPrompt, setAuthPrompt] = useState(false);
  const { mode } = useMode();
  const { user: authUser } = useAuth();
  const isElectron = window.api !== undefined;
  // 竖屏大屏（壁挂数字屏/竖放平板）：hero 路由的画布层与文案样式走手机竖屏
  // 同款的全宽穿透形态，而非 md 档"右侧 55% / 低层级"的横屏布局
  const isPortraitBoard = usePortraitBoard();
  useOtaUpdate(); // App 在线更新检查（手机弹窗 / kiosk 静默换包；浏览器端内部短路）
  const live2dContainerRef = useRef<HTMLDivElement>(null);
  const currentLayoutRef = useRef({ showSidebar, isFooterCollapsed });
  const previousLayoutRef = useRef<{ showSidebar: boolean; isFooterCollapsed: boolean } | null>(null);
  currentLayoutRef.current = { showSidebar, isFooterCollapsed };

  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const syncRoute = () => {
      setCurrentRoute(getCurrentRoute());
      setCurrentMainRoute(getCurrentMainRoute());
      setActiveCampusTopic(readCampusTopicFromLocation());
      setHeroView(readHeroView());
    };
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);

    // 初始检查
    syncRoute();

    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  }, []);

  useEffect(() => {
    if (activeCampusTopic) {
      if (!previousLayoutRef.current) {
        previousLayoutRef.current = { ...currentLayoutRef.current };
      }
      setShowSidebar(false);
      setIsFooterCollapsed(true);
      return;
    }

    if (previousLayoutRef.current) {
      setShowSidebar(previousLayoutRef.current.showSidebar);
      setIsFooterCollapsed(previousLayoutRef.current.isFooterCollapsed);
      previousLayoutRef.current = null;
    }
  }, [activeCampusTopic]);

  const navigateToCampusTopic = (topicId: CampusTopicId) => {
    setActiveCampusTopic(topicId);
    window.history.pushState(
      { campusTopic: topicId },
      '',
      `${window.location.pathname}${window.location.search}#/campus/${topicId}`,
    );
  };

  const closeCampusTopic = () => {
    setActiveCampusTopic(null);
    // 返回到 hero 首页
    window.location.hash = '#/hero';
  };

    
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  document.documentElement.style.height = '100%';
  document.body.style.height = '100%';
  document.documentElement.style.position = 'fixed';
  document.body.style.position = 'fixed';
  document.documentElement.style.width = '100%';
  document.body.style.width = '100%';

  // body 滚动守卫：App 是固定视口应用（body 已被上方样式锁定），但
  // overflow:hidden 的元素仍可被浏览器程序化滚动——切页内容替换时滚动锚定
  // 会把 body 滚动几十 px 且不恢复，表现为整页被顶上去、底部露出异色带、
  // 顶部导航被裁（2026-09-09 真机实锤：body.scrollTop=47.7）。页面内滚动
  // 全部走各自的内部容器，body 一旦滚动立即归零。横向同理归零（竖屏大屏
  // 真机实锤：屏外设置抽屉撑出横向可滚空间，WebView 平移后左缘被裁）。
  // 一体机触摸屏还会横向拖出 scrollLeft 残留（整页左移、左侧文字被屏边
  // 裁掉半字），html/body 两个方向一起钉死。
  useEffect(() => {
    const clamp = () => {
      const de = document.documentElement;
      const b = document.body;
      if (de.scrollTop !== 0) de.scrollTop = 0;
      if (de.scrollLeft !== 0) de.scrollLeft = 0;
      if (b.scrollTop !== 0) b.scrollTop = 0;
      if (b.scrollLeft !== 0) b.scrollLeft = 0;
    };
    document.body.addEventListener('scroll', clamp, { passive: true });
    document.documentElement.addEventListener('scroll', clamp, { passive: true });
    clamp();
    return () => {
      document.body.removeEventListener('scroll', clamp);
      document.documentElement.removeEventListener('scroll', clamp);
    };
  }, []);

  const live2dWindowFrameStyle = {
    position: "absolute" as const,
    top: isElectron ? "30px" : "0px",
    height: `calc(100% - ${isElectron ? "30px" : "0px"})`,
    zIndex: 5,
    left: {
      base: "0px",
      md: showSidebar ? "440px" : "24px",
    },
    right: "0px",
    overflow: "hidden",
    transition: "left 0.3s ease-in-out",
    pointerEvents: "none" as const,
  };

  // Define styles specifically for the "pet" mode
  const live2dPetStyle = {
    position: "absolute" as const,
    overflow: "hidden",
    transition: "all 0.3s ease-in-out",
    pointerEvents: "none" as const,
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    zIndex: 15,
  };

  // 登录门禁（2026-09-20 需求 #6）：浏览类页面（新首页/校园专题页）不再强制登录，
  // 进入「对话界面」才要求登录——家长/学生各用各的账号，会话数据按账号隔离。
  const isHomeViewGate = currentRoute === 'hero' && heroView === 'home' && !activeCampusTopic;
  const isTopicViewGate = currentRoute === 'hero' && !!activeCampusTopic;
  const isDialogViewGate = currentRoute === 'hero' && !isHomeViewGate && !isTopicViewGate;
  if (isDialogViewGate && !authUser) {
    return <AppLoginPage />;
  }

  // 专题页匿名点「讲解」：登录浮层盖在当前页面上，可取消继续浏览
  const authPromptOverlay = authPrompt && !authUser && (
    <Box position="fixed" top={0} left={0} width="100vw" height="100vh" zIndex={100}>
      <AppLoginPage onCancel={() => setAuthPrompt(false)} />
    </Box>
  );

  // Show Hero Landing page on hero route (still wrapped in all providers)
  if (currentRoute === 'hero') {
    // 新首页：#/home / 空 hash 且未打开专题页；#/hero 为对话界面
    const isHomeView = heroView === 'home' && !activeCampusTopic;
    return (
      <>
        {/* Background layer for hero route（首页居中布局，关闭桌面端分屏遮罩） */}
        <Background splitLayout={!isHomeView} />

        {/* Live2D layer for hero route - 手机端/竖屏大屏全屏穿透画布；桌面端对话界面右侧 55%、
            新首页全宽（人物居中）。大屏一体机用 --app-vh 实测高（kiosk ROM 100vh 缩水） */}
        <Box
          position="absolute"
          top={0}
          right={0}
          width={isHomeView || isPortraitBoard ? "100%" : { base: "100%", md: "55%" }}
          height={{
            base: IS_KIOSK ? "var(--app-vh, 100vh)" : "100vh",
            md: isElectron ? "calc(100vh - 30px)" : "100vh",
          }}
          zIndex={isPortraitBoard ? 15 : { base: 15, md: 1 }}
          /* 手机端：全屏穿透画布（pointerEvents none + window 级 hitTest 触摸）。
             人物可被拖到屏幕任意位置（包括卡片中间），且只有摸到模型本体
             才拦截触摸，其余区域完全放行——按钮/选项行/输入框全部正常。
             桌面端：画布不拦截鼠标（与历史行为一致）。 */
          pointerEvents="none"
        >
          <Live2D showSidebar={false} touchThrough heroAlign={isHomeView ? 'center' : 'right'} />
        </Box>

        {/* CampusKnowledge overlay for topic pages */}
        {activeCampusTopic && (
          <Box
            position="absolute"
            top={0}
            left={0}
            width="100%"
            height={IS_KIOSK ? "var(--app-vh, 100vh)" : (isElectron ? "calc(100vh - 30px)" : "100vh")}
            zIndex={2}
            pointerEvents="none"
          >
            <Box pointerEvents="auto" width="100%" height="100%">
              <CampusKnowledge
                activeTopicId={activeCampusTopic}
                onNavigate={navigateToCampusTopic}
                onClose={closeCampusTopic}
                mode="hero"
                onRequireAuth={() => setAuthPrompt(true)}
              />
            </Box>
          </Box>
        )}

        {/* WebSocketStatus indicator（专题页打开时隐藏，避免浮在专题页导航上；未登录时隐藏——
            匿名浏览不连 WS，亮着红色断连提示反而困惑） */}
        {!activeCampusTopic && authUser && (
          <Box position="absolute" top="20px" left="20px" zIndex={10}>
            <WebSocketStatus />
          </Box>
        )}

        {/* Subtitle for hero page - 手机端对话卡片内已展示文本，隐藏；专题页/新首页隐藏 */}
        {!activeCampusTopic && !isHomeView && (
        <Box
          position="absolute"
          bottom={{ base: "8%", md: "12%" }}
          right={{ base: "0", md: "0" }}
          left={{ base: "auto", md: "auto" }}
          zIndex={20}
          width={{ base: "85%", md: "45%" }}
          textAlign="center"
          pointerEvents="none"
          paddingRight={{ base: "8", md: "12" }}
          display={{ base: "none", md: "block" }}
        >
          <Box
            bg="rgba(255, 255, 255, 0.95)"
            borderRadius="16px"
            padding="16px 24px"
            boxShadow="0 4px 20px rgba(0, 0, 0, 0.1)"
            backdropFilter="blur(10px)"
            border="1px solid rgba(255, 255, 255, 0.5)"
            margin="0 auto"
            maxWidth="400px"
          >
            <Subtitle />
          </Box>
        </Box>
        )}

        {/* 新首页（学校简介 + 居中数字人 + 开始对话）；对话界面/专题页仍走 HeroLanding */}
        {isHomeView ? (
          <HomePage onNavigateTopic={navigateToCampusTopic} />
        ) : (
          <HeroLanding
            activeCampusTopic={activeCampusTopic}
          />
        )}

        {/* 专题页匿名点「讲解」触发的登录浮层（盖在当前页面上，可取消） */}
        {authPromptOverlay}
      </>
    );
  }

  // Admin workspace page - school themed management dashboard
  if (currentRoute === 'main-admin') {
    // 登录守卫：管理后台仅 admin（最高权限管理员）/ editor（数据管理员）可进入；
    // 学生（user）/ 家长（parent）无权限
    if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'editor')) {
      return <AppLoginPage />;
    }

    let content;
    switch (currentMainRoute) {
      case 'dashboard':
        content = <SchoolDashboard />;
        break;
      case 'test-conversation':
        content = <SchoolTestConversation />;
        break;
      case 'workspace':
        content = <ModernMainWorkspace />;
        break;
      case 'unanswered-questions':
        content = <UnansweredQuestions />;
        break;
      case 'user-management':
        content = <UserManagement />;
        break;
      case 'character-config':
        content = <CharacterConfig />;
        break;
      case 'document-knowledge':
        content = <DocumentKnowledge />;
        break;
      case 'system-logs':
        content = <SystemLogs />;
        break;
      case 'knowledge-admin':
        return <KnowledgeAdmin />;
      default:
        content = <SchoolDashboard />;
    }

    return (
      <SchoolAdminLayout>
        {content}
      </SchoolAdminLayout>
    );
  }

  return (
    <>
      {/* 工作台模式 - 现代化管理界面（默认） */}
      {currentRoute === 'main' && (
        <>
          {/* 使用工作台风格的侧边栏 */}
          <ModernSidebar
            isCollapsed={!showSidebar}
            onToggle={() => setShowSidebar(!showSidebar)}
          />

          {/* 主内容区域 */}
          <Box
            ml={showSidebar ? '280px' : '80px'}
            height="100vh"
            transition="margin-left 0.3s ease"
            position="relative"
          >
            {/* Live2D 层 */}
            <Box
              {...(mode === "window"
                ? live2dWindowFrameStyle
                : live2dPetStyle)}
              marginLeft={showSidebar ? '0px' : '0px'}
            >
              <Box
                ref={live2dContainerRef}
                position="absolute"
                top="0"
                right="0"
                width={mode === 'window' && activeCampusTopic
                  ? { base: '100%', lg: '42%' }
                  : '100%'}
                height="100%"
                pointerEvents="auto"
                transition="width 0.35s cubic-bezier(0.4, 0, 0.2, 1)"
              >
                <Live2D showSidebar={showSidebar} />
              </Box>
            </Box>

            {/* Window Mode UI */}
            {mode === "window" && (
              <>
                {isElectron && <TitleBar />}
                <Box {...layoutStyles.mainContent}>
                  <Background />
                  <CampusKnowledge
                    activeTopicId={activeCampusTopic}
                    onNavigate={navigateToCampusTopic}
                    onClose={closeCampusTopic}
                  />
                  <Box position="absolute" top="20px" left="20px" zIndex={10}>
                    <WebSocketStatus />
                  </Box>
                  <Box
                    position="absolute"
                    bottom={isFooterCollapsed ? "39px" : "185px"}
                    left={activeCampusTopic ? { base: '50%', lg: '79%' } : '50%'}
                    transform="translateX(-50%)"
                    zIndex={10}
                    width={activeCampusTopic ? { base: '80%', lg: '36%' } : '60%'}
                    transition="all 0.3s ease"
                  >
                    <Subtitle />
                  </Box>
                  <Box
                    {...layoutStyles.footer}
                    zIndex={10}
                    {...(isFooterCollapsed && layoutStyles.collapsedFooter)}
                  >
                    <Footer
                      isCollapsed={isFooterCollapsed}
                      onToggle={() => setIsFooterCollapsed(!isFooterCollapsed)}
                    />
                  </Box>
                </Box>
              </>
            )}

            {/* Pet Mode UI */}
            {mode === "pet" && <InputSubtitle />}
          </Box>
        </>
      )}
    </>
  );
}

function App(): JSX.Element {
  return (
    <ChakraProvider value={system}>
      {/* ModeProvider needs to wrap AppContent to provide mode to getGlobalStyles */}
      <ModeProvider>
        <AppWithGlobalStyles />
      </ModeProvider>
    </ChakraProvider>
  );
}

// Admin Panel Wrapper Component
function AdminPanelWrapper(): JSX.Element | null {
  const { isAdminOpen, closeAdmin } = useAdmin();

  if (!isAdminOpen) return null;

  return <KnowledgeAdmin onClose={closeAdmin} />;
}

// New component to access mode for global styles
function AppWithGlobalStyles(): JSX.Element {
  const content = (
    <AuthProvider>
    <CameraProvider>
      <ScreenCaptureProvider>
        <CharacterConfigProvider>
          <ChatHistoryProvider>
            <VolumeProvider>
              <AiStateProvider>
              <ProactiveSpeakProvider>
                <Live2DConfigProvider>
                  <SubtitleProvider>
                    <VADProvider>
                      <BgUrlProvider>
                        <GroupProvider>
                          <BrowserProvider>
                            <KnowledgeProvider>
                              <AdminProvider>
                                <WebSocketHandler>
                                  <Toaster />
                                  <AppContent />
                              </WebSocketHandler>
                                <AdminPanelWrapper />
                            </AdminProvider>
                          </KnowledgeProvider>
                        </BrowserProvider>
                      </GroupProvider>
                      </BgUrlProvider>
                    </VADProvider>
                  </SubtitleProvider>
                </Live2DConfigProvider>
              </ProactiveSpeakProvider>
            </AiStateProvider>
            </VolumeProvider>
          </ChatHistoryProvider>
        </CharacterConfigProvider>
      </ScreenCaptureProvider>
    </CameraProvider>
    </AuthProvider>
  );

  if (IS_KIOSK) {
    return (
      <Box
        width={`${KIOSK_LAYOUT_WIDTH}px`}
        height="var(--app-vh, 100vh)"
        transform="scale(var(--kiosk-css-scale, 1))"
        transformOrigin="top left"
        /* clip 而非 hidden：hidden 仍可被程序化滚动（scrollIntoView 会把整个
           包装盒滚下去、内容顶出屏），clip 在 Chrome90+ 完全禁滚 */
        style={{ overflow: 'clip' }}
      >
        {content}
      </Box>
    );
  }

  return (
    <>
      {content}
    </>
  );
}

export default App;
