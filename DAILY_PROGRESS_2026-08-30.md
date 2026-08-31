# 今日工作进度报告

**日期**: 2026-08-30
**项目**: 安卓 AI 数字人中学问答系统
**Git 仓库**: https://github.com/chenxundaozu/Open-LLM-VTuber.git
**工作目录**: D:\SRP\AI_school\Open-LLM-VTuber
**结束时间**: 2026-08-30

---

## 📊 今日完成概况

### 主要成果
- ✅ 服务器部署完成并对外提供服务（`http://183.36.243.124:12393`）
- ✅ 端到端对话链路验证通过（曾静默故障，已定位根因并修复）
- ✅ 修复 llama.cpp 空流 bug（`_normalize_messages` 补丁，待提交）
- ✅ 安卓端 Capacitor 方案落地：**首个 app-debug.apk 构建成功（21MB）**
- ✅ 本机安卓工具链从零搭建完成（JDK 21 + Android SDK + adb）

### 整体进度
- **Web 端**: 95% ✅ 已部署上线
- **服务器部署**: 100% ✅ 今日完成
- **安卓端**: 代码与构建 100%，**真机联调 0%**（下一步）

---

## ✅ 今日完成任务

### 1. 服务器部署（183.36.243.124）
- ✅ `~/ai_school` 部署完成，服务监听 `0.0.0.0:12393`，公网可访问（HTTP 200）
- ✅ LLM 接入服务器本机 llama.cpp（`localhost:11435`，qwen2.5-7b-instruct Q4 GGUF）
- ✅ ASR=sherpa-onnx（本地）、TTS=edge-tts（联网）
- ✅ `start_server.sh` + setsid 脱离会话启动，日志 `~/server_run.log`
- ✅ 启动慢是正常现象（知识库/embedding 模型加载约 40-60 秒）

### 2. 对话链路排障与修复
- ✅ 修复 LLM 配置残留（conf.yaml 11434 → 11435，重启服务生效）
- ✅ 定位并修复"对话 1 秒静默结束、零输出"bug：
  - 根因：上游管道将 user 消息转成多模态列表格式 `[{'type':'text',...}]` 且重复发送；
    llama-cpp-python 收到列表 content 会**静默返回空流**（无报错、无历史）
  - 修复：`src/open_llm_vtuber/agent/stateless_llm/openai_compatible_llm.py`
    新增 `_normalize_messages()`（纯文本列表摊平 + 去紧邻重复消息）
  - **本地已改未提交**；服务器已部署生效，端到端验证通过（回复 + 表情 + TTS 全正常，CPU ~14s/轮）
- ✅ 排障经验：服务端 DEBUG 日志在 `~/ai_school/logs/debug_*.log`；WS 端点是 `/client-ws`（不是 `/ws`）

### 3. 安卓端开发（Capacitor 方案，架构+代码全部完成）

**架构**：前端打进 APK（WebView origin = `https://localhost`，secure context → 麦克风可用），
HTTP 请求跨源访问远程后端（后端 CORS 已是 `*`，静态资源带 ACAO 头），WS 直连远程。
不做服务端加固的前提下解决了安卓 cleartext + getUserMedia 两大限制。

**已完成**：
- ✅ 前端后端地址集中化：新增 `frontend/src/renderer/src/services/api-base.ts`
  （getDefaultUrls/apiUrl/resolveApiBaseUrl；Capacitor 原生环境默认指向 `VITE_REMOTE_SERVER`）
- ✅ 10 处相对路径请求改为 apiUrl 拼接：live2d-models-api、use-dual-asr(/asr、/verification/config)、
  knowledge-api、auth.ts(login + authFetch 统一解析)、knowledge-admin-api(/health)、
  use-live2d-model(parseModelUrl)、background.tsx、hero-sidebar(背景预设)
- ✅ `.env.web` 增加 `VITE_REMOTE_SERVER=http://183.36.243.124:12393`
- ✅ `package.json` 增加 `android:sync` / `android:run` 脚本；安装 @capacitor/core、android、cli
- ✅ `capacitor.config.ts`：appId `com.shishi.ai`、appName `AI数字人`、webDir `dist/web`、
  allowMixedContent、webContentsDebuggingEnabled
- ✅ `npx cap add android` + `cap sync`：android/ 工程生成，web 资产已打入
- ✅ AndroidManifest：RECORD_AUDIO + CAMERA 权限、`usesCleartextTraffic="true"`
- ✅ MainActivity：屏幕常亮 FLAG_KEEP_SCREEN_ON；返回键无历史时 moveTaskToBack（防误退）
- ✅ 图标/启动屏源图生成：`frontend/assets/icon.png`(1024²)、`splash.png`(2732²)——**尚未生成到 android res**
- ✅ typecheck:web ✅、build:web ✅（新 bundle 已含远程地址）
- ✅ 工具链安装：JDK 21（D:\SRP\android-tools\jdk-21.0.12.1+1）、Android SDK
  （D:\SRP\android-tools\android-sdk，含 platform-tools 37 / android-35 / build-tools 35.0.0），
  licenses 已接受；ANDROID_HOME/JAVA_HOME 已 setx 到用户环境变量；android/local.properties 已写
- ✅ **首次 Gradle 构建：BUILD SUCCESSFUL（11m50s）**
  产物：`frontend/android/app/build/outputs/apk/debug/app-debug.apk`（21MB，debug 签名）

---

## ⏳ 待办事项（下次继续，按顺序）

### 安卓端收尾
1. [ ] 图标/启动屏生成到工程：`cd frontend && npx cap sync android && npx @capacitor/assets generate --android`
   （源图已在 frontend/assets/，需先 `npm i -D @capacitor/assets`；生成后重新 gradle 构建）
2. [ ] **真机 USB 联调**：手机开开发者模式+USB调试 → `adb devices` 确认 →
   `adb install -r frontend/android/app/build/outputs/apk/debug/app-debug.apk`
   （环境变量已 setx，新开终端即有；旧终端需手动 export JAVA_HOME/ANDROID_HOME）
3. [ ] 真机验收清单：
   - [ ] 启动 → WS 连上远程后端（chrome://inspect 看 WebView console，webContentsDebuggingEnabled 已开）
   - [ ] 文本对话全链路（服务器 CPU 推理 ~14s 延迟属正常）
   - [ ] Live2D 渲染/表情/口型/待机动画（关注低端机 FPS）
   - [ ] 麦克风权限弹窗 → VAD 收音 → 服务器 ASR → TTS 播报 → 语音打断
   - [ ] TTS 不被 autoplay 拦截（Capacitor 默认放行；被拦则在原生层补 WebView 设置）
   - [ ] 背景切换、校史/成就/学习标兵专题页、管理后台登录+知识库
   - [ ] 断网重连、杀进程重开
4. [ ] 问题迭代修复后重打包

### 服务端（用户明确暂缓，未做）
- [ ] Token 门禁（公网裸奔，App 分发前建议补上）
- [ ] 自签 HTTPS（当前方案已绕开，不阻塞安卓）
- [ ] 服务器 SSH 密码修改

### Git 提交（改动均未提交）
- `openai_compatible_llm.py`（llama.cpp 空流修复）
- 前端 10 文件 + api-base.ts + .env.web + package.json + capacitor.config.ts
- frontend/android/（工程，.gitignore 已含构建产物排除）+ frontend/assets/（图标源）

---

## 🚀 下次打开 Claude 的恢复路径
1. 读 `DAILY_PROGRESS_2026-08-30.md`（本文件）+ 记忆 `android-app-capacitor-plan`
2. 直接从「安卓端收尾」第 1 条开始执行
3. 手机连接后若 adb 不识别：装对应品牌 OEM USB 驱动，或手机上把 USB 模式切到"传输文件"
