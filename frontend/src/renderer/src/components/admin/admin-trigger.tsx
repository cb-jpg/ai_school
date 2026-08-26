/**
 * Admin Panel Trigger Button
 * A floating button to quickly open the knowledge base admin panel
 */

import { Button, Flex, Icon } from '@chakra-ui/react';
import { FiSettings } from 'react-icons/fi';
import { useAdmin } from '@/context/admin-context';

const blue = '#002FA7';
const paper = '#FFFFFF';
const hairline = '#D9DEE8';
const ink = '#121826';

interface AdminTriggerProps {
  position?: 'sidebar' | 'floating';
}

export default function AdminTrigger({ position = 'sidebar' }: AdminTriggerProps) {
  const { openAdmin, isAdminOpen } = useAdmin();

  if (position === 'floating') {
    return (
      <Button
        position="fixed"
        bottom="80px"
        right="20px"
        width="48px"
        height="48px"
        borderRadius="50%"
        background={isAdminOpen ? hairline : blue}
        color={isAdminOpen ? ink : paper}
        boxShadow="0 4px 12px rgba(0, 47, 167, 0.3)"
        onClick={openAdmin}
        zIndex={50}
        _hover={{
          background: blue,
          color: paper,
          transform: 'scale(1.05)',
        }}
        transition="all 0.2s ease"
        aria-label="打开知识库管理后台"
      >
        <Icon as={FiSettings} width="20px" height="20px" />
      </Button>
    );
  }

  return (
    <Button
      onClick={openAdmin}
      height="40px"
      px="12px"
      borderRadius="2px"
      border="1px solid"
      borderColor={isAdminOpen ? blue : hairline}
      background={isAdminOpen ? blue : paper}
      color={isAdminOpen ? paper : ink}
      _hover={{
        borderColor: blue,
        background: blue,
        color: paper,
      }}
      transition="all 0.2s ease"
      aria-label="打开知识库管理后台"
    >
      <Flex align="center" gap="8px">
        <Icon as={FiSettings} width="16px" height="16px" />
        <span>知识库管理</span>
      </Flex>
    </Button>
  );
}
