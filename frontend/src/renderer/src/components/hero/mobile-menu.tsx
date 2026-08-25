/**
 * Mobile Menu Component
 * 移动端全屏菜单组件 - 明亮简洁风格
 */

import { memo } from 'react';
import { Box, Flex, Button, Text, IconButton, HStack } from '@chakra-ui/react';
import { FiX, FiHome, FiBook, FiClock, FiAward, FiUsers } from 'react-icons/fi';
import { useInterrupt } from '@/hooks/utils/use-interrupt';

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

  const handleLogin = () => {
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
      position="absolute"
      insetX={0}
      top={0}
      zIndex={20}
      bg="white"
      height={isOpen ? '100vh' : '0'}
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
        size={10}
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
              spacing={4}
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

        {/* CTA Button - 登录按钮 */}
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
          onClick={handleLogin}
        >
          登录
        </Button>
      </Flex>
    </Box>
  );
});

MobileMenu.displayName = 'MobileMenu';

export default MobileMenu;
