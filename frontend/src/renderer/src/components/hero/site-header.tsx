/**
 * Site Header Component
 * 全站共享页头（2026-09-21 全站官网化；同日二次改版：省实式下拉导航）
 * 绛红校名横带 + 白色通栏栏目导航条。首页（home-page）/ 栏目页（column-page）/
 * 新闻中心（news-page）/ 对话页（hero-landing）四处共用。
 * 导航行（省实官网式）：首页 | 学校概况▾ 办学成果▾ 招生入学▾ | 新闻中心▾ | 对话。
 * 下拉菜单只在 md+ 桌面悬停/点击展开；手机端与一体机（kiosk 断点不可达）一律
 * 平铺直跳栏目页，文章切换由栏目页内菜单完成——触摸稳定优先。
 * 横带：石字圆章 + 楷体校名 + 英文副标 + 后台管理入口 + 设置齿轮。
 */
import { useState } from 'react';
import { Box, Button, Flex, HStack, Text } from '@chakra-ui/react';
import { FiChevronDown, FiHome, FiMessageCircle, FiSettings } from 'react-icons/fi';
import TopicTabRow from './topic-tab-row';
import { SCHOOL_CONFIG } from './school-config';
import { kaiFont, swissFont, siteTheme } from './site-theme';
import { useInterrupt } from '@/hooks/utils/use-interrupt';
import { usePortraitBoard } from '@/hooks/utils/use-portrait-board';
import { CampusTopicId } from '@/data/campus-knowledge';
import { SiteColumnId, siteColumns } from '@/data/site-columns';

export type SiteNavActive = 'home' | 'dialog' | 'news' | SiteColumnId | CampusTopicId;

interface SiteHeaderProps {
  /** 当前激活栏目（红底白字） */
  activeNav: SiteNavActive;
  /** 进入指定栏目文章页（省实式导航主路径） */
  onNavigateColumn: (columnId: SiteColumnId, articleId?: string) => void;
  /** 进入新闻中心 */
  onNavigateNews: () => void;
  /** 进入对话界面（先打断播报再切路由由内部处理） */
  onGoChat: () => void;
  /** 设置齿轮回调（打开 HeroSidebar） */
  onOpenSettings: () => void;
  /** 是否显示"后台管理"入口（默认显示） */
  showAdmin?: boolean;
}

interface DropdownItem {
  label: string;
  active?: boolean;
  onClick: () => void;
}

/** 栏目下拉按钮（md+ 悬停/点击出白色下拉面板；base/竖屏大屏直跳栏目页） */
function NavDropdown({
  label,
  active,
  items,
  isPortraitBoard,
  testId,
}: {
  label: string;
  active: boolean;
  items: DropdownItem[];
  isPortraitBoard: boolean;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  // base（手机/一体机 420 布局视口）：无下拉，点击直达栏目页；
  // md+ 桌面：点击/悬停展开下拉，菜单项切换到具体文章
  const isDesktopViewport = typeof window !== 'undefined'
    && window.matchMedia('(min-width: 768px)').matches;
  const navigateFirst = () => items[0]?.onClick();

  return (
    <Box
      position="relative"
      flexShrink={0}
      onMouseEnter={isDesktopViewport ? () => setOpen(true) : undefined}
      onMouseLeave={isDesktopViewport ? () => setOpen(false) : undefined}
    >
      <Button
        data-testid={testId}
        aria-haspopup="menu"
        aria-expanded={open ? true : undefined}
        aria-current={active ? 'page' : undefined}
        aria-label={`进入${label}栏目`}
        onClick={() => {
          if (isDesktopViewport && !isPortraitBoard) setOpen((value) => !value);
          else navigateFirst();
        }}
        height={isPortraitBoard ? '54px' : '40px'}
        px={isPortraitBoard ? '20px' : { base: '12px', lg: '16px' }}
        borderRadius="md"
        background={active ? siteTheme.red : 'transparent'}
        color={active ? 'white' : siteTheme.navy}
        fontFamily={swissFont}
        fontWeight="500"
        fontSize={isPortraitBoard ? '19px' : 'sm'}
        flexShrink={0}
        _hover={{
          background: active ? siteTheme.red : siteTheme.redWash,
          color: active ? 'white' : siteTheme.red,
        }}
        transition="all 200ms ease"
      >
        <HStack gap={isPortraitBoard ? '8px' : '5px'}>
          <Text>{label}</Text>
          {/* ▾ 箭头只在 md+ 桌面语义成立（base 一律直跳栏目页，无下拉可展开） */}
          <Box
            as="span"
            display={isPortraitBoard ? 'none' : { base: 'none', md: 'inline-flex' }}
            alignItems="center"
          >
            <FiChevronDown size={13} style={{ opacity: 0.7 }} />
          </Box>
        </HStack>
      </Button>

      {/* 下拉面板：md+ 桌面 only（Chakra 断点；kiosk 全档都是 base 不出现） */}
      {open && (
        <Box
          data-testid={`${testId}-menu`}
          role="menu"
          display={{ base: 'none', md: 'block' }}
          position="absolute"
          top="100%"
          left={0}
          minWidth="184px"
          background={siteTheme.paper}
          borderRadius="md"
          border="1px solid"
          borderColor={siteTheme.hairline}
          boxShadow="0 10px 28px rgba(13, 34, 65, 0.16)"
          py="6px"
          zIndex={60}
        >
          {items.map((item) => (
            <Box
              key={item.label}
              role="menuitem"
              as="button"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              width="100%"
              textAlign="left"
              px="14px"
              py="9px"
              background={item.active ? siteTheme.redWash : 'transparent'}
              color={item.active ? siteTheme.red : siteTheme.navy}
              fontWeight={item.active ? '600' : '400'}
              fontSize="13.5px"
              fontFamily={swissFont}
              lineHeight="1.4"
              _hover={{ background: siteTheme.redWash, color: siteTheme.red }}
              transition="background 140ms ease"
            >
              {item.label}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default function SiteHeader({
  activeNav,
  onNavigateColumn,
  onNavigateNews,
  onGoChat,
  onOpenSettings,
  showAdmin = true,
}: SiteHeaderProps) {
  const { interrupt } = useInterrupt();
  const isPortraitBoard = usePortraitBoard();

  const goHash = (hash: string) => {
    interrupt();
    window.location.hash = hash;
  };

  const goColumn = (columnId: SiteColumnId, articleId?: string) => {
    interrupt();
    onNavigateColumn(columnId, articleId);
  };

  const goNews = () => {
    interrupt();
    onNavigateNews();
  };

  return (
    <>
      {/* 绛红校名横带："石"字圆章 + 楷体校名 + 英文副标；右侧后台入口 + 设置齿轮 */}
      <Flex
        align="center"
        justify="space-between"
        gap={isPortraitBoard ? 4 : { base: 2, md: 3 }}
        bg={siteTheme.red}
        color={siteTheme.paper}
        px={isPortraitBoard ? 6 : { base: 3, md: 5 }}
        py={isPortraitBoard ? '14px' : { base: '7px', md: '10px' }}
        flexShrink={0}
      >
        <HStack
          gap={isPortraitBoard ? '14px' : { base: '10px', md: '14px' }}
          align="center"
          minW={0}
        >
          {/* "石"字圆章（校徽矢量图到位前的占位章） */}
          <Box
            flexShrink={0}
            display="flex"
            alignItems="center"
            justifyContent="center"
            width={isPortraitBoard ? '52px' : { base: '36px', md: '42px' }}
            height={isPortraitBoard ? '52px' : { base: '36px', md: '42px' }}
            borderRadius="full"
            border="2px solid rgba(255, 255, 255, 0.85)"
            fontFamily={kaiFont}
            fontWeight="bold"
            fontSize={isPortraitBoard ? '28px' : { base: '19px', md: '23px' }}
            lineHeight="1"
          >
            石
          </Box>
          <Box minW={0}>
            <Text
              fontFamily={kaiFont}
              fontWeight="bold"
              fontSize={isPortraitBoard ? '28px' : { base: '17px', md: '22px' }}
              letterSpacing="0.08em"
              lineHeight="1.15"
              whiteSpace="nowrap"
            >
              {SCHOOL_CONFIG.name}
            </Text>
            <Text
              display={isPortraitBoard ? 'block' : { base: 'none', md: 'block' }}
              fontSize={isPortraitBoard ? '13px' : { base: '8.5px', md: '10px' }}
              letterSpacing="0.22em"
              opacity={0.85}
              mt="2px"
              whiteSpace="nowrap"
            >
              SHISHI EXPERIMENTAL SCHOOL · 扬长教育 人人出彩
            </Text>
          </Box>
        </HStack>

        <HStack gap={isPortraitBoard ? 3 : 2} flexShrink={0}>
          {/* 后台管理：进入管理界面（#/main，未登录由 App 登录门禁接管） */}
          {showAdmin && (
            <Box
              as="button"
              onClick={() => goHash('#/main')}
              aria-label="进入后台管理"
              display={isPortraitBoard ? 'block' : { base: 'none', md: 'block' }}
              fontSize={isPortraitBoard ? '18px' : { base: '12.5px', md: '13px' }}
              opacity={0.92}
              px={isPortraitBoard ? 3 : 2}
              py={1}
              borderRadius="md"
              whiteSpace="nowrap"
              transition="all 0.2s ease"
              _hover={{ opacity: 1, background: 'rgba(255, 255, 255, 0.14)' }}
            >
              后台管理
            </Box>
          )}
          {/* 设置齿轮：打开 HeroSidebar（模型/语音等设置） */}
          <Box
            as="button"
            onClick={onOpenSettings}
            aria-label="打开设置"
            display="flex"
            alignItems="center"
            justifyContent="center"
            p={isPortraitBoard ? '10px' : '7px'}
            borderRadius="full"
            transition="all 0.2s ease"
            _hover={{ background: 'rgba(255, 255, 255, 0.16)' }}
          >
            <FiSettings size={isPortraitBoard ? 26 : 18} />
          </Box>
        </HStack>
      </Flex>

      {/* 白色通栏栏目导航条（省实式）：首页 | 三栏目▾ | 新闻中心▾ | 对话（行尾）。
          TopicTabRow 提供行壳与 kiosk JS 拖滑兜底；items 替换默认专题按钮组 */}
      <TopicTabRow
        leading={
          <Button
            data-testid="campus-nav-home"
            aria-label="回到学校首页"
            aria-current={activeNav === 'home' ? 'page' : undefined}
            onClick={() => goHash('#/home')}
            height={isPortraitBoard ? '54px' : '40px'}
            px={isPortraitBoard ? '20px' : { base: '12px', lg: '16px' }}
            borderRadius="md"
            background={activeNav === 'home' ? siteTheme.red : 'transparent'}
            color={activeNav === 'home' ? 'white' : '#586174'}
            fontFamily={swissFont}
            fontWeight="500"
            fontSize={isPortraitBoard ? '19px' : 'sm'}
            flexShrink={0}
            _hover={{
              background: activeNav === 'home' ? siteTheme.red : siteTheme.redWash,
              color: activeNav === 'home' ? 'white' : siteTheme.red,
            }}
            transition="all 200ms ease"
          >
            <HStack gap={isPortraitBoard ? '10px' : '8px'}>
              <FiHome size={isPortraitBoard ? 22 : 16} />
              <Text>首页</Text>
            </HStack>
          </Button>
        }
        items={
          <>
            {siteColumns.map((column) => (
              <NavDropdown
                key={column.id}
                testId={`campus-nav-${column.id}`}
                label={column.navLabel}
                active={activeNav === column.id}
                isPortraitBoard={isPortraitBoard}
                items={column.articles.map((article) => ({
                  label: article.title,
                  active: activeNav === column.id,
                  onClick: () => goColumn(column.id, article.id),
                }))}
              />
            ))}
            <NavDropdown
              testId="campus-nav-news"
              label="新闻中心"
              active={activeNav === 'news'}
              isPortraitBoard={isPortraitBoard}
              items={[
                { label: '学校新闻', onClick: goNews },
                { label: '通知公告', onClick: goNews },
              ]}
            />
          </>
        }
        trailing={
          <Button
            aria-label="进入对话界面"
            aria-current={activeNav === 'dialog' ? 'page' : undefined}
            onClick={() => {
              interrupt();
              onGoChat();
            }}
            height={isPortraitBoard ? '54px' : '40px'}
            px={isPortraitBoard ? '20px' : '16px'}
            borderRadius="md"
            variant="ghost"
            flexShrink={0}
            background={activeNav === 'dialog' ? siteTheme.red : 'transparent'}
            color={activeNav === 'dialog' ? 'white' : '#586174'}
            fontFamily={swissFont}
            fontWeight="500"
            fontSize={isPortraitBoard ? '19px' : 'sm'}
            _hover={{
              background: activeNav === 'dialog' ? siteTheme.red : siteTheme.redWash,
              color: activeNav === 'dialog' ? 'white' : siteTheme.red,
            }}
          >
            <FiMessageCircle size={isPortraitBoard ? 22 : 16} style={{ marginRight: '8px' }} />
            对话
          </Button>
        }
      />
    </>
  );
}
