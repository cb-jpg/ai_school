/**
 * Mobile Menu Component
 * 移动端全屏菜单组件 - 明亮简洁风格
 */

import { memo } from 'react';
import { Box, Flex, Button, Text, IconButton } from '@chakra-ui/react';
import { FiX } from 'react-icons/fi';

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

const handleNavClick = (itemId: string, onClose: () => void) => {
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
        {navigation.map((item) => (
          <Text
            key={item.id}
            fontSize="2xl"
            fontWeight="medium"
            color="gray.700"
            _hover={{ color: '#002FA7' }}
            cursor="pointer"
            mb={6}
            onClick={() => handleNavClick(item.id, onClose)}
          >
            {item.label}
          </Text>
        ))}

        {/* CTA Button */}
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
          onClick={() => {
            onClose();
            // Focus on input field
            setTimeout(() => {
              const textarea = document.querySelector('textarea[placeholder*="问题"]');
              if (textarea instanceof HTMLTextAreaElement) {
                textarea.focus();
              }
            }, 100);
          }}
        >
          开始咨询
        </Button>
      </Flex>
    </Box>
  );
});

MobileMenu.displayName = 'MobileMenu';

export default MobileMenu;
