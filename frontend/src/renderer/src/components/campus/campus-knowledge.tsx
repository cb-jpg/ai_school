import {
  Box,
  Button,
  Flex,
  HStack,
  Image,
  Link,
  SimpleGrid,
  Text,
} from '@chakra-ui/react';
import {
  FiArrowUpRight,
  FiAward,
  FiBookOpen,
  FiClock,
  FiHome,
  FiMessageCircle,
  FiMic,
  FiPlay,
  FiUsers,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWebSocket } from '@/context/websocket-context';
import { safeRandomId } from '@/utils/random-id';
import { useAiState } from '@/context/ai-state-context';
import { useSubtitle } from '@/context/subtitle-context';
import { useAuth } from '@/context/auth-context';
import { useInterrupt } from '@/hooks/utils/use-interrupt';
import {
  CampusKnowledgeSection,
  CampusTopic,
  CampusTopicId,
  campusTopicMap,
  campusTopics,
  demoSchool,
} from '@/data/campus-knowledge';
import { imageForSection, topicBanners } from '@/data/campus-images';
import { swissFont, siteTheme } from '../hero/site-theme';
import { usePortraitBoard } from '@/hooks/utils/use-portrait-board';

interface CampusKnowledgeProps {
  activeTopicId: CampusTopicId | null;
  onNavigate: (topicId: CampusTopicId) => void;
  onClose: () => void;
  onStartConsultation?: () => void;  // 新增：开始对话的回调
  mode?: 'hero' | 'main';
  /** 未登录用户点「讲解」时回调（hero 路由弹出登录浮层；需求 #6：浏览免登录、互动先登录） */
  onRequireAuth?: () => void;
}

const topicIcons: Record<CampusTopicId, IconType> = {
  intro: FiBookOpen,
  history: FiClock,
  achievements: FiAward,
  'role-models': FiUsers,
};

/* 全站官网化（2026-09-21）：颜色统一取自石实 IP 官方主题（site-theme.ts）——
   绛红主色 / 藏青墨色 / 青绿点缀 / 米白纸感底 */
const ink = siteTheme.navy;
const muted = siteTheme.textBody;
const hairline = siteTheme.hairline;
const paper = siteTheme.paper;
const surface = '#FBF8F3';
const accent = siteTheme.red;
const accentWash = siteTheme.redWash;

function TopicNavigationButton({
  topic,
  active,
  onClick,
}: {
  topic: CampusTopic;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = topicIcons[topic.id];
  return (
    <Button
      data-testid={`campus-nav-${topic.id}`}
      aria-current={active ? 'page' : undefined}
      aria-label={`进入${topic.navLabel}页面`}
      onClick={onClick}
      height="40px"
      px={{ base: '12px', lg: '16px' }}
      borderRadius="md"
      background={active ? accent : 'transparent'}
      color={active ? 'white' : ink}
      fontFamily={swissFont}
      fontWeight="500"
      fontSize="sm"
      _hover={{
        background: active ? accent : accentWash,
        color: active ? 'white' : accent,
      }}
      transition="all 200ms ease"
    >
      <HStack gap="8px">
        <Icon size={16} />
        <Text>{topic.navLabel}</Text>
      </HStack>
    </Button>
  );
}

function KnowledgeSectionCard({
  section,
  index,
  onNarrate,
  disabled,
}: {
  section: CampusKnowledgeSection;
  index: number;
  onNarrate: () => void;
  disabled: boolean;
}) {
  // 按标题关键词匹配配图（学习标兵头像=portrait 圆形随文；荣誉牌匾/校园照片=card 横向大图）
  const sectionImage = imageForSection(section.title);
  return (
    <Box
      data-testid={`campus-section-${section.id}`}
      py="6"
      borderBottom="1px solid"
      borderColor={hairline}
      _hover={{ background: surface }}
      transition="background 160ms ease"
    >
      <Flex align="flex-start" gap={{ base: '4', md: '6' }} direction={{ base: 'column', md: 'row' }}>
        {/* Index Number */}
        <Box width={{ base: 'auto', md: '60px' }} flexShrink={0} mb={{ base: '4', md: '0' }}>
          <Text
            color={accent}
            fontSize="24px"
            lineHeight="1"
            fontWeight="700"
            fontFamily={swissFont}
          >
            {String(index + 1).padStart(2, '0')}
          </Text>
        </Box>

        {/* Content */}
        <Box flex="1" minWidth="0">
          <Flex align="center" justify="space-between" gap="4" mb="3" flexWrap="wrap">
            <Text color={ink} fontSize="18px" lineHeight="1.3" fontWeight="700">
              {section.title}
            </Text>
            <Button
              size="sm"
              disabled={disabled}
              onClick={onNarrate}
              aria-label={`讲解${section.title}`}
              height="36px"
              px="4"
              borderRadius="md"
              background={accent}
              color="white"
              fontFamily={swissFont}
              fontWeight="500"
              fontSize="sm"
              _hover={{ background: siteTheme.redDark }}
              _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
            >
              <FiMic size={14} style={{ marginRight: '6px' }} />
              讲解
            </Button>
          </Flex>

          {/* 摘要与事实：有头像配图时右侧并排圆形头像（学习标兵卡片） */}
          <Flex gap={{ base: '3', md: '4' }} align="flex-start">
            <Box flex="1" minWidth="0">
              <Text color={muted} fontSize="14px" lineHeight="1.7" mb="4">
                {section.summary}
              </Text>

              <Flex gap="3" flexWrap="wrap">
                {section.facts.map((fact, idx) => (
                  <Flex key={idx} align="flex-start" gap="2">
                    <Box mt="2" width="4" height="4" flexShrink={0} background={accent} borderRadius="full" />
                    <Text color={muted} fontSize="13px" lineHeight="1.6">
                      {fact}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            </Box>

            {sectionImage?.variant === 'portrait' && (
              <Box flexShrink={0} textAlign="center">
                <Image
                  src={sectionImage.src}
                  alt={section.title}
                  boxSize={{ base: '88px', md: '104px' }}
                  borderRadius="full"
                  objectFit="cover"
                  border="2px solid"
                  borderColor={hairline}
                />
                {sectionImage.caption && (
                  <Text mt="1" color={muted} fontSize="10px" lineHeight="1.4" maxW="112px">
                    {sectionImage.caption}
                  </Text>
                )}
              </Box>
            )}
          </Flex>

          {/* 牌匾/场景配图：横向大图（荣誉、校园照片） */}
          {sectionImage?.variant === 'card' && (
            <Box mt="4" borderRadius="md" overflow="hidden" border="1px solid" borderColor={hairline}>
              <Image
                src={sectionImage.src}
                alt={sectionImage.caption || section.title}
                width="100%"
                height={{ base: '150px', md: '190px' }}
                objectFit="cover"
                display="block"
              />
              {sectionImage.caption && (
                <Text px="2" py="1" color={muted} fontSize="11px">
                  {sectionImage.caption}
                </Text>
              )}
            </Box>
          )}
        </Box>
      </Flex>
    </Box>
  );
}

export default function CampusKnowledge({
  activeTopicId,
  onNavigate,
  onClose,
  onStartConsultation,
  mode = 'main',
  onRequireAuth,
}: CampusKnowledgeProps) {
  const { user: authUser } = useAuth();
  const { sendMessage, wsState } = useWebSocket();
  const { aiState, setAiState } = useAiState();
  const { subtitleText, setSubtitleText } = useSubtitle();
  const { interrupt } = useInterrupt();
  const [, setNarrationError] = useState('');
  const activeTopic = activeTopicId ? campusTopicMap[activeTopicId] : null;
  const isSpeaking = aiState === 'thinking-speaking';
  const isHeroMode = mode === 'hero';
  // 竖屏大屏（壁挂数字屏）：页头更高，内容卡起点相应下移
  const isPortraitBoard = usePortraitBoard();

  // Debug logging
  useEffect(() => {
    console.log('[CampusKnowledge] mode:', mode, 'isHeroMode:', isHeroMode, 'activeTopicId:', activeTopicId);
  }, [mode, isHeroMode, activeTopicId]);

  const narrate = useCallback((title: string, segments: string[]) => {
    const cleanedSegments = segments.map((segment) => segment.trim()).filter(Boolean);
    if (cleanedSegments.length === 0) return;

    // 匿名浏览时点「讲解」：先登录（讲解即数字人对话，会话按账号隔离）
    if (!authUser) {
      if (onRequireAuth) {
        onRequireAuth();
      } else {
        setNarrationError('请先登录后再使用语音讲解。');
      }
      return;
    }

    if (wsState !== 'OPEN') {
      setNarrationError('讲解服务尚未连接，请稍后重试。');
      return;
    }

    if (aiState === 'thinking-speaking') interrupt();

    const sent = sendMessage({
      type: 'static-narration',
      title,
      segments: cleanedSegments,
      narration_id: safeRandomId('campus-narrate'),
    });
    if (!sent) {
      setNarrationError('讲解请求发送失败，请检查后端连接。');
      return;
    }

    setNarrationError('');
    setSubtitleText(`正在准备讲解：${title}`);
    setAiState('thinking-speaking');
  }, [aiState, authUser, interrupt, onRequireAuth, sendMessage, setAiState, setSubtitleText, wsState]);

  const stopNarration = useCallback(() => {
    interrupt();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setAiState('idle');
    setSubtitleText('讲解已停止，可以选择其他内容。');
  }, [interrupt, setAiState, setSubtitleText]);

  const handleTopicNavigation = useCallback((topic: CampusTopic) => {
    // 2026-09-09 用户要求：进入专题页不再自动播报简介语音，
    // 需要讲解时用页面上的"完整讲解"或各段"讲解"按钮
    onNavigate(topic.id);
  }, [onNavigate]);

  const fullNarration = useMemo(() => (
    activeTopic
      ? [activeTopic.introNarration, ...activeTopic.sections.map((section) => section.narration)]
      : []
  ), [activeTopic]);

  const handleClose = () => {
    // 在关闭时总是打断语音播报，不仅是在 isSpeaking 状态时
    interrupt();
    if (isSpeaking) stopNarration();
    onClose();

    // 如果是 Hero 模式且有开始对话的回调，延迟触发进入对话模式
    if (isHeroMode && onStartConsultation) {
      setTimeout(() => {
        onStartConsultation();
      }, 100);
    }
  };

  return (
    /* 根容器：纵向 flex（导航卡 + 内容面板），结构上保证两者永不互相遮挡。
       hero 路由（2026-09-21 全站官网化）：页面导航已由 SiteHeader（hero-landing
       渲染，绛红横带+白色栏目导航条）承担，本组件整体避开页头高度
       （base≈106px / lg≈122px / 竖屏大屏≈158px）；main 模式（Electron 工作台）
       维持原内部导航卡与位置。 */
    <Box
      position="absolute"
      top={isHeroMode
        ? (isPortraitBoard ? '164px' : { base: '112px', lg: '128px' })
        : { base: '92px', lg: '16px' }}
      left={{ base: '12px', lg: '24px' }}
      right={{ base: '12px', lg: '24px' }}
      bottom={{ base: '12px', lg: '24px' }}
      display="flex"
      flexDirection="column"
      gap={{ base: '10px', lg: '16px' }}
      zIndex={30}
      fontFamily={swissFont}
    >
      {/* Navigation Bar（仅 main 模式：hero 模式的导航在 SiteHeader） */}
      {!isHeroMode && (
      <Box
        data-testid="campus-navigation"
        flexShrink={0}
        px={{ base: '12px', md: '20px', lg: '24px' }}
        py={{ base: '10px', md: '20px' }}
        background={paper}
        borderRadius="lg"
        boxShadow="sm"
        border="1px solid"
        borderColor={hairline}
      >
        {/* 手机端隐藏 logo 行（顶部学校导航栏已有校名），只保留一行 tab */}
        <Flex align="center" justify="space-between" gap="16px" flexWrap="wrap" display={{ base: 'none', md: 'flex' }}>
          <Flex align="center" gap="16px">
            <Box width="40px" height="40px" background={accent} color={paper} display="grid" placeItems="center" borderRadius="lg">
              <FiBookOpen size={20} />
            </Box>
            <Box>
              <Text color={ink} fontSize="16px" fontWeight="600" lineHeight="1.1">
                {demoSchool.shortName}
              </Text>
              <Text mt="2px" color={muted} fontSize="12px" lineHeight="1.1">
                校园专题档案
              </Text>
            </Box>
          </Flex>
        </Flex>

        {/* 手机端一行横向滑动；桌面端保持换行布局 */}
        <Flex
          align="center"
          justify={{ base: 'flex-start', lg: 'flex-end' }}
          gap="8px"
          flexWrap={{ base: 'nowrap', lg: 'wrap' }}
          overflowX={{ base: 'auto', lg: 'visible' }}
          css={{ '&::-webkit-scrollbar': { display: 'none' } }}
        >
            <Button
              data-testid="campus-nav-home"
              aria-label="返回学校首页"
              onClick={() => {
                interrupt();
                window.location.hash = '#/home';
              }}
              height="40px"
              px={{ base: '12px', lg: '16px' }}
              borderRadius="md"
              variant="ghost"
              color={ink}
              fontFamily={swissFont}
              fontWeight="500"
              fontSize="sm"
              flexShrink={0}
              _hover={{ background: accentWash, color: accent }}
              transition="all 200ms ease"
            >
              <HStack gap="8px">
                <FiHome size={16} />
                <Text>首页</Text>
              </HStack>
            </Button>
            {campusTopics.map((topic) => (
              <TopicNavigationButton
                key={topic.id}
                topic={topic}
                active={activeTopicId === topic.id}
                onClick={() => handleTopicNavigation(topic)}
              />
            ))}
            {activeTopic && (
              <Button
                data-testid="campus-close"
                aria-label="返回对话界面"
                onClick={handleClose}
                height="40px"
                px="16px"
                borderRadius="md"
                variant="ghost"
                color={muted}
                fontFamily={swissFont}
                fontWeight="500"
                fontSize="sm"
                _hover={{ background: accentWash, color: accent }}
              >
                <FiMessageCircle size={16} style={{ marginRight: '8px' }} />
                对话
              </Button>
            )}
        </Flex>
      </Box>
      )}

      {activeTopic && (
        <Box
          data-testid="campus-topic-page"
          data-topic={activeTopic.id}
          flex="1"
          minHeight="0"
          alignSelf={{ base: 'stretch', lg: 'flex-start' }}
          width={{ base: '100%', lg: isHeroMode ? 'calc(50% - 24px)' : '55%' }}
          background={paper}
          overflow="hidden"
          borderRadius="lg"
          boxShadow="sm"
          border="1px solid"
          borderColor={hairline}
        >
          <Box
            height="100%"
            overflowY="auto"
            css={{
              '&::-webkit-scrollbar': {
              width: '6px',
              },
              '&::-webkit-scrollbar-track': {
              background: surface,
              },
              '&::-webkit-scrollbar-thumb': {
              background: hairline,
              borderRadius: '3px',
              },
              '&::-webkit-scrollbar-thumb:hover': {
              background: muted,
              },
            }}
          >
            <Box
              mx={{ base: '16px', md: '24px' }}
              mt={{ base: '20px', md: '24px' }}
              mb={{ base: '20px', md: '24px' }}
              p={{ base: '20px', md: '24px' }}
            >
              {/* Badge（青绿眉行：石实 IP 次点缀色） */}
              <Box mb="4">
                <Text
                  color={siteTheme.teal}
                  fontSize={{ base: '12px', md: '14px' }}
                  fontWeight="600"
                  letterSpacing="0.05em"
                  textTransform="uppercase"
                >
                  {activeTopic.eyebrow}
                </Text>
              </Box>

              {/* Title：标题下短红下划线（省实官网板块标题式） */}
              <Text
                data-testid="campus-topic-title"
                color={ink}
                fontSize={{ base: '32px', md: '42px', lg: '48px' }}
                lineHeight="1.1"
                fontWeight="700"
                letterSpacing="-0.02em"
                mb="3"
              >
                {activeTopic.title}
              </Text>
              <Box mb="5" width="64px" height="4px" bg={accent} />

              {/* Subtitle */}
              <Text
                maxWidth="600px"
                color={muted}
                fontSize={{ base: '14px', md: '16px' }}
                lineHeight="1.7"
                mb="6"
              >
                {activeTopic.subtitle}
              </Text>

              {/* 专题配图横幅（校方素材，见 campus-images.ts；绛红底边呼应官网 banner） */}
              {topicBanners[activeTopic.id] && (
                <Box
                  mb="6"
                  borderRadius="lg"
                  overflow="hidden"
                  border="1px solid"
                  borderBottom="3px solid"
                  borderColor={hairline}
                  borderBottomColor={accent}
                >
                  <Image
                    src={topicBanners[activeTopic.id]}
                    alt={`${activeTopic.navLabel}配图`}
                    width="100%"
                    height={{ base: '150px', md: '210px' }}
                    objectFit="cover"
                    display="block"
                  />
                </Box>
              )}

              {/* Stats */}
              <SimpleGrid columns={{ base: 2, md: 3 }} gap="6" mb="8" pb="8" borderBottom="1px solid" borderColor={hairline}>
                {activeTopic.stats.map((stat) => (
                  <Box key={stat.label}>
                    <Text
                      color={accent}
                      fontSize={{ base: '24px', md: '28px' }}
                      lineHeight="1"
                      fontWeight="700"
                      mb="2"
                    >
                      {stat.value}
                    </Text>
                    <Text color={muted} fontSize="12px" lineHeight="1.4">
                      {stat.label}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>

              {/* Control Buttons */}
              <Flex gap="4" mb="8">
                <Button
                  onClick={() => narrate(`${demoSchool.name}·${activeTopic.navLabel}完整讲解`, fullNarration)}
                  disabled={isSpeaking}
                  height="44px"
                  px="6"
                  borderRadius="md"
                  background={accent}
                  color="white"
                  fontFamily={swissFont}
                  fontWeight="500"
                  fontSize="sm"
                  _hover={{ background: siteTheme.redDark }}
                  _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
                >
                  <FiPlay size={16} style={{ marginRight: '8px' }} />
                  完整讲解
                </Button>
                {isSpeaking && (
                  <Button
                    onClick={stopNarration}
                    height="44px"
                    px="6"
                    borderRadius="md"
                    variant="outline"
                    color={ink}
                    fontFamily={swissFont}
                    fontWeight="500"
                    fontSize="sm"
                    _hover={{ background: surface }}
                  >
                    停止讲解
                  </Button>
                )}
              </Flex>

              {/* Sections */}
              <Box>
                <Text
                  color={accent}
                  fontSize="16px"
                  fontWeight="700"
                  mb="6"
                  pb="4"
                  borderBottom="2px solid"
                  borderColor={accent}
                >
                  内容索引
                </Text>

                {activeTopic.sections.map((section, index) => (
                  <KnowledgeSectionCard
                    key={section.id}
                    section={section}
                    index={index}
                    disabled={isSpeaking}
                    onNarrate={() => narrate(section.title, [section.narration])}
                  />
                ))}
              </Box>

              {activeTopic.sources.length > 0 && (
                <Box mt="8">
                  <Text
                    color={accent}
                    fontSize="14px"
                    fontWeight="700"
                    mb="4"
                    pb="4"
                    borderBottom="1px solid"
                    borderColor={accent}
                  >
                    参考来源
                  </Text>
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                    {activeTopic.sources.map((source, index) => (
                      <Link
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        display="block"
                        py="3"
                        px="4"
                        borderRadius="md"
                        _hover={{ background: accentWash, color: accent }}
                        transition="background 160ms ease"
                      >
                        <Flex align="flex-start" gap="8px">
                          <Text color={accent} fontSize="12px" fontWeight="700" fontFamily={swissFont}>
                            {String(index + 1).padStart(2, '0')}
                          </Text>
                          <Box minWidth="0">
                            <Text color={ink} fontSize="13px" lineHeight="1.4" display="flex" alignItems="center">
                              {source.title}
                              <FiArrowUpRight size={12} style={{ marginLeft: '4px', flexShrink: 0 }} />
                            </Text>
                            <Text mt="2px" color={muted} fontSize="11px">
                              {source.publisher} · {source.publishedAt}
                            </Text>
                          </Box>
                        </Flex>
                      </Link>
                    ))}
                  </SimpleGrid>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* 讲解字幕条：讲解过程中在页面底部同步显示当前播报内容与状态 */}
      {isSpeaking && (
        <Box
          data-testid="campus-narration-caption"
          pointerEvents="none"
          position="absolute"
          left="50%"
          transform="translateX(-50%)"
          bottom={{ base: '10px', lg: '16px' }}
          maxWidth={{ base: '94%', lg: '560px' }}
          width="max-content"
          px="18px"
          py="10px"
          background="rgba(255, 255, 255, 0.96)"
          borderRadius="12px"
          boxShadow="0 4px 20px rgba(0, 0, 0, 0.12)"
          border="1px solid"
          borderColor={hairline}
          zIndex={40}
        >
          <Flex align="center" justify="center" gap="6px" mb="2px">
            <Box width="7px" height="7px" borderRadius="full" background={accent} />
            <Text color={accent} fontSize="11px" fontWeight="600" letterSpacing="0.08em">
              正在讲解
            </Text>
          </Flex>
          <Text
            color={ink}
            fontSize={{ base: '13px', lg: '14px' }}
            lineHeight="1.6"
            textAlign="center"
            whiteSpace="pre-wrap"
            css={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {subtitleText}
          </Text>
        </Box>
      )}
    </Box>
  );
}
