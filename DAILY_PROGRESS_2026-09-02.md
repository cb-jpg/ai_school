# 今日工作进度报告

**日期**: 2026-09-02（凌晨，接续 09-01 全天会话）
**项目**: 安卓 AI 数字人中学问答系统（功能点.md 项目一）
**工作目录**: `D:\SRP\AI_school\Open-LLM-VTuber`
**上一份日志**: `DAILY_PROGRESS_2026-09-01.md`（09-01 全天：RAG 空库修复/缩放根因/hero 布局/管理后台抽屉化//libs 门禁）
**当前 HEAD**: `526e8d0`（已推送 GitHub main，仓库 `cb-jpg/ai_school`）
**部署状态**: 服务器（183.36.243.124:12393）Web bundle = HEAD 同步 ✅；**用户手机已装最新 APK** ✅

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

> ⏭️ 本文记录到这里为止。
