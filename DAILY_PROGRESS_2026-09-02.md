# 今日工作进度报告

**日期**: 2026-09-02（凌晨 + 上午 + 下午三段，接续 09-01 全天会话）
**项目**: 安卓 AI 数字人中学问答系统（功能点.md 项目一）
**工作目录**: `D:\SRP\AI_school\Open-LLM-VTuber`
**上一份日志**: `DAILY_PROGRESS_2026-09-01.md`（09-01 全天：RAG 空库修复/缩放根因/hero 布局/管理后台抽屉化//libs 门禁）
**当前 HEAD**: `1026c73`（**已推送 GitHub main**：`d8c6fb2` 上午美化 → `a331086` 下午穿透改造 → `1026c73` 知识库详情滚动；仓库 `cb-jpg/ai_school`）
**部署状态**: 服务器（183.36.243.124:12393）Web bundle = `1026c73`（index.html→main-CM_UylhD.js）✅；**用户手机已装最新 APK**（17:00 前后安装）✅

---

## 📊 本轮（09-01 晚 → 09-02 凌晨）完成总览

| 事项 | commit | 验证 |
|---|---|---|
| 音量链路补强（speechSynthesis 回退/stateRef/持久化 `ttsVolume`） | `459bf24` | 待真机复测 |
| 专题页讲解字幕条（isSpeaking 时底部显示当前播报句+状态） | `459bf24` | 待真机复测 |
| **RAG 空库修复**：`data/knowledge` 本地/服务器都为空 → `scripts/seed_knowledge.py` 灌 15 条真实校情 | `d2448f9` | 公网 e2e `has_context=True doc_count=3` ✅ |
| **双指缩放根因修复**（scale 是绝对赋值须用 scaleRelative + 触摸改原生监听 + touchcancel） | `fdd897e` | **headless CDP + 真机 CDP 双实测 PASS**（1→1.68→2.36→3.0 钳制，0.6 捏拢精确） |
| hero 布局：背景去分屏白遮罩、标题移到导航栏下（zIndex 低于人物）、设置键进导航栏 | `fdd897e` | 真机截图 ✅ |
| 管理后台侧栏抽屉化 + 内容区 flex 撑满 + `/libs` 门禁放行（**浏览器端曾整站白屏**） | `723ed96`/`667bffd` | 真机 + curl 200 ✅ |
| 五项真机反馈：导航栏呼吸空间/菜单底漏(windowBackground)/角色设置堆叠/知识库返回键/系统日志卡片换行 | `ff50e5d` | 真机 9 页截图巡检（系统日志最后一张因手机锁屏未拍到，代码已过检） |

## ✅ 真机巡检结论（9 个管理后台页面，全部截图核验）

dashboard / workspace / test-conversation / character-config(堆叠修复后) / knowledge-admin(加返回键+tabs横滑) / unanswered-questions / document-knowledge / user-management / system-logs(卡片换行修复) —— **全部手机可用**。待补充问题库里能看到灌库前记录的 2 条未命中问题（功能闭环正常）。

## 🔑 关键技术结论（下一手必读，详见记忆 `android-app-capacitor-plan`）

1. **Cubism `CubismMatrix44.scale(x,y)` 是绝对赋值**，相对缩放必须 `scaleRelative(x,y)`；Live2D 矩阵操作一律走 `getLAppAdapter().getModel()`
2. **React 17+ 合成 touch 事件是 passive**（preventDefault 无效）→ 手机端触摸用原生监听 `{passive:false}`（见 `use-live2d-model.ts`，经 ref 分发最新闭包）；必须处理 touchcancel
3. **门禁放行清单** `server.py PUBLIC_PREFIXES`：/assets、/live2d-models、/bg、/avatars、/web-tool、**/libs**（少了 /libs 会让浏览器端 Live2D 核心 401，且 main.tsx 核心失败即拒渲染 = 整站白屏；APK 因本地取核心不暴露）
4. **此 WebView 视口怪癖**：`100vh`=布局视口 793px，屏幕实际 830px，底部 37px 手势条区由**窗口背景**绘制（styles.xml `windowBackground=#FFFFFF` 兜底）；`env(safe-area-inset-top)` 与 Capacitor 8 注入的 `--safe-area-inset-*` 均=0（WebView 已被父视图 padding 排到状态栏下方）→ 顶部遮挡问题先 CDP 截图实测再动 CSS
5. **固定宽度列 + flex=1 列手机端必挤爆** → 一律 `flexDirection={{base:'column',md:'row'}}` 堆叠
6. **adb 荣耀 X60 Pro**：复合设备 MI 序号重插后会变（ADB 这次 MI_02，上次 MI_01）；修复脚本 `D:\SRPandroid-tools\fix_adb_guid_mi02.ps1`（+同目录 fix_adb_guid.ps1），**必须物理重插拔生效**，软重启设备无效
7. **CDP**：Edge 的 `Input.dispatchTouchEvent` 不回响应（发后不等）；headless 不产生 DOM touch 事件 → 用 JS `new TouchEvent` 派发可测处理逻辑；真机 WebView 的 dispatchTouchEvent 是全管线可用的
8. 验证勿写 `cmd | tail && next`（管道掩盖退出码，曾带病构建）

## 🛠️ 常用命令（全套）

```bash
# 出包（改前端后）
cd frontend && npm run android:sync
export JAVA_HOME="D:/SRP/android-tools/jdk-21.0.12.1+1"
(cd android && ./gradlew assembleDebug)
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# 服务器 Web 端更新（改前端后同步）
cd frontend && tar czf /tmp/web-dist.tar.gz dist/web && scp /tmp/web-dist.tar.gz liucb@183.36.243.124:/tmp/
ssh liucb@183.36.243.124 "cd ~/ai_school/frontend && tar xzf /tmp/web-dist.tar.gz"
# 改了 server.py 才需重启：pkill -f 'run_server[.]py' → setsid nohup ~/ai_school/start_server.sh >> ~/server_run.log 2>&1 < /dev/null &（等 40-90s）

# 真机 CDP 调试
adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof com.shishi.ai)
# 脚本（都在 scripts/）：
#   cdp_pinch_test.py <port>   双指缩放回归（真机 9222 / headless 9333）
#   rag_e2e_probe.py <ws_url>  RAG 链路（rag-status/full-text/audio 三段）
#   ws_token_e2e_test.py       门禁+对话基础回归
#   seed_knowledge.py          知识库灌库（幂等，服务器上跑）
```

## ⏳ 剩余待办（优先级序）

1. **用户肉眼复检**（我修完但最后截图因手机锁屏没拍到）：下拉菜单底部、角色形象设置、系统日志统计卡；以及缩放手感/hero 布局/音量滑块/专题页字幕条
2. **hero 导航栏**：用户报"被状态栏遮挡"，实测未遮挡（已加呼吸空间）。若用户坚持看到遮挡 → 要截图，按机型深查（可能涉及 MagicOS 沉浸式状态）
3. 弱网重连、杀进程重开实测（重连代码在，从未实测）
4. 摄像头作背景、网页抓取(URL)录入——代码已在，真机/后台联测
5. VAD 灵敏度调参（环境噪声易触发"聆听中"）
6. 服务器 SSH 改密（用户暂缓中）
7. 功能点.md 二期（教师学生数智化成长平台）尚未开始

## 🧭 下次打开 Claude 的恢复路径

1. 读本文件 + `DAILY_PROGRESS_2026-09-01.md` + 记忆 `android-app-capacitor-plan`、`server-deployment-state`
2. 手机连 USB → `adb devices`；看不到设备按上面第 6 条处理
3. 手机在手上即可用 9222 CDP 直接驱动页面实测（登录 admin / pN7As2YmrIpc1Js5）
4. 服务器当前与仓库 HEAD 同步，无需部署；改 server.py 才需重启+回归

---

# 📌 09-02 上午增补（第二段会话）

## ✅ 待办清单核销（接凌晨"剩余待办"编号）

1. **肉眼复检三项全部补拍确认**（CDP `scripts/cdp_shot.py` + adb 全屏）：
   - 下拉菜单底部：全屏截图白色覆盖到手势条区，**无漏色** ✅
   - 角色形象设置：数字人选择卡片竖排堆叠正常 ✅
   - 系统日志统计卡：本轮已重做（见下），不再横滑裁切 ✅
   - hero 导航栏"被状态栏遮挡"：全屏截图确认标题/齿轮/汉堡完整可见，未遮挡 ✅
2. **断网重连实测 PASS**：`svc wifi/data disable` → UI 黄条"正在连接服务器..."+红点"等待连接..." → logcat 确认指数退避 1s→2s→4s→8s→15s 封顶 → `enable` 后自动重连"在线" → CDP 发消息，RAG 回复正确（1999 年创办等真实校情）✅
3. **杀进程重开实测 PASS**：force-stop → am start → 冷启动直接"在线"、聊天记录持久化恢复、模型存活 ✅
4. **顺带验证**：麦克风按钮 CDP 误触后 VAD/ASR 链路正常工作（报"语音过于简短"属无真人发声的预期行为）

## 🎨 用户口头需求（09-02 上午）→ 已全部实现并真机验证（commit `d8c6fb2`）

| 需求 | 实现 |
|---|---|
| 聊天框上方渐变 | 消息卡手机端 `linear-gradient(180deg,transparent 0,rgba(255,255,255,.9) 64px,#FFF 112px)`，去边框 |
| "在线/+/历史"行置于人物之下 | Live2D 层 z1→**z15**（高 42vh→**56vh**），对话卡片 z10→**z5**（md 恢复 10） |
| 人物可移动范围增加 | canvas 加高到 56vh，拖动实测 ty 0→-0.81 生效 |
| 输入仍可用 | 输入框/mic/发送/自动停止开关单提 **z20**，textarea hit-test PASS |
| main 页文章知识库+系统日志美化 | 文档知识库：上下堆叠（原固定 360px 左列手机端详情完全不可见）+55% 限高+刷新键完整+图标徽章；系统日志：统计卡 2 列网格（md 5 列）+标题徽章+StatCard 图标块 |
| 删除两个未开发选项 | school-admin-layout 删「播报语音设置」「语音&模型参数设置」，无路由/引用残留，DOM 验证通过 |

**层级代价（用户已认可）**：人物盖住状态行时，+/历史按钮点不到（canvas 矩形拦截触摸），拖开人物即恢复。

## 🔑 新增坑与工具

9. **CDP 截图 WebGL 呈模糊/失焦态是捕获限制**——看真实效果必须 `adb exec-out screencap -p`（本次人物 Hiyori 实为清晰渲染）
10. **Chakra v3 无 `noOfLines`**，用 `lineClamp`；React 受控输入注入用原生 setter+input 事件；`.click()` 后需等 ~1s 动画再截图
11. **APK 覆盖安装会清 WebView localStorage** → 管理后台登录态丢失需重登（admin/pN7As2YmrIpc1Js5）；聊天历史在服务器不受影响
12. 新工具：`scripts/cdp_shot.py <port> <#route> <out.png> ["js"]`（导航+截图+JS 注入巡检，注意 Git Bash 需 `MSYS_NO_PATHCONV=1` 且输出路径不能是 /tmp）；`scripts/cdp_drag_test.py`（触摸拖动+可点性回归）
13. 测试残留清理：CDP 发的测试消息会进服务器 `chat_history/hiyori_pro_001/`，本次已通过 UI 删除 2 条测试会话（凌晨 2 条旧会话是用户自己的，保留）
14. 09-02 中午 GitHub 直连被重置且本机无代理——**push 待网络恢复重试**

## ⏳ 更新后的剩余待办

1. ~~git push 重试~~（`a331086` 已推）
2. 穿透模式用户真机手感复检（人物拖动/捏合/消息滚动共存）
3. 摄像头作背景、URL 网页抓取录入联测（URL API=POST /api/knowledge/add-url 可服务器端先测）
4. VAD 灵敏度调参；SSH 改密（用户暂缓）
5. 句级气泡重叠（最后一句在整段气泡尾部+单独气泡重复显示，待优化合并显示）
6. 功能点.md 项目二（数智化成长平台）未开始

---

# 📌 09-02 下午增补（第三段会话）：用户三项反馈全修复

用户反馈：①测试对话页 web 端有人物 app 端没有；②文档知识库没法往下滑；③hero 人物上半截能拖进渐变区、中间就不行了（进不了对话框）。

## ✅ 修复与实现（commit `a331086`，已 push）

| 问题 | 根因 | 修复 |
|---|---|---|
| ③ 人物进不了对话框 | canvas 只有 56vh，模型画不出画布 | **全屏穿透**：容器 100vh+pointerEvents:none，触摸监听挂 window，hitTest 命中模型才 preventDefault 拖动，其余触摸全放行（消息滚动/按钮/输入不受影响）。实测拖到对话框中间 PASS |
| ① 测试对话页无人物 | SPA 路由往返替换 DOM `<canvas>`，**GL 单例绑着旧节点**，渲染画到已卸载元素 | 重挂载时 hook url effect（prevModelUrlRef=null 自然触发）全链重建；删掉会双重初始化的 rebind effect；`lappdelegate.run` 加 `s_instance!==this` 旧循环自灭（render 崩溃 8 次→0） |
| ② 知识库滑不动 | `maxHeight` 不约束 flex 子项，内容撑开被 overflow:hidden 裁切且无滚动 | maxHeight→**height 60vh**，内部滚动生效 |
| 附带：测试对话页布局 | 固定 400px 聊天列把人物区挤成 0（铁律7再现） | 手机端上下堆叠：人物 40vh + 全宽聊天面板 |

## 🔑 下午新增技术结论（下一手必读）

15. **SPA 路由切换 Live2D 空白的根因**：`LAppGlManager` 的 canvas/gl 是**模块级变量**，绑定只在 getInstance 构造时发生；换 DOM canvas 必须走 releaseInstance→重新 getInstance。重建职责收敛在 hook url effect 一处（重挂载 prev=null 自然触发），**不要**另加挂载重建 effect（双重初始化互相踩，症状为时序性空白/崩溃）
16. **全屏穿透触摸模式**：window 监听 + hitTestAt 门控 + 会话化 preventDefault（touchActiveRef/startHitRef）；双指启动条件是"任一指命中"（真实捏合两指近乎同时落下）。hook 暴露 `window.__live2dHitTest` 供 CDP 脚本定位人物（cdp_pinch_test.py 已用来自动找人物）
17. **模型初始站位适配**：必须等"模型就绪+canvas 位图非默认300x150"后先 `LAppDelegate.onResize()` 重算投影再设 scale/ty，否则投影按过渡尺寸算 → 大小错乱。校准值（Hiyori/荣耀X60Pro）：绝对 scale 0.30 ≈ 17% 屏高、ty 0.56 ≈ 中心 24% 屏高；换其他角色若大小不合适改 HERO_FIT_FACTOR/HERO_CENTER_Y 两个常量
18. **CDP 合成触摸（Input.dispatchTouchEvent）不触发浏览器原生滚动**——放行路径（pd=false+touch-action auto）只能证明链路正确，滚动真机手感需用户肉眼复检；真机 dispatchTouchEvent 拖动/缩放可用
19. 上午的"状态行按钮被人物盖住点不到"代价已被穿透模式根治：现在只有摸到模型本体才拦截

## 📌 09-02 傍晚增补：文档知识库详情区滑不动（第二轮反馈）

**根因**：详情卡 `flex=1` 被压缩到列表卡（60vh）的剩余空间约 200px，头部即占满，切分结果区 `flex=1 overflowY:auto` 高度归零——"学校信息速查框里还有好多内容但滑不动"。
**修复**（`1026c73`）：手机端详情卡 flex:none 自然高度、切分结果区与 chunk pre（maxHeight 300px 仅桌面）取消内滚，**整页滚动**接管；桌面端双栏内部滚动不变。
**验证**：滚动容器主内容区 1220/706、列表卡内部独立 1049/309；JS 滚底截图确认切分结果全文完整渲染，与 web 端（headless Edge 桌面截图比对）内容一致。

## ⏳ 最新剩余待办

1. 穿透模式用户真机手感复检（拖动/捏合/滚动共存；Shizuku/Mao 角色的初始大小未单独校准）
2. 文档知识库详情区手机端整页滚动手感复检（本次修复）
3. 摄像头作背景、URL 网页抓取录入联测
4. VAD 灵敏度调参；SSH 改密（用户暂缓）
5. 句级气泡重叠优化
6. 功能点.md 项目二（数智化成长平台）未开始

> ⏭️ 本文记录到这里为止。
