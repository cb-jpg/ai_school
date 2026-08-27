/**
 * Live2D 模型列表服务
 * 从后端 /live2d-models/info 拉取可用角色列表，替代前端硬编码。
 * 会话内缓存一次结果；模型目录变更后可调用 invalidateLive2dModelsCache() 强制刷新。
 */

export interface Live2dCharacter {
  /** 模型目录名，同时作为唯一标识 */
  id: string;
  /** 展示名（取自 model_dict.json 描述的名称部分，缺省用目录名） */
  name: string;
  /** 展示描述（取自 model_dict.json） */
  description: string;
  /** 列表 UI 的预览图标 */
  preview: string;
  /** .model3.json 的请求路径（后端返回的真实路径） */
  modelPath: string;
  /** 角色头像路径（模型目录内提供时才有） */
  avatarUrl: string | null;
  /** 以下为切模型时要透传给 Live2D 组件的动作/表情参数 */
  kScale: number;
  initialXshift: number;
  initialYshift: number;
  idleMotionGroupName?: string;
  emotionMap: Record<string, number>;
  tapMotions?: Record<string, Record<string, number>>;
}

interface RawCharacterEntry {
  name: string;
  avatar?: string | null;
  model_path?: string;
  description?: string;
  k_scale?: number;
  initial_xshift?: number;
  initial_yshift?: number;
  idle_motion_group_name?: string;
  emotion_map?: Record<string, number>;
  tap_motions?: Record<string, Record<string, number>>;
}

/** 按目录名关键词选一个预览图标；未知模型给通用图标 */
const PREVIEW_ICONS: Array<[RegExp, string]> = [
  [/mao/i, '🐱'],
  [/shizuku/i, '🌸'],
  [/hiyori/i, '👩‍🏫'],
];

function previewForModel(name: string): string {
  for (const [pattern, icon] of PREVIEW_ICONS) {
    if (pattern.test(name)) return icon;
  }
  return '🎭';
}

/** "Mao Pro - 猫咪角色" → { name: 'Mao Pro', description: '猫咪角色' } */
function splitDescription(raw: string): { name: string; description: string } {
  const [first, ...rest] = raw.split(' - ');
  return rest.length > 0
    ? { name: first.trim(), description: rest.join(' - ').trim() }
    : { name: '', description: raw.trim() };
}

export async function fetchLive2dModels(): Promise<Live2dCharacter[]> {
  // 注意：该接口在 routes.py 中注册时无 /api 前缀；vite 代理与生产部署均会转发 /live2d-models
  const response = await fetch('/live2d-models/info');
  if (!response.ok) {
    throw new Error(`获取角色列表失败（${response.status}）`);
  }
  const data = await response.json();
  const entries: RawCharacterEntry[] = Array.isArray(data?.characters)
    ? data.characters
    : [];

  return entries.map((entry) => {
    const display = entry.description ? splitDescription(entry.description) : null;
    return {
      id: entry.name,
      name: display?.name || entry.name,
      description: display?.description || '',
      preview: previewForModel(entry.name),
      modelPath: entry.model_path || `/live2d-models/${entry.name}/`,
      avatarUrl: entry.avatar ?? null,
      // 后端取不到参数时沿用模型默认值 0.5（Provider 会乘以 2）
      kScale: entry.k_scale ?? 0.5,
      initialXshift: entry.initial_xshift ?? 0,
      initialYshift: entry.initial_yshift ?? 0,
      idleMotionGroupName: entry.idle_motion_group_name,
      emotionMap: entry.emotion_map ?? {},
      tapMotions: entry.tap_motions,
    };
  });
}

// ---- 会话级缓存 ----

let cache: Promise<Live2dCharacter[]> | null = null;

export function getLive2dModels(): Promise<Live2dCharacter[]> {
  if (!cache) {
    cache = fetchLive2dModels().catch((error) => {
      cache = null; // 失败不缓存，下次重试
      throw error;
    });
  }
  return cache;
}

export function invalidateLive2dModelsCache(): void {
  cache = null;
}
