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
import { useCallback, useMemo, useState } from 'react';
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
}

const topicIcons: Record<CampusTopicId, IconType> = {
  history: FiClock,
  achievements: FiAward,
  'role-models': FiUsers,
};

const swissFont = '"Helvetica Neue", Arial, sans-serif';
const ink = '#121826';
const muted = '#586174';
const hairline = '#D9DEE8';
const paper = '#FFFFFF';
const surface = '#F7F7F8';
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
      px={{ base: '10px', lg: '14px' }}
      borderRadius="0"
      border="1px solid"
      borderColor={active ? blue : hairline}
      borderBottomWidth={active ? '3px' : '1px'}
      background={active ? blueWash : paper}
      color={ink}
      fontFamily={swissFont}
      _hover={{
        borderColor: blue,
        background: blueWash,
        color: blue,
      }}
      transition="background 160ms ease, border-color 160ms ease, color 160ms ease"
    >
      <HStack gap="7px">
        <Icon size="15" color={blue} />
        <Text fontSize={{ base: '12px', lg: '13px' }} fontWeight="700">
          {topic.navLabel}
        </Text>
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
      borderTop="1px solid"
      borderColor={hairline}
      py={{ base: '20px', xl: '24px' }}
      fontFamily={swissFont}
      _hover={{ background: blueWash }}
      transition="background 160ms ease"
    >
      <Flex align="flex-start" gap={{ base: '14px', md: '24px' }}>
        <Box width={{ base: '54px', md: '92px' }} flexShrink={0}>
          <Text
            color={blue}
            fontSize={{ base: '22px', md: '28px' }}
            lineHeight="1"
            fontWeight="800"
            fontVariantNumeric="tabular-nums"
          >
            {String(index + 1).padStart(2, '0')}
          </Text>
          <Box mt="12px" width="28px" height="4px" background={blue} />
          <Text mt="10px" color={muted} fontSize="10px" lineHeight="1.45">
            {section.eyebrow}
          </Text>
        </Box>

        <Box flex="1" minWidth="0">
          <Flex align={{ base: 'flex-start', md: 'center' }} justify="space-between" gap="16px" flexWrap="wrap">
            <Text color={ink} fontSize={{ base: '18px', xl: '21px' }} lineHeight="1.3" fontWeight="800">
              {section.title}
            </Text>
            <Button
              size="sm"
              disabled={disabled}
              onClick={onNarrate}
              aria-label={`讲解${section.title}`}
              height="32px"
              px="10px"
              borderRadius="0"
              border="1px solid"
              borderColor={blue}
              background={paper}
              color={blue}
              fontFamily={swissFont}
              _hover={{ background: blue, color: paper }}
            >
              <FiMic />
              讲解这一段
            </Button>
          </Flex>

          <Text mt="9px" maxWidth="680px" color={muted} fontSize="14px" lineHeight="1.7">
            {section.summary}
          </Text>

          <SimpleGrid columns={{ base: 1, md: 2 }} gap={{ base: '7px', md: '8px 20px' }} mt="14px">
            {section.facts.map((fact) => (
              <Flex key={fact} align="flex-start" gap="9px">
                <Box mt="7px" width="5px" height="5px" flexShrink={0} background={blue} />
                <Text color={ink} fontSize="12px" lineHeight="1.6">
                  {fact}
                </Text>
              </Flex>
            ))}
          </SimpleGrid>
        </Box>
      </Flex>
    </Box>
  );
}

export default function CampusKnowledge({
  activeTopicId,
  onNavigate,
  onClose,
}: CampusKnowledgeProps) {
  const { sendMessage, wsState } = useWebSocket();
  const { aiState, setAiState } = useAiState();
  const { setSubtitleText } = useSubtitle();
  const { interrupt } = useInterrupt();
  const [narrationError, setNarrationError] = useState('');
  const activeTopic = activeTopicId ? campusTopicMap[activeTopicId] : null;
  const isSpeaking = aiState === 'thinking-speaking';

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
    if (isSpeaking) stopNarration();
    onClose();
  };

  return (
    <>
      <Box
        data-testid="campus-navigation"
        position="absolute"
        top={{ base: '10px', lg: '16px' }}
        left={{ base: '12px', lg: '24px' }}
        right={{ base: '12px', lg: '24px' }}
        zIndex={30}
        px={{ base: '8px', lg: '12px' }}
        py="8px"
        border="1px solid"
        borderColor={hairline}
        background={paper}
        fontFamily={swissFont}
      >
        <Flex align="center" justify="space-between" gap="10px" flexWrap="wrap">
          <Flex align="center" gap="10px" px={{ base: '4px', lg: '8px' }}>
            <Box width="26px" height="26px" background={blue} color={paper} display="grid" placeItems="center">
              <FiBookOpen size="14" />
            </Box>
            <Box>
              <Text color={ink} fontSize="12px" fontWeight="800" lineHeight="1.1">
                {demoSchool.shortName}
              </Text>
              <Text mt="3px" color={muted} fontSize="10px" lineHeight="1.1">
                校园专题档案
              </Text>
            </Box>
          </Flex>

          <Flex align="center" justify="flex-end" gap="6px" flexWrap="wrap">
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
                px="11px"
                borderRadius="0"
                border="1px solid"
                borderColor={hairline}
                background={paper}
                color={muted}
                fontFamily={swissFont}
                _hover={{ borderColor: blue, color: blue, background: blueWash }}
              >
                <FiArrowLeft />
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
          top={{ base: '116px', lg: '86px' }}
          left={{ base: '12px', lg: '24px' }}
          bottom={{ base: '44px', lg: '50px' }}
          width={{ base: 'calc(100% - 24px)', lg: '55%' }}
          zIndex={22}
          border="1px solid"
          borderColor={hairline}
          background={surface}
          overflow="hidden"
          fontFamily={swissFont}
        >
          <Box
            height="100%"
            overflowY="auto"
            backgroundImage="linear-gradient(to right, rgba(0, 47, 167, 0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 47, 167, 0.045) 1px, transparent 1px)"
            backgroundSize="32px 32px"
          >
            <Box
              mx={{ base: '14px', md: '24px', xl: '32px' }}
              mt={{ base: '14px', md: '24px' }}
              background={paper}
              border="1px solid"
              borderColor={hairline}
            >
              <Box px={{ base: '16px', md: '26px', xl: '34px' }} pt={{ base: '22px', md: '30px' }}>
                <Flex align="flex-start" justify="space-between" gap="24px" flexWrap="wrap">
                  <Box maxWidth="700px">
                    <Flex align="center" gap="10px" mb="16px">
                      <Text color={blue} fontSize="11px" fontWeight="800" letterSpacing="0.16em">
                        {activeTopic.eyebrow}
                      </Text>
                      <Box width="42px" height="1px" background={blue} />
                      <Text color={muted} fontSize="11px" fontVariantNumeric="tabular-nums">
                        {activeTopic.statusLabel}
                      </Text>
                    </Flex>
                    <Text
                      data-testid="campus-topic-title"
                      color={ink}
                      fontSize={{ base: '29px', md: '39px', xl: '47px' }}
                      lineHeight="1.08"
                      fontWeight="800"
                      letterSpacing="-0.04em"
                    >
                      {activeTopic.title}
                    </Text>
                    <Text mt="16px" maxWidth="650px" color={muted} fontSize={{ base: '14px', md: '16px' }} lineHeight="1.75">
                      {activeTopic.subtitle}
                    </Text>
                    <Text mt="14px" color={muted} fontSize="11px" lineHeight="1.55">
                      {demoSchool.name} · 原名：{demoSchool.formerName}
                    </Text>
                  </Box>

                  <Box minWidth={{ base: '100%', sm: '190px' }}>
                    <Text color={muted} fontSize="10px" letterSpacing="0.13em">
                      ARCHIVE / {activeTopic.id.toUpperCase()}
                    </Text>
                    <Text mt="6px" color={blue} fontSize={{ base: '32px', md: '42px' }} lineHeight="1" fontWeight="800" fontVariantNumeric="tabular-nums">
                      {String(activeTopic.sections.length).padStart(2, '0')}
                    </Text>
                    <Text mt="8px" color={muted} fontSize="11px" lineHeight="1.5">
                      个主题单元
                    </Text>
                    <Button
                      data-testid="campus-play-all"
                      mt="18px"
                      onClick={() => narrate(`${demoSchool.name}·${activeTopic.navLabel}完整讲解`, fullNarration)}
                      disabled={isSpeaking}
                      height="38px"
                      px="13px"
                      borderRadius="0"
                      border="1px solid"
                      borderColor={blue}
                      background={blue}
                      color={paper}
                      fontFamily={swissFont}
                      fontWeight="700"
                      _hover={{ background: ink, borderColor: ink }}
                    >
                      <FiPlay />
                      完整讲解
                    </Button>
                    {isSpeaking && (
                      <Button
                        data-testid="campus-stop-narration"
                        mt="8px"
                        onClick={stopNarration}
                        height="32px"
                        px="11px"
                        borderRadius="0"
                        border="1px solid"
                        borderColor="#B3261E"
                        background={paper}
                        color="#B3261E"
                        fontFamily={swissFont}
                        _hover={{ background: '#FCE8E6' }}
                      >
                        停止讲解
                      </Button>
                    )}
                  </Box>
                </Flex>
              </Box>

              <SimpleGrid
                columns={{ base: 1, sm: 3 }}
                mt={{ base: '24px', md: '32px' }}
                borderTop="1px solid"
                borderBottom="1px solid"
                borderColor={hairline}
              >
                {activeTopic.stats.map((stat, index) => (
                  <Box
                    key={stat.label}
                    px={{ base: '16px', md: '26px' }}
                    py="17px"
                    borderLeft={{ base: 'none', sm: index === 0 ? 'none' : '1px solid' }}
                    borderTop={{ base: index === 0 ? 'none' : '1px solid', sm: 'none' }}
                    borderColor={hairline}
                  >
                    <Text color={blue} fontSize={{ base: '22px', md: '27px' }} lineHeight="1" fontWeight="800" fontVariantNumeric="tabular-nums">
                      {stat.value}
                    </Text>
                    <Text mt="7px" color={muted} fontSize="11px" lineHeight="1.45">
                      {stat.label}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>

              {narrationError && (
                <Box mx={{ base: '16px', md: '26px' }} mt="20px" px="13px" py="10px" borderLeft="3px solid" borderColor="#B3261E" background="#FCE8E6">
                  <Text color="#8C1D18" fontSize="12px">{narrationError}</Text>
                </Box>
              )}

              <Flex
                align="flex-start"
                gap="12px"
                mx={{ base: '16px', md: '26px' }}
                mt="22px"
                px="14px"
                py="13px"
                borderLeft="3px solid"
                borderColor={blue}
                background={blueWash}
              >
                <Text color={blue} fontSize="12px" fontWeight="800" lineHeight="1.4">资料说明</Text>
                <Box>
                  <Text color={ink} fontSize="12px" lineHeight="1.65">{activeTopic.notice}</Text>
                  <Text mt="4px" color={muted} fontSize="10px" lineHeight="1.55">
                    更新：{demoSchool.updatedAt} · {demoSchool.disclaimer}
                  </Text>
                </Box>
              </Flex>

              <Box px={{ base: '16px', md: '26px' }} pt={{ base: '24px', md: '32px' }} pb="8px">
                <Flex align="baseline" justify="space-between" gap="12px" borderBottom="2px solid" borderColor={ink} pb="10px">
                  <Text color={ink} fontSize="14px" fontWeight="800">内容索引</Text>
                  <Text color={muted} fontSize="10px" fontVariantNumeric="tabular-nums">
                    {activeTopic.sections.length} 个主题单元
                  </Text>
                </Flex>
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
                <Box px={{ base: '16px', md: '26px' }} pt="10px" pb={{ base: '24px', md: '34px' }}>
                  <Flex align="center" gap="8px" borderBottom="2px solid" borderColor={ink} pb="10px">
                    <FiExternalLink color={blue} />
                    <Text color={ink} fontSize="14px" fontWeight="800">公开资料来源</Text>
                    <Text color={muted} fontSize="10px">点击标题打开原文</Text>
                  </Flex>
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap="0 20px">
                    {activeTopic.sources.map((source, index) => (
                      <Link
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        display="block"
                        py="13px"
                        borderBottom="1px solid"
                        borderColor={hairline}
                        _hover={{ color: blue, background: blueWash }}
                        transition="background 160ms ease, color 160ms ease"
                      >
                        <Flex align="flex-start" gap="10px">
                          <Text color={blue} fontSize="11px" fontWeight="800" fontVariantNumeric="tabular-nums">
                            {String(index + 1).padStart(2, '0')}
                          </Text>
                          <Box minWidth="0">
                            <Text color={ink} fontSize="12px" lineHeight="1.55">
                              {source.title}
                              <FiArrowUpRight size="12" style={{ display: 'inline', marginLeft: '5px', verticalAlign: '-1px' }} />
                            </Text>
                            <Text mt="4px" color={muted} fontSize="10px">
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
