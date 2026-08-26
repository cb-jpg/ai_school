/**
 * 管理后台登录页（#/main/* 未登录时显示）
 */
import { useState } from 'react';
import { Box, VStack, Text, Input, Button } from '@chakra-ui/react';
import { useAuth } from '@/context/auth-context';

const schoolBlue = '#1a4d8f';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login(username.trim(), password);
      // 登录成功后 AuthContext 更新，App 自动切回管理页
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      width="100vw"
      height="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      background="linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)"
      fontFamily="Microsoft YaHei, SimHei, sans-serif"
    >
      <Box
        width="360px"
        bg="white"
        borderRadius="lg"
        boxShadow="lg"
        p="8"
        border="1px solid"
        borderColor="#e2e8f0"
      >
        <VStack gap="2" mb="6" alignItems="start">
          <Text fontSize="lg" fontWeight="bold" color={schoolBlue}>
            石实实验学校 · AI数字人管理后台
          </Text>
          <Text fontSize="xs" color="#475569">
            请使用管理账号登录（admin / editor）
          </Text>
        </VStack>

        <form onSubmit={handleSubmit}>
          <VStack gap="4" alignItems="stretch">
            <VStack gap="1" alignItems="start">
              <Text fontSize="xs" color="#475569">用户名</Text>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="用户名"
                size="md"
                autoComplete="username"
              />
            </VStack>
            <VStack gap="1" alignItems="start">
              <Text fontSize="xs" color="#475569">密码</Text>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                size="md"
                autoComplete="current-password"
              />
            </VStack>

            {error && (
              <Text fontSize="xs" color="#c41e3a">{error}</Text>
            )}

            <Button
              type="submit"
              width="full"
              background={schoolBlue}
              color="white"
              _hover={{ background: '#0f3a6e' }}
              loading={submitting}
              loadingText="登录中..."
            >
              登录
            </Button>
          </VStack>
        </form>
      </Box>
    </Box>
  );
}
