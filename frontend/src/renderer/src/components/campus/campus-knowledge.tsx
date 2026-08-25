import {
  Box,
  Button,
  Flex,
  HStack,
  Link,
  SimpleGrid,
  Text,
} from '@chakra-ui/react';
import {
  FiArrowLeft,
  FiArrowUpRight,
  FiAward,
  FiBookOpen,
  FiClock,
  FiExternalLink,
  FiMic,
  FiPlay,
  FiUsers,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWebSocket } from '@/context/websocket-context';
import { useAiState } from '@/context/ai-state-context';
import { useSubtitle } from '@/context/subtitle-context';
import { useInterrupt } from '@/hooks/utils/use-interrupt';
import {
  CampusKnowledgeSection,
  CampusTopic,
  CampusTopicId,
  campusTopicMap,
  campusTopics,
  demoSchool,
} from '@/data/campus-knowledge';

interface CampusKnowledgeProps {
  activeTopicId: CampusTopicId | null;
  onNavigate: (topicId: CampusTopicId) => void;
  onClose: () => void;
  onStartConsultation?: () => void;  // 新增：开始对话的回调
  mode?: 'hero' | 'main';
}

const topicIcons: Record<CampusTopicId, IconType> = {
  intro: FiBookOpen,
  history: FiClock,
  achievements: FiAward,
  'role-models': FiUsers,
};

// 使用与首页一致的明亮风格配色
const lightColors = {
  bg: '#FAFAFA',
  primary: '#002FA7',
  text: '#121826',
  textSecondary: '#586174',
  border: '#E5E7EB',
  white: '#FFFFFF',
  accent: '#E8EEFF',
};

const swissFont = '"Helvetica Neue", Arial, sans-serif';
const ink = '#121826';
const muted = '#586174';
const hairline = '#E5E7EB';
const paper = '#FFFFFF';
const surface = '#FAFAFA';
const blue = '#002FA7';
const blueWash = '#E8EEFF';

const buildNarrationId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `campus-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

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
      background={active ? blue : 'transparent'}
      color={active ? 'white' : ink}
      fontFamily={swissFont}
      fontWeight="500"
      fontSize="sm"
      _hover={{
        background: active ? blue : blueWash,
        color: active ? 'white' : blue,
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
            color={blue}
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
              background={blue}
              color="white"
              fontFamily={swissFont}
              fontWeight="500"
              fontSize="sm"
              _hover={{ background: 'rgba(0, 47, 167, 0.9)' }}
              _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
            >
              <FiMic size={14} style={{ marginRight: '6px' }} />
              讲解
            </Button>
          </Flex>

          <Text color={muted} fontSize="14px" lineHeight="1.7" mb="4">
            {section.summary}
          </Text>

          <Flex gap="3" flexWrap="wrap">
            {section.facts.map((fact, idx) => (
              <Flex key={idx} align="flex-start" gap="2">
                <Box mt="2" width="4" height="4" flexShrink={0} background={blue} borderRadius="full" />
                <Text color={muted} fontSize="13px" lineHeight="1.6">
                  {fact}
                </Text>
              </Flex>
            ))}
          </Flex>
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
}: CampusKnowledgeProps) {
  const { sendMessage, wsState } = useWebSocket();
  const { aiState, setAiState } = useAiState();
  const { setSubtitleText } = useSubtitle();
  const { interrupt } = useInterrupt();
  const [narrationError, setNarrationError] = useState('');
  const activeTopic = activeTopicId ? campusTopicMap[activeTopicId] : null;
  const isSpeaking = aiState === 'thinking-speaking';
  const isHeroMode = mode === 'hero';

  // Debug logging
  useEffect(() => {
    console.log('[CampusKnowledge] mode:', mode, 'isHeroMode:', isHeroMode, 'activeTopicId:', activeTopicId);
  }, [mode, isHeroMode, activeTopicId]);

  const narrate = useCallback((title: string, segments: string[]) => {
    const cleanedSegments = segments.map((segment) => segment.trim()).filter(Boolean);
    if (cleanedSegments.length === 0) return;

    if (wsState !== 'OPEN') {
      setNarrationError('讲解服务尚未连接，请稍后重试。');
      return;
    }

    if (aiState === 'thinking-speaking') interrupt();

    const sent = sendMessage({
      type: 'static-narration',
      title,
      segments: cleanedSegments,
      narration_id: buildNarrationId(),
    });
    if (!sent) {
      setNarrationError('讲解请求发送失败，请检查后端连接。');
      return;
    }

    setNarrationError('');
    setSubtitleText(`正在准备讲解：${title}`);
    setAiState('thinking-speaking');
  }, [aiState, interrupt, sendMessage, setAiState, setSubtitleText, wsState]);

  const stopNarration = useCallback(() => {
    interrupt();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setAiState('idle');
    setSubtitleText('讲解已停止，可以选择其他内容。');
  }, [interrupt, setAiState, setSubtitleText]);

  const handleTopicNavigation = useCallback((topic: CampusTopic) => {
    onNavigate(topic.id);
    narrate(`${demoSchool.name}·${topic.navLabel}`, [topic.introNarration]);
  }, [narrate, onNavigate]);

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
    <>
      {/* Navigation Bar - 在所有模式下都显示，但在 Hero 模式下样式调整 */}
      <Box
        data-testid="campus-navigation"
        display="block"
        position="absolute"
        top={{ base: '10px', lg: '16px' }}
        left={{ base: '12px', lg: '24px' }}
        right={{ base: '12px', lg: '24px' }}
        zIndex={30}
        px={{ base: '16px', md: '20px', lg: '24px' }}
        py={{ base: '16px', md: '20px' }}
        background={paper}
        borderRadius="lg"
        boxShadow="sm"
        border="1px solid"
        borderColor={hairline}
        fontFamily={swissFont}
      >
        <Flex align="center" justify="space-between" gap="16px" flexWrap="wrap">
          <Flex align="center" gap="16px">
            <Box width="40px" height="40px" background={blue} color={paper} display="grid" placeItems="center" borderRadius="lg">
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

          <Flex align="center" justify="flex-end" gap="8px" flexWrap="wrap">
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
                aria-label="返回普通对话页面"
                onClick={handleClose}
                height="40px"
                px="16px"
                borderRadius="md"
                variant="ghost"
                color={muted}
                fontFamily={swissFont}
                fontWeight="500"
                fontSize="sm"
                _hover={{ background: blueWash, color: blue }}
              >
                <FiArrowLeft size={16} style={{ marginRight: '8px' }} />
                返回对话
              </Button>
            )}
          </Flex>
        </Flex>
      </Box>

      {activeTopic && (
        <Box
          data-testid="campus-topic-page"
          data-topic={activeTopic.id}
          position="absolute"
          top={isHeroMode ? { base: '80px', lg: '76px' } : { base: '116px', lg: '86px' }}
          left={{ base: '12px', lg: '24px' }}
          bottom={{ base: '20px', lg: '24px' }}
          width={isHeroMode ? { base: 'calc(100% - 24px)', lg: 'calc(50% - 24px)' } : { base: 'calc(100% - 24px)', lg: '55%' }}
          zIndex={22}
          background={paper}
          overflow="hidden"
          fontFamily={swissFont}
          borderRadius="lg"
          boxShadow="sm"
          border="1px solid"
          borderColor={hairline}
        >
          <Box
            height="100%"
            overflowY="auto"
            CSS={{
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
              {/* Badge */}
              <Box mb="6">
                <Text
                  color={blue}
                  fontSize={{ base: '12px', md: '14px' }}
                  fontWeight="600"
                  letterSpacing="0.05em"
                  textTransform="uppercase"
                >
                  {activeTopic.eyebrow}
                </Text>
              </Box>

              {/* Title */}
              <Text
                data-testid="campus-topic-title"
                color={ink}
                fontSize={{ base: '32px', md: '42px', lg: '48px' }}
                lineHeight="1.1"
                fontWeight="700"
                letterSpacing="-0.02em"
                mb="6"
              >
                {activeTopic.title}
              </Text>

              {/* Subtitle */}
              <Text
                maxWidth="600px"
                color={muted}
                fontSize={{ base: '14px', md: '16px' }}
                lineHeight="1.7"
                mb="8"
              >
                {activeTopic.subtitle}
              </Text>

              {/* Stats */}
              <SimpleGrid columns={{ base: 2, md: 3 }} gap="6" mb="8" pb="8" borderBottom="1px solid" borderColor={hairline}>
                {activeTopic.stats.map((stat, index) => (
                  <Box key={stat.label}>
                    <Text
                      color={blue}
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
                  background={blue}
                  color="white"
                  fontFamily={swissFont}
                  fontWeight="500"
                  fontSize="sm"
                  _hover={{ background: 'rgba(0, 47, 167, 0.9)' }}
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
                  color={ink}
                  fontSize="16px"
                  fontWeight="700"
                  mb="6"
                  pb="4"
                  borderBottom="2px solid"
                  borderColor={ink}
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
                    color={ink}
                    fontSize="14px"
                    fontWeight="700"
                    mb="4"
                    pb="4"
                    borderBottom="1px solid"
                    borderColor={hairline}
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
                        _hover={{ background: surface, color: blue }}
                        transition="background 160ms ease"
                      >
                        <Flex align="flex-start" gap="8px">
                          <Text color={blue} fontSize="12px" fontWeight="700" fontFamily={swissFont}>
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
    </>
  );
}
