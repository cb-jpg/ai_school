/**
 * 官网新闻/公告数据源（2026-09-29 后台管理化）：
 * 后台「官网新闻公告」页发布的内容经 GET /api/portal/content 下发，
 * 官网刷新即见——不再需要重建+OTA。拉取失败或为空时回退到
 * data/portal-content.ts 的内置占位数组（断电兜底，官网永不空窗）。
 *
 * 条目三态：url=外链（新窗口）；无 url 有 has_article=站内阅读页
 * （#/article/<id>）；都没有=纯标题不可点（与历史占位行为一致）。
 */
import { useEffect, useState } from 'react';
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

// 模块级缓存（2026-09-30 优化）：官网页间切换（首页↔新闻↔栏目）此前每次都
// 先渲染内置占位数组再等 fetch 回来整列替换——肉眼可见的"闪一下"（用户反馈
// 页面卡顿的观感之一）。改为：有缓存先秒出缓存，60s 内不重复请求；请求共享
// 同一 in-flight promise；失败保持旧数据（无缓存才落兜底数组）。
const PORTAL_CACHE_TTL_MS = 60_000;
let portalCache: { data: PortalContentResponse; at: number } | null = null;
let portalInflight: Promise<PortalContentResponse | null> | null = null;

function fetchPortalContent(): Promise<PortalContentResponse | null> {
  if (portalInflight) return portalInflight;
  portalInflight = (async () => {
    try {
      const res = await fetch(apiUrl('/api/portal/content'));
      if (!res.ok) return null;
      const body = (await res.json()) as PortalContentResponse;
      if (!body || (!body.news?.length && !body.announcements?.length)) {
        return null;
      }
      const data: PortalContentResponse = {
        news: body.news?.length ? body.news : FALLBACK_NEWS,
        announcements: body.announcements?.length
          ? body.announcements
          : FALLBACK_ANNOUNCEMENTS,
      };
      portalCache = { data, at: Date.now() };
      return data;
    } catch {
      // 网络/后端不可达：保持现有数据（无缓存则为内置兜底）
      return null;
    } finally {
      portalInflight = null;
    }
  })();
  return portalInflight;
}

export function usePortalContent(): PortalContentResponse {
  // 有缓存直接以缓存为首帧（不闪占位数据），否则先兜底静态数组
  const [data, setData] = useState<PortalContentResponse>(
    () => portalCache?.data ?? {
      news: FALLBACK_NEWS,
      announcements: FALLBACK_ANNOUNCEMENTS,
    },
  );

  useEffect(() => {
    if (portalCache && Date.now() - portalCache.at < PORTAL_CACHE_TTL_MS) {
      return; // 缓存还新鲜：不请求，首帧即最新
    }
    let alive = true;
    void fetchPortalContent().then((fresh) => {
      if (alive && fresh) setData(fresh);
    });
    return () => {
      alive = false;
    };
  }, []);

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
