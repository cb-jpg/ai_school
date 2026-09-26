/**
 * 安全生成唯一 id。
 * crypto.randomUUID 只在 HTTPS/localhost 安全上下文存在——本站以
 * http://IP:端口 直连（非安全上下文），调用它直接 TypeError
 * （2026-09-22 用户 web 端实测：状态"在线"但发消息必崩即此因）。
 * 一切需要唯一 id 的地方统一走这里，禁止直接调 crypto.randomUUID。
 */
export function safeRandomId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
