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
const system = createSystem(defaultConfig, { theme: { tokens } });
import { useState, useEffect, useRef } from "react";
// 导入工作台字体
import "@/styles/admin-fonts.css";
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
import KnowledgeAdmin from "./components/admin/knowledge-admin";
import { DocumentKnowledge } from "./components/admin/document-knowledge";
import { SystemLogs } from "./components/admin/system-logs";
import ModernSidebar from "./components/admin/modern-sidebar";
import { SchoolAdminLayout } from "./components/admin/school-admin-layout";
import { SchoolDashboard } from "./components/admin/school-dashboard";
import { SchoolTestConversation } from "./components/admin/school-test-conversation";
import { ModernMainWorkspace } from "./components/admin/modern-workspace";
import LoginPage from "./components/admin/login-page";
import UnansweredQuestions from "./components/admin/unanswered-questions";
import UserManagement from "./components/admin/user-management";
import { CharacterConfig } from "./components/admin/character-config";

// 定义路由类型
type AppRoute = 'hero' | 'main' | 'campus' | 'main-admin';
type MainRoute = 'dashboard' | 'test-conversation' | 'knowledge-admin' | 'workspace' | string;

const getCurrentRoute = (): AppRoute => {
  if (typeof window === 'undefined') return 'main-admin';
  const hash = window.location.hash;

  // Main admin workspace routes
  if (hash.startsWith('#/main') || hash === '#/main' || hash === '#/main/') {
    return 'main-admin';
  }

  // Hero landing page route - include campus routes as hero mode
  if (hash === '#/hero' || hash === '#/landing' || hash === '' || hash === '#/' || hash.startsWith('#/campus/')) {
    return 'hero';
  }

  // Default to admin workspace
  return 'main-admin';
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
  const { mode } = useMode();
  const { user: authUser } = useAuth();
  const isElectron = window.api !== undefined;
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

  // Show Hero Landing page on hero route (still wrapped in all providers)
  if (currentRoute === 'hero') {
    return (
      <>
        {/* Background layer for hero route */}
        <Background />

        {/* Live2D layer for hero route - 手机端占上半屏，桌面端右侧 55% */}
        <Box
          position="absolute"
          top={0}
          right={0}
          width={{ base: "100%", md: "55%" }}
          height={{
            base: "42vh",
            md: isElectron ? "calc(100vh - 30px)" : "100vh",
          }}
          zIndex={1}
          pointerEvents="none"
        >
          <Live2D showSidebar={false} />
        </Box>

        {/* CampusKnowledge overlay for topic pages */}
        {activeCampusTopic && (
          <Box
            position="absolute"
            top={0}
            left={0}
            width="100%"
            height={isElectron ? "calc(100vh - 30px)" : "100vh"}
            zIndex={2}
            pointerEvents="none"
          >
            <Box pointerEvents="auto" width="100%" height="100%">
              <CampusKnowledge
                activeTopicId={activeCampusTopic}
                onNavigate={navigateToCampusTopic}
                onClose={closeCampusTopic}
                mode="hero"
              />
            </Box>
          </Box>
        )}

        {/* WebSocketStatus indicator（专题页打开时隐藏，避免浮在专题页导航上） */}
        {!activeCampusTopic && (
          <Box position="absolute" top="20px" left="20px" zIndex={10}>
            <WebSocketStatus />
          </Box>
        )}

        {/* Subtitle for hero page - 手机端对话卡片内已展示文本，隐藏；专题页打开时隐藏 */}
        {!activeCampusTopic && (
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

        {/* Hero UI overlay */}
        <HeroLanding
          activeCampusTopic={activeCampusTopic}
        />
      </>
    );
  }

  // Admin workspace page - school themed management dashboard
  if (currentRoute === 'main-admin') {
    // 登录守卫：管理后台所有页面要求先登录
    if (!authUser) {
      return <LoginPage />;
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
  return (
    <>
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
    </>
  );
}

export default App;
