/**
 * 用户管理页（仅 admin 可见）：列表（角色/分组筛选）/ 创建 / 批量导入导出 / 删除
 *
 * 2026-10-06 批量建号：CSV 导入（用户名,密码,角色,分组；密码留空自动生成，
 * 导入后可下载含初始密码的一次性回执——服务端 scrypt 哈希不可逆，导出清单
 * 因此不含密码）；「分组」为纯标注字段（班级/部门），不参与权限。
 *
 * 2026-10-13 下载修复：Android WebView（App/一体机）没有下载处理器，
 * blob + <a download> 点击是纯静默 no-op（Capacitor 未接 DownloadListener），
 * 校方在 App 后台点「下载模板/导出/回执」毫无反应。原生环境改弹
 * 「复制内容」层兜底（execCommand 复制，http 非安全上下文无 navigator.clipboard）；
 * 桌面浏览器保持原下载（CDP 实测落盘正常）。原生真下载需 APK 接
 * DownloadListener + 服务端附件端点，留待后续发版。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
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
  role: 'admin' | 'editor' | 'user' | 'parent';
  group?: string;
  created_at: number;
}

type CreateRole = 'user' | 'parent' | 'editor' | 'admin';

// 角色中文名（2026-09-20 需求 #6）：admin=最高权限管理员、editor=数据管理员
//（仅能上传，不能动他人数据）、user=学生、parent=家长（会话数据与学生分开）
const ROLE_LABELS: Record<CreateRole, string> = {
  user: '学生',
  parent: '家长',
  editor: '数据管理员',
  admin: '最高权限管理员',
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin: schoolBlue,
  editor: gray600,
  user: '#2e8b57',
  parent: '#b7791f',
};

interface ImportCreated {
  username: string;
  password: string;
  role: string;
  group: string;
}

interface ImportResult {
  created: ImportCreated[];
  skipped: { line: number; username: string; reason: string }[];
  errors: { line: number; username: string; error: string }[];
}

/** 能否走浏览器原生下载：Capacitor App（Android WebView）下载会静默失败，
 *  一律走「复制内容」兜底；桌面浏览器/Electron 可下载。
 *  桌面地址栏加 ?csvcopy=1 可强制预览兜底弹层（调试用）。 */
const canBrowserDownload = (): boolean => {
  try {
    if (new URLSearchParams(window.location.search).get('csvcopy') === '1') return false;
    return !Capacitor.isNativePlatform();
  } catch {
    return true;
  }
};

/** 浏览器下载 CSV（BOM 让 Excel 直接打开不乱码）。
 *  元素先挂 DOM 再点击（老内核兜底）；revoke 延后一分钟，避免个别
 *  WebView 起下载慢、同步 revoke 把下载掐死的竞态。 */
function saveCsvViaBrowser(filename: string, content: string) {
  const blob = new Blob([`﻿${content}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const TEMPLATE_CSV = [
  '用户名,密码,角色,分组',
  'student2601,Abcd1234,学生,初一(1)班',
  'parent2601,,家长,初一(1)班',
].join('\n');

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 创建表单
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [newRole, setNewRole] = useState<CreateRole>('user');
  const [creating, setCreating] = useState(false);

  // 批量导入
  const fileRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // CSV 下载（原生 App 走复制兜底层）
  const [csvFallback, setCsvFallback] = useState<{ filename: string; content: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const downloadCsv = useCallback((filename: string, content: string) => {
    if (!canBrowserDownload()) {
      setCsvFallback({ filename, content });
      return;
    }
    saveCsvViaBrowser(filename, content);
  }, []);

  const copyFallbackCsv = useCallback(async () => {
    if (!csvFallback) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(csvFallback.content);
      ok = true;
    } catch {
      // http 非安全上下文无 navigator.clipboard：execCommand 兜底
      try {
        const ta = document.createElement('textarea');
        ta.value = csvFallback.content;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        ta.remove();
      } catch {
        ok = false;
      }
    }
    setCopied(ok);
    window.setTimeout(() => setCopied(false), 2500);
  }, [csvFallback]);

  // 筛选
  const [roleFilter, setRoleFilter] = useState<'all' | CreateRole>('all');
  const [groupFilter, setGroupFilter] = useState('');

  const allGroups = useMemo(
    () => Array.from(new Set(users.map((u) => u.group || '').filter(Boolean))).sort(),
    [users],
  );

  const shownUsers = useMemo(() => users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (groupFilter && !(u.group || '').includes(groupFilter.trim())) return false;
    return true;
  }), [users, roleFilter, groupFilter]);

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
        body: JSON.stringify({
          username: newUsername.trim(), password: newPassword,
          role: newRole, group: newGroup.trim(),
        }),
      });
      if (!response.ok) {
        const detail = await response.json().then((d) => d?.detail).catch(() => null);
        throw new Error(detail || `创建失败（${response.status}）`);
      }
      setNewUsername('');
      setNewPassword('');
      setNewGroup('');
      setNewRole('user');
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setError('');
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const response = await authFetch('/api/auth/users/import', { method: 'POST', body: fd });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.detail || `导入失败（${response.status}）`);
      }
      setImportResult(data as ImportResult);
      setImportFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    setError('');
    try {
      const response = await authFetch('/api/auth/users/export');
      if (!response.ok) {
        throw new Error(`导出失败（${response.status}）`);
      }
      const text = await response.text();
      downloadCsv('账号列表.csv', text);
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败');
    }
  };

  const downloadReceipt = () => {
    if (!importResult?.created.length) return;
    const rows = ['用户名,密码,角色,分组'];
    for (const c of importResult.created) {
      rows.push([c.username, c.password, ROLE_LABELS[c.role as CreateRole] || c.role, c.group]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }
    downloadCsv('账号导入回执（含初始密码，请妥善保管）.csv', rows.join('\n'));
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
          管理员拥有全部权限；编辑者仅可管理知识库；普通用户用于 App 登录（每人独立聊天记录）。
          「分组」用于标注班级/部门，方便筛选，不影响权限。当前登录：{user?.username}
        </Text>
      </VStack>

      {error && (
        <Box mb="4" p="3" bg="#FCE8E6" borderRadius="md" borderWidth="1px" borderColor={schoolRed}>
          <Text fontSize="xs" color={schoolRed}>{error}</Text>
        </Box>
      )}

      {/* 创建用户 */}
      <Box bg="white" borderRadius="md" borderWidth="1px" borderColor={gray200} p="5" mb="4">
        <Text fontSize="sm" fontWeight="semibold" color={gray800} mb="4">创建新用户</Text>
        <HStack gap="3" flexWrap="wrap">
          <Input
            width="160px" placeholder="用户名" size="sm"
            value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
          />
          <Input
            width="180px" type="password" placeholder="密码（至少 8 位）" size="sm"
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            width="140px" placeholder="分组（可选，如班级）" size="sm"
            value={newGroup} onChange={(e) => setNewGroup(e.target.value)}
          />
          <HStack gap="1">
            {(['user', 'parent', 'editor', 'admin'] as CreateRole[]).map((role) => (
              <Button
                key={role}
                size="sm" variant={newRole === role ? 'solid' : 'outline'}
                colorScheme={newRole === role ? 'blue' : 'gray'}
                onClick={() => setNewRole(role)}
              >
                {ROLE_LABELS[role]}
              </Button>
            ))}
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

      {/* 批量导入 / 导出 */}
      <Box bg="white" borderRadius="md" borderWidth="1px" borderColor={gray200} p="5" mb="4">
        <Text fontSize="sm" fontWeight="semibold" color={gray800} mb="2">批量导入 / 导出</Text>
        <Text fontSize="xs" color={gray600} mb="3">
          表格四列：用户名，密码，角色（学生/家长/数据管理员/管理员），分组（可选）。
          Excel 里「另存为 CSV」即可上传；密码留空的账号系统自动生成，导入后请下载
          「导入回执」保存初始密码（账号密码加密存储，导出清单不含密码）。
        </Text>
        <HStack gap="3" flexWrap="wrap">
          <Button
            size="sm" variant="outline"
            onClick={() => downloadCsv('账号导入模板.csv', TEMPLATE_CSV)}
          >
            下载模板
          </Button>
          <Button
            size="sm" variant="outline" colorScheme="blue"
            onClick={() => fileRef.current?.click()}
          >
            {importFile ? `已选：${importFile.name}` : '选择 CSV 文件'}
          </Button>
          <input
            ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
          />
          <Button
            size="sm" background={schoolBlue} color="white"
            _hover={{ background: '#0f3a6e' }}
            disabled={!importFile} onClick={handleImport}
            loading={importing} loadingText="导入中..."
          >
            开始导入
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            导出账号列表
          </Button>
        </HStack>

        {importResult && (
          <Box mt="4" p="3" bg="#F0F7F1" borderRadius="md" borderWidth="1px" borderColor="#2e8b57">
            <HStack justify="space-between" flexWrap="wrap" gap="2">
              <Text fontSize="xs" color={gray800}>
                新建 {importResult.created.length} 个 · 跳过 {importResult.skipped.length} 个（已存在）
                {importResult.errors.length > 0 && ` · 错误 ${importResult.errors.length} 行`}
              </Text>
              {importResult.created.length > 0 && (
                <Button size="xs" background="#2e8b57" color="white" onClick={downloadReceipt}>
                  下载导入回执（含初始密码）
                </Button>
              )}
            </HStack>
            {importResult.skipped.length > 0 && (
              <Text fontSize="10px" color={gray600} mt="1">
                跳过：{importResult.skipped.slice(0, 6).map((s) => s.username).join('、')}
                {importResult.skipped.length > 6 && ' 等'}
              </Text>
            )}
            {importResult.errors.length > 0 && (
              <VStack gap="0" alignItems="start" mt="2">
                {importResult.errors.slice(0, 8).map((e, i) => (
                  <Text key={i} fontSize="10px" color={schoolRed}>
                    第 {e.line} 行 {e.username && `（${e.username}）`}：{e.error}
                  </Text>
                ))}
                {importResult.errors.length > 8 && (
                  <Text fontSize="10px" color={schoolRed}>
                    ……等共 {importResult.errors.length} 行错误
                  </Text>
                )}
              </VStack>
            )}
          </Box>
        )}
      </Box>

      {/* 用户列表 */}
      <Box bg="white" borderRadius="md" borderWidth="1px" borderColor={gray200} p="5">
        <HStack justify="space-between" mb="4" flexWrap="wrap" gap="2">
          <Text fontSize="sm" fontWeight="semibold" color={gray800}>
            用户列表（{shownUsers.length}/{users.length}）
          </Text>
          <HStack gap="2" flexWrap="wrap">
            <select
              aria-label="按分组筛选"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              style={{
                fontSize: '12px', padding: '4px 8px',
                border: `1px solid ${gray200}`, borderRadius: '6px', color: gray800,
              }}
            >
              <option value="">全部分组</option>
              {allGroups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <Button size="xs" variant="ghost" onClick={loadUsers} loading={loading}>
              刷新
            </Button>
          </HStack>
        </HStack>
        <HStack gap="1" mb="3" flexWrap="wrap">
          {(['all', 'user', 'parent', 'editor', 'admin'] as const).map((r) => (
            <Button
              key={r}
              size="xs" variant={roleFilter === r ? 'solid' : 'outline'}
              colorScheme={roleFilter === r ? 'blue' : 'gray'}
              onClick={() => setRoleFilter(r)}
            >
              {r === 'all' ? '全部' : ROLE_LABELS[r]}
            </Button>
          ))}
        </HStack>
        <VStack gap="2" alignItems="stretch">
          {shownUsers.map((u) => (
            <HStack
              key={u.username}
              p="3" borderRadius="md"
              borderWidth="1px" borderColor={gray200}
              justify="space-between"
            >
              <HStack gap="3">
                <Text fontSize="sm" fontWeight="medium" color={gray800}>{u.username}</Text>
                <Badge
                  bg={ROLE_BADGE_COLORS[u.role] || gray600}
                  color="white" fontSize="9px" px="2" rounded="full"
                >
                  {ROLE_LABELS[u.role as CreateRole] || u.role}
                </Badge>
                {u.group && (
                  <Badge bg="#ebf2fa" color={schoolBlue} fontSize="9px" px="2" rounded="full">
                    {u.group}
                  </Badge>
                )}
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
          {!loading && shownUsers.length === 0 && (
            <Text fontSize="xs" color={gray600}>没有符合条件的用户</Text>
          )}
        </VStack>
      </Box>

      {/* 原生 App 下载兜底：Android WebView 无下载处理器，提供复制出口 */}
      {csvFallback && (
        <Box
          position="fixed" inset="0" zIndex={1400} bg="blackAlpha.600"
          display="flex" alignItems="center" justifyContent="center" p="4"
          onClick={() => setCsvFallback(null)}
        >
          <Box
            bg="white" borderRadius="lg" p="5" width="100%" maxWidth="560px"
            maxHeight="80vh" overflowY="auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Text fontWeight="bold" color={gray800} mb="2">保存「{csvFallback.filename}」</Text>
            <Text fontSize="xs" color={gray600} mb="3">
              当前 App 内无法直接下载文件，请点「复制内容」后：电脑上粘贴到记事本，
              另存为 .csv 文件（或直接粘贴进 Excel）；也可以用电脑浏览器打开后台
              管理，点同一按钮即可直接下载。
            </Text>
            <textarea
              readOnly value={csvFallback.content} rows={6}
              onFocus={(e) => e.currentTarget.select()}
              style={{
                width: '100%', fontFamily: 'monospace', fontSize: '11px', padding: '8px',
                border: `1px solid ${gray200}`, borderRadius: '6px',
                color: gray800, background: '#f8fafc',
              }}
            />
            <HStack mt="3" justify="flex-end" gap="2">
              <Button size="sm" variant="outline" onClick={() => setCsvFallback(null)}>
                关闭
              </Button>
              <Button
                size="sm" background={copied ? '#2e8b57' : schoolBlue} color="white"
                _hover={{ background: copied ? '#25704a' : '#0f3a6e' }}
                onClick={copyFallbackCsv}
              >
                {copied ? '已复制 ✓' : '复制内容'}
              </Button>
            </HStack>
          </Box>
        </Box>
      )}
    </Box>
  );
}
