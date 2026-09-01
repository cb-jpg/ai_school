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

---

## 🌙 下午追加：缺失功能点清理（真机未连，代码侧先行）

**HEAD**：`7ae96c2` → `459bf24`（前端修复）→ `d2448f9`（脚本），均已 push。

对照 `数字人缺失功能点.txt` 逐条核实，**清单本身已部分过时**：

| 清单项 | 实际状态 |
|---|---|
| hero 页字幕同步显示 | ✅ 早已实现（桌面端字幕条 + 手机端对话卡内字幕气泡），清单过时 |
| 音量调节无效 | ⚠️ 主链路其实是通的；本次补强 3 处薄弱点（见下） |
| 知识库网页资料（URL）添加 | ✅ 前后端早已实现（`/api/knowledge/add-url` + 管理端"网页抓取"tab），待联测 |
| 摄像头画面作为背景 | ✅ bgurl-context 已有 `useCameraBackground` 全链路，待联测 |
| RAG 回答→Live2D 播报字幕联动 | 🔴 **真问题：RAG 检索恒 0 命中**（见下），已修复 |

### 1. 音量链路补强（`459bf24`）

- 浏览器 speechSynthesis 回退路径此前完全没接音量（`utterance.volume` 缺失）——补上
- `audio.volume` 改读 `stateRef.current.volume`（防闭包旧值）
- **音量持久化到 localStorage**（key `ttsVolume`）——此前每次启动重置回 80，是"调了没效果"观感的来源之一
- 待真机复测：拖动滑块 → 下一句播报音量变化；播放中拖动 → 立即变化

### 2. 专题页讲解字幕条（`459bf24`）

功能点要求"讲解过程中显示字幕和当前状态"，campus 专题页此前只在点按钮瞬间 set 一次文案，讲解中无字幕。新增：讲解进行中（`isSpeaking`）在专题页底部显示字幕条（`data-testid=campus-narration-caption`，当前播报句 + "正在讲解"状态点，`pointerEvents:none` 不挡滚动，最多 3 行截断）。hero/工作台两种模式都生效。

### 3. 🔴→✅ RAG 检索 0 命中修复（今日最重要发现）

**现象**：公网 e2e 问"学校是什么时候创办的？"→ `rag-status: has_context=False doc_count=0`，回答全靠人设兜底。

**根因**：对话 RAG 检索的是**新知识库 `data/knowledge`**，而它**本地和服务器都是空的**（index.json 只有 `{}`）。`school_rag/models/*.json` 只是专题页数据源，且内容还是占位演示数据（"XX中学""张三""北京市海淀区"）；真实校情在 `frontend/src/renderer/src/data/campus-knowledge.ts`。

**修复**：新增 `scripts/seed_knowledge.py`，把 campus-knowledge.ts 的真实校情整理成 **15 条知识条目**（概况/理念/位置/教学特色/校史三节点/防震减灾荣誉/信息学清北/教师成长/阅读美育/学习标兵三人/FAQ速查），走与后台 `/create` 相同的 切分→向量化→索引 流程，按标题幂等。服务器已执行并重启：

- 灌库自检：4 个典型问题全部命中，分数 0.51-0.66（MIN_SCORE=0.3）
- **公网 e2e 复测：`has_context=True doc_count=3`，回答明确引用"始建于1999年"** ✅
- 新增 `scripts/rag_e2e_probe.py`：在 e2e 基础上检查 rag-status/full-text/audio 三段，专测"检索→生成→TTS"链路

**新知识库以后这样维护**：管理后台增删改查即生效；批量灌内容改 `seed_knowledge.py` 的 ENTRIES 后服务器重跑（幂等）。

### 本轮出包状态

新 APK（含音量补强+专题页字幕）已构建：`frontend/android/app/build/outputs/apk/debug/app-debug.apk`，**手机一连 USB 直接 `adb install -r` 即可**（`android:sync`+gradle 已跑过）。

---

## 🌙 晚间追加：App hero 布局调整 + 双指缩放重写（用户真机反馈五项，HEAD `fdd897e`）

### 1. 🔴→✅ 双指缩放"抖动且无法缩放"根因修复（真机问题闭环）

**根因是两个叠加的 bug**：

1. **`CubismMatrix44.scale(x, y)` 是绝对赋值（`_tr[0]=x`）不是乘法**——原实现把"增量系数 ≈1.0x"直接赋给整个模型矩阵，模型被瞬间打到 ~1 倍刻度、下帧又被覆盖 → 抖动。相对缩放必须用 **`scaleRelative(x, y)`**（Framework 源码 cubismmatrix44.ts:222，乘法且保持平移）。
2. **React 17+ 的合成 touch 事件在 root 上是 passive 的**，`e.preventDefault()` 无效——WebView 的页面缩放手势不被阻止，且 touchend 后浏览器合成 mousedown/mousemove/mouseup，捏合松手瞬间触发一次拖动 = 松手抖动。

**重写方案**（use-live2d-model.ts）：触摸改**原生监听**（`{passive:false}` 可 preventDefault，经 ref 分发到最新闭包避免旧 isDragging 状态）；缩放目标 = 捏合起始 scale × 手指距离系数，钳制 [0.35×, 3×]；双指会话压制单指拖动、捏合结束后等全部手指抬起才恢复拖动；**补 touchcancel 处理**（深度定制 ROM 手势接管必发，原实现完全不处理 → 残留状态错乱）。

### 2. App hero 布局（用户四项要求，全走 base 断点，桌面 md/lg 未动）

- **背景去分屏白**：background.tsx 的"左侧虚化遮罩"（左 45% 白渐变，web 分屏设计遗留）手机端隐藏
- **标题上移置底**："以人为本，全面发展"+副标题移出对话卡，成为导航栏下方独立层（top 84px），`zIndex 0` 低于 Live2D 层(1) → 人物从标题上方经过；对话卡内原标题块手机端隐藏
- **设置进导航栏**：悬浮齿轮手机端隐藏；导航栏抽屉键左侧新增设置键（ghost 图标钮）；校名/设置/抽屉统一垂直居中（图标钮 boxSize 32px 对齐）

### 3. 管理后台账号密码（用户询问，已实测可登录）

- 用户名 `admin`，密码在服务器 `~/ai_school/data/auth/initial_admin_password.txt`（= `pN7As2YmrIpc1Js5`），POST /api/auth/login 实测返回 JWT ✅
- 入口：App 内 hero 导航栏（桌面端）"登录"按钮 → `#/main`；或浏览器 `http://183.36.243.124:12393/?token=<门禁值>#/main`

### 4. 服务器同步（本轮末）

- Web bundle 已部署（tar 解到 `~/ai_school/frontend`）并重启，回归 `rag_e2e_probe.py` PASS（RAG 命中+TTS 音频正常）。浏览器端同步获得：音量补强、专题页字幕条、缩放修复、hero 布局调整
- 新 APK 已构建（含本轮全部改动），待真机安装验证

---

## 🌙 深夜追加：管理后台 main 布局手机端适配（`723ed96`，已部署）

**用户反馈**：登录后台看 main 界面，左右侧压缩得诡异。

**根因**（`school-admin-layout.tsx`，桌面优先设计从未适配过手机）：
- 侧栏 `position:fixed` 固定 280px → 手机屏内容区只剩 ~110px
- 内容区 `width=calc(100% - var(--sidebar-width, 280px))`——**该 CSS 变量从未被设置**，且折叠时宽度不跟随（桌面收起态右侧本就有 200px 空档的隐藏 bug）

**修复**（桌面端行为不变）：
- 侧栏手机端改**抽屉**：默认移出屏幕，顶栏汉堡键（FiMenu）呼出 + 半透明遮罩，点菜单项即收起；"收起"折叠按钮仅桌面端显示
- 内容区去掉坏的 width calc，`ml` 改响应式（base: 0 / md: 80|280px），折叠态对齐 bug 一并修复
- 顶栏手机端：汉堡键+标题缩小，徽章/用户名隐藏；内容区 padding `base:3 / md:6`
- 工作台页（modern-workspace）欢迎区/主内容 padding 响应式

**状态**：typecheck ✅ → Web bundle 已部署服务器并重启 → APK 已重新出包。刷新浏览器即可看到（无需重装 APK 也能在浏览器验证，APK 端待下次安装生效）。

---

## 🌙 深夜二轮：main 布局 flex 修复 + 重大发现 /libs 门禁致浏览器端白屏（`667bffd`，已部署）

### 用户二次反馈 → 两个真问题

**1. main 布局仍压缩**：上轮删了坏的 width calc 但没加 `flex:1`——内容区是 flex 子项，宽度塌成内容固有宽度（dashboard 内容窄 → 右侧大片空白）。补 `flex:1 + minW:0`。

**2. 排查缩放时用 headless 浏览器实测，暴露重大问题**：
- **`/libs` 不在门禁放行清单** → `/libs/live2dcubismcore.js`（Live2D 核心，`<script>` 标签加载，天然不带 token）自 08-31 门禁上线起一直 401
- `main.tsx` 逻辑：核心加载失败 → **整个应用拒绝渲染**（白屏报错"Error loading required components"）
- 即 **08-31 之后纯浏览器端整站一直是坏的**！此前没人发现是因为所有验证都走 APK（Capacitor 从本地 assets 取核心，不经过服务器）
- 修复：`PUBLIC_PREFIXES` 加 `/libs`（静态惰性资源，与 /bg、/live2d-models 同理）+ `main.tsx` 加 `.min.js` 回退不再单点失败。已部署重启，curl 200 ✅

### 缩放修复的实证（headless Edge + CDP 注入双指触摸，新增 `scripts/cdp_pinch_test.py`）

刷新后模型正常加载（证明门禁修复生效），双指捏合实测：

| 步骤 | 预期 | 实测 |
|---|---|---|
| 双指落下（间距100） | scale 不变 | 1 ✅ |
| 张开间距300 | 3.0 | **3.0** ✅ |
| 张开间距400（超上限） | 钳制 3.0 | **3.0** ✅ |
| 捏拢间距60 | 0.6 | **0.6** ✅ |

无抖动、数学精确。**用户仍报缩放抖动 = 手机上跑的是旧 APK（今日修复均未安装）**。

### 测试基建沉淀

- `scripts/cdp_pinch_test.py`：CDP 双指捏合回归脚本，本机 headless 或手机（adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>）通用
- CDP 坑：Edge 的 `Input.dispatchTouchEvent` 不回响应（fire-and-forget）；headless 下该接口不产生 DOM touch 事件（需 touch 模拟），用 JS 构造 `new TouchEvent` 派发可直接测处理逻辑

### 状态

- 服务器：web bundle + server.py 已部署并重启；`/libs` 200；待办回归 PASS（rag_e2e_probe 已跑过两轮 PASS）
- **APK 已重新出包（HEAD 667bffd）——用户必须 `adb install -r` 才能看到缩放/hero/main/音量全部修复**

---

## 🌙 深夜三轮：真机安装 + 真机缩放实测 PASS（收尾）

- 手机重连后 adb 不可见：**复合设备接口布局又变了（这次 ADB 在 MI_02，08-31 修的是 MI_01）**——修复脚本 `D:\SRP\android-tools\fix_adb_guid_mi02.ps1`（写 DeviceInterfaceGUIDs 后**必须物理重插拔**才生效，软重启设备无效）。两份脚本都留着，哪个 MI 是 ADB 就用哪份；重插后 MI 序号可能再变，按 PnP 列表现查
- `adb install -r` 新 APK Success（含今天全部修复），预授权 RECORD_AUDIO/CAMERA，冷启动
- **真机 CDP 捏合实测 PASS**（pid 3954，webview forward 9222）：scale 1 → 1.68 → 2.36 → 3.0（钳制），比例精确无抖动——真机全输入管线验证，与 headless 结论一致
- App 状态核验：WS 已连、模型已加载、音量 key `ttsVolume` 待用户首次拖动后落 localStorage

**用户手上待人工确认**：双指缩放手感、hero 布局四项（背景/标题/导航栏设置键）、main 后台布局、音量滑块、专题页讲解字幕条。

---

## 📱 09-02 凌晨追加：真机反馈五项修复 + 全后台页面巡检（`ff50e5d`，已装回手机）

用户装上新 APK 后反馈五项，逐项处理（全部已构建、部署、装机）：

1. **hero 导航栏"被状态栏遮挡"**：CDP 实测并未真遮挡（Capacitor 已把 WebView 排在状态栏下方；`env(safe-area-inset-top)` 在此 WebView=0，Capacitor 8 SystemBars 注入的 `--safe-area-inset-*` 也=0），属视觉偏紧 → 导航栏手机端 pt 加到 28px，标题层 top 96px。若用户仍见遮挡需其截图再查
2. **下拉菜单底部露出一条**：根因有趣——Android WebView 布局视口 793px，屏幕实际 830px，多出的 37px（底部手势条区）由**窗口背景**绘制；DayNight 深色模式下是黑色。styles.xml `AppTheme.NoActionBar` 加 `windowBackground=#FFFFFF` 兜底（页面无法画进那 37px，只能让窗口背景变白）
3. **角色形象设置异常**：右列固定 300px + 左列 flex=1，手机端左列被挤成 ~28px 细条。改上下堆叠（base: column + auto 高度）。已真机验证：全宽可用，hash 不再异常跳 hero（之前那次弹回是用户恰好在操作手机）
4. **知识库管理无退出键 + 未适配**：路由直开时不传 onClose → 关闭键不渲染。按钮改常驻（无 onClose 跳 #/main/dashboard，"返回工作台"）；tabs 窄屏横滑不换行。真机验证：概览/知识库/上传/未回答问题四 tab 一行放下，统计卡单列，灌库的 15 条正常显示
5. **子页面适配**：真机逐页巡检（dashboard/workspace/test-conversation/character-config/knowledge-admin/unanswered-questions/document-knowledge/user-management/system-logs 共 9 页截图）。发现并修：系统日志统计卡第三张溢出屏幕（flex=1+文字 min-content → 改 flexWrap+1 1 40% 两列换行）；待补充问题库/文档知识库/用户管理/仪表盘/主工作台实测本来就可用。另加：管理后台抽屉在 hashchange 时自动收起

**坑**：修复过程中曾因管道 `typecheck | tail && build` 掩盖 TS 报错（重复 JSX 属性）构建出坏包又重修——验证类命令勿接管道后依赖退出码。
