/**
 * 无后台权限提示页（2026-09-30）：学生(user)/家长(parent)账号在 #/main 登录
 * 其实是成功的（服务端 200、JWT 已存），但管理后台门禁只放行 admin/editor，
 * 此前无声弹回登录页——校方看起来就是"密码错误/无法登录"。
 * 本页替代无声弹回：明确告知账号类型，给出「进入 AI 对话」「退出登录」两个出口。
 */
import { Box, VStack, Text, Button } from '@chakra-ui/react';
import { FiLogOut, FiMessageCircle } from 'react-icons/fi';
import type { AuthUser } from '@/services/auth';
import { useAuth } from '@/context/auth-context';
import { siteTheme, swissFont } from '@/components/hero/site-theme';

const ROLE_LABELS: Record<string, string> = {
  user: '学生账号',
  parent: '家长账号',
  editor: '数据管理员',
  admin: '管理员',
};

export default function NonStaffNotice({ user }: { user: AuthUser }) {
  const { logout } = useAuth();
  const roleLabel = ROLE_LABELS[user.role] || '普通账号';

  return (
    <Box
      width="100%"
      height="var(--app-vh, 100vh)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      background={`linear-gradient(160deg, ${siteTheme.red} 0%, #7C1730 52%, ${siteTheme.redDark} 100%)`}
      fontFamily={swissFont}
    >
      <Box
        width={{ base: '86vw', md: '420px' }}
        bg="white"
        borderRadius="20px"
        boxShadow="0 12px 40px rgba(0, 0, 0, 0.25)"
        p={{ base: '6', md: '8' }}
      >
        <VStack gap="2" mb="6" alignItems="start">
          <Text fontSize="md" fontWeight="bold" color={siteTheme.red}>
            当前账号：{user.username}（{roleLabel}）
          </Text>
          <Text fontSize="sm" color="#475569" lineHeight="1.7">
            {roleLabel}用于「AI 对话」页面，不具备管理后台权限，因此无法进入后台。
            管理后台请使用管理员/数据管理员账号登录。
          </Text>
        </VStack>
        <VStack gap="3" alignItems="stretch">
          <Button
            width="full"
            background={siteTheme.red}
            color="white"
            _hover={{ background: siteTheme.redDark }}
            size="md"
            borderRadius="12px"
            onClick={() => {
              window.location.hash = '#/hero';
            }}
          >
            <FiMessageCircle style={{ marginRight: '8px' }} />
            进入 AI 对话
          </Button>
          <Button
            variant="ghost"
            width="full"
            size="sm"
            color="#64748b"
            onClick={logout}
          >
            <FiLogOut style={{ marginRight: '6px' }} />
            退出登录，改用其他账号
          </Button>
        </VStack>
      </Box>
    </Box>
  );
}
