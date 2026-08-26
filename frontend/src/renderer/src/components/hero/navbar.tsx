/**
 * Navbar Component
 * 响应式导航栏组件 - 明亮简洁风格
 */

import { memo } from 'react';
import { Flex, Text, Button, HStack, IconButton } from '@chakra-ui/react';
import { FiMenu, FiHome, FiBook, FiClock, FiAward, FiUsers } from 'react-icons/fi';
import { useInterrupt } from '@/hooks/utils/use-interrupt';

interface NavItem {
  id: string;
  label: string;
  icon: any;
}

// 图标映射
const iconMap: Record<string, React.ElementType> = {
  home: FiHome,
  intro: FiBook,
  history: FiClock,
  achievements: FiAward,
  'role-models': FiUsers,
};

interface NavbarProps {
  schoolName: string;
  navigation: NavItem[];
  onMobileMenuToggle: () => void;
  mobileMenuOpen: boolean;
}

const handleNavClick = (itemId: string, onInterrupt?: () => void) => {
  // 切换界面时打断语音播报
  if (onInterrupt) {
    onInterrupt();
  }

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

const Navbar = memo(({
  schoolName,
  navigation,
  onMobileMenuToggle,
}: NavbarProps) => {
  const { interrupt } = useInterrupt();

  const handleLogin = () => {
    // 切换界面时打断语音播报
    interrupt();
    // 跳转到main界面（工作台模式）
    window.location.hash = '#/main';
    window.dispatchEvent(new Event('hashchange'));
  };

  return (
    <Flex
      position="absolute"
      top={0}
      left={0}
      right={0}
      zIndex={30}
      px={{ base: 6, md: 12, lg: 16 }}
      py={{ base: 5, md: 6 }}
      justifyContent="space-between"
      alignItems="center"
      bg="white"
      borderBottom="1px solid"
      borderColor="gray.200"
      boxShadow="sm"
    >
      {/* Left Side: Logo */}
      <HStack gap={4}>
        <Text
          fontSize={{ base: 'lg', sm: 'xl' }}
          fontWeight="bold"
          letterSpacing="tight"
          color="#1E5494"
          cursor="pointer"
          onClick={() => handleNavClick('home', interrupt)}
        >
          {schoolName}
        </Text>
      </HStack>

      {/* Center: Desktop Navigation */}
      <HStack
        display={{ base: 'none', md: 'flex' }}
        gap={{ base: 8, md: 6, lg: 8 }}
      >
        {navigation.map((item) => {
          const Icon = iconMap[item.id] || item.icon;
          return (
            <HStack
              key={item.id}
              gap={2}
              fontSize="sm"
              color="gray.600"
              _hover={{ color: '#1E5494' }}
              transition="all 0.2s"
              cursor="pointer"
              fontWeight="500"
              onClick={() => handleNavClick(item.id, interrupt)}
            >
              <Icon size={16} />
              <Text>{item.label}</Text>
            </HStack>
          );
        })}
      </HStack>

      {/* Right Side: CTA Button (Desktop) */}
      <HStack gap={4}>
        <Button
          display={{ base: 'none', md: 'inline-flex' }}
          bg="#1E5494"
          color="white"
          px={5}
          py={2}
          fontSize="sm"
          fontWeight="medium"
          rounded="lg"
          _hover={{ bg: '#152C5E', transform: 'scale(1.05)' }}
          transition="all 0.2s"
          onClick={handleLogin}
        >
          登录
        </Button>

        {/* Mobile Menu Toggle */}
        <IconButton
          display={{ base: 'flex', md: 'none' }}
          aria-label="Toggle menu"
          onClick={onMobileMenuToggle}
          bg="transparent"
          color="gray.700"
          _hover={{ bg: 'gray.100' }}
          _active={{ scale: 0.9 }}
          zIndex={50}
        >
          <FiMenu size={20} />
        </IconButton>
      </HStack>
    </Flex>
  );
});

Navbar.displayName = 'Navbar';

export default Navbar;
