/**
 * Mobile Menu Component
 * 移动端全屏菜单组件 - 明亮简洁风格
 */

import { memo } from 'react';
import { Box, Flex, Button, Text, IconButton, HStack } from '@chakra-ui/react';
import { FiX, FiHome, FiBook, FiClock, FiAward, FiUsers, FiLogOut } from 'react-icons/fi';
import { useInterrupt } from '@/hooks/utils/use-interrupt';
import { useAuth } from '@/context/auth-context';

interface NavItem {
  id: string;
  label: string;
  icon: any;
}

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  navigation: NavItem[];
}

// 图标映射
const iconMap: Record<string, React.ElementType> = {
  home: FiHome,
  intro: FiBook,
  history: FiClock,
  achievements: FiAward,
  'role-models': FiUsers,
};

const handleNavClick = (itemId: string, onClose: () => void, onInterrupt?: () => void) => {
  // 切换界面时打断语音播报
  if (onInterrupt) {
    onInterrupt();
  }

  onClose();

  // Navigate based on item id
  switch (itemId) {
    case 'home':
      window.location.hash = '#/hero';
      break;
    case 'intro':
      window.location.hash = '#/campus/intro';
      break;
    case 'history':
      window.location.hash = '#/campus/history';
      break;
    case 'achievements':
      window.location.hash = '#/campus/achievements';
      break;
    case 'role-models':
      window.location.hash = '#/campus/role-models';
      break;
    default:
      console.log('Unknown navigation item:', itemId);
  }
};

const MobileMenu = memo(({ isOpen, onClose, navigation }: MobileMenuProps) => {
  const { interrupt } = useInterrupt();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  const handleAdminConsole = () => {
    // 切换界面时打断语音播报
    interrupt();
    // 关闭菜单
    onClose();
    // 跳转到main界面（工作台模式）
    setTimeout(() => {
      window.location.hash = '#/main';
      window.dispatchEvent(new Event('hashchange'));
    }, 100);
  };

  return (
    <Box
      /* fixed 铺满视口：本机型 WebView 里 absolute+100vh 受容器偏移影响
         会在屏底漏一条背景（背景图是 fixed 所以能铺满，菜单必须同样 fixed）；
         40：盖过导航栏(30)与对话输入区(20)，打开时完整覆盖 */
      position="fixed"
      insetX={0}
      top={0}
      zIndex={40}
      bg="white"
      height={isOpen ? '100%' : '0'}
      opacity={isOpen ? 1 : 0}
      pointerEvents={isOpen ? 'auto' : 'none'}
      transition="all 0.5s ease"
      transitionTimingFunction="cubic-bezier(0.16, 1, 0.3, 1)"
      boxShadow="xl"
    >
      {/* Close Button */}
      <IconButton
        position="absolute"
        top={5}
        right={6}
        aria-label="Close menu"
        onClick={onClose}
        bg="transparent"
        color="gray.700"
        _hover={{ bg: 'gray.100' }}
      >
        <FiX size={24} />
      </IconButton>

      <Flex
        h="full"
        flexDirection="column"
        justifyContent="center"
        px={8}
        opacity={isOpen ? 1 : 0}
        transition="opacity 0.3s ease 0.1s, transform 0.3s ease 0.1s"
        transform={isOpen ? 'translateY(0)' : 'translateY(32px)'}
      >
        {/* Navigation Links */}
        {navigation.map((item) => {
          const Icon = iconMap[item.id] || item.icon;
          return (
            <HStack
              key={item.id}
              gap={4}
              fontSize="2xl"
              fontWeight="medium"
              color="gray.700"
              _hover={{ color: '#002FA7' }}
              cursor="pointer"
              mb={6}
              onClick={() => handleNavClick(item.id, onClose, interrupt)}
            >
              <Icon size={28} />
              <Text>{item.label}</Text>
            </HStack>
          );
        })}

        {/* 管理后台入口：仅管理员可见（普通使用者无任何后台入口） */}
        {isAdmin && (
          <Button
            mt={6}
            rounded="full"
            bg="#002FA7"
            color="white"
            px={8}
            py={3.5}
            fontSize="base"
            fontWeight="medium"
            _hover={{ bg: 'blue.800', transform: 'scale(1.05)' }}
            transition="all 0.2s"
            onClick={handleAdminConsole}
          >
            管理后台
          </Button>
        )}

        {/* 登录用户标识 + 退出登录 */}
        {user && (
          <HStack mt={isAdmin ? 4 : 6} gap={3} alignItems="center">
            <Text fontSize="sm" color="gray.500">
              {user.username}
            </Text>
            <IconButton
              aria-label="退出登录"
              title="退出登录"
              onClick={logout}
              size="sm"
              boxSize="34px"
              bg="transparent"
              color="gray.500"
              _hover={{ bg: 'gray.100', color: '#c41e3a' }}
            >
              <FiLogOut size={16} />
            </IconButton>
          </HStack>
        )}
      </Flex>
    </Box>
  );
});

MobileMenu.displayName = 'MobileMenu';

export default MobileMenu;
