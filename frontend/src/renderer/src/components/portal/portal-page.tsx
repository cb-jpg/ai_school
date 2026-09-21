/**
 * 学校官网门户页（2026-09-20 需求 #5）
 *
 * 布局参照广东省实验中学官网（截图见 页面设计建议/）：
 *   红色校名横带（校名+工具导航+搜索）→ 白色栏目导航条 → 校门大图+校训红色蒙版 →
 *   学校简介+数据亮点 → 学校新闻 → 公告与通知 | 荣誉墙 → 校园风光 → 优秀学生 →
 *   数字人入口横幅 → 页脚（联系方式）。
 * 按需求删去省实导航中的党建/部门主页/纪委/校庆/教育基金/招标等栏目；
 * 「招生咨询」暂为规划中占位（见 docs/官网改版-待开发记录.md）。
 *
 * 数据：@/data/portal-content.ts（新闻/公告为占位示例，未来由服务器接口/公众号同步接入，
 * 前端仅替换数据源）。
 *
 * 路由约定：浏览器端空 hash 默认进本页；App（Capacitor 原生）空 hash 仍进数字人首页，
 * 两者互不影响。数字人展示页=#/home，对话界面=#/hero。
 */

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { Box, Flex, HStack, Image, Input, Text, VStack } from '@chakra-ui/react';
import { FiChevronRight, FiMapPin, FiPhone } from 'react-icons/fi';
import {
  CAMPUS_PHOTOS,
  FEATURED_STUDENTS,
  HONOR_ITEMS,
  PORTAL_ANNOUNCEMENTS,
  PORTAL_NEWS,
  SCHOOL_CONTACT,
  SCHOOL_MOTTO_LINES,
} from '@/data/portal-content';

const colors = {
  red: '#9B1B22', // 主红（校名横带、标题、强调）
  redDark: '#7A1218',
  redWash: 'rgba(155, 27, 34, 0.88)',
  ink: '#1F2937',
  body: '#4B5563',
  subtle: '#8A8F98',
  line: '#E7E1D8',
  wash: '#FAF7F2', // 米白页面底
  gold: '#C9A063',
  white: '#FFFFFF',
};

const kaiFont = "'STKaiti', 'KaiTi', '楷体', 'Noto Serif SC', serif";

/** 校名横带右侧工具导航（省实：首页|校历|作息…；石实版精简） */
const UTILITY_LINKS: Array<{ label: string; hash: string }> = [
  { label: '数字人体验', hash: '#/home' },
  { label: '后台登录', hash: '' }, // 走 onLogin 弹层
];

const NAV_ITEMS: Array<{ label: string; anchor: string }> = [
  { label: '首页', anchor: '#top' },
  { label: '学校概况', anchor: '#about' },
  { label: '学校新闻', anchor: '#news' },
  { label: '公告与通知', anchor: '#notices' },
  { label: '荣誉墙', anchor: '#honors' },
  { label: '校园风光', anchor: '#campus' },
  { label: '优秀学生', anchor: '#students' },
  { label: '数字人体验', anchor: '#digital-human' },
];

interface PortalPageProps {
  /** 顶栏「后台登录」：弹登录浮层（复用 App 的 authPrompt 机制） */
  onLogin?: () => void;
}

export default function PortalPage({ onLogin }: PortalPageProps) {
  const [keyword, setKeyword] = useState('');

  const kw = keyword.trim();
  const news = useMemo(
    () => (kw ? PORTAL_NEWS.filter((n) => n.title.includes(kw)) : PORTAL_NEWS),
    [kw],
  );
  const notices = useMemo(
    () => (kw ? PORTAL_ANNOUNCEMENTS.filter((n) => n.title.includes(kw)) : PORTAL_ANNOUNCEMENTS),
    [kw],
  );

  const jump = (hash: string) => {
    window.location.hash = hash;
  };

  /** 导航条锚点滚动（页内定位，不改 hash——hash 只承载应用路由 #/xxx） */
  const scrollTo = (anchor: string) => {
    document.getElementById(anchor.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Box id="top" bg={colors.wash} minH="100vh" w="full" fontFamily="'Helvetica Neue', Arial, sans-serif">
      {/* ===== 校名横带（红） ===== */}
      <Box bg={colors.red} color={colors.white}>
        <Flex
          maxW="1200px"
          mx="auto"
          px={{ base: 4, md: 6 }}
          py={{ base: 3, md: 4 }}
          align="center"
          justify="space-between"
          gap={4}
          flexWrap={{ base: 'wrap', md: 'nowrap' }}
        >
          {/* 校名（无现成校徽文件，先用楷体校名+英文字线；校徽到位后替换为 <Image>） */}
          <HStack gap={{ base: 3, md: 4 }} align="center">
            <Box
              w={{ base: '40px', md: '48px' }}
              h={{ base: '40px', md: '48px' }}
              borderRadius="full"
              border="2px solid rgba(255,255,255,0.85)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              fontFamily={kaiFont}
              fontSize={{ base: '20px', md: '24px' }}
              fontWeight="bold"
              flexShrink={0}
            >
              石
            </Box>
            <Box>
              <Text
                fontFamily={kaiFont}
                fontSize={{ base: '22px', md: '30px' }}
                fontWeight="bold"
                lineHeight="1.15"
                letterSpacing="0.06em"
              >
                石实实验学校
              </Text>
              <Text fontSize={{ base: '9px', md: '11px' }} letterSpacing="0.28em" opacity={0.85} mt="2px">
                SHISHI EXPERIMENTAL SCHOOL · 扬长教育 人人出彩
              </Text>
            </Box>
          </HStack>

          <VStack align={{ base: 'stretch', md: 'flex-end' }} gap={2} flexShrink={0}>
            <HStack gap={{ base: 3, md: 5 }} fontSize={{ base: '12px', md: '13.5px' }}>
              {UTILITY_LINKS.map((l, i) => (
                <Fragment key={l.label}>
                  {i > 0 && <Text opacity={0.4}>|</Text>}
                  <Box
                    as="button"
                    onClick={() => (l.hash ? jump(l.hash) : onLogin?.())}
                    _hover={{ textDecoration: 'underline' }}
                    whiteSpace="nowrap"
                  >
                    {l.label}
                  </Box>
                </Fragment>
              ))}
            </HStack>
            {/* 搜索：站内新闻/公告关键字实时过滤；「搜」按钮跳到新闻区 */}
            <Flex
              bg="rgba(255,255,255,0.14)"
              border="1px solid rgba(255,255,255,0.45)"
              borderRadius="full"
              px={4}
              py={1}
              gap={2}
              align="center"
              minW={{ base: '220px', md: '260px' }}
            >
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索站内新闻与通知…"
                flex={1}
                size="sm"
                border="none"
                bg="transparent"
                color={colors.white}
                fontSize="13px"
                h="28px"
                px={0}
                _focusVisible={{ border: 'none', outline: 'none', boxShadow: 'none' }}
                _placeholder={{ color: 'rgba(255,255,255,0.65)' }}
              />
              <Box
                as="button"
                onClick={() => scrollTo('#news')}
                fontSize="13px"
                opacity={0.9}
                flexShrink={0}
              >
                搜
              </Box>
            </Flex>
          </VStack>
        </Flex>
      </Box>

      {/* ===== 栏目导航条（白，吸顶） ===== */}
      <Box
        bg={colors.white}
        boxShadow="0 1px 0 rgba(0,0,0,0.06)"
        position="sticky"
        top={0}
        zIndex={30}
        overflowX="auto"
        css={{ WebkitOverflowScrolling: 'touch', '&::-webkit-scrollbar': { display: 'none' } }}
      >
        <HStack
          maxW="1200px"
          mx="auto"
          px={{ base: 2, md: 6 }}
          gap={{ base: 4, md: 8 }}
          justify={{ base: 'flex-start', md: 'center' }}
          whiteSpace="nowrap"
        >
          {NAV_ITEMS.map((item) => (
            <Box
              key={item.label}
              as="button"
              onClick={() => scrollTo(item.anchor)}
              py={{ base: '10px', md: '13px' }}
              fontSize={{ base: '13px', md: '15px' }}
              color={colors.ink}
              fontWeight="500"
              borderBottom="3px solid transparent"
              _hover={{ color: colors.red, borderBottomColor: colors.red }}
              flexShrink={0}
            >
              {item.label}
            </Box>
          ))}
          {/* 招生咨询：规划中占位（需求 #5：未开发部分先记录，见待开发文档） */}
          <Box
            as="span"
            py={{ base: '10px', md: '13px' }}
            fontSize={{ base: '13px', md: '15px' }}
            color={colors.subtle}
            cursor="not-allowed"
            title="招生专栏规划中，敬请期待"
            flexShrink={0}
          >
            招生咨询
            <Box as="span" ml={1} fontSize="10px" color={colors.gold} verticalAlign="super">
              规划中
            </Box>
          </Box>
        </HStack>
      </Box>

      {/* ===== 大图 + 校训 ===== */}
      <Box position="relative" h={{ base: '300px', md: '440px' }} overflow="hidden">
        <Image
          src={CAMPUS_PHOTOS[0].src}
          alt="石实实验学校校门"
          w="100%"
          h="100%"
          objectFit="cover"
        />
        {/* 左侧红色蒙版 + 校训（省实同构） */}
        <Flex
          position="absolute"
          top={0}
          bottom={0}
          left={{ base: 0, md: '6%' }}
          w={{ base: '100%', md: '380px' }}
          bg={{ base: 'linear-gradient(180deg, rgba(122,18,24,0.55), rgba(122,18,24,0.75))', md: colors.redWash }}
          alignItems="center"
          px={{ base: 6, md: 10 }}
        >
          <Box>
            <Text
              fontFamily={kaiFont}
              color={colors.white}
              fontSize={{ base: '26px', md: '36px' }}
              fontWeight="bold"
              lineHeight="1.7"
              letterSpacing="0.1em"
              textShadow="0 2px 10px rgba(0,0,0,0.35)"
            >
              {SCHOOL_MOTTO_LINES.map((line) => (
                <Box as="span" key={line} display="block">
                  {line}
                </Box>
              ))}
            </Text>
            <Text mt={4} color="rgba(255,255,255,0.85)" fontSize={{ base: '12px', md: '14px' }} letterSpacing="0.2em">
              —— 石实实验学校校训与办学理念
            </Text>
          </Box>
        </Flex>
      </Box>

      {/* ===== 学校概况 + 数据亮点 ===== */}
      <SectionContainer id="about" title="学校概况" en="ABOUT US">
        <Flex direction={{ base: 'column', md: 'row' }} gap={{ base: 6, md: 10 }} align="stretch">
          <Box flex={{ md: 1.4 }}>
            <Text color={colors.body} fontSize={{ base: '14px', md: '15.5px' }} lineHeight="2">
              石实实验学校（原石门实验学校）坐落于佛山市南海区大沥镇，是一所全日制寄宿制初中。
              学校秉承“扬长教育、人人出彩”的办学理念，以“以爱治校、尊重你我”的教育价值观滋养师生，
              历经二十五载耕耘，培养了两万多名优秀学子。
              <Box as="span" display="block" mt={2} />
              学校构建了100余门扬长选修课程体系，信息学、机器人、合唱、体艺等课程百花齐放；
              自信息学特长培养以来，已有13名学子保送清华大学、北京大学，办学质量连续多年位居区、市前列。
            </Text>
            <Flex mt={6} gap={{ base: 4, md: 8 }}>
              {[
                { num: '13', label: '名学子保送清北' },
                { num: '100+', label: '门扬长选修课' },
                { num: '25', label: '载办学积淀' },
              ].map((s) => (
                <Box key={s.label}>
                  <Text color={colors.red} fontSize={{ base: '26px', md: '34px' }} fontWeight="bold" lineHeight="1.1">
                    {s.num}
                  </Text>
                  <Text color={colors.subtle} fontSize={{ base: '11px', md: '12.5px' }} mt={1}>
                    {s.label}
                  </Text>
                </Box>
              ))}
            </Flex>
          </Box>
          <Box
            flex={{ md: 1 }}
            borderRadius="lg"
            overflow="hidden"
            boxShadow="0 8px 28px rgba(31, 41, 55, 0.12)"
            minH={{ base: '220px', md: '300px' }}
          >
            <Image src={CAMPUS_PHOTOS[2].src} alt="教学楼" w="100%" h="100%" objectFit="cover" />
          </Box>
        </Flex>
      </SectionContainer>

      {/* ===== 学校新闻 ===== */}
      <SectionContainer id="news" title="学校新闻" en="SCHOOL NEWS" moreHref="#/campus/history">
        <Flex direction={{ base: 'column', md: 'row' }} gap={{ base: 6, md: 10 }}>
          {/* 头条卡 */}
          {news[0] && (
            <Box
              flex={{ md: 1.1 }}
              borderRadius="lg"
              overflow="hidden"
              bg={colors.white}
              boxShadow="0 8px 28px rgba(31, 41, 55, 0.10)"
              cursor="pointer"
              onClick={() => jump('#/campus/history')}
              _hover={{ transform: 'translateY(-3px)', transition: 'all 200ms ease' }}
            >
              <Box h={{ base: '180px', md: '230px' }} overflow="hidden">
                <Image src={CAMPUS_PHOTOS[7].src} alt={news[0].title} w="100%" h="100%" objectFit="cover" />
              </Box>
              <Box p={{ base: 4, md: 5 }}>
                <Text
                  color={colors.red}
                  fontSize="11px"
                  fontWeight="bold"
                  letterSpacing="0.12em"
                >
                  {news[0].category}
                </Text>
                <Text mt={2} color={colors.ink} fontSize={{ base: '15px', md: '17px' }} fontWeight="semibold" lineHeight="1.6">
                  {news[0].title}
                </Text>
                <Text mt={2} color={colors.subtle} fontSize="12px">
                  {news[0].date}
                </Text>
              </Box>
            </Box>
          )}
          {/* 新闻列表 */}
          <VStack flex={{ md: 1.4 }} align="stretch" gap={0} bg={colors.white} borderRadius="lg" px={{ base: 4, md: 6 }} boxShadow="0 4px 18px rgba(31,41,55,0.06)">
            {news.slice(1).map((n) => (
              <Flex
                key={n.id}
                as="button"
                textAlign="left"
                py={{ base: '12px', md: '15px' }}
                borderBottom={`1px solid ${colors.line}`}
                align="center"
                gap={3}
                _hover={{ '& > p:first-of-type': { color: colors.red } }}
              >
                <Box w="6px" h="6px" borderRadius="full" bg={colors.red} flexShrink={0} />
                <Text flex={1} color={colors.ink} fontSize={{ base: '13.5px', md: '14.5px' }} lineClamp={1}>
                  {n.title}
                </Text>
                <Text color={colors.subtle} fontSize="12px" flexShrink={0}>
                  {n.date}
                </Text>
              </Flex>
            ))}
            {news.length <= 1 && (
              <Text py={6} color={colors.subtle} fontSize="13px" textAlign="center">
                没有匹配的新闻
              </Text>
            )}
          </VStack>
        </Flex>
      </SectionContainer>

      {/* ===== 公告与通知 | 荣誉墙 ===== */}
      <Flex
        maxW="1200px"
        mx="auto"
        px={{ base: 4, md: 6 }}
        pb={{ base: 8, md: 12 }}
        direction={{ base: 'column', md: 'row' }}
        gap={{ base: 8, md: 12 }}
      >
        <Box flex={{ md: 1 }} id="notices" scrollMarginTop="70px">
          <SectionTitle title="公告与通知" en="NOTICES" />
          <VStack align="stretch" gap={0} bg={colors.white} borderRadius="lg" px={{ base: 4, md: 5 }} py={2} boxShadow="0 4px 18px rgba(31,41,55,0.06)">
            {notices.map((a) => (
              <Flex key={a.id} py={{ base: '11px', md: '13px' }} borderBottom={`1px solid ${colors.line}`} align="center" gap={3}>
                {/* 日期章（省实同款红底日期块） */}
                <Box
                  bg={colors.red}
                  color={colors.white}
                  borderRadius="md"
                  px={2}
                  py={1}
                  fontSize="11px"
                  fontWeight="bold"
                  textAlign="center"
                  flexShrink={0}
                  lineHeight="1.3"
                >
                  {a.date.slice(5)}
                  <Box as="span" display="block" fontSize="9px" opacity={0.85}>
                    {a.date.slice(0, 4)}
                  </Box>
                </Box>
                <Text flex={1} color={colors.ink} fontSize={{ base: '13.5px', md: '14px' }} lineClamp={1}>
                  {a.title}
                </Text>
                <Text
                  flexShrink={0}
                  fontSize="11px"
                  color={a.audience === '家长' ? colors.red : colors.subtle}
                  border={`1px solid ${a.audience === '家长' ? colors.red : colors.line}`}
                  borderRadius="full"
                  px={2}
                >
                  {a.audience}
                </Text>
              </Flex>
            ))}
            {notices.length === 0 && (
              <Text py={6} color={colors.subtle} fontSize="13px" textAlign="center">
                没有匹配的通知
              </Text>
            )}
          </VStack>
          <Text mt={3} color={colors.subtle} fontSize="12px">
            更多通知将随学校发布同步上线（规划中，见官网改版待开发记录）。
          </Text>
        </Box>

        <Box flex={{ md: 1.2 }} id="honors" scrollMarginTop="70px">
          <SectionTitle title="荣誉墙" en="HONORS" />
          <Flex gap={4} wrap="wrap">
            {HONOR_ITEMS.slice(0, 6).map((h) => (
              <HStack
                key={h.title}
                bg={colors.white}
                borderRadius="lg"
                p={3}
                gap={3}
                boxShadow="0 4px 18px rgba(31,41,55,0.06)"
                w={{ base: '100%', md: 'calc(50% - 8px)' }}
              >
                <Image
                  src={h.src}
                  alt={h.title}
                  w="64px"
                  h="64px"
                  objectFit="cover"
                  borderRadius="md"
                  flexShrink={0}
                />
                <Box minW={0}>
                  <Text color={colors.ink} fontSize="13px" fontWeight="semibold" lineClamp={2} lineHeight="1.5">
                    {h.title}
                  </Text>
                  <Text color={colors.red} fontSize="11px" mt={1}>
                    {h.caption}
                  </Text>
                </Box>
              </HStack>
            ))}
          </Flex>
        </Box>
      </Flex>

      {/* ===== 校园风光 ===== */}
      <SectionContainer id="campus" title="校园风光" en="CAMPUS">
        <Flex gap={{ base: 3, md: 4 }} wrap="wrap">
          {CAMPUS_PHOTOS.map((p) => (
            <Box
              key={p.caption}
              flex={{ base: 'calc(50% - 6px)', md: 'calc(25% - 12px)' }}
              minW={{ base: 'calc(50% - 6px)', md: 'calc(25% - 12px)' }}
              borderRadius="lg"
              overflow="hidden"
              position="relative"
              boxShadow="0 4px 18px rgba(31,41,55,0.08)"
            >
              <Image src={p.src} alt={p.caption} w="100%" h={{ base: '110px', md: '150px' }} objectFit="cover" />
              <Box
                position="absolute"
                bottom={0}
                left={0}
                right={0}
                bg="linear-gradient(transparent, rgba(0,0,0,0.62))"
                color={colors.white}
                fontSize="12px"
                px={3}
                pt={6}
                pb={2}
              >
                {p.caption}
              </Box>
            </Box>
          ))}
        </Flex>
      </SectionContainer>

      {/* ===== 优秀学生 ===== */}
      <SectionContainer id="students" title="优秀学生" en="STUDENTS">
        <Flex gap={{ base: 4, md: 6 }} wrap="wrap" direction={{ base: 'column', md: 'row' }}>
          {FEATURED_STUDENTS.map((s) => (
            <HStack
              key={s.name}
              flex={{ base: '100%', md: 1 }}
              bg={colors.white}
              borderRadius="lg"
              p={4}
              gap={4}
              boxShadow="0 4px 18px rgba(31,41,55,0.06)"
              align="center"
            >
              <Image
                src={s.src}
                alt={s.name}
                w={{ base: '72px', md: '88px' }}
                h={{ base: '72px', md: '88px' }}
                borderRadius="full"
                objectFit="cover"
                flexShrink={0}
                border={`3px solid ${colors.gold}`}
              />
              <Box>
                <Text color={colors.ink} fontSize={{ base: '16px', md: '18px' }} fontWeight="bold">
                  {s.name}
                </Text>
                <Text color={colors.body} fontSize={{ base: '12.5px', md: '13.5px' }} mt={1} lineHeight="1.6">
                  {s.desc}
                </Text>
              </Box>
            </HStack>
          ))}
          <HStack
            flex={{ base: '100%', md: 1.2 }}
            bg={colors.white}
            borderRadius="lg"
            p={4}
            justify="center"
            boxShadow={`inset 0 0 0 1.5px ${colors.line}`}
          >
            <Text color={colors.body} fontSize="13px" textAlign="center" lineHeight="1.8">
              更多优秀学子风采（南海区优秀学生、百佳之星等）
              <Box as="span" display="block" color={colors.subtle} fontSize="12px">
                可向AI数字人「小石」提问了解
              </Box>
            </Text>
          </HStack>
        </Flex>
      </SectionContainer>

      {/* ===== 数字人入口横幅 ===== */}
      <Box id="digital-human" scrollMarginTop="70px" bg={colors.red} color={colors.white}>
        <Flex
          maxW="1200px"
          mx="auto"
          px={{ base: 4, md: 6 }}
          py={{ base: 8, md: 12 }}
          direction={{ base: 'column', md: 'row' }}
          align={{ base: 'flex-start', md: 'center' }}
          justify="space-between"
          gap={5}
        >
          <Box>
            <Text fontFamily={kaiFont} fontSize={{ base: '24px', md: '32px' }} fontWeight="bold" letterSpacing="0.06em">
              AI校园数字人 · 小石
            </Text>
            <Text mt={2} fontSize={{ base: '13px', md: '15px' }} opacity={0.9} lineHeight="1.8">
              学校历史、办学特色、荣誉师生、招生咨询…… 支持语音与文字提问，随时为您解答
            </Text>
          </Box>
          <HStack gap={3} flexShrink={0}>
            <Box
              as="button"
              onClick={() => jump('#/home')}
              bg={colors.white}
              color={colors.red}
              px={{ base: 6, md: 8 }}
              py={{ base: 3, md: 3.5 }}
              borderRadius="full"
              fontSize={{ base: '14px', md: '15.5px' }}
              fontWeight="bold"
              _hover={{ transform: 'translateY(-2px)', boxShadow: '0 8px 22px rgba(0,0,0,0.25)' }}
              transition="all 200ms ease"
            >
              与小石对话
            </Box>
          </HStack>
        </Flex>
      </Box>

      {/* ===== 页脚 ===== */}
      <Box bg="#241D1B" color="rgba(255,255,255,0.82)">
        <Flex
          maxW="1200px"
          mx="auto"
          px={{ base: 4, md: 6 }}
          py={{ base: 7, md: 10 }}
          direction={{ base: 'column', md: 'row' }}
          gap={{ base: 4, md: 10 }}
          justify="space-between"
        >
          <Box>
            <Text fontFamily={kaiFont} fontSize="18px" color={colors.white} letterSpacing="0.08em">
              石实实验学校
            </Text>
            <HStack mt={2} fontSize="12.5px" align="flex-start" gap={1.5}>
              <FiMapPin size={13} style={{ marginTop: '4px', flexShrink: 0 }} />
              <Text lineHeight="1.9">地址：{SCHOOL_CONTACT.address}</Text>
            </HStack>
            <HStack fontSize="12.5px" mt={1}>
              <FiPhone size={13} />
              <Text>联系电话：{SCHOOL_CONTACT.phone}</Text>
            </HStack>
          </Box>
          <VStack align={{ base: 'flex-start', md: 'flex-end' }} gap={2} fontSize="12.5px">
            <HStack as="button" onClick={() => jump('#/home')} _hover={{ color: colors.white }}>
              <Text>
                AI数字人体验 <FiChevronRight style={{ display: 'inline' }} />
              </Text>
            </HStack>
            <HStack as="button" onClick={onLogin} _hover={{ color: 'white' }}>
              <Text>后台管理登录</Text>
            </HStack>
            <Text fontSize="11.5px" opacity={0.55} pt={2}>
              © 2026 佛山市南海区石实实验学校
            </Text>
          </VStack>
        </Flex>
      </Box>
    </Box>
  );
}

/** 板块容器：限宽 + 标题（红竖条 + 中文标题 + 英文小字 + 可选更多） */
function SectionContainer({
  id,
  title,
  en,
  moreHref,
  children,
}: {
  id: string;
  title: string;
  en: string;
  moreHref?: string;
  children: ReactNode;
}) {
  return (
    <Box id={id} scrollMarginTop="70px" maxW="1200px" mx="auto" px={{ base: 4, md: 6 }} pt={{ base: 8, md: 12 }} pb={{ base: 4, md: 6 }}>
      <SectionTitle title={title} en={en} moreHref={moreHref} />
      <Box mt={{ base: 4, md: 6 }}>{children}</Box>
    </Box>
  );
}

function SectionTitle({ title, en, moreHref }: { title: string; en: string; moreHref?: string }) {
  return (
    <Flex align="flex-end" justify="space-between" pb={3} borderBottom={`2px solid ${colors.red}`}>
      <HStack gap={3} align="baseline">
        <Box w="5px" h={{ base: '18px', md: '22px' }} bg={colors.red} borderRadius="1px" />
        <Text color={colors.ink} fontSize={{ base: '18px', md: '22px' }} fontWeight="bold" letterSpacing="0.04em">
          {title}
        </Text>
        <Text color={colors.subtle} fontSize={{ base: '10px', md: '11px' }} letterSpacing="0.22em">
          {en}
        </Text>
      </HStack>
      {moreHref && (
        <HStack
          as="button"
          onClick={() => (window.location.hash = moreHref)}
          color={colors.subtle}
          fontSize="12.5px"
          _hover={{ color: colors.red }}
          flexShrink={0}
        >
          <Text>更多</Text>
          <FiChevronRight size={14} />
        </HStack>
      )}
    </Flex>
  );
}
