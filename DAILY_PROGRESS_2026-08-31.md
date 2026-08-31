# 今日工作进度报告

**日期**: 2026-08-31
**项目**: 安卓 AI 数字人中学问答系统
**工作目录**: D:\SRP\AI_school\Open-LLM-VTuber
**上一份日志**: `DAILY_PROGRESS_2026-08-30.md`（安卓端收尾待办 + 服务端安全待办）

---

## 📊 今日完成概况

| 事项 | 状态 |
|---|---|
| 服务端 access token 门禁（公网裸奔防护） | ✅ 部署上线并公网验证 |
| 安卓图标/启动屏生成（昨日待办 #1） | ✅ 87 个资源已生成 |
| 新 APK（图标 + 内置 token） | ✅ 2026-08-31 13:48 构建 |
| 前端 vite envDir 重大配置坑 | ✅ 修复 |
| Git 提交（昨日遗留 + 今日改动） | ✅ 4 个 commit（未 push） |
| 真机 USB 联调（昨日待办 #2） | ⏳ 待用户连手机 |

---

## ✅ 一、服务端安全防护：token 门禁（今日核心）

**背景**：服务器 183.36.243.124 无云防火墙、后端无鉴权，LLM/ASR/TTS/知识库/日志全部公网裸奔。用户明确要求做必要安全防护。

### 设计决策（下一个 Claude 不要推翻，除非用户要求）

- **机制**：共享访问令牌 `system_config.access_token`（conf.yaml），`AccessTokenMiddleware`（纯 ASGI，`server.py`）强制校验。
- **⚠️ 本仓库是公开仓库：真实令牌绝不写入任何 tracked 文件**（下方用 `<ACCESS_TOKEN>` 占位；真实值只在服务器 `~/ai_school/conf.yaml` 和本地 `frontend/.env.web.local`，两者都 gitignored）。
- **令牌来源（任一即可）**：`?token=` 查询参数 / `X-Access-Token` 头 / `Bearer` 头。查询参数优先解析（避免知识库后台的 Bearer JWT 干扰判断）。
- **管住**：`/client-ws`、全部 API 路由（知识库/角色配置/系统日志/campus/ASR/auth）、`/cache`（音频）、`/docs`。
- **放开**：SPA 壳 + `/assets/*`（浏览器书签流程需要，内部相对路径无法逐个带 token）、`/live2d-models`、`/bg`、`/avatars`、`/web-tool`。
- **为什么放开静态**：① 它们是惰性文件，无算力价值；② Live2D 走 Cubism WebSDK 内部 XHR 加载，token 透传要改 WebSDK，风险大；③ chat-history-panel 直接拼 `${baseUrl}/avatars/...`，历史遗留路径多，强改必碎。
- **防爆破**：token 为 24 字节随机（`<ACCESS_TOKEN>`），且已知即用，无需限流。

### 前端透传（`api-base.ts`）

`getAccessToken()` 三级优先：地址栏 `?token=`（读到即写 localStorage 并从地址栏抹除，防截图泄露）> localStorage `accessToken` > `import.meta.env.VITE_ACCESS_TOKEN`（安卓 APK 构建期注入）。`apiUrl()` 与 `wsService.connect()` 统一过 `withToken()`。

### 使用方式（重要）

- **浏览器**：`http://183.36.243.124:12393/?token=<ACCESS_TOKEN>`（首次打开后存 localStorage，之后可直接访问裸地址）
- **安卓 APK**：token 已内置（`frontend/.env.web.local` → `VITE_ACCESS_TOKEN`），无需用户输入
- **token 存放**：服务器 `~/ai_school/conf.yaml` 第 13 行；本地 `frontend/.env.web.local`（gitignored）；**都不要写进 .env.web（tracked）或 conf.yaml.example**

### 公网验证结果（全部通过）

```
GET /                          200（壳公开）
GET /assets/main-*.js          200
GET /live2d-models/.../hiyori_pro_t11.model3.json  200
GET /api/auth/me 无 token      401 {"error":"missing or invalid access token"}
GET /api/auth/me?token=正确    401 {"detail":"未登录"} ← 门禁放行、到达 auth 层
GET /api/auth/me?token=错误    401（门禁拦截）
GET /cache/test                401
GET /docs                      401
WS 无 token / 错 token         HTTP 403 握手拒绝
WS 带 token                    一轮对话：User input 进管道 + TTS audio payload ✅
```

验证脚本：`scripts/ws_token_e2e_test.py`（已提交，服务器上在 /tmp/）。

### 部署过程的坑（全部已踩平，复述防再踩）

1. **HF_HUB_OFFLINE**：重启后卡在 embedding 模型加载——HuggingFace Hub 向 hf-mirror.com 发在线校验，当天网络不通无限重试。**修复**：`start_server.sh` 加 `export HF_HUB_OFFLINE=1` + `TRANSFORMERS_OFFLINE=1`（模型已缓存，离线秒加载）。已提交备份 `start_server.sh.bak`。
2. **tar 路径 bug**：本地 `tar czf` 从 frontend/ 打包带了 `dist/` 前缀，在服务器 `~/ai_school/frontend/dist` 里解出了 `dist/dist/web`，导致启动时找不到 `frontend/dist/web`、静态目录降级挂载到 `frontend` 源码目录（`/` 404）。**正确姿势**：`cd ~/ai_school/frontend && tar xzf web-dist.tar.gz`（归档内路径是 `dist/web/...`）。
3. **ssh 后台挂起**：`ssh host "setsid nohup xxx &"` 挂住 120s——子进程继承 ssh 的 stdin 未脱离。**正确姿势**：`setsid nohup ... >> log 2>&1 < /dev/null &`。
4. **grep|head 假警报**：`grep -rl X dir | head -2 && echo LEAKED` 恒为真（管道退出码取 head）。验证类命令别用管道接 &&。

### 重启服务器标准姿势（更新）

```bash
ssh liucb@183.36.243.124
pkill -f 'run_server[.]py'   # 方括号防自杀（记忆里有）
sleep 2
setsid nohup ~/ai_school/start_server.sh >> ~/server_run.log 2>&1 < /dev/null &
sleep 2; echo relaunched
# 启动到监听约 40-90s（HF 离线后不再受网络拖累，但 load 86 时仍慢）
```

---

## ✅ 二、安卓端进展

### 图标/启动屏（昨日待办 #1 完成）

- `npm i -D @capacitor/assets`（sharp 的 install script 被 npm allow-scripts 拦了但实际可用）
- `npx @capacitor/assets generate --android` → **87 个资源**（自适应图标全密度 +  splash 全密度）写入 `frontend/android/app/src/main/res/`
- 源图 `frontend/assets/icon.png`(1024²) + `splash.png`(2732²) 已随仓库提交

### ⚠️ 重大配置坑修复：vite envDir（影响所有构建，务必了解）

`vite.config.ts` 设了 `root: src/renderer`，而 Vite 的 `envDir` 默认跟 `root` → **`frontend/.env.web` 从未被加载过**。此前"远程地址生效"其实是 `api-base.ts` 里硬编码 fallback 的巧合。后果链：

- `VITE_ACCESS_TOKEN` 打不进 APK（本次发现的直接原因）
- `VITE_API_BASE_URL=http://localhost:12393` 若哪天真生效会把 campus 知识接口打到 localhost

**修复**：`vite.config.ts` 显式 `envDir: __dirname`（指向 frontend/）；同时把 `.env.web` 的 `VITE_API_BASE_URL` 置空（同源语义），并加注释警告。验证：重建后 bundle 内 token×1、`183.36.243.124:12393`×1、可执行路径无 `http://localhost:12393`（仅剩 2 处惰性常量：URL 规范化比较集 + 设置页提示文案）。

### 新 APK（2026-08-31 13:48）

`frontend/android/app/build/outputs/apk/debug/app-debug.apk`（21MB，debug 签名），
内含：87 个图标资源 + 带 token 的 web bundle + 远程地址。

**完整构建命令序列**（下次迭代用）：

```bash
cd D:/SRP/AI_school/Open-LLM-VTuber/frontend
npm run android:sync        # = build:web（自动吃 .env.web.local 的 token）+ cap sync android
export JAVA_HOME="D:/SRP/android-tools/jdk-21.0.12.1+1"
cd android && ./gradlew assembleDebug   # 增量约 2 分钟
```

注意：`android/app/src/main/assets/public`（cap sync 产物）和 `app/build` 均 gitignored，
**从 git 干净 clone 构建 APK 必须先 `npm run android:sync` 再 gradle**。

---

## ✅ 三、Git 提交（4 个 commit，在本地 main，**未 push**）

| commit | 内容 |
|---|---|
| `a37fbfe` | fix: llama.cpp 空流修复（昨日遗留） |
| `48ed3d6` | feat: 服务端共享访问令牌门禁 |
| （第3个） | feat: 安卓 App（Capacitor）+ 前端地址集中化 + token 透传 + envDir 修复 |
| （第4个） | docs: 工作日志（08-30 + 08-31） |

**push 前注意**：确认没有把 token 提交进任何 tracked 文件（已核对：token 只在 conf.yaml[gitignored]、.env.web.local[gitignored]、服务器上）。push 到 github.com/chenxundaozu/Open-LLM-VTuber 需用户拍板。

---

## ⏳ 待办事项（下次继续，按优先级）

### 1. 真机 USB 联调（昨日待办 #2，今日未做——手机没连）

```bash
export PATH="$PATH:/d/SRP/android-tools/android-sdk/platform-tools"
adb devices          # 手机开开发者模式+USB调试后确认
adb install -r D:/SRP/AI_school/Open-LLM-VTuber/frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

验收清单（继承昨日）：
- [ ] 启动 → WS 连上远程后端（chrome://inspect 看 WebView console；若 403 说明 token 没带上，查 api-base getAccessToken）
- [ ] 文本对话全链路（服务器 CPU 推理慢属正常，load 86 时可能 20s+）
- [ ] Live2D 渲染/表情/口型/待机动画
- [ ] 麦克风权限 → VAD 收音 → ASR → TTS 播报 → 语音打断
- [ ] TTS autoplay、背景切换、专题页、管理后台登录（后台登录页现在需要先带 access token 进站）
- [ ] 断网重连、杀进程重开
- [ ] 图标/启动屏显示是否正常（本次新增）

### 2. 服务端（用户未再强调，但仍是风险）

- [ ] 服务器 SSH 密码修改（今天聊天里又出现过明文密码 kDwJ...；本机免密 key 可用，改密不影响本机）
- [ ] 若要进一步防护：门禁 token 轮换脚本、失败连接日志告警

### 3. 功能缺口（`D:\SRP\AI_school\数字人缺失功能点.txt`，今日未动）

- hero 页字幕同步显示（测试版本有，没移过来）
- 音量调节无效
- 知识库前端：网页资料（URL）添加；RAG 回答→Live2D 播报字幕联动验证
- 知识库后台功能测试（现在进后台需先带 access token）

---

## 🚀 下次打开 Claude 的恢复路径

1. 读本文件 + 记忆 `android-app-capacitor-plan`、`server-deployment-state`
2. 用户连手机 → 直接从待办 1（真机联调）开始
3. 改前端后重新出 APK：`npm run android:sync` → gradle（见上文命令序列）
4. 改服务端 py：scp 对应文件到 ~/ai_school 相对路径 → 按标准姿势重启 → 跑 `scripts/ws_token_e2e_test.py` 回归
