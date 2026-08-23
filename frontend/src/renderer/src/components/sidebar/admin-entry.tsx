/**
 * 管理后台入口组件 - Admin Entry
 * 提供知识库管理后台的访问入口
 */

import {
  Button,
  Flex,
  Icon,
  Text,
  HStack
} from '@chakra-ui/react';
import { useColorModeValue } from '@/components/ui/color-mode';
import { FiSettings } from 'react-icons/fi';
import { useAdmin } from '@/context/admin-context';

const swissFont = '"Helvetica Neue", Arial, sans-serif';

interface AdminEntryProps {
  showLabel?: boolean;
  variant?: 'button' | 'menuItem';
}

export default function AdminEntry({ showLabel = true, variant = 'menuItem' }: AdminEntryProps) {
  const { openAdmin, isAdminOpen } = useAdmin();
  const textColor = useColorModeValue('gray.700', 'gray.200');
  const hoverBg = useColorModeValue('gray.100', 'gray.700');
  const activeBg = useColorModeValue('blue.50', 'blue.900');
  const activeColor = useColorModeValue('blue.600', 'blue.300');

  if (variant === 'button') {
    return (
      <Button
        onClick={openAdmin}
        size="sm"
        bg={isAdminOpen ? '#002FA7' : 'transparent'}
        color={isAdminOpen ? 'white' : textColor}
        border="1px solid"
        borderColor={isAdminOpen ? '#002FA7' : 'gray.300'}
        _hover={{
          bg: isAdminOpen ? '#001F7A' : hoverBg,
          borderColor: isAdminOpen ? '#001F7A' : 'gray.400'
        }}
        fontFamily={swissFont}
        fontWeight="600"
        leftIcon={<FiSettings size="14px" />}
      >
        {showLabel && '知识库管理'}
      </Button>
    );
  }

  return (
    <HStack
      p="3"
      borderRadius="md"
      bg={isAdminOpen ? activeBg : 'transparent'}
      cursor="pointer"
      onClick={openAdmin}
      _hover={{
        bg: isAdminOpen ? activeBg : hoverBg
      }}
      transition="all 0.2s ease"
      width="stretch"
    >
      <Icon
        as={FiSettings}
        color={isAdminOpen ? activeColor : textColor}
        boxSize="4"
      />
      <Text
        fontSize="sm"
        fontWeight="500"
        color={isAdminOpen ? activeColor : textColor}
        fontFamily={swissFont}
        flex="1"
      >
        知识库管理
      </Text>
      {isAdminOpen && (
        <Text
          fontSize="xs"
          color={activeColor}
          fontFamily={swissFont}
        >
          ●
        </Text>
      )}
    </HStack>
  );
}

// 紧凑版本 - 用于设置菜单中
export function CompactAdminEntry() {
  const { openAdmin } = useAdmin();

  return (
    <Button
      onClick={openAdmin}
      variant="ghost"
      size="sm"
      justifyContent="flex-start"
      width="100%"
      fontFamily={swissFont}
      leftIcon={<FiSettings size="14px" />}
    >
      知识库管理后台
    </Button>
  );
}
