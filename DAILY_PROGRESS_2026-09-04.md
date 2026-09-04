# 今日工作进度报告

**日期**: 2026-09-04（上午会话）
**项目**: 安卓 AI 数字人中学问答系统（功能点.md 项目一）
**工作目录**: `D:\SRP\AI_school\Open-LLM-VTuber`
**上一份日志**: `DAILY_PROGRESS_2026-09-03.md`
**当前 HEAD**: `031bd95`（已推送 GitHub main：**知识库切块死循环+表格切碎双修复**）
**部署状态**: 服务器 `document_processor.py` 已同步 `031bd95` 版本（备份 `document_processor.py.bak-20260904-chunkfix`）并重启，HTTP 200 ✅

---

## 🎯 本会话主题：学校数据清单 → RAG 知识库（上次会话遗留任务，已完成）

**结果**：`数据清单` 91 条结构化条目（82 万字）全部灌入服务器 `data/knowledge`，现共 **105 条**。
检索自检 6/6 语义正确命中；公网 WS 全链路 e2e **PASS**（has_context=True、音频正常）。
灌库全程走**常驻 run_server 的管理 API**（零额外内存），服务器余量全程 41G+、load≈3、PSI≈0%。

## ✅ 关键决策与实现

1. **灌库路径改为 HTTP API**（吸取 09-02 换页风暴教训）：不再在服务器起第二个 torch 进程跑
   `seed_knowledge_v2.py`，而是本地脚本 `scripts/knowledge_data/seed_via_api.py`（未跟踪目录，
   含凭据读取逻辑，密钥不进仓库）逐条 `POST /api/knowledge/create`，向量化在常驻进程内完成。
   幂等（按标题去重）+ 可续传 + 每 5 条健康检查。
2. **健康保险丝**（新增 PSI 指标）：`available<8G / load1>50 / swap>50% / io PSI full avg10>50%`
   任一超标立即中止；连续 2 次请求失败视为服务器卡死也中止。实测两次正确拒绝开窗
   （同事 yaowj 的 ollama 加载模型引发 IO 风暴时）。窗口自动重试循环（每 4 分钟）等到了空档，
   91 条仅 134 秒灌完。
3. **数据清洗**：docx 提取残留 HTML 实体（`&quot;` 等）与零宽字符，4 条 8 处清洗，备份
   `merged.json.bak-pre-clean`；09-02 中断前灌入的 2 条脏内容条目删掉重建。

## 🔴 重大发现：知识库切块死循环 bug（已修，commit `031bd95`）

`_chunk_text` 旧实现把全文 `re.sub(r'\s+',' ')` 压成一行再按 500 字窗口+句读回退切分：

1. **死循环**：窗口内最后一个句读符号落在 `[start, start+overlap]` 内时 `start` 停滞/倒退 →
   无限切块。**实测一条 948 字文本（"校园文化相关介绍"）把 run_server CPU 烧到 52%、
   内存吃到 34G 并冻结事件循环，全服务无响应**——上午第一次"服务器风暴"即此 bug 与
   同事 ollama 加载模型叠加所致。管理后台任何用户上传类似文本都会触发，属于公网服务
   级隐患。修复：保证每次前进 ≥1 字符。
2. **表格切碎**：换行被压成空格后，获奖登记类表格（一行一条记录）被切成 10 字级碎片。
   修复：按行聚合到 chunk_size，单行超长再句读切分（断点只落在 start+overlap 之后）。
   学校数据 91 条实测：**1851 块、平均 438 字、零重复**（修复前 5334 块+死循环）。

## 📋 09-04 上午事件时间线（排查记录，供复盘）

| 时间 | 事件 |
|---|---|
| 11:14 | 第 1 次灌库开跑，前 2 条秒级完成（当时机器健康，余量 30G） |
| 11:14+ | 第 3 条请求卡住 → 排查发现 run_server D 状态、RSS 34G、磁盘 PSI 90%、swap 换入 100MB/s（同事 yaowj 的 ollama 加载模型引发换页风暴 × 切块死循环叠放） |
| 11:26 | 杀 run_server → 内存立即释放（used 50G→31G），风暴解除，标准姿势重启恢复 |
| 11:34 | 第 2 次灌库 → 又卡在第 3 条：这次是 R 状态烧 CPU（余量 24G、IO 正常）→ **定位切块死循环** |
| 11:45 | 本地复现+修复+全量回归（1851 块零重复），部署+重启 |
| 12:00 | 第 3 次尝试被 PSI 保险丝正确拒绝（同事又一波实验，load 116） |
| 12:20 | 窗口打开，第 4 次灌库 134 秒完成 91/91，失败 0 |
| 12:30 | 检索自检 6/6 + 公网 WS e2e PASS |

## 📌 09-04 午后增补：App"正在连接服务器"卡死修复（登录态过期无出口）

**现象**：用户 App 一直"正在连接服务器"。服务器本身健康（HTTP 200），日志显示
`/client-ws` 握手被 403 拒：`invalid or expired user_token`，每 15s 无限重试。

**根因（两层）**：
1. 登录 JWT 有效期 `TOKEN_TTL_SECONDS = 12h`（auth.py:32）——09-03 登录的 admin 到 09-04 午后已过期
2. **前端缺陷（主因）**：`AuthContext` 只处理 HTTP 401（authFetch → kb-unauthorized → 回登录页），
   WS 握手 403 不走这条路；且浏览器 WS API 不暴露 HTTP 状态码，403 拒绝与网络故障在
   `onclose(1006)` 上无法区分 → App 永远卡在重连。**影响所有用户，每 12h 必踩**。

**修复**（`websocket-service.tsx`）：`onclose` 且本地带 `kb_token` 时，30s 节流地用
`authFetch('/api/auth/me')` 探活——401 则自动清凭证+广播 kb-unauthorized → 回登录页；
网络不通则交给既有重连。e2e：`scripts/cdp_auth_expire_test.py` 注入伪造过期登录态，
实测凭证被清、回登录页 **PASS**。

**交付**：Web bundle（`main-DX5-3dH3.js`）已部署服务器；APK 已重构建并装回用户手机
（重装清了旧登录态，登录页正常，用户重登即恢复）。

## 🔑 新增坑与结论（接 09-03 编号）

23. **`/api/auth/login` 本身也过访问令牌门禁**：不带 `X-Access-Token` 的登录请求收到的是
    门禁 401（不是"用户名或密码错误"），两个错误都会以 401 呈现，看 body 区分。
24. **`/proc/pressure/io` 的 PSI** 是比 load/内存更灵敏的"机器在抖"信号：09-04 两次风暴
    PSI full avg10 都 >85%，而 load/内存当时看起来还行。重活前查 PSI。
25. **run_server RSS 膨胀到 34G 的真相**：不是 22 小时泄漏，是卡死请求在死循环里无限追加
    chunks。诊断进程异常时先看它在算什么（R 状态烧 CPU=代码死循环；D 状态=IO/换页），
    `~/ai_school/.venv/bin/py-spy` 可用（uvx 不存在）。
26. **共用服务器"窗口"是波动的**：同事实验潮（ollama 加载、smart-meeting、pcb 任务）会让
    PSI/load 飙几分钟到几十分钟，过了就好。自动重试循环（间隔 4 分钟）比人守着更靠谱。
27. **teacher01 账号密码与 09-03 记录不符**（登录返回"用户名或密码错误"，账号本身存在），
    需要时让 admin 在用户管理里重置。
28. **WS 握手 403 在浏览器侧不可辨别**（WS API 不给 HTTP 状态码）——要区分"认证失败"和
    "网络故障"只能旁路 HTTP 探测（`/api/auth/me`）。凡是"WS 拒绝后要有动作"的需求都此法。
29. **headless Edge 自选 target 要按 URL 过滤**：Edge 会开 edge://sync-confirmation-dialog
    等内部页，`/json` 里第一个 page 未必是目标站。

## ⏳ 剩余待办

1. **admin 密码进公开仓库 git 历史的改密待办仍未做**（09-03 遗留，本轮日志已不再写明文）
2. run_server 配 systemd 自拉起（本轮再次验证后端"消失"风险，仍未做）
3. 登录 JWT TTL 仅 12h（auth.py `TOKEN_TTL_SECONDS`）：前端死路已修（过期自动回登录页），
   但学校演示场景若嫌一天一登麻烦可酌情调长
4. 图片存档类条目（相机命名照片）是占位文本，需要人工整理或 OCR 后补充
5. URL 网页抓取录入联测（`POST /api/knowledge/add-url` 仍待测）
6. 摄像头作背景联测；VAD 灵敏度调参；句级气泡重叠合并显示
7. 用户复检：App 登录→对话问校情（现应有真实数据支撑），观察检索命中率
8. 功能点.md 项目二（数智化成长平台）未开始

## 🧭 下次打开 Claude 的恢复路径

1. 读本文件 + 记忆 `shared-server-heavy-job-rules`（已更新 PSI/死循环教训）、`server-deployment-state`
2. 灌库/补数据：改 `scripts/knowledge_data/merged.json` → `python seed_via_api.py seed`
   （幂等续传）；清洗模式 `clean`；检索自检 `search`
3. 服务器侧如需重建某条：先 `DELETE /api/knowledge/{id}` 再跑 seed（脚本支持 RESET_TITLES 机制）

---

**当前版本对应**: 服务器 = 仓库 `031bd95`（document_processor.py 已同步；其余 .py 无改动）
