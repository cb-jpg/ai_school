/* eslint-disable no-shadow */
// import { StrictMode } from 'react';
import { Box, Flex, ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { useState, useEffect, useRef } from "react";
// import Canvas from './components/canvas/canvas'; // Likely unused now
import Sidebar from "./components/sidebar/sidebar";
import Footer from "./components/footer/footer";
import { AiStateProvider } from "./context/ai-state-context";
import { Live2DConfigProvider } from "./context/live2d-config-context";
import { SubtitleProvider } from "./context/subtitle-context";
import { BgUrlProvider } from "./context/bgurl-context";
import { layoutStyles } from "./layout";
import WebSocketHandler from "./services/websocket-handler";
import { CameraProvider } from "./context/camera-context";
import { ChatHistoryProvider } from "./context/chat-history-context";
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
// eslint-disable-next-line import/no-extraneous-dependencies, import/newline-after-import
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import Background from "./components/canvas/background";
import WebSocketStatus from "./components/canvas/ws-status";
import Subtitle from "./components/canvas/subtitle";
import { ModeProvider, useMode } from "./context/mode-context";
import CampusKnowledge from "./components/campus/campus-knowledge";
import { CampusTopicId, isCampusTopicId } from "./data/campus-knowledge";

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
  const { mode } = useMode();
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
    const syncCampusRoute = () => {
      setActiveCampusTopic(readCampusTopicFromLocation());
    };
    window.addEventListener('hashchange', syncCampusRoute);
    window.addEventListener('popstate', syncCampusRoute);
    return () => {
      window.removeEventListener('hashchange', syncCampusRoute);
      window.removeEventListener('popstate', syncCampusRoute);
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
    window.history.pushState(
      { campusTopic: null },
      '',
      `${window.location.pathname}${window.location.search}`,
    );
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

  return (
    <>
      <Box
        {...(mode === "window"
          ? live2dWindowFrameStyle
          : live2dPetStyle)}
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

      {/* Conditional Rendering of Window UI */}
      {mode === "window" && (
        <>
          {isElectron && <TitleBar />}
          {/* Apply styles by spreading */}
          <Flex {...layoutStyles.appContainer}>
            <Box
              {...layoutStyles.sidebar}
              {...(!showSidebar && { width: "24px" })}
            >
              <Sidebar
                isCollapsed={!showSidebar}
                onToggle={() => setShowSidebar(!showSidebar)}
              />
            </Box>
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
          </Flex>
        </>
      )}

      {/* Conditional Rendering of Pet Mode UI */}
      {mode === "pet" && <InputSubtitle />}
    </>
  );
}

function App(): JSX.Element {
  return (
    <ChakraProvider value={defaultSystem}>
      {/* ModeProvider needs to wrap AppContent to provide mode to getGlobalStyles */}
      <ModeProvider>
        <AppWithGlobalStyles />
      </ModeProvider>
    </ChakraProvider>
  );
}

// New component to access mode for global styles
function AppWithGlobalStyles(): JSX.Element {
  return (
    <>
      <CameraProvider>
        <ScreenCaptureProvider>
          <CharacterConfigProvider>
            <ChatHistoryProvider>
              <AiStateProvider>
                <ProactiveSpeakProvider>
                  <Live2DConfigProvider>
                    <SubtitleProvider>
                      <VADProvider>
                        <BgUrlProvider>
                          <GroupProvider>
                            <BrowserProvider>
                              <WebSocketHandler>
                                <Toaster />
                                <AppContent />
                              </WebSocketHandler>
                            </BrowserProvider>
                          </GroupProvider>
                        </BgUrlProvider>
                      </VADProvider>
                    </SubtitleProvider>
                  </Live2DConfigProvider>
                </ProactiveSpeakProvider>
              </AiStateProvider>
            </ChatHistoryProvider>
          </CharacterConfigProvider>
        </ScreenCaptureProvider>
      </CameraProvider>
    </>
  );
}

export default App;
