/**
 * 官网新闻/公告数据源（2026-09-29 后台管理化）：
 * 后台「官网新闻公告」页发布的内容经 GET /api/portal/content 下发，
 * 官网刷新即见——不再需要重建+OTA。拉取失败或为空时回退到
 * data/portal-content.ts 的内置占位数组（断电兜底，官网永不空窗）。
 *
 * 条目三态：url=外链（新窗口）；无 url 有 has_article=站内阅读页
 * （#/article/<id>）；都没有=纯标题不可点（与历史占位行为一致）。
 */
import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from './api-base';
import {
  PORTAL_ANNOUNCEMENTS,
  PORTAL_NEWS,
} from '@/data/portal-content';

export interface PortalNewsItem {
  id: string;
  title: string;
  date: string;
  category?: string;
  url?: string;
  source?: string;
  /** 无外链但有自撰正文 → 站内 #/article/<id> 可读 */
  has_article?: boolean;
}

export interface PortalAnnounceItem {
  id: string;
  title: string;
  date: string;
  audience?: string;
  url?: string;
  source?: string;
  has_article?: boolean;
}

interface PortalContentResponse {
  news: PortalNewsItem[];
  announcements: PortalAnnounceItem[];
}

// 静态占位数据兜底（同构形状；无 has_article → 渲染为不可点，行为同旧版）
const FALLBACK_NEWS: PortalNewsItem[] = PORTAL_NEWS.map((n) => ({ ...n }));
const FALLBACK_ANNOUNCEMENTS: PortalAnnounceItem[] = PORTAL_ANNOUNCEMENTS.map(
  (a) => ({ ...a }),
);

export function usePortalContent(): PortalContentResponse {
  const [data, setData] = useState<PortalContentResponse>({
    news: FALLBACK_NEWS,
    announcements: FALLBACK_ANNOUNCEMENTS,
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/portal/content'));
      if (!res.ok) return;
      const body = (await res.json()) as PortalContentResponse;
      if (!body || (!body.news?.length && !body.announcements?.length)) return;
      setData({
        news: body.news?.length ? body.news : FALLBACK_NEWS,
        announcements: body.announcements?.length
          ? body.announcements
          : FALLBACK_ANNOUNCEMENTS,
      });
    } catch {
      // 网络/后端不可达：保持内置兜底数据
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return data;
}

/** 条目点击目标：外链 url 优先，否则有自撰正文走站内阅读页，否则 null（不可点） */
export function portalItemHref(
  item: Pick<PortalNewsItem, 'url' | 'id' | 'has_article'>,
): string | null {
  if (item.url) return item.url;
  if (item.has_article) return `#/article/${item.id}`;
  return null;
}
