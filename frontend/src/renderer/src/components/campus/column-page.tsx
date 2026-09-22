/**
 * 栏目页（2026-09-21 简化版省实改版）：学校概况 / 办学成果 / 招生入学
 *
 * 省实官网子页版式：banner 条 + 面包屑 + 左侧红块栏目菜单 + 右侧文章区
 * （点菜单项就地切换文章）。数据来自 data/site-columns.ts。
 * main 模式（Electron 工作台）仍走 campus-knowledge.tsx 旧专题版式，互不影响。
 */
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
import { FiArrowRight, FiArrowUpRight, FiChevronRight, FiHome, FiMic, FiPlay } from 'react-icons/fi';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWebSocket } from '@/context/websocket-context';
import { useAiState } from '@/context/ai-state-context';
import { useSubtitle } from '@/context/subtitle-context';
import { useAuth } from '@/context/auth-context';
import { useInterrupt } from '@/hooks/utils/use-interrupt';
import {
  ColumnArticle,
  SiteColumn,
  SiteColumnId,
  siteColumnMap,
} from '@/data/site-columns';
import { swissFont, siteTheme } from '../hero/site-theme';
import { usePortraitBoard } from '@/hooks/utils/use-portrait-board';

const ink = siteTheme.navy;
const muted = siteTheme.textBody;
const hairline = siteTheme.hairline;
const paper = siteTheme.paper;
const surface = '#FBF8F3';
const accent = siteTheme.red;
const accentWash = siteTheme.redWash;

const buildNarrationId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `column-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

interface ColumnPageProps {
  columnId: SiteColumnId;
  activeArticleId: string;
  onNavigateArticle: (columnId: SiteColumnId, articleId: string) => void;
  onNavigateHome: () => void;
  /** 未登录用户点「讲解」时回调（hero 路由弹出登录浮层） */
  onRequireAuth?: () => void;
}

function SidebarMenuButton({
  article,
  active,
  onClick,
}: {
  article: ColumnArticle;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      data-testid={`column-menu-${article.id}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      justifyContent="flex-start"
      width="100%"
      height="auto"
      minHeight="44px"
      py="10px"
      px="14px"
      borderRadius="none"
      background={active ? accentWash : 'transparent'}
      color={active ? accent : ink}
      borderLeft="3px solid"
      borderColor={active ? accent : 'transparent'}
      fontFamily={swissFont}
      fontWeight={active ? '600' : '400'}
      fontSize="14px"
      lineHeight="1.5"
      textAlign="left"
      whiteSpace="normal"
      _hover={{ background: accentWash, color: accent }}
      transition="all 160ms ease"
    >
      {article.title}
    </Button>
  );
}

/** 校庆等站内视频：<video> 直播服务器 /media 静态目录（APK 不打包） */
function ArticleVideo({ src, poster, caption }: { src: string; poster?: string; caption: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <Box
        mt="6"
        p="4"
        borderRadius="md"
        border="1px dashed"
        borderColor={hairline}
        background={surface}
      >
        <Text color={muted} fontSize="13px" lineHeight="1.6">
          视频暂时无法加载（需连接校园网或学校服务器）。可到学校视频号观看相关视频。
        </Text>
      </Box>
    );
  }
  return (
    <Box data-testid="column-video" mt="6">
      <Box
        borderRadius="md"
        overflow="hidden"
        border="1px solid"
        borderBottom="3px solid"
        borderColor={hairline}
        borderBottomColor={accent}
      >
        <video
          controls
          preload="metadata"
          poster={poster}
          src={src}
          style={{ width: '100%', display: 'block', maxHeight: 420, background: '#000' }}
          onError={() => setFailed(true)}
        />
      </Box>
      <Text mt="2" color={muted} fontSize="11px">
        {caption}
      </Text>
    </Box>
  );
}

export default function ColumnPage({
  columnId,
  activeArticleId,
  onNavigateArticle,
  onNavigateHome,
  onRequireAuth,
}: ColumnPageProps) {
  const { user: authUser } = useAuth();
  const { sendMessage, wsState } = useWebSocket();
  const { aiState, setAiState } = useAiState();
  const { subtitleText, setSubtitleText } = useSubtitle();
  const { interrupt } = useInterrupt();
  const [, setNarrationError] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isPortraitBoard = usePortraitBoard();

  const column: SiteColumn = siteColumnMap[columnId];
  const article: ColumnArticle = useMemo(
    () =>
      column.articles.find((item) => item.id === activeArticleId) ?? column.articles[0],
    [column, activeArticleId],
  );
  const isSpeaking = aiState === 'thinking-speaking';

  // 切换文章时滚回顶部（内容容器内滚动）
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [article.id]);

  useEffect(() => {
    console.log('[ColumnPage] column:', columnId, 'article:', article.id);
  }, [columnId, article.id]);

  const narrate = useCallback(
    (title: string, segments: string[]) => {
      const cleanedSegments = segments.map((segment) => segment.trim()).filter(Boolean);
      if (cleanedSegments.length === 0) return;

      // 匿名浏览时点「讲解」：先登录（讲解即数字人对话，会话按账号隔离）
      if (!authUser) {
        if (onRequireAuth) onRequireAuth();
        else setNarrationError('请先登录后再使用语音讲解。');
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
        narration_id: buildNarrationId(),
      });
      if (!sent) {
        setNarrationError('讲解请求发送失败，请检查后端连接。');
        return;
      }
      setNarrationError('');
      setSubtitleText(`正在准备讲解：${title}`);
      setAiState('thinking-speaking');
    },
    [aiState, authUser, interrupt, onRequireAuth, sendMessage, setAiState, setSubtitleText, wsState],
  );

  const stopNarration = useCallback(() => {
    interrupt();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setAiState('idle');
    setSubtitleText('讲解已停止，可以选择其他内容。');
  }, [interrupt, setAiState, setSubtitleText]);

  return (
    <Box
      data-testid="column-page"
      data-column={column.id}
      position="absolute"
      top={isPortraitBoard ? '164px' : { base: '112px', lg: '128px' }}
      left={{ base: '12px', lg: '24px' }}
      right={{ base: '12px', lg: '24px' }}
      bottom={{ base: '12px', lg: '24px' }}
      display="flex"
      flexDirection="column"
      gap={{ base: '8px', lg: '12px' }}
      zIndex={30}
      fontFamily={swissFont}
    >
      {/* banner 条 + 面包屑（省实官网子页式） */}
      <Box
        flexShrink={0}
        borderRadius="lg"
        overflow="hidden"
        position="relative"
        height={{ base: '108px', lg: '168px' }}
        border="1px solid"
        borderBottom="3px solid"
        borderColor={hairline}
        borderBottomColor={accent}
      >
        <Image
          src={column.banner}
          alt={`${column.navLabel}栏目配图`}
          width="100%"
          height="100%"
          objectFit="cover"
          objectPosition="center 35%"
          display="block"
        />
        <Box
          position="absolute"
          inset={0}
          background="linear-gradient(90deg, rgba(13,34,65,0.82) 0%, rgba(13,34,65,0.45) 55%, rgba(13,34,65,0.12) 100%)"
        />
        <Flex
          position="absolute"
          inset={0}
          align="flex-end"
          px={{ base: '16px', md: '24px' }}
          pb={{ base: '10px', lg: '16px' }}
        >
          <Box>
            <Text
              color={siteTheme.teal}
              fontSize={{ base: '10px', md: '12px' }}
              fontWeight="600"
              letterSpacing="0.08em"
              textTransform="uppercase"
            >
              {column.eyebrow}
            </Text>
            <Text
              color="white"
              fontSize={{ base: '22px', md: '30px' }}
              fontWeight="700"
              lineHeight="1.15"
              letterSpacing="-0.01em"
            >
              {column.navLabel}
            </Text>
          </Box>
        </Flex>
      </Box>

      <Flex align="center" gap="4px" px={{ base: '4px', lg: '2px' }} flexShrink={0} flexWrap="wrap">
        <Button
          data-testid="column-breadcrumb-home"
          variant="plain"
          height="auto"
          px="0"
          color={muted}
          fontSize="12px"
          fontFamily={swissFont}
          _hover={{ color: accent }}
          onClick={onNavigateHome}
        >
          <HStack gap="4px">
            <FiHome size={12} />
            <Text>首页</Text>
          </HStack>
        </Button>
        <FiChevronRight size={12} color={muted} />
        <Text color={muted} fontSize="12px">{column.navLabel}</Text>
        <FiChevronRight size={12} color={muted} />
        <Text color={accent} fontSize="12px" fontWeight="600">{article.title}</Text>
      </Flex>

      {/* 主体：左栏目菜单 + 右文章区（lg+ 双栏靠左，右侧留人物；base 单栏全宽） */}
      <Flex
        flex="1"
        minHeight="0"
        gap={{ base: '10px', lg: '14px' }}
        direction={{ base: 'column', lg: 'row' }}
        alignSelf={{ base: 'stretch', lg: 'flex-start' }}
        width={{ base: '100%', lg: '58%' }}
      >
        {/* 左侧栏目菜单：lg+ 红块栏目名 + 白底文章列表；base 横向 chips 行 */}
        <Box
          flexShrink={0}
          width={{ base: '100%', lg: '216px' }}
          background={paper}
          borderRadius="lg"
          border="1px solid"
          borderColor={hairline}
          boxShadow="sm"
          overflow="hidden"
        >
          <Box display={{ base: 'none', lg: 'block' }} background={accent} px="14px" py="12px">
            <Text color="white" fontSize="15px" fontWeight="700" lineHeight="1.2">
              {column.navLabel}
            </Text>
            <Text mt="2px" color="rgba(255,255,255,0.75)" fontSize="10px" letterSpacing="0.06em">
              {column.eyebrow}
            </Text>
          </Box>
          {/* base：横向滑动 chips（原生滚动；kiosk 触摸可用） */}
          <Flex
            display={{ base: 'flex', lg: 'none' }}
            overflowX="auto"
            css={{ '&::-webkit-scrollbar': { display: 'none' } }}
            px="6px"
            py="6px"
            gap="6px"
          >
            {column.articles.map((item) => {
              const active = item.id === article.id;
              return (
                <Button
                  key={item.id}
                  data-testid={`column-chip-${item.id}`}
                  onClick={() => onNavigateArticle(column.id, item.id)}
                  flexShrink={0}
                  height="32px"
                  px="12px"
                  borderRadius="full"
                  background={active ? accent : 'transparent'}
                  color={active ? 'white' : ink}
                  border="1px solid"
                  borderColor={active ? accent : hairline}
                  fontFamily={swissFont}
                  fontWeight={active ? '600' : '400'}
                  fontSize="13px"
                  _hover={{ background: active ? accent : accentWash, color: active ? 'white' : accent }}
                >
                  {item.title}
                </Button>
              );
            })}
          </Flex>
          {/* lg+：竖排文章菜单（省实白底菜单式） */}
          <Box display={{ base: 'none', lg: 'block' }} borderTop="1px solid" borderColor={hairline}>
            {column.articles.map((item) => (
              <SidebarMenuButton
                key={item.id}
                article={item}
                active={item.id === article.id}
                onClick={() => onNavigateArticle(column.id, item.id)}
              />
            ))}
          </Box>
        </Box>

        {/* 右侧文章区 */}
        <Box
          flex="1"
          minWidth="0"
          background={paper}
          borderRadius="lg"
          border="1px solid"
          borderColor={hairline}
          boxShadow="sm"
          overflow="hidden"
        >
          <Box
            ref={scrollRef}
            height="100%"
            overflowY="auto"
            css={{
              '&::-webkit-scrollbar': { width: '6px' },
              '&::-webkit-scrollbar-track': { background: surface },
              '&::-webkit-scrollbar-thumb': { background: hairline, borderRadius: '3px' },
              '&::-webkit-scrollbar-thumb:hover': { background: muted },
            }}
          >
            <Box
              data-testid={`column-article-${article.id}`}
              mx={{ base: '16px', md: '24px' }}
              mt={{ base: '18px', md: '24px' }}
              mb={{ base: '24px', md: '32px' }}
            >
              {article.eyebrow && (
                <Text
                  color={siteTheme.teal}
                  fontSize={{ base: '11px', md: '13px' }}
                  fontWeight="600"
                  letterSpacing="0.05em"
                  textTransform="uppercase"
                  mb="2"
                >
                  {article.eyebrow}
                </Text>
              )}

              {/* 文章标题：红标题 + 短红下划线（省实正文标题式） */}
              <Text
                data-testid="column-article-title"
                color={ink}
                fontSize={{ base: '24px', md: '30px' }}
                lineHeight="1.2"
                fontWeight="700"
                letterSpacing="-0.01em"
                mb="3"
              >
                {article.title}
              </Text>
              <Box mb="4" width="56px" height="3px" bg={accent} />

              <Text color={muted} fontSize={{ base: '13px', md: '14px' }} lineHeight="1.7" mb="5">
                {article.summary}
              </Text>

              {/* 讲解控制 */}
              <Flex gap="3" mb="6">
                <Button
                  data-testid="column-article-narrate"
                  onClick={() => narrate(`石实实验学校·${article.title}`, [article.narration])}
                  disabled={isSpeaking}
                  height="40px"
                  px="5"
                  borderRadius="md"
                  background={accent}
                  color="white"
                  fontFamily={swissFont}
                  fontWeight="500"
                  fontSize="sm"
                  _hover={{ background: siteTheme.redDark }}
                  _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
                >
                  <FiPlay size={15} style={{ marginRight: '8px' }} />
                  讲解本文
                </Button>
                {isSpeaking && (
                  <Button
                    onClick={stopNarration}
                    height="40px"
                    px="5"
                    borderRadius="md"
                    variant="outline"
                    color={ink}
                    fontFamily={swissFont}
                    fontWeight="500"
                    fontSize="sm"
                    _hover={{ background: surface }}
                  >
                    <FiMic size={14} style={{ marginRight: '6px' }} />
                    停止讲解
                  </Button>
                )}
              </Flex>

              {/* 正文段落 */}
              {article.paragraphs.map((paragraph, idx) => (
                <Text
                  key={idx}
                  color={muted}
                  fontSize={{ base: '14px', md: '15px' }}
                  lineHeight="1.9"
                  mb="4"
                >
                  {paragraph}
                </Text>
              ))}

              {/* 事实要点 */}
              {article.facts.length > 0 && (
                <Box mt="5" p="4" borderRadius="md" background={surface} border="1px solid" borderColor={hairline}>
                  {article.facts.map((fact, idx) => (
                    <Flex key={idx} align="flex-start" gap="2" mb={idx === article.facts.length - 1 ? 0 : 2}>
                      <Box mt="2" width="4" height="4" flexShrink={0} background={accent} borderRadius="full" />
                      <Text color={muted} fontSize="13px" lineHeight="1.7">
                        {fact}
                      </Text>
                    </Flex>
                  ))}
                </Box>
              )}

              {/* 站内视频（/media 自建播放） */}
              {article.video && (
                <ArticleVideo
                  src={article.video.src}
                  poster={article.video.poster}
                  caption={article.video.caption}
                />
              )}

              {/* 配图（card 横图 / portrait 圆形头像） */}
              {article.images.length > 0 && (
                <SimpleGrid columns={{ base: 1, md: 2 }} gap="4" mt="6">
                  {article.images.map((image, idx) =>
                    image.variant === 'portrait' ? (
                      <Flex
                        key={idx}
                        align="center"
                        gap="3"
                        p="3"
                        borderRadius="md"
                        border="1px solid"
                        borderColor={hairline}
                        background={surface}
                      >
                        <Image
                          src={image.src}
                          alt={image.caption || article.title}
                          boxSize="72px"
                          borderRadius="full"
                          objectFit="cover"
                          border="2px solid"
                          borderColor={hairline}
                          flexShrink={0}
                        />
                        {image.caption && (
                          <Text color={muted} fontSize="11px" lineHeight="1.5">
                            {image.caption}
                          </Text>
                        )}
                      </Flex>
                    ) : (
                      <Box
                        key={idx}
                        borderRadius="md"
                        overflow="hidden"
                        border="1px solid"
                        borderColor={hairline}
                        gridColumn={article.images.length === 1 ? 'span 2' : undefined}
                      >
                        <Image
                          src={image.src}
                          alt={image.caption || article.title}
                          width="100%"
                          height={{ base: '150px', md: '180px' }}
                          objectFit="cover"
                          display="block"
                        />
                        {image.caption && (
                          <Text px="2" py="1" color={muted} fontSize="11px">
                            {image.caption}
                          </Text>
                        )}
                      </Box>
                    ),
                  )}
                </SimpleGrid>
              )}

              {/* 参考来源（无 url 渲染为纯文字，不做假链接） */}
              {article.sources.length > 0 && (
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
                  {article.sources.map((source, index) => {
                    const inner = (
                      <Flex align="flex-start" gap="8px">
                        <Text color={accent} fontSize="12px" fontWeight="700" fontFamily={swissFont}>
                          {String(index + 1).padStart(2, '0')}
                        </Text>
                        <Box minWidth="0">
                          <Text color={ink} fontSize="13px" lineHeight="1.4" display="flex" alignItems="center">
                            {source.title}
                            {source.url && <FiArrowUpRight size={12} style={{ marginLeft: '4px', flexShrink: 0 }} />}
                          </Text>
                          <Text mt="2px" color={muted} fontSize="11px">
                            {source.publisher} · {source.publishedAt}
                          </Text>
                        </Box>
                      </Flex>
                    );
                    return source.url ? (
                      <Link
                        key={source.title}
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
                        {inner}
                      </Link>
                    ) : (
                      <Box key={source.title} py="3" px="4" opacity={0.85}>
                        {inner}
                      </Box>
                    );
                  })}
                </Box>
              )}

              {/* 下一篇快捷入口 */}
              {column.articles.length > 1 && (() => {
                const nextIndex = column.articles.findIndex((item) => item.id === article.id) + 1;
                const next = column.articles[nextIndex % column.articles.length];
                if (nextIndex < 0 || next.id === article.id) return null;
                return (
                  <Button
                    mt="8"
                    variant="outline"
                    height="40px"
                    px="5"
                    borderRadius="md"
                    color={accent}
                    borderColor={accent}
                    fontFamily={swissFont}
                    fontSize="sm"
                    _hover={{ background: accentWash }}
                    onClick={() => onNavigateArticle(column.id, next.id)}
                  >
                    下一篇：{next.title}
                    <FiArrowRight size={14} style={{ marginLeft: '8px' }} />
                  </Button>
                );
              })()}
            </Box>
          </Box>
        </Box>
      </Flex>

      {/* 讲解字幕条 */}
      {isSpeaking && (
        <Box
          data-testid="column-narration-caption"
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
