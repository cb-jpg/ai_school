/**
 * 官网新闻/公告管理页（2026-09-29 三期提前落地）：
 * 后台发布官网首页新闻栏/公告栏与新闻中心页的内容——外链（公众号文章、
 * 教育局通知等，新窗口跳转）或自撰文字文章（官网 #/article/<id> 站内阅读）。
 * 发布后官网刷新即见，无需重新发版。
 * API：GET/POST/PUT/DELETE /api/portal/items（require_staff，写审计）。
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Box, VStack, HStack, Text, Button, Input, Badge, Textarea,
} from '@chakra-ui/react';
import { authFetch } from '@/services/auth';

const schoolBlue = '#1a4d8f';
const schoolRed = '#c41e3a';
const gray200 = '#e2e8f0';
const gray600 = '#475569';
const gray800 = '#1e293b';

interface PortalItem {
  id: string;
  kind: 'news' | 'announcement';
  title: string;
  date: string;
  category?: string | null;
  audience?: string | null;
  source?: string | null;
  url?: string | null;
  content?: string | null;
  pinned: boolean;
  published: boolean;
  created_by?: string;
}

type Kind = 'news' | 'announcement';
type Tab = 'all' | Kind;

const NEWS_CATEGORIES = ['校园新闻', '荣誉喜报', '媒体聚焦'];
const AUDIENCES = ['全体', '家长', '学生'];

// 表单态（编辑时整体回填）
interface FormState {
  kind: Kind;
  title: string;
  date: string;
  category: string;
  audience: string;
  source: string;
  url: string;
  content: string;
  pinned: boolean;
  published: boolean;
}

const EMPTY_FORM: FormState = {
  kind: 'news',
  title: '',
  date: '',
  category: '校园新闻',
  audience: '全体',
  source: '',
  url: '',
  content: '',
  pinned: false,
  published: true,
};

function itemToForm(it: PortalItem): FormState {
  return {
    kind: it.kind,
    title: it.title,
    date: it.date || '',
    category: it.category || '校园新闻',
    audience: it.audience || '全体',
    source: it.source || '',
    url: it.url || '',
    content: it.content || '',
    pinned: it.pinned,
    published: it.published,
  };
}

/** 条目形态标签：外链 / 文章 / 纯标题（后台只读展示用） */
function shapeLabel(it: PortalItem): string {
  if (it.url) return '外链';
  if (it.content) return '文章';
  return '标题';
}

function Toggle(
  { on, label, onClick, activeColor = schoolBlue }: {
    on: boolean; label: string; onClick: () => void; activeColor?: string;
  },
) {
  return (
    <Button
      size="sm"
      variant={on ? 'solid' : 'outline'}
      colorScheme={on ? 'blue' : 'gray'}
      background={on ? activeColor : undefined}
      color={on ? 'white' : undefined}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

export function PortalContentAdmin() {
  const [items, setItems] = useState<PortalItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  // 公众号同步（A路线）：按钮触发 POST /api/portal/sync-wechat
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  // 表单：editingId=null 新建；否则编辑该条
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authFetch('/api/portal/items');
      if (!response.ok) {
        const detail = await response.json().then((d) => d?.detail).catch(() => null);
        throw new Error(detail || `加载失败（${response.status}）`);
      }
      const data = await response.json();
      setItems(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const startEdit = (it: PortalItem) => {
    setEditingId(it.id);
    setForm(itemToForm(it));
    setError('');
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('标题不能为空');
      return;
    }
    setSaving(true);
    setError('');
    const payload: Record<string, unknown> = {
      kind: form.kind,
      title: form.title.trim(),
      date: form.date.trim(),
      category: form.kind === 'news' ? form.category : null,
      audience: form.kind === 'announcement' ? form.audience : null,
      source: form.source.trim() || null,
      url: form.url.trim() || null,
      content: form.content.trim() || null,
      pinned: form.pinned,
      published: form.published,
    };
    try {
      const response = await authFetch(
        editingId
          ? `/api/portal/items/${encodeURIComponent(editingId)}`
          : '/api/portal/items',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const detail = await response.json().then((d) => d?.detail).catch(() => null);
        throw new Error(detail || `保存失败（${response.status}）`);
      }
      startCreate();
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (it: PortalItem) => {
    if (!window.confirm(`确定删除「${it.title}」？官网将同步下线该条目。`)) {
      return;
    }
    setError('');
    try {
      const response = await authFetch(
        `/api/portal/items/${encodeURIComponent(it.id)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        const detail = await response.json().then((d) => d?.detail).catch(() => null);
        throw new Error(detail || `删除失败（${response.status}）`);
      }
      if (editingId === it.id) startCreate();
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSyncWechat = async () => {
    setSyncing(true);
    setSyncMsg('');
    setError('');
    try {
      const response = await authFetch('/api/portal/sync-wechat', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || `同步失败（${response.status}）`);
      }
      setSyncMsg(
        `同步完成：公众号拉到 ${data.total} 篇，新增 ${data.created}、更新 ${data.updated}、下架 ${data.hidden}`,
      );
      await loadItems();
    } catch (e) {
      setSyncMsg('');
      setError(e instanceof Error ? e.message : '同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const visible = items.filter((it) => tab === 'all' || it.kind === tab);

  return (
    <Box maxWidth="960px">
      <VStack gap="1" alignItems="start" mb="6">
        <Text fontSize="lg" fontWeight="bold" color={gray800}>官网新闻公告</Text>
        <Text fontSize="xs" color={gray600}>
          发布官网首页「学校新闻/公告与通知」两栏与新闻中心页的内容：贴外链（公众号文章、政府
          通知等，新窗口打开）或直接撰写文字文章（官网站内阅读页）。保存后官网刷新即见，无需重新发版。
        </Text>
      </VStack>

      {error && (
        <Box mb="4" p="3" bg="#FCE8E6" borderRadius="md" borderWidth="1px" borderColor={schoolRed}>
          <Text fontSize="xs" color={schoolRed}>{error}</Text>
        </Box>
      )}

      {syncMsg && (
        <Box mb="4" p="3" bg="#E8F5E9" borderRadius="md" borderWidth="1px" borderColor="#2DAFAD">
          <Text fontSize="xs" color="#1b7a70">{syncMsg}</Text>
        </Box>
      )}

      {/* 新建/编辑表单 */}
      <Box bg="white" borderRadius="md" borderWidth="1px" borderColor={gray200} p="5" mb="6">
        <HStack justify="space-between" mb="4">
          <Text fontSize="sm" fontWeight="semibold" color={gray800}>
            {editingId ? `编辑条目（${editingId}）` : '发布新内容'}
          </Text>
          {editingId && (
            <Button size="xs" variant="ghost" onClick={startCreate}>
              取消编辑，改为新建
            </Button>
          )}
        </HStack>

        <VStack gap="3" alignItems="stretch">
          <HStack gap="3" flexWrap="wrap">
            <Toggle on={form.kind === 'news'} label="学校新闻" onClick={() => set('kind', 'news')} />
            <Toggle on={form.kind === 'announcement'} label="通知公告" onClick={() => set('kind', 'announcement')} />
          </HStack>

          <Input
            placeholder="标题（必填）" size="sm"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />

          {form.kind === 'news' ? (
            <HStack gap="1" flexWrap="wrap">
              <Text fontSize="xs" color={gray600} minW="52px">分类</Text>
              {NEWS_CATEGORIES.map((c) => (
                <Toggle key={c} on={form.category === c} label={c} onClick={() => set('category', c)} />
              ))}
            </HStack>
          ) : (
            <HStack gap="1" flexWrap="wrap">
              <Text fontSize="xs" color={gray600} minW="52px">面向</Text>
              {AUDIENCES.map((a) => (
                <Toggle key={a} on={form.audience === a} label={a} onClick={() => set('audience', a)} />
              ))}
            </HStack>
          )}

          <HStack gap="3" flexWrap="wrap">
            <Input
              width="160px" placeholder="日期，如 2026-09-01" size="sm"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
            />
            <Input
              width="200px" placeholder="来源（选填，如 南方+/学校官微）" size="sm"
              value={form.source}
              onChange={(e) => set('source', e.target.value)}
            />
          </HStack>

          <Box>
            <Text fontSize="xs" color={gray600} mb="1">
              外链（选填，以 http:// 或 https:// 开头；填写后条目在官网新窗口打开该链接）
            </Text>
            <Input
              placeholder="https://mp.weixin.qq.com/s/..." size="sm"
              value={form.url}
              onChange={(e) => set('url', e.target.value)}
            />
          </Box>

          <Box>
            <Text fontSize="xs" color={gray600} mb="1">
              文章内容（选填；与外链都不填则条目仅展示标题。空行分段，官网站内阅读页展示）
            </Text>
            <Textarea
              placeholder={'正文第一段……\n\n正文第二段……'}
              size="sm" rows={8}
              value={form.content}
              onChange={(e) => set('content', e.target.value)}
            />
          </Box>

          <HStack gap="1" flexWrap="wrap">
            <Toggle
              on={form.published} label={form.published ? '已发布' : '未发布（官网隐藏）'}
              onClick={() => set('published', !form.published)}
            />
            <Toggle
              on={form.pinned} label="置顶" activeColor="#b7791f"
              onClick={() => set('pinned', !form.pinned)}
            />
            <Button
              size="sm" background={schoolBlue} color="white" ml="2"
              _hover={{ background: '#0f3a6e' }}
              onClick={handleSave} loading={saving} loadingText="保存中..."
            >
              {editingId ? '保存修改' : '发布'}
            </Button>
          </HStack>
        </VStack>
      </Box>

      {/* 条目列表 */}
      <Box bg="white" borderRadius="md" borderWidth="1px" borderColor={gray200} p="5">
        <HStack justify="space-between" mb="4" flexWrap="wrap">
          <HStack gap="1">
            {(['all', 'news', 'announcement'] as Tab[]).map((t) => (
              <Toggle
                key={t}
                on={tab === t}
                label={t === 'all' ? `全部（${items.length}）` : t === 'news' ? '新闻' : '公告'}
                onClick={() => setTab(t)}
              />
            ))}
          </HStack>
          <HStack gap="2">
            <Button
              size="xs"
              variant="outline"
              borderColor={schoolBlue}
              color={schoolBlue}
              onClick={handleSyncWechat}
              loading={syncing}
              loadingText="同步中..."
            >
              从公众号同步
            </Button>
            <Button size="xs" variant="ghost" onClick={loadItems} loading={loading}>
              刷新
            </Button>
          </HStack>
        </HStack>
        <VStack gap="2" alignItems="stretch">
          {visible.map((it) => (
            <Box key={it.id} p="3" borderRadius="md" borderWidth="1px" borderColor={gray200}>
              <HStack justify="space-between" gap="3" flexWrap="wrap">
                <HStack gap="2" flex="1" minW="0">
                  <Badge
                    bg={it.kind === 'news' ? schoolBlue : '#2DAFAD'}
                    color="white" fontSize="9px" px="2" rounded="full" flexShrink={0}
                  >
                    {it.kind === 'news' ? '新闻' : '公告'}
                  </Badge>
                  <Text fontSize="sm" color={gray800} lineClamp={1} title={it.title}>
                    {it.title}
                  </Text>
                </HStack>
                <HStack gap="1" flexShrink={0}>
                  <Button size="xs" variant="ghost" onClick={() => startEdit(it)}>编辑</Button>
                  <Button size="xs" variant="ghost" color={schoolRed} onClick={() => handleDelete(it)}>
                    删除
                  </Button>
                </HStack>
              </HStack>
              <HStack gap="2" mt="2" flexWrap="wrap">
                <Text fontSize="10px" color={gray600}>{it.date || '无日期'}</Text>
                <Text fontSize="10px" color={gray600}>
                  {it.kind === 'news' ? it.category || '校园新闻' : it.audience || '全体'}
                </Text>
                <Badge bg={gray200} color={gray600} fontSize="9px" px="2" rounded="full">
                  {shapeLabel(it)}
                </Badge>
                {it.pinned && (
                  <Badge bg="#b7791f" color="white" fontSize="9px" px="2" rounded="full">置顶</Badge>
                )}
                {!it.published && (
                  <Badge bg={schoolRed} color="white" fontSize="9px" px="2" rounded="full">未发布</Badge>
                )}
                {it.source && <Text fontSize="10px" color={gray600}>来源：{it.source}</Text>}
              </HStack>
            </Box>
          ))}
          {!loading && visible.length === 0 && (
            <Text fontSize="xs" color={gray600}>该分类暂无条目</Text>
          )}
        </VStack>
      </Box>
    </Box>
  );
}

export default PortalContentAdmin;
