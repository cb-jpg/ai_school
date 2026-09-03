/**
 * App 全局登录页（启动门禁）：所有用户（管理员/普通使用者）先登录再使用。
 * 账号由管理员在管理后台"用户管理"中创建并派发。
 */
import { useState } from 'react';
import { Box, VStack, Text, Input, Button } from '@chakra-ui/react';
import { useAuth } from '@/context/auth-context';

const schoolBlue = '#1a4d8f';

export default function AppLoginPage() {
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
      // 登录成功后 AuthContext 更新，自动进入主界面并连接服务器
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
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      background={`linear-gradient(160deg, ${schoolBlue} 0%, #2a6db5 55%, #4a90c9 100%)`}
      fontFamily="Microsoft YaHei, SimHei, sans-serif"
      position="relative"
      overflow="hidden"
    >
      {/* 背景装饰光斑 */}
      <Box
        position="absolute"
        top="-15%"
        right="-10%"
        width="55vw"
        height="55vw"
        borderRadius="full"
        background="radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 65%)"
        pointerEvents="none"
      />
      <Box
        position="absolute"
        bottom="-20%"
        left="-15%"
        width="60vw"
        height="60vw"
        borderRadius="full"
        background="radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 60%)"
        pointerEvents="none"
      />

      <VStack gap="1" mb={{ base: 6, md: 8 }} position="relative">
        <Text
          fontSize={{ base: '2xl', md: '3xl' }}
          fontWeight="bold"
          color="white"
          letterSpacing="2px"
        >
          AI 数字人
        </Text>
        <Text fontSize={{ base: 'xs', md: 'sm' }} color="rgba(255,255,255,0.85)">
          佛山市南海区石实实验学校
        </Text>
      </VStack>

      <Box
        width={{ base: '86vw', md: '380px' }}
        maxWidth="380px"
        bg="white"
        borderRadius="20px"
        boxShadow="0 12px 40px rgba(0, 0, 0, 0.25)"
        p={{ base: '6', md: '8' }}
        position="relative"
      >
        <VStack gap="1" mb="6" alignItems="start">
          <Text fontSize="md" fontWeight="bold" color={schoolBlue}>
            欢迎使用
          </Text>
          <Text fontSize="xs" color="#64748b">
            请输入管理员派发的账号密码登录
          </Text>
        </VStack>

        <form onSubmit={handleSubmit}>
          <VStack gap="4" alignItems="stretch">
            <VStack gap="1" alignItems="start">
              <Text fontSize="xs" color="#475569">用户名</Text>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
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
                placeholder="请输入密码"
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
              size="lg"
              borderRadius="12px"
              loading={submitting}
              loadingText="登录中..."
            >
              登 录
            </Button>
          </VStack>
        </form>
      </Box>

      <Text
        fontSize="xs"
        color="rgba(255,255,255,0.65)"
        mt={{ base: 6, md: 8 }}
        position="relative"
      >
        如需账号请联系学校管理员
      </Text>
    </Box>
  );
}
