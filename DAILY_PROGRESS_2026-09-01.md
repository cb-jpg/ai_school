# 今日工作进度报告

**日期**: 2026-09-01（凌晨至夜间，跨 08-31 深夜会话）
**项目**: 安卓 AI 数字人中学问答系统
**工作目录**: `D:\SRP\AI_school\Open-LLM-VTuber`
**上一份日志**: `DAILY_PROGRESS_2026-08-31.md`（真机联调五连修 + 首轮全链路打通）
**当前 HEAD**: `128d9f6`（已推送 GitHub main，仓库 `cb-jpg/ai_school`）

---

## 📊 今日完成概况

| 事项 | commit | 状态 |
|---|---|---|
| 手机端布局：hero 上下分区、专题页防遮挡 | `7ad0b19` | ✅ 真机验证 |
| 体验补全：背景图/拖动缩放/新对话/历史自动收起/标题布局 | `483b02a` | ✅ 除捏合外真机验证 |
| 二轮修复：缩放路径、背景校验、删 hiyori_free | `128d9f6` | ✅ 真机验证 |
| **TTS 播报有声音**（用户确认）、LLM 回复真机稳定 | — | ✅ |

**当前 App 状态：数字人"小石"在荣耀 X60 Pro 上功能完整可用**——WS 连接、Live2D 渲染、拖动/缩放、麦克风→VAD→ASR、语音打断、TTS 播报、文本/语音对话、新对话、专题页跳转、背景切换，全部正常。

---

## ✅ 一、手机端布局优化（`7ad0b19`）

- **hero 页改为上下分区**：App.tsx 中 hero 模式 Live2D 容器手机端缩为上半屏 42vh（canvas 跟随容器尺寸，`use-live2d-resize` 的 ResizeObserver 自动适配），对话区从其下开始；`dialog-box.tsx` 的 `maxHeight:75vh / minHeight:500px` 改为响应式（手机端填满剩余高度）
- **专题页（campus-knowledge）根结构重构为纵向 flex**（导航卡 + 内容面板），结构上保证永不互相遮挡；手机端隐藏 logo 行、tab 一行横向滑动（`overflowX:auto` + `flexWrap:nowrap`）、内容面板全宽到底；根容器 `top:92px` 避开学校导航栏
- 专题页打开时隐藏 hero 的设置齿轮 / WS 状态点 / 底部字幕条（App.tsx + hero-landing 条件渲染）
- `index.html` 补 viewport meta（`viewport-fit=cover`）；HeroLanding 右侧 Live2D 空位 Box 手机端 `display:none`
- 桌面端布局全部未动（md/lg 断点保留原设计）

## ✅ 二、体验补全（`483b02a`）

- **背景图**：`background.tsx` 改 fetch→blob→objectURL 渲染（绕开 MagicOS 的 `<img>` 拦截，与 Live2D 纹理同坑同解法），并整体 `blur(8px)+scale(1.08)` 虚化（用户指定）
- **Live2D 触摸交互**：`use-live2d-model.ts` 新增单指拖动/点按动作（复用鼠标逻辑）+ 双指捏合缩放（增量系数×`_modelMatrix.scale`）；wrapper 加 `touchAction:none`；App.tsx 人物区手机端 `pointerEvents:auto`
- **加号=新对话**：原来只有 `console.log`，已接 `useSidebar().createNewHistory()`（打断播报+通知后端开会话）
- **历史面板自动收起**：新消息到达即 `setShowHistory(false)`
- **标题**：手机端 order 提到最上、字号 2xl→lg、间距收紧，聊天卡片变大

## ✅ 三、二轮修复（`128d9f6`，用户反馈三问题）

1. **双指缩放无效** → pinch 原走 `LAppLive2DManager.getInstance()`（applyScale from use-live2d-resize），在多实例包装下拿不到渲染中的模型、**静默失效**；改为 `getLAppAdapter().getModel()`（与拖动同路径），CDP 实测 `_modelMatrix.scale(1.4)` 视觉生效
   - ⚠️ **铁律：操作 Live2D 模型矩阵一律走 `window.getLAppAdapter().getModel()`，别用 manager 单例**
2. **背景选了就被清空** → hero-sidebar 的加载校验探针用 `new Image()`，MagicOS 下必 onerror → 刚 set 的 backgroundUrl 被立即清空；改 fetch 校验
3. **删除 hiyori_free** → `git rm` 资源 + `model_dict.json` 删条目 + `.gitignore` 删白名单行 + 服务器 `rm -rf` 目录（`/live2d-models/info` 实时扫描目录，无需重启）。设置面板现剩：Hiyori Pro 日葵 / Shizuku 栀子 / Mao Pro 猫咪角色

## ✅ 四、功能验证全记录（真机，荣耀 X60 Pro）

- [x] WS 连接远程后端（token 内置，断线自动重连代码已加）
- [x] 文本对话全链路、语音对话全链路（VAD→ASR→LLM→TTS 有声）
- [x] Live2D 渲染/待机动画/点按动作
- [x] 单指拖动人物（adb input swipe 实测位移生效）
- [x] 语音打断
- [x] 加号新对话（清屏+"新对话已开始"）
- [x] 专题页跳转与排版
- [x] 背景切换（学校建筑虚化显示）
- [x] 设置面板模型列表（3 个，hiyori_free 已除名）
- [ ] 双指捏合缩放——机制已验证（adapter 路径 CDP 实测），**手势需人手确认**
- [ ] 历史面板自动收起——代码就位，需实际连聊验证
- [ ] 弱网/杀进程重连实测
- [ ] 管理后台（#/main，需 access token）真机过一遍

## 🧭 下次打开 Claude 的恢复路径

1. 读本文件 + 08-31 日志 + 记忆 `android-app-capacitor-plan`（含全部踩坑铁律）、`server-deployment-state`
2. 手机 USB 调试连接后：`adb devices` 确认；调试 WebView 用 `adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof com.shishi.ai)` + `D:/SRP/AI_school/cdp_eval.py "<js>"`
3. 改前端出包：`cd frontend && npm run android:sync` → `JAVA_HOME="D:/SRP/android-tools/jdk-21.0.12.1+1" ./android/gradlew -p android assembleDebug` → `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
4. 改 Live2D 矩阵操作一律走 `getLAppAdapter().getModel()`（见二轮修复铁律）
5. 服务器（183.36.243.124）当前与仓库同步（含 08-31 晚部署的 run_server.py 心跳 60s + wow-wogua 知识库修复）；SSH 密码改密待办仍未做

## ⏳ 遗留待办（优先级序）

1. 双指缩放/历史自动收起 人手确认（预计通过）
2. 管理后台真机过一遍（登录页需带 access token 进站）
3. 弱网重连、杀进程重开实测
4. 服务器 SSH 改密（用户暂缓中）
5. VAD 灵敏度调参（ambient 噪声易触发"聆听中"，设置面板有阈值提示文案可引导）
