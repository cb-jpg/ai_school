/**
 * 用户管理页（仅 admin 可见）：列表 / 创建 / 删除
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Box, VStack, HStack, Text, Button, Input, Badge,
} from '@chakra-ui/react';
import { authFetch } from '@/services/auth';
import { useAuth } from '@/context/auth-context';

const schoolBlue = '#1a4d8f';
const schoolRed = '#c41e3a';
const gray200 = '#e2e8f0';
const gray600 = '#475569';
const gray800 = '#1e293b';

interface UserRow {
  username: string;
  role: 'admin' | 'editor';
  created_at: number;
}

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 创建表单
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'editor'>('editor');
  const [creating, setCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authFetch('/api/auth/users');
      if (!response.ok) {
        const detail = await response.json().then((d) => d?.detail).catch(() => null);
        throw new Error(detail || `加载失败（${response.status}）`);
      }
      const data = await response.json();
      setUsers(data.users || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreate = async () => {
    if (!newUsername.trim() || newPassword.length < 8) {
      setError('用户名不能为空，密码至少 8 位');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const response = await authFetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole }),
      });
      if (!response.ok) {
        const detail = await response.json().then((d) => d?.detail).catch(() => null);
        throw new Error(detail || `创建失败（${response.status}）`);
      }
      setNewUsername('');
      setNewPassword('');
      setNewRole('editor');
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (username: string) => {
    if (!window.confirm(`确定删除用户 ${username}？`)) {
      return;
    }
    setError('');
    try {
      const response = await authFetch(`/api/auth/users/${encodeURIComponent(username)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const detail = await response.json().then((d) => d?.detail).catch(() => null);
        throw new Error(detail || `删除失败（${response.status}）`);
      }
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
  };

  return (
    <Box maxWidth="860px">
      <VStack gap="1" alignItems="start" mb="6">
        <Text fontSize="lg" fontWeight="bold" color={gray800}>用户管理</Text>
        <Text fontSize="xs" color={gray600}>
          admin 拥有全部权限；editor 仅可管理知识库（当前登录：{user?.username}）
        </Text>
      </VStack>

      {error && (
        <Box mb="4" p="3" bg="#FCE8E6" borderRadius="md" borderWidth="1px" borderColor={schoolRed}>
          <Text fontSize="xs" color={schoolRed}>{error}</Text>
        </Box>
      )}

      {/* 创建用户 */}
      <Box bg="white" borderRadius="md" borderWidth="1px" borderColor={gray200} p="5" mb="6">
        <Text fontSize="sm" fontWeight="semibold" color={gray800} mb="4">创建新用户</Text>
        <HStack gap="3" flexWrap="wrap">
          <Input
            width="180px" placeholder="用户名" size="sm"
            value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
          />
          <Input
            width="200px" type="password" placeholder="密码（至少 8 位）" size="sm"
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
          />
          <HStack gap="1">
            <Button
              size="sm" variant={newRole === 'editor' ? 'solid' : 'outline'}
              colorScheme={newRole === 'editor' ? 'blue' : 'gray'}
              onClick={() => setNewRole('editor')}
            >
              editor
            </Button>
            <Button
              size="sm" variant={newRole === 'admin' ? 'solid' : 'outline'}
              colorScheme={newRole === 'admin' ? 'blue' : 'gray'}
              onClick={() => setNewRole('admin')}
            >
              admin
            </Button>
          </HStack>
          <Button
            size="sm" background={schoolBlue} color="white"
            _hover={{ background: '#0f3a6e' }}
            onClick={handleCreate} loading={creating} loadingText="创建中..."
          >
            创建
          </Button>
        </HStack>
      </Box>

      {/* 用户列表 */}
      <Box bg="white" borderRadius="md" borderWidth="1px" borderColor={gray200} p="5">
        <HStack justify="space-between" mb="4">
          <Text fontSize="sm" fontWeight="semibold" color={gray800}>用户列表（{users.length}）</Text>
          <Button size="xs" variant="ghost" onClick={loadUsers} loading={loading}>
            刷新
          </Button>
        </HStack>
        <VStack gap="2" alignItems="stretch">
          {users.map((u) => (
            <HStack
              key={u.username}
              p="3" borderRadius="md"
              borderWidth="1px" borderColor={gray200}
              justify="space-between"
            >
              <HStack gap="3">
                <Text fontSize="sm" fontWeight="medium" color={gray800}>{u.username}</Text>
                <Badge
                  bg={u.role === 'admin' ? schoolBlue : gray600}
                  color="white" fontSize="9px" px="2" rounded="full"
                >
                  {u.role}
                </Badge>
                {u.username === user?.username && (
                  <Text fontSize="10px" color={gray600}>（当前登录）</Text>
                )}
              </HStack>
              <Button
                size="xs" variant="ghost" color={schoolRed}
                onClick={() => handleDelete(u.username)}
                disabled={u.username === user?.username}
                title={u.username === user?.username ? '不能删除当前登录用户' : undefined}
              >
                删除
              </Button>
            </HStack>
          ))}
          {!loading && users.length === 0 && (
            <Text fontSize="xs" color={gray600}>暂无用户</Text>
          )}
        </VStack>
      </Box>
    </Box>
  );
}
