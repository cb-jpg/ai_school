/**
 * 新闻中心页（2026-09-21 简化版省实改版）
 * 省实官网列表页式：红标题 + 红下划线 + 新闻/公告两组可点击列表 + 右侧栏
 * （图说石实照片卡 + 联系方式卡）。匿名可看；条目有已核实直链才可点击跳转。
 */
import { Box, Button, Flex, HStack, Image, Link, Text } from '@chakra-ui/react';
import { FiArrowUpRight, FiBell, FiCalendar, FiMapPin, FiPhone } from 'react-icons/fi';
import { useState } from 'react';
import {
  CAMPUS_PHOTOS,
  PORTAL_ANNOUNCEMENTS,
  PORTAL_NEWS,
  SCHOOL_CONTACT,
} from '@/data/portal-content';
import { swissFont, siteTheme } from './site-theme';
import { usePortraitBoard } from '@/hooks/utils/use-portrait-board';

const ink = siteTheme.navy;
const muted = siteTheme.textBody;
const hairline = siteTheme.hairline;
const paper = siteTheme.paper;
const surface = '#FBF8F3';
const accent = siteTheme.red;
const accentWash = siteTheme.redWash;

interface NewsPageProps {
  onNavigateHome: () => void;
}

function NewsRow({
  title,
  date,
  tag,
  url,
  source,
  testId,
}: {
  title: string;
  date: string;
  tag: string;
  url?: string;
  source?: string;
  testId: string;
}) {
  const inner = (
    <Flex
      align="center"
      justify="space-between"
      gap="3"
      py="12px"
      borderBottom="1px solid"
      borderColor={hairline}
    >
      <Box minWidth="0" flex="1">
        <Text
          color={url ? ink : muted}
          fontSize={{ base: '14px', md: '15px' }}
          lineHeight="1.55"
          fontWeight="500"
          display="flex"
          alignItems="center"
          _hover={url ? { color: accent } : undefined}
        >
          {title}
          {url && <FiArrowUpRight size={14} style={{ marginLeft: '4px', flexShrink: 0, color: accent }} />}
        </Text>
        <HStack gap="8px" mt="4px">
          <Flex align="center" gap="4px">
            <FiCalendar size={11} color={muted} />
            <Text color={muted} fontSize="11px">{date}</Text>
          </Flex>
          {source && (
            <Text color={muted} fontSize="11px">
              来源：{source}
            </Text>
          )}
        </HStack>
      </Box>
      <Box
        flexShrink={0}
        px="8px"
        py="3px"
        borderRadius="full"
        background={tag === '通知' ? siteTheme.tealWash : accentWash}
        color={tag === '通知' ? siteTheme.teal : accent}
        fontSize="11px"
        fontWeight="600"
      >
        {tag}
      </Box>
    </Flex>
  );
  if (!url) return <Box data-testid={testId} opacity={0.9}>{inner}</Box>;
  return (
    <Link
      data-testid={testId}
      href={url}
      target="_blank"
      rel="noreferrer"
      display="block"
      _hover={{ textDecoration: 'none' }}
    >
      {inner}
    </Link>
  );
}

export default function NewsPage({ onNavigateHome }: NewsPageProps) {
  const isPortraitBoard = usePortraitBoard();
  // 图说石实：校园实景轮换（静态取前 3 张，手机取 2 张由布局裁剪）
  const [photoIndex] = useState(0);
  const galleryPhotos = CAMPUS_PHOTOS.slice(photoIndex, photoIndex + 3);

  return (
    <Box
      data-testid="news-page"
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
      {/* lg+ 内容行收在左 58%（与栏目页同构）：列表卡 + 右侧栏并列，
          右 42% 留透明给 Live2D 人物（页面根 z30 压过画布 z1，卡片铺进右区会挡住人物） */}
      <Flex
        alignSelf={{ base: 'stretch', lg: 'flex-start' }}
        width={{ base: '100%', lg: '58%' }}
        height={{ lg: '100%' }}
        gap={{ base: '8px', lg: '12px' }}
        alignItems="stretch"
      >
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
          height="100%"
          overflowY="auto"
          css={{
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { background: surface },
            '&::-webkit-scrollbar-thumb': { background: hairline, borderRadius: '3px' },
            '&::-webkit-scrollbar-thumb:hover': { background: muted },
          }}
        >
          <Box mx={{ base: '16px', md: '24px' }} mt={{ base: '20px', md: '28px' }} mb={{ base: '24px', md: '32px' }}>
            {/* 红标题 + 红下划线（省实板块标题式） */}
            <Text
              data-testid="news-page-title"
              color={ink}
              fontSize={{ base: '26px', md: '32px' }}
              fontWeight="700"
              letterSpacing="-0.01em"
              mb="3"
            >
              新闻中心
            </Text>
            <Box mb="4" width="56px" height="3px" bg={accent} />
            <Text color={muted} fontSize={{ base: '13px', md: '14px' }} lineHeight="1.7" mb="7">
              学校新闻与通知公告。带 ↗ 的条目可点击查看政府或媒体公开报道原文；更多图文请关注学校微信公众号"石实"。
            </Text>

            {/* 学校新闻 */}
            <Text
              data-testid="news-list-news"
              color={accent}
              fontSize="15px"
              fontWeight="700"
              mb="2"
              pb="3"
              borderBottom="2px solid"
              borderColor={accent}
            >
              学校新闻
            </Text>
            {PORTAL_NEWS.map((item) => (
              <NewsRow
                key={item.id}
                testId={`news-row-${item.id}`}
                title={item.title}
                date={item.date}
                tag={item.category}
                url={item.url}
                source={item.source}
              />
            ))}

            {/* 通知公告 */}
            <Text
              data-testid="news-list-announcements"
              color={accent}
              fontSize="15px"
              fontWeight="700"
              mt="8"
              mb="2"
              pb="3"
              borderBottom="2px solid"
              borderColor={accent}
            >
              通知公告
            </Text>
            {PORTAL_ANNOUNCEMENTS.map((item) => (
              <NewsRow
                key={item.id}
                testId={`news-row-${item.id}`}
                title={item.title}
                date={item.date}
                tag={item.audience === '全体' ? '通知' : `${item.audience}·通知`}
                url={item.url}
              />
            ))}

            <Text mt="6" color={muted} fontSize="11px" lineHeight="1.7">
              注：新闻与公告目前为占位示例（内容基于学校真实事件，日期可能不精确），正式发布前由校方宣传审核；
              公众号图文永久链接需校方在微信内复制提供后接入。
            </Text>
          </Box>
        </Box>
      </Box>

      {/* 右侧栏（lg+）：图说石实 + 联系方式（列表卡右侧并列，不出内容行） */}
      <Flex
        display={{ base: 'none', lg: 'flex' }}
        width="34%"
        flexShrink={0}
        flexDirection="column"
        gap="12px"
        overflowY="auto"
      >
        <Box
          background={paper}
          borderRadius="lg"
          border="1px solid"
          borderColor={hairline}
          boxShadow="sm"
          overflow="hidden"
          flexShrink={0}
        >
          <Box px="16px" pt="14px" pb="10px">
            <Text color={ink} fontSize="15px" fontWeight="700">
              图说石实
            </Text>
          </Box>
          {galleryPhotos.map((photo) => (
            <Box key={photo.caption} px="12px" pb="12px">
              <Box borderRadius="md" overflow="hidden" border="1px solid" borderColor={hairline}>
                <Image
                  src={photo.src}
                  alt={photo.caption}
                  width="100%"
                  height="130px"
                  objectFit="cover"
                  display="block"
                />
              </Box>
              <Text mt="4px" color={muted} fontSize="11px">
                {photo.caption}
              </Text>
            </Box>
          ))}
        </Box>

        <Box
          data-testid="news-contact-card"
          background={paper}
          borderRadius="lg"
          border="1px solid"
          borderColor={hairline}
          boxShadow="sm"
          p="16px"
        >
          <Text color={ink} fontSize="15px" fontWeight="700" mb="3">
            联系方式
          </Text>
          <Flex align="flex-start" gap="8px" mb="2">
            <FiMapPin size={14} color={accent} style={{ marginTop: 2, flexShrink: 0 }} />
            <Text color={muted} fontSize="12px" lineHeight="1.6">
              {SCHOOL_CONTACT.address}
            </Text>
          </Flex>
          <Flex align="flex-start" gap="8px" mb="3">
            <FiPhone size={14} color={accent} style={{ marginTop: 2, flexShrink: 0 }} />
            <Text color={muted} fontSize="12px" lineHeight="1.6">
              {SCHOOL_CONTACT.phone}
            </Text>
          </Flex>
          <Flex align="flex-start" gap="8px">
            <FiBell size={14} color={accent} style={{ marginTop: 2, flexShrink: 0 }} />
            <Text color={muted} fontSize="12px" lineHeight="1.6">
              学校微信公众号：石实
            </Text>
          </Flex>
        </Box>

        <Button
          variant="outline"
          height="40px"
          borderRadius="md"
          color={accent}
          borderColor={accent}
          fontFamily={swissFont}
          fontSize="sm"
          background={paper}
          _hover={{ background: accentWash }}
          onClick={onNavigateHome}
        >
          返回首页
        </Button>
      </Flex>
      </Flex>
    </Box>
  );
}
