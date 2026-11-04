/*
 * 模型资源预取（2026-11-04「数字人形象加载总要点时间」优化）。
 *
 * 链路：应用一挂载就后台拉公开 /live2d-models/info → 默认模型（小石）的
 * model3.json → 贴图/moc3/物理等大文件逐个 fetch 进 HTTP 缓存。服务端对
 * 贴图已开 max-age=86400（server.py RevalidateStaticFiles 分级），预取命中
 * 后用户进对话页时模型可立即渲染，不再现场下载大文件；json/moc3 仍
 * no-cache（仅多一次 304），就地更新保护不变。
 *
 * 幂等：一次页面会话只跑一遍；全程静默失败（兜底/正常加载链路不受影响）；
 * 只在 window 存在（非 SSR）时执行。
 */
import { fetchLive2dModels } from "@/services/live2d-models-api";

let started = false;

export function preloadLive2dAssets(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  // 稍让路给首屏渲染（登录页/首页先出），再在空闲期预取
  const kick = () => {
    fetchLive2dModels()
      .then((characters) => {
        const character =
          characters.find((item) => item.id === "xiaoshi") ?? characters[0];
        const modelPath = character?.modelPath;
        if (!modelPath || !modelPath.toLowerCase().endsWith(".model3.json")) {
          return undefined;
        }
        return fetch(modelPath)
          .then((r) => (r.ok ? r.json() : null))
          .then((m3: { FileReferences?: Record<string, unknown> } | null) => {
            const refs = m3?.FileReferences;
            if (!refs) return;
            const files: string[] = [];
            if (typeof refs.File === "string") files.push(refs.File);
            const textures = refs.Textures;
            if (Array.isArray(textures)) {
              for (const tex of textures) {
                if (Array.isArray(tex)) files.push(...tex.filter((t) => typeof t === "string"));
                else if (typeof tex === "string") files.push(tex);
              }
            }
            if (typeof refs.Physics === "string") files.push(refs.Physics);
            const seen = new Set<string>();
            for (const f of files) {
              let abs: string;
              try {
                abs = new URL(f, new URL(modelPath, window.location.href)).href;
              } catch {
                continue;
              }
              if (seen.has(abs)) continue;
              seen.add(abs);
              // 不 await：全部在途即可；失败静默（正常加载会按需重取）
              fetch(abs).catch(() => {});
            }
          });
      })
      .catch(() => {
        // /info 拉不到（后端未就绪等）：静默放弃，正常加载链路兜底
      });
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(kick, { timeout: 4000 });
  } else {
    window.setTimeout(kick, 800);
  }
}
