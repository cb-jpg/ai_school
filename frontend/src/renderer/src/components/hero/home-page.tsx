/**
 * Home Page Component
 * 学校数字人首页（官网化改版 2026-09-21；同日二次改版：简化版省实式 hero banner）
 * 结构（参考省实官网首页 + 用户手绘人物站位）：
 *   页头（SiteHeader，与栏目页/对话页同款）
 *   → hero banner：校园实景照铺底（zIndex base1/md0，压在 Live2D 画布下——
 *     人物从画布透出"站在照片上"，位置=用户手绘红圈 banner 右侧）
 *   → 左侧绛红理念面板（z20 内容层：楷体理念大标题 + 校训三行 + 亮点行 +
 *     "开始对话"CTA，首屏保底可达）
 *   → 新闻/公告两栏（有已核实直链的条目可点击跳转，"更多>"进新闻中心）
 *   → 页脚条（地址/电话/版权，省实页脚式一行小字）
 * 竖屏大屏（壁挂数字屏）：保留已真机调优的"限宽 840 内容列 + 人物居中站下方"
 * 布局（HOME_BOARD_* 常量），不套 banner 形态。
 * 人物站位/大小由 use-live2d-model.ts 的 HOME_BANNER_* 常量控制（右侧 ~72% 屏宽）。
 */

import { useState } from 'react';
import { Box, Flex, HStack, Image, Link, Text } from '@chakra-ui/react';
import { FiArrowUpRight, FiChevronRight, FiMessageCircle } from 'react-icons/fi';
import HeroSidebar from './hero-sidebar';
import SiteHeader from './site-header';
import { kaiFont, swissFont, siteTheme } from './site-theme';
import { useInterrupt } from '@/hooks/utils/use-interrupt';
import { usePortraitBoard } from '@/hooks/utils/use-portrait-board';
import {
  PORTAL_ANNOUNCEMENTS,
  PORTAL_NEWS,
  SCHOOL_CONTACT,
} from '@/data/portal-content';
import campusGate from '@/assets/school/campus-gate.jpg';

// 亮点数据：南方+《佛山唯一！保送北大！》——"石实实验学校近年来第13位
// 因信息学特长保送进入清北的学子"，校领导最认可的硬成果
const HIGHLIGHT_COUNT = '13';

// 新闻/公告栏目：占位数据（事件真实、细节未获校方审核），首页展示前 3 条
const NEWS_COUNT = 3;
const ANNOUNCE_COUNT = 3;

interface HomePageProps {
  /** 2026-09-21 官网 v2 后无必传项：栏目/新闻/对话全部走 SiteHeader 的 hash 路由 */
}

/** 板块标题：红字 + 短红下划线 + 可选"更多>"入口（省实官网式） */
function SectionTitle({
  children,
  isPortraitBoard,
  onMore,
  moreLabel = '更多',
}: {
  children: string;
  isPortraitBoard: boolean;
  onMore?: () => void;
  moreLabel?: string;
}) {
  return (
    <Flex align="center" justify="space-between" mb={isPortraitBoard ? 3 : 2}>
      <Box>
        <Text
          as="span"
          color={siteTheme.red}
          fontWeight="bold"
          fontSize={isPortraitBoard ? '24px' : { base: '14px', md: '16px' }}
          letterSpacing="0.04em"
        >
          {children}
        </Text>
        <Box
          mt="3px"
          width={isPortraitBoard ? '56px' : '36px'}
          height={isPortraitBoard ? '4px' : '3px'}
          bg={siteTheme.red}
        />
      </Box>
      {onMore && (
        <Box
          as="button"
          onClick={onMore}
          aria-label={`进入${children}栏目`}
          display="inline-flex"
          alignItems="center"
          gap="2px"
          color={siteTheme.textSecondary}
          fontSize={isPortraitBoard ? '18px' : { base: '11px', md: '12.5px' }}
          px={isPortraitBoard ? 3 : 2}
          py="3px"
          borderRadius="full"
          transition="all 0.2s ease"
          _hover={{ color: siteTheme.red, background: siteTheme.redWash }}
        >
          {moreLabel}
          <FiChevronRight size={isPortraitBoard ? 20 : 13} />
        </Box>
      )}
    </Flex>
  );
}

export default function HomePage(_props: HomePageProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { interrupt } = useInterrupt();
  const isPortraitBoard = usePortraitBoard();

  // 进入对话界面：先打断可能进行中的播报，再切路由
  const goChat = () => {
    interrupt();
    window.location.hash = '#/hero';
  };

  const goNews = () => {
    interrupt();
    window.location.hash = '#/news';
  };

  /* hero banner 高度：页头实际高（base≈94px / md≈112px）+ banner 区高。
     banner 背景层从页头顶端铺起（页头自身不透明，盖住 banner 顶部即可对齐）。 */
  const bannerBgHeight = isPortraitBoard
    ? undefined
    : { base: 'calc(96px + 38vh)', md: 'calc(114px + 40vh)' };
  const heroSectionHeight = isPortraitBoard
    ? undefined
    : { base: '38vh', md: '40vh' };

  return (
    <Box
      position="relative"
      w="full"
      overflow="hidden"
      /* 大屏一体机：--app-vh 由 device-profile 视口守卫实测写入（kiosk ROM 的
         100vh 会缩水成半屏）；手机/桌面无该变量回退 100vh，行为不变 */
      style={{ height: 'var(--app-vh, 100vh)' }}
      css={{
        fontFamily: swissFont,
        background: siteTheme.wash,
      }}
    >
      {/* hero banner 背景层：校园实景照 + 自左向右压暗渐变。
          zIndex base1/md0——都在 Live2D 画布（base15/md1）之下：人物从画布透出
          站在照片上（用户手绘红圈=banner 右侧）；页头（z20 不透明）盖住其顶部。
          竖屏大屏保留原形态，不铺 banner。 */}
      {!isPortraitBoard && (
        <Box
          data-testid="home-banner-bg"
          position="absolute"
          top={0}
          left={0}
          right={0}
          height={bannerBgHeight}
          zIndex={{ base: 1, md: 0 }}
          overflow="hidden"
        >
          <Image
            src={campusGate}
            alt="石实实验学校校园实景"
            width="100%"
            height="100%"
            objectFit="cover"
            objectPosition="center 38%"
            display="block"
          />
          <Box
            position="absolute"
            inset={0}
            background="linear-gradient(90deg, rgba(13,34,65,0.30) 0%, rgba(13,34,65,0.10) 45%, rgba(13,34,65,0) 70%), linear-gradient(180deg, rgba(250,247,242,0) 78%, rgba(250,247,242,0.95) 100%)"
          />
        </Box>
      )}

      {/* Content Column：z20 盖过 banner(0/1) 与画布(15/1)。
          竖屏大屏：整列限宽 840 居中（防 1272+ 宽拉伸），人物改居中站下方 */}
      <Flex
        direction="column"
        h="full"
        position="relative"
        zIndex={20}
        width={isPortraitBoard ? '100%' : undefined}
        maxWidth={isPortraitBoard ? '840px' : undefined}
        mx={isPortraitBoard ? 'auto' : undefined}
      >
        {/* 共享页头：绛红校名横带 + 白色通栏栏目导航条（与栏目页/新闻中心/对话页同款） */}
        <SiteHeader
          activeNav="home"
          onNavigateColumn={(columnId, articleId) => {
            window.location.hash = `#/campus/${columnId}${articleId ? `/${articleId}` : ''}`;
          }}
          onNavigateNews={goNews}
          onGoChat={goChat}
          onOpenSettings={() => setSidebarOpen(!sidebarOpen)}
        />

        {isPortraitBoard ? (
          /* —— 竖屏大屏：保留 2026-09 真机调优的原版理念块（不套 banner 形态）—— */
          <Box
            alignSelf="stretch"
            mt={4}
            py={6}
            pl={8}
            pr={10}
            background="linear-gradient(100deg, rgba(250, 247, 242, 0.95) 0%, rgba(250, 247, 242, 0.75) 32%, rgba(250, 247, 242, 0) 62%)"
          >
            <Box maxW="none">
              <Text
                color={siteTheme.red}
                fontSize="18px"
                fontWeight="600"
                letterSpacing="0.15em"
                lineHeight="1.6"
                textShadow="0 1px 6px rgba(255, 255, 255, 0.9)"
              >
                佛山市南海区石实实验学校 · AI校园数字人 · 小石
              </Text>
              <Text
                mt={3}
                color={siteTheme.navy}
                fontFamily={kaiFont}
                fontSize="clamp(40px, 3.8vw, 56px)"
                fontWeight="bold"
                lineHeight="1.35"
                textShadow="0 1px 8px rgba(255, 255, 255, 0.9), 0 0 18px rgba(255, 255, 255, 0.65)"
              >
                让每一个孩子都能成长、成才、成功
              </Text>
            </Box>
            <Box maxW="640px">
              <Text
                mt={4}
                color={siteTheme.textBody}
                fontFamily={kaiFont}
                fontSize="22px"
                lineHeight="1.7"
              >
                “扬长教育、人人出彩”
                <Box as="span" display="block">
                  “以爱治校、尊重你我”
                </Box>
                <Box as="span" display="block">
                  “任重道远、毋忘奋斗”
                </Box>
              </Text>
              <Flex mt={6} align="center" gap={6}>
                <Text
                  color={siteTheme.red}
                  fontSize="clamp(56px, 5.5vw, 76px)"
                  fontWeight="bold"
                  lineHeight="1"
                  flexShrink={0}
                >
                  {HIGHLIGHT_COUNT}
                </Text>
                <Box maxW="none">
                  <Text color={siteTheme.navy} fontSize="24px" fontWeight="semibold" lineHeight="1.5">
                    位学子凭信息学特长
                    <Box as="span" display="block">
                      保送清华、北京大学
                    </Box>
                  </Text>
                  <Text mt="3px" color={siteTheme.textSecondary} fontSize="16px" lineHeight="1.5">
                    据南方+、南海区教育局公开报道
                  </Text>
                </Box>
              </Flex>
              <Box mt={6} width="96px" height="3px" bg="rgba(144, 27, 53, 0.35)" />
            </Box>
          </Box>
        ) : (
          /* —— hero banner 区：左侧绛红理念面板（白字），右侧留白给人物 —— */
          <Flex
            data-testid="home-hero-banner"
            position="relative"
            height={heroSectionHeight}
            minHeight="240px"
            align="center"
            px={{ base: 3, md: 8, lg: 12 }}
          >
            <Box
              width={{ base: '82%', md: '56%', lg: '48%' }}
              maxWidth="560px"
              background="rgba(144, 27, 53, 0.88)"
              borderRadius="lg"
              boxShadow="0 10px 32px rgba(13, 34, 65, 0.28)"
              px={{ base: 4, md: 7 }}
              py={{ base: 3, md: 6 }}
              color={siteTheme.paper}
            >
              <Text
                fontSize={{ base: '8.5px', md: '11px' }}
                letterSpacing="0.22em"
                opacity={0.82}
                fontWeight="600"
              >
                SHISHI EXPERIMENTAL SCHOOL
              </Text>

              {/* 理念大标题（楷体） */}
              <Text
                fontFamily={kaiFont}
                fontWeight="bold"
                fontSize={{ base: '17px', md: '26px', lg: '30px' }}
                lineHeight="1.4"
                mt={{ base: 1, md: 2 }}
              >
                让每一个孩子都能成长、成才、成功
              </Text>

              {/* 校训三行（楷体小字） */}
              <Text
                fontFamily={kaiFont}
                fontSize={{ base: '11.5px', md: '14px' }}
                lineHeight="1.75"
                mt={{ base: 1.5, md: 3 }}
                opacity={0.92}
              >
                扬长教育、人人出彩 · 以爱治校、尊重你我
                <Box as="span" display="block">
                  任重道远、毋忘奋斗
                </Box>
              </Text>

              {/* 亮点行（紧凑单行） */}
              <Flex
                mt={{ base: 2, md: 4 }}
                pt={{ base: 2, md: 3 }}
                borderTop="1px solid rgba(255,255,255,0.28)"
                gap={{ base: 3, md: 6 }}
                flexWrap="wrap"
              >
                <Text fontSize={{ base: '11px', md: '14px' }} lineHeight="1.5">
                  <Box as="span" fontWeight="bold" fontSize={{ base: '15px', md: '19px' }}>
                    {HIGHLIGHT_COUNT}
                  </Box>
                  {' '}位学子保送清北
                </Text>
                <Text fontSize={{ base: '11px', md: '14px' }} lineHeight="1.5">
                  <Box as="span" fontWeight="bold" fontSize={{ base: '15px', md: '19px' }}>
                    100+
                  </Box>
                  {' '}门扬长选修课
                </Text>
                <Text fontSize={{ base: '11px', md: '14px' }} lineHeight="1.5" opacity={0.85}>
                  据南方+公开报道
                </Text>
              </Flex>

              {/* 开始对话 CTA：纸白底红字（首屏保底可达） */}
              <Flex mt={{ base: 2.5, md: 4 }}>
                <Box
                  as="button"
                  onClick={goChat}
                  aria-label="开始对话"
                  data-testid="home-hero-cta"
                  display="inline-flex"
                  alignItems="center"
                  justifyContent="center"
                  gap="8px"
                  height={{ base: '40px', md: '48px' }}
                  px={{ base: 5, md: 7 }}
                  rounded="full"
                  bg={siteTheme.paper}
                  color={siteTheme.red}
                  fontSize={{ base: 'sm', md: 'md' }}
                  fontWeight="semibold"
                  boxShadow="0 6px 18px rgba(13, 34, 65, 0.25)"
                  transition="all 0.2s ease"
                  _hover={{ transform: 'translateY(-2px)', boxShadow: '0 10px 24px rgba(13, 34, 65, 0.32)' }}
                  _active={{ transform: 'scale(0.97)' }}
                >
                  <FiMessageCircle size={18} />
                  和小石同学对话
                </Box>
              </Flex>
            </Box>
          </Flex>
        )}

        {/* 新闻/公告栏目：省实官网式两栏；有已核实直链的条目可点击（↗），
            标题行"更多>"进新闻中心（#/news）。手机端每列收紧到 2 条可见
            （第 3 条 md 起显示），保证定高页面里页脚/CTA 布局稳定 */}
        <Flex
          px={isPortraitBoard ? 8 : { base: 4, md: 12, lg: 16 }}
          pr={isPortraitBoard ? 10 : { base: 5, md: 10 }}
          mt={isPortraitBoard ? 4 : { base: 2, md: 3 }}
          gap={isPortraitBoard ? 10 : { base: 4, md: 10 }}
          direction="row"
        >
          {/* 学校新闻：红日期 + 可点击标题 + 分类 */}
          <Box flex={isPortraitBoard ? '1.2' : '1.15'} minW={0}>
            <SectionTitle isPortraitBoard={isPortraitBoard} onMore={goNews}>
              学校新闻
            </SectionTitle>
            {PORTAL_NEWS.slice(0, NEWS_COUNT).map((item, idx) => {
              const row = (
                <Flex
                  align="flex-start"
                  gap={isPortraitBoard ? 4 : { base: 2, md: 3 }}
                  py={isPortraitBoard ? '10px' : { base: '3px', md: '5px' }}
                  borderBottom="1px dashed"
                  borderColor={siteTheme.hairline}
                  display={idx === NEWS_COUNT - 1 && !isPortraitBoard
                    ? { base: 'none', md: 'flex' }
                    : 'flex'}
                >
                  <Text
                    color={siteTheme.red}
                    fontSize={isPortraitBoard ? '17px' : { base: '10px', md: '12px' }}
                    fontWeight="600"
                    fontFamily={swissFont}
                    flexShrink={0}
                    pt="1px"
                  >
                    {item.date}
                  </Text>
                  <Text
                    color={item.url ? siteTheme.navy : siteTheme.textBody}
                    fontSize={isPortraitBoard ? '19px' : { base: '11px', md: '13px' }}
                    lineHeight="1.5"
                    lineClamp={1}
                    flex="1"
                    minW={0}
                    _hover={item.url ? { color: siteTheme.red } : undefined}
                  >
                    {item.title}
                    {item.url && (
                      <FiArrowUpRight
                        size={isPortraitBoard ? 20 : 12}
                        style={{ marginLeft: '3px', display: 'inline', verticalAlign: '-1px', color: siteTheme.red }}
                      />
                    )}
                  </Text>
                  <Box
                    flexShrink={0}
                    px={isPortraitBoard ? '10px' : '6px'}
                    py="1px"
                    borderRadius="sm"
                    fontSize={isPortraitBoard ? '14px' : { base: '9.5px', md: '10px' }}
                    display={isPortraitBoard ? 'block' : 'block'}
                    background={item.category === '荣誉喜报' ? siteTheme.tealWash : siteTheme.redWash}
                    color={item.category === '荣誉喜报' ? siteTheme.teal : siteTheme.red}
                  >
                    {item.category}
                  </Box>
                </Flex>
              );
              return item.url ? (
                <Link
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  data-testid={`home-news-${item.id}`}
                  display="block"
                  _hover={{ textDecoration: 'none' }}
                >
                  {row}
                </Link>
              ) : (
                <Box key={item.id} data-testid={`home-news-${item.id}`}>
                  {row}
                </Box>
              );
            })}
          </Box>

          {/* 公告与通知：红wash 日期 chip + 标题 + 面向对象 */}
          <Box flex="1" minW={0}>
            <SectionTitle isPortraitBoard={isPortraitBoard} onMore={goNews}>
              公告与通知
            </SectionTitle>
            {PORTAL_ANNOUNCEMENTS.slice(0, ANNOUNCE_COUNT).map((item, idx) => (
              <Flex
                key={item.id}
                align="flex-start"
                gap={isPortraitBoard ? 4 : { base: 2, md: 3 }}
                py={isPortraitBoard ? '10px' : { base: '3px', md: '5px' }}
                borderBottom="1px dashed"
                borderColor={siteTheme.hairline}
                display={idx === ANNOUNCE_COUNT - 1 && !isPortraitBoard
                  ? { base: 'none', md: 'flex' }
                  : 'flex'}
              >
                <Box
                  flexShrink={0}
                  px={isPortraitBoard ? '10px' : '6px'}
                  py="1px"
                  borderRadius="sm"
                  background={siteTheme.redWash}
                  color={siteTheme.red}
                  fontSize={isPortraitBoard ? '14px' : { base: '9px', md: '10.5px' }}
                  fontWeight="600"
                  fontFamily={swissFont}
                  mt="1px"
                >
                  {item.date}
                </Box>
                <Box flex="1" minW={0}>
                  <Text
                    color={siteTheme.textBody}
                    fontSize={isPortraitBoard ? '19px' : { base: '11px', md: '13px' }}
                    lineHeight="1.5"
                    lineClamp={1}
                  >
                    {item.title}
                  </Text>
                </Box>
                <Text
                  flexShrink={0}
                  color={siteTheme.textSecondary}
                  fontSize={isPortraitBoard ? '14px' : { base: '9.5px', md: '10.5px' }}
                  pt="2px"
                  display={isPortraitBoard ? 'block' : { base: 'none', md: 'block' }}
                >
                  {item.audience}
                </Text>
              </Flex>
            ))}
          </Box>
        </Flex>
        <Text
          px={isPortraitBoard ? 8 : { base: 4, md: 12, lg: 16 }}
          mt={isPortraitBoard ? 2 : 1}
          color={siteTheme.textSecondary}
          fontSize={isPortraitBoard ? '14px' : { base: '9.5px', md: '10.5px' }}
        >
          带 ↗ 的新闻可点击查看公开报道原文；新闻与公告为示例数据，正式内容待校方审核后由后台发布流替换
        </Text>

        {/* 竖屏大屏：人物在下方居中展示 + 底部主 CTA（非竖屏大屏的 CTA 已并入 banner 红面板） */}
        {isPortraitBoard && <Box flex={1} minHeight={0} />}
        {isPortraitBoard && (
          <Box flexShrink={0} pb={8} textAlign="center">
            <HStack justify="center">
              <Box
                as="button"
                onClick={goChat}
                aria-label="开始对话"
                display="inline-flex"
                alignItems="center"
                justifyContent="center"
                gap="14px"
                height="84px"
                px={24}
                rounded="full"
                bg={siteTheme.red}
                color={siteTheme.paper}
                fontSize="26px"
                fontWeight="semibold"
                boxShadow="0 10px 30px rgba(144, 27, 53, 0.35)"
                transition="all 0.2s ease"
                _hover={{ bg: siteTheme.redDark, transform: 'translateY(-2px)' }}
                _active={{ transform: 'scale(0.97)' }}
              >
                <FiMessageCircle size={30} />
                开始对话
              </Box>
            </HStack>
          </Box>
        )}

        {/* 非竖屏大屏：人物展示留白区（banner 右侧 + 新闻下方空间） */}
        {!isPortraitBoard && <Box flex={1} minHeight={0} />}

        {/* 页脚条：地址 / 电话 / 版权（省实页脚式一行小字） */}
        <Box
          data-testid="home-footer"
          flexShrink={0}
          px={isPortraitBoard ? 8 : { base: 4, md: 12, lg: 16 }}
          py={{ base: '6px', md: '9px' }}
          borderTop="1px solid"
          borderColor={siteTheme.hairline}
          background="rgba(255, 255, 255, 0.72)"
        >
          <Text
            color={siteTheme.textSecondary}
            fontSize={isPortraitBoard ? '15px' : { base: '9.5px', md: '11px' }}
            lineHeight="1.6"
          >
            {SCHOOL_CONTACT.address} · 联系电话 {SCHOOL_CONTACT.phone} · © 2026 佛山市南海区石实实验学校
          </Text>
        </Box>
      </Flex>

      {/* 右侧设置侧栏 */}
      <HeroSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </Box>
  );
}
