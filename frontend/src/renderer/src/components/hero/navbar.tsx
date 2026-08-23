/**
 * Navbar Component
 * 响应式导航栏组件 - 明亮简洁风格
 */

import { memo } from 'react';
import { Flex, Text, Button, HStack, IconButton, Box } from '@chakra-ui/react';
import { FiMenu } from 'react-icons/fi';

interface NavItem {
  id: string;
  label: string;
  icon: any;
}

interface NavbarProps {
  schoolName: string;
  navigation: NavItem[];
  onMobileMenuToggle: () => void;
  mobileMenuOpen: boolean;
}

const handleNavClick = (itemId: string) => {
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
  mobileMenuOpen
}: NavbarProps) => {
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
      <HStack spacing={4}>
        <Text
          fontSize={{ base: 'lg', sm: 'xl' }}
          fontWeight="bold"
          tracking="tight"
          color="#002FA7"
          cursor="pointer"
          onClick={() => handleNavClick('home')}
        >
          {schoolName}
        </Text>
      </HStack>

      {/* Center: Desktop Navigation */}
      <HStack
        spacing={8}
        display={{ base: 'none', md: 'flex' }}
      >
        {navigation.map((item) => (
          <Text
            key={item.id}
            fontSize="sm"
            color="gray.600"
            _hover={{ color: '#002FA7' }}
            transition="colors 0.2s"
            cursor="pointer"
            fontWeight="500"
            onClick={() => handleNavClick(item.id)}
          >
            {item.label}
          </Text>
        ))}
      </HStack>

      {/* Right Side: CTA Button (Desktop) */}
      <HStack spacing={4}>
        <Button
          display={{ base: 'none', md: 'inline-flex' }}
          bg="#002FA7"
          color="white"
          px={5}
          py={2}
          fontSize="sm"
          fontWeight="medium"
          rounded="lg"
          _hover={{ bg: 'blue.800', transform: 'scale(1.05)' }}
          transition="all 0.2s"
          onClick={() => {
            // Focus on the input field
            const textarea = document.querySelector('textarea[placeholder*="问题"]');
            if (textarea instanceof HTMLTextAreaElement) {
              textarea.focus();
            }
          }}
        >
          开始咨询
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
          size={10}
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
