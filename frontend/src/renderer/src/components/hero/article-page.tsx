/**
 * 官网文章阅读页（2026-09-29 新闻/公告后台管理化）：
 * 后台「官网新闻公告」发布的自撰文字文章，站内经 #/article/<id> 阅读。
 * 数据 GET /api/portal/article/<id>（公共，仅 published 且有正文）。
 * 版式沿用新闻中心页的纸面卡片 + 红标题骨架（58% 内容行，右区留透明给人物）。
 */
import { useEffect, useState } from "react";
import { Box, Button, Flex, Link, Text } from "@chakra-ui/react";
import { FiArrowLeft, FiExternalLink } from "react-icons/fi";
import { apiUrl } from "@/services/api-base";
import { swissFont, siteTheme } from "./site-theme";
import { usePortraitBoard } from "@/hooks/utils/use-portrait-board";

const ink = siteTheme.navy;
const muted = siteTheme.textBody;
const hairline = siteTheme.hairline;
const paper = siteTheme.paper;
const accent = siteTheme.red;
const accentWash = siteTheme.redWash;

interface ArticleData {
  id: string;
  kind: string;
  title: string;
  date: string;
  source?: string;
  url?: string;
  content: string;
}

interface ArticlePageProps {
  articleId: string;
  onNavigateNews: () => void;
  onNavigateHome: () => void;
}

export default function ArticlePage({
  articleId,
  onNavigateNews,
}: ArticlePageProps) {
  const isPortraitBoard = usePortraitBoard();
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    setArticle(null);
    setNotFound(false);
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/portal/article/${articleId}`));
        if (!res.ok) {
          if (alive) setNotFound(true);
          return;
        }
        const body = (await res.json()) as ArticleData;
        if (alive) setArticle(body);
      } catch {
        if (alive) setNotFound(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [articleId]);

  const paragraphs = (article?.content ?? "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Box
      data-testid="article-page"
      position="absolute"
      top={isPortraitBoard ? "164px" : { base: "112px", lg: "128px" }}
      left={{ base: "12px", lg: "24px" }}
      right={{ base: "12px", lg: "24px" }}
      bottom={{ base: "12px", lg: "24px" }}
      display="flex"
      flexDirection="column"
      zIndex={30}
      fontFamily={swissFont}
    >
      <Flex
        alignSelf={{ base: "stretch", lg: "flex-start" }}
        width={{ base: "100%", lg: "58%" }}
        height={{ lg: "100%" }}
        flex={1}
        minHeight={0}
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
          display="flex"
          flexDirection="column"
        >
          <Box flex="1" overflowY="auto" minHeight={0}>
            <Box mx={{ base: "16px", md: "24px" }} my={{ base: "20px", md: "28px" }}>
              {notFound && (
                <Text data-testid="article-missing" color={muted} fontSize="14px">
                  文章不存在或未发布。
                </Text>
              )}
              {article && (
                <>
                  <Text
                    data-testid="article-title"
                    color={ink}
                    fontSize={{ base: "22px", md: "28px" }}
                    fontWeight="700"
                    lineHeight="1.35"
                    mb="3"
                  >
                    {article.title}
                  </Text>
                  <Box mb="4" width="56px" height="3px" bg={accent} />
                  <Flex align="center" gap="10px" mb="6" flexWrap="wrap">
                    {article.date && (
                      <Text color={muted} fontSize="12px">
                        {article.date}
                      </Text>
                    )}
                    {article.source && (
                      <Text color={muted} fontSize="12px">
                        来源：{article.source}
                      </Text>
                    )}
                    <Box
                      px="8px"
                      py="2px"
                      borderRadius="full"
                      background={accentWash}
                      color={accent}
                      fontSize="11px"
                      fontWeight="600"
                    >
                      {article.kind === "announcement" ? "通知公告" : "学校新闻"}
                    </Box>
                    {article.url && (
                      <Link
                        href={article.url}
                        target="_blank"
                        rel="noreferrer"
                        display="inline-flex"
                        alignItems="center"
                        px="10px"
                        py="3px"
                        borderRadius="full"
                        border="1px solid"
                        borderColor={accent}
                        color={accent}
                        fontSize="11px"
                        fontWeight="600"
                        textDecoration="none"
                        transition="background 0.15s ease"
                        _hover={{ background: accentWash, textDecoration: "none" }}
                      >
                        原文链接 <FiExternalLink size={11} style={{ marginLeft: 3 }} />
                      </Link>
                    )}
                  </Flex>
                  {paragraphs.map((p, i) => (
                    <Text
                      key={i}
                      color={muted}
                      fontSize={{ base: "14px", md: "15px" }}
                      lineHeight="1.9"
                      mb="4"
                    >
                      {p}
                    </Text>
                  ))}
                </>
              )}
              <Button
                mt={article ? "2" : "4"}
                variant="outline"
                height="38px"
                borderRadius="md"
                color={accent}
                borderColor={accent}
                fontSize="sm"
                background={paper}
                _hover={{ background: accentWash }}
                onClick={onNavigateNews}
              >
                <FiArrowLeft style={{ marginRight: 6 }} /> 返回新闻中心
              </Button>
            </Box>
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}
