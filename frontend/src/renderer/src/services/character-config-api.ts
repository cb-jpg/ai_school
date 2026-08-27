/**
 * 角色配置服务 —— 对接后端 /api/character/config
 * 使角色名称/人设真正写入后端配置并作用于 LLM system prompt，
 * 替代此前"只存 localStorage、对 AI 零影响"的假保存。
 * 接口需要管理员/editor 登录，经 authFetch 注入 token。
 */

import { authFetch } from './auth';

export interface BackendCharacterConfig {
  /** 角色名称（conf.yaml 的 character_config.character_name） */
  character_name: string;
  /** 角色人设 / 系统提示词（character_config.persona_prompt） */
  persona_prompt: string;
  /** 配置项显示名，仅供参考 */
  conf_name?: string;
}

export async function fetchBackendCharacterConfig(): Promise<BackendCharacterConfig> {
  const response = await authFetch('/api/character/config');
  if (!response.ok) {
    const detail = await response
      .json()
      .then((data) => data?.detail)
      .catch(() => null);
    throw new Error(detail || `读取角色配置失败（${response.status}）`);
  }
  return response.json();
}

export async function saveBackendCharacterConfig(
  characterName: string,
  personaPrompt: string
): Promise<string> {
  const response = await authFetch('/api/character/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      character_name: characterName,
      persona_prompt: personaPrompt,
    }),
  });
  if (!response.ok) {
    const detail = await response
      .json()
      .then((data) => data?.detail)
      .catch(() => null);
    throw new Error(detail || `保存角色配置失败（${response.status}）`);
  }
  const data = await response.json();
  return data?.message || '已保存';
}
