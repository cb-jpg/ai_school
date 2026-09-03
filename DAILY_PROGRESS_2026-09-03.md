# 今日工作进度报告

**日期**: 2026-09-03（晚间会话，接续下午中断的会话）
**项目**: 安卓 AI 数字人中学问答系统（功能点.md 项目一）
**工作目录**: `D:\SRP\AI_school\Open-LLM-VTuber`
**上一份日志**: `DAILY_PROGRESS_2026-09-02.md`
**接续说明**: 下午会话按已批准计划（App 登录门禁+角色区分+每账号独立历史+Hero 布局优化）实施到"dialog-box 美化"时撞 5 小时限额中断；本会话从该断点继续，完成收尾、部署与真机验证。

---

## ✅ 本会话完成

### 1. Hero 对话区收尾（断点续做）

- `dialog-box.tsx` 轻量美化：状态行/新对话+历史按钮改白色胶囊底衬（含 backdrop blur，提升在人物渐变上的可读性）；消息气泡 2xl 圆角+尾巴内角+行高 1.6；历史面板圆角；输入框 2xl 圆角+阴影
- `hero-landing.tsx`：手机端对话卡 maxWidth 收窄 92% 靠左，右侧留出人物空间

### 2. 质量关卡

- `npm run typecheck` 全过；`ruff check` 对比 HEAD：新增 5 处已清（UP045 自动修复；B008 为 FastAPI Depends 惯用法，存量风格）；`py_compile` 通过
- `npm run build:web` + `android:sync` + `gradlew assembleDebug` 全过

### 3. 服务端部署（183.36.243.124:12393）

- 13 个 .py 先备份（`*.bak-20260903-login`）再 scp：auth/knowledge-routes/chat_history_manager/routes/service_context/websocket_handler/4 个 agent/conversations×3
- 标准姿势重启，HTTP 200 恢复
- **新 e2e `scripts/login_e2e_test.py` 8 项全绿**：admin 登录 / 创建 user 账号 / user 登录+角色 / user 调知识库 API 403 / WS 伪造 user_token 握手层拒绝（服务端日志确认） / user WS 对话链路通（Thinking→audio） / 旧无 user_token 连接仍可用（共享历史兼容） / **历史文件落 `chat_history/hiyori_pro_001/users/teacher01/` 磁盘确认**
- 测试账号：`teacher01` / `Shishi@2026`（role=user，供演示普通使用者视角）

### 4. 🔴 重大发现：hero 人物初始站位偏移根因 + CDP 截图盲区再确认

- 现象：装机后 CDP 整页截图 hero 页"看不到人物"，连冷启动也如此
- 排查链：canvas/GL/模型/矩阵/RAF 全部正常 → GL spy 显示 drawElements 疯狂执行 → **帧内 readPixels/toDataURL 证明人物被完整画进帧缓冲**（位置在右缘）→ **CDP 整页截图在这台荣耀 WebView 上拍不到 GL 图层**（与 09-02 日志坑 #9 同源；本会话用 `scripts/cdp_fb_dump.py` 抓同帧 toDataURL 作为帧缓冲真值）
- **真根因（数学）**：竖屏画布下 Cubism 视图空间按【高度】等比映射，视图 X 实际只覆盖 **±0.475 屏宽**（不是 ±1 对应全宽）。下午会话定的 `HERO_OFFSET_X=0.42` 实际把人物中心放到 **~94% 屏宽**（半截出界），并非注释以为的 71%
- **修复**：`HERO_OFFSET_X 0.42→0.24`（中心 ≈75% 屏宽），常量注释补上坐标换算公式与 fb_dump 验证法
- 真机验证（fb_dump）：人物中心 74% 屏宽、头顶导航栏下方、脚尖探进对话卡顶部、完整无裁切 ✅

### 5. 触摸回归（fit 常量变更必测）

- `cdp_pinch_test.py 9222`：自动定位人物 → 双指捏合 0.52→1.56（上限 3×）**PASS**
- 新 `scripts/cdp_drag_locate_test.py`（自动定位版拖动回归，旧版用固定中心坐标已不适用新站位）：拖动 tx 0.24→-0.062 **PASS**
- 注意：adb forward 会随进程重启失效（指向旧 PID 时 connection refused），先 `forward --remove-all` 再按新 PID 重挂

### 6. 交付物

- **APK v1.1**：`D:\SRP\AI_school\APK导出\AI数字人-体验版-v1.1-20260903.apk`（已装用户手机，冷启动 fb_dump 验证通过）；`试玩说明.txt` 增补登录流程/账号隔离/v1.1 更新点
- **服务器 Web bundle**：`main-DVEatf_d.js`（含站位修复）已解压至 `~/ai_school/frontend`，index.html 引用确认（静态文件无需重启）

---

## 🧭 新增坑与工具（接 09-02 编号）

15. **竖屏下 hero 站位换算**：x_view=(2f−1)×0.475（f=目标屏宽比例）；0.42→94% 屏宽、0.24→75% 屏宽
16. **CDP 整页截图 GL 盲区的确定性验证法**：`scripts/cdp_fb_dump.py <port> <out.png>`（双 RAF 内 toDataURL 抓真值；注意偶发抓到已清空缓冲，多抓两次）
17. **WS 历史是前端驱动创建**：裸 WS 客户端只发 text-input 不会建历史（`context.history_uid` 为空直接跳过存储），e2e 必须先发 `create-new-history`（ack 类型 `new-history-created`）
18. **`websocket.close(1008)` 在 accept 前调用=HTTP 握手层拒绝**（客户端见 InvalidStatus 403，不是 WS close 帧），e2e 断言要按握手拒绝判

## ⏳ 剩余待办

1. **安全：admin 密码已随 DAILY_PROGRESS_2026-09-02.md 进公开仓库 git 历史**——建议尽快改密（服务器 `data/auth/`），并在文档中移除明文密码的书写惯例
2. 用户真机手感复检：登录页观感、hero 人物站位/大小是否满意（不满意调 HERO_* 三常量即可）
3. VAD 灵敏度调参；SSH 改密；句级气泡重叠合并显示
4. 摄像头作背景、URL 网页抓取录入联测
5. 功能点.md 项目二（数智化成长平台）未开始

---

# 📌 09-03 深夜增补（第二段会话）：用户四项反馈全修复（commit `2a60f46`）

用户反馈：①人物应在右侧中间、再放大；②左侧聊天框可以拉上去；③输入框拉通宽+麦克风居右+输入后发送键替换麦克风；④（普通用户）点导航栏后下拉菜单"无法完全覆盖"。

## ✅ 修复与实现

| 反馈 | 实现 |
|---|---|
| ① 人物右中放大 | HERO_FIT_FACTOR 0.52→0.62（约40%屏高）、HERO_CENTER_Y 0.46→0（垂直正中）、OFFSET_X 0.24 不变；fb_dump 真机验证人物中心≈75%屏宽/50%屏高 |
| ② 聊天卡上移 | hero-landing pt 42vh→88px（贴导航栏下方）；撤独立标题层，标题改在对话卡头部（dialog-box 移动端启用），描述文字手机端隐藏 |
| ③ 输入区重做 | 输入框与卡片同宽（pr 预留按键位）；右缘悬浮 40px 圆键：输入为空=麦克风（蓝/橙按录音态），有输入=发送键原地替换；切交换算 `hasInputText` |
| ④ 菜单覆盖不全 | 双重根因：a) 菜单 z20 与输入行 z20 同层且 DOM 靠后→输入行浮在菜单上；b) 菜单 absolute 受容器偏移（本机型 hero 容器 top≈-80）只到 762，屏底漏 32px 背景。修复=菜单改 `position:fixed` 铺满视口 + zIndex 40（盖导航栏30） |

## 🔑 新增坑（接编号）

19. **本机型 WebView absolute+100vh 的容器偏移**：hero 容器实测 top≈-80（背景图是 fixed 所以能铺满全屏，absolute 层到不了物理底）。全屏覆盖层一律用 `position:fixed`（真机 screencap 验证覆盖完整）
20. **Capacitor Activity 主题终身=manifest 的 Launch 主题**：窗口背景一直是启动图（不是 styles.xml 里 NoActionBar 的白！），WebView 表面以下的物理区露启动图。修复=MainActivity.onCreate `setTheme(R.style.AppTheme_NoActionBar)`（super.onCreate 前）。启动画面不受影响（starting window 用 manifest 主题）
21. **CDP 整页截图与 adb screencap 差异**：CDP 截图高 2581px(794 CSS)但物理屏 2700px(832 CSS)——看覆盖类问题必须 screencap
22. **React 受控 textarea 注入**：原生 value setter + dispatchEvent('input')（直接改 value 不触发 onChange）

## ⏳ 待办补充

- 用户复检：人物大小/位置手感、菜单覆盖、输入区切换是否满意
- 其余待办同上（admin 密码进仓库历史、VAD、句级气泡合并等）

---

**当前版本对应**: 服务器 Web bundle 与手机 APK = `2a60f46`（登录门禁+历史隔离+hero 站位/菜单/输入区修复）
