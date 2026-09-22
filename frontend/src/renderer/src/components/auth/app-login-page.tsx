/**
 * App 全局登录页：管理员/数据管理员进后台、学生/家长进对话前登录。
 * 账号由管理员在管理后台"用户管理"中创建并派发。
 * 浏览类页面（首页/专题页）不要求登录；匿名讲解时本页作为可取消浮层弹出（onCancel）。
 */
import { useState } from 'react';
import { Box, VStack, Text, Input, Button } from '@chakra-ui/react';
import { useAuth } from '@/context/auth-context';
import { siteTheme, swissFont } from '@/components/hero/site-theme';

// 全站官网主题（site-theme.ts）：绛红主色，渐变到按压深一档
const brand = siteTheme.red;

interface AppLoginPageProps {
  /** 作为浮层弹出时的"暂不登录"回调；提供时显示返回按钮 */
  onCancel?: () => void;
}

export default function AppLoginPage({ onCancel }: AppLoginPageProps) {
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
      /* 100% 而非 100vw：一体机 CSS transform 兜底模式下页面装在 420px 包装盒里，
         100vw 会取到未钉住的物理视口宽（如 960），把表单中心挤出可见区 */
      data-login-root
      width="100%"
      height="var(--app-vh, 100vh)"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      background={`linear-gradient(160deg, ${brand} 0%, #7C1730 52%, ${siteTheme.redDark} 100%)`}
      fontFamily={swissFont}
      position="relative"
      overflow="hidden"
    >
      {/* 背景装饰光斑 */}
      <Box
        data-login-spot="1"
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
        data-login-spot="2"
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
          data-login-title
          fontSize={{ base: '2xl', md: '3xl' }}
          fontWeight="bold"
          color="white"
          letterSpacing="2px"
        >
          AI 数字人
        </Text>
        <Text data-login-sub fontSize={{ base: 'xs', md: 'sm' }} color="rgba(255,255,255,0.85)">
          佛山市南海区石实实验学校
        </Text>
      </VStack>

      <Box
        data-login-card
        width={{ base: '86vw', md: '380px' }}
        maxWidth="380px"
        bg="white"
        borderRadius="20px"
        boxShadow="0 12px 40px rgba(0, 0, 0, 0.25)"
        p={{ base: '6', md: '8' }}
        position="relative"
      >
        <VStack gap="1" mb="6" alignItems="start">
          <Text data-login-card-title fontSize="md" fontWeight="bold" color={brand}>
            欢迎使用
          </Text>
          <Text data-login-card-sub fontSize="xs" color="#64748b">
            请输入管理员派发的账号密码登录
          </Text>
        </VStack>

        <form onSubmit={handleSubmit}>
          <VStack gap="4" alignItems="stretch">
            <VStack gap="1" alignItems="start">
              <Text data-login-label fontSize="xs" color="#475569">用户名</Text>
              <Input
                data-login-input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                size="md"
                autoComplete="username"
              />
            </VStack>
            <VStack gap="1" alignItems="start">
              <Text data-login-label fontSize="xs" color="#475569">密码</Text>
              <Input
                data-login-input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                size="md"
                autoComplete="current-password"
              />
            </VStack>

            {error && (
              <Text data-login-error fontSize="xs" color="#c41e3a">{error}</Text>
            )}

            <Button
              data-login-submit
              type="submit"
              width="full"
              background={brand}
              color="white"
              _hover={{ background: siteTheme.redDark }}
              size="lg"
              borderRadius="12px"
              loading={submitting}
              loadingText="登录中..."
            >
              登 录
            </Button>

            {/* 浮层模式（匿名讲解触发）：可暂不登录，返回继续浏览 */}
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                width="full"
                size="sm"
                color="#64748b"
                onClick={onCancel}
              >
                暂不登录，继续浏览
              </Button>
            )}
          </VStack>
        </form>
      </Box>

      <Text
        data-login-footnote
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
