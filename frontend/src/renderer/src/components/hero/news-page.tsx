/**
 * 新闻中心页（2026-09-21 简化版省实改版；2026-09-29 后台管理化）
 * 省实官网列表页式：红标题 + 红下划线 + 新闻/公告两组可点击列表 + 右侧栏
 * （图说石实照片卡 + 联系方式卡）。匿名可看。
 * 数据=后台 GET /api/portal/content（刷新即见，无需重建）；
 * 后台不可达时回退静态占位数组。条目三态：外链 ↗ 新窗、自撰文章站内阅读、
 * 纯标题不可点。
 */
import { Box, Button, Flex, HStack, Image, Link, Text } from "@chakra-ui/react";
import {
  FiArrowUpRight,
  FiBell,
  FiCalendar,
  FiMapPin,
  FiPhone,
} from "react-icons/fi";
import { useState } from "react";
import { CAMPUS_PHOTOS, SCHOOL_CONTACT } from "@/data/portal-content";
import {
  portalItemHref,
  usePortalContent,
} from "@/services/portal-content-api";
import { swissFont, siteTheme } from "./site-theme";
import { usePortraitBoard } from "@/hooks/utils/use-portrait-board";

const ink = siteTheme.navy;
const muted = siteTheme.textBody;
const hairline = siteTheme.hairline;
const paper = siteTheme.paper;
const surface = "#FBF8F3";
const accent = siteTheme.red;
const accentWash = siteTheme.redWash;

interface NewsPageProps {
  onNavigateHome: () => void;
}

function NewsRow({
  title,
  date,
  tag,
  href,
  external,
  source,
  testId,
}: {
  title: string;
  date: string;
  tag: string;
  /** 条目点击目标：外链 url / 站内 #/article/<id>；null=纯标题不可点 */
  href: string | null;
  /** 外链（新窗口）与站内阅读（本窗 hash 跳转）区分 */
  external: boolean;
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
          color={href ? ink : muted}
          fontSize={{ base: "14px", md: "15px" }}
          lineHeight="1.55"
          fontWeight="500"
          display="flex"
          alignItems="center"
          _hover={href ? { color: accent } : undefined}
        >
          {title}
          {href && (
            <FiArrowUpRight
              size={14}
              style={{ marginLeft: "4px", flexShrink: 0, color: accent }}
            />
          )}
        </Text>
        <HStack gap="8px" mt="4px">
          <Flex align="center" gap="4px">
            <FiCalendar size={11} color={muted} />
            <Text color={muted} fontSize="11px">
              {date}
            </Text>
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
        background={tag === "通知" ? siteTheme.tealWash : accentWash}
        color={tag === "通知" ? siteTheme.teal : accent}
        fontSize="11px"
        fontWeight="600"
      >
        {tag}
      </Box>
    </Flex>
  );
  if (!href)
    return (
      <Box data-testid={testId} opacity={0.9}>
        {inner}
      </Box>
    );
  return (
    <Link
      data-testid={testId}
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      display="block"
      _hover={{ textDecoration: "none" }}
    >
      {inner}
    </Link>
  );
}

export default function NewsPage({ onNavigateHome }: NewsPageProps) {
  const isPortraitBoard = usePortraitBoard();
  // 后台管理数据（失败/空回退静态占位）；刷新即见后台改动
  const { news, announcements } = usePortalContent();
  // 图说石实：校园实景轮换（静态取前 3 张，手机取 2 张由布局裁剪）
  const [photoIndex] = useState(0);
  const galleryPhotos = CAMPUS_PHOTOS.slice(photoIndex, photoIndex + 3);

  return (
    <Box
      data-testid="news-page"
      position="absolute"
      top={isPortraitBoard ? "164px" : { base: "112px", lg: "128px" }}
      left={{ base: "12px", lg: "24px" }}
      right={{ base: "12px", lg: "24px" }}
      bottom={{ base: "12px", lg: "24px" }}
      display="flex"
      flexDirection="column"
      gap={{ base: "8px", lg: "12px" }}
      zIndex={30}
      fontFamily={swissFont}
    >
      {/* lg+ 内容行收在左 58%（与栏目页同构）：列表卡 + 右侧栏并列，
          右 42% 留透明给 Live2D 人物（页面根 z30 压过画布 z1，卡片铺进右区会挡住人物） */}
      <Flex
        alignSelf={{ base: "stretch", lg: "flex-start" }}
        width={{ base: "100%", lg: "58%" }}
        height={{ lg: "100%" }}
        /* base（手机）也要高度约束：根是 top112~bottom12 的定高列，缺 flex+minHeight
           时此行随内容撑高→列表溢出屏幕外且 body 滚动被 App 守卫钉死=无法下滑
           （2026-09-27 用户反馈） */
        flex={1}
        minHeight={0}
        gap={{ base: "8px", lg: "12px" }}
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
              "&::-webkit-scrollbar": { width: "6px" },
              "&::-webkit-scrollbar-track": { background: surface },
              "&::-webkit-scrollbar-thumb": {
                background: hairline,
                borderRadius: "3px",
              },
              "&::-webkit-scrollbar-thumb:hover": { background: muted },
            }}
          >
            <Box
              mx={{ base: "16px", md: "24px" }}
              mt={{ base: "20px", md: "28px" }}
              mb={{ base: "24px", md: "32px" }}
            >
              {/* 红标题 + 红下划线（省实板块标题式） */}
              <Text
                data-testid="news-page-title"
                color={ink}
                fontSize={{ base: "26px", md: "32px" }}
                fontWeight="700"
                letterSpacing="-0.01em"
                mb="3"
              >
                新闻中心
              </Text>
              <Box mb="4" width="56px" height="3px" bg={accent} />
              <Text
                color={muted}
                fontSize={{ base: "13px", md: "14px" }}
                lineHeight="1.7"
                mb="7"
              >
                学校新闻与通知公告。带 ↗
                的条目可点击查看（政府/媒体公开报道或站内发布文章）；更多图文请关注学校微信公众号"石实"。
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
              {news.map((item) => (
                <NewsRow
                  key={item.id}
                  testId={`news-row-${item.id}`}
                  title={item.title}
                  date={item.date}
                  tag={item.category || "新闻"}
                  href={portalItemHref(item)}
                  external={Boolean(item.url)}
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
              {announcements.map((item) => (
                <NewsRow
                  key={item.id}
                  testId={`news-row-${item.id}`}
                  title={item.title}
                  date={item.date}
                  tag={
                    item.audience === "全体" || !item.audience
                      ? "通知"
                      : `${item.audience}·通知`
                  }
                  href={portalItemHref(item)}
                  external={Boolean(item.url)}
                  source={item.source}
                />
              ))}

              <Text mt="6" color={muted} fontSize="11px" lineHeight="1.7">
                注：新闻与公告由学校后台统一发布（2026-09-29 起，无需重新发版即生效）；
                带 ↗ 条目跳转政府/媒体公开报道原文，站内发布的文章点击后在阅读页打开。
              </Text>
            </Box>
          </Box>
        </Box>

        {/* 右侧栏（lg+）：图说石实 + 联系方式（列表卡右侧并列，不出内容行） */}
        <Flex
          display={{ base: "none", lg: "flex" }}
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
                <Box
                  borderRadius="md"
                  overflow="hidden"
                  border="1px solid"
                  borderColor={hairline}
                >
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
              <FiMapPin
                size={14}
                color={accent}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <Text color={muted} fontSize="12px" lineHeight="1.6">
                {SCHOOL_CONTACT.address}
              </Text>
            </Flex>
            <Flex align="flex-start" gap="8px" mb="3">
              <FiPhone
                size={14}
                color={accent}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <Text color={muted} fontSize="12px" lineHeight="1.6">
                {SCHOOL_CONTACT.phone}
              </Text>
            </Flex>
            <Flex align="flex-start" gap="8px">
              <FiBell
                size={14}
                color={accent}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
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
