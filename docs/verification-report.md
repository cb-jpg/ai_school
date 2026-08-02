# 技术验证报告

## 1. 执行摘要

当前结论：`PARTIAL`。已完成固定上游版本、环境检查、运行时配置、双 ASR 前端实现、LLM provider 归一化、健康检查、指标脚本、测试骨架和迁移文档。SenseVoice INT8 已实际在 CPU 加载并完成静音推理；由于服务器无 `ffmpeg`、无 GPU 驱动、无音频设备、无真实 LLM 配置和无浏览器会话，完整语音闭环尚未实际通过。

Open-LLM-VTuber 适合作为后续原型底座，不建议直接作为正式学校产品底座。正式产品需要独立 School QA API、RAG 引用、无依据拒答、审核、敏感问题策略和更明确的运行监控。

## 2. 固定版本

- Git tag：`v1.2.1`
- commit：`3afa41014b4548a0842e9ee2f576f4b164b48886`
- 前端源码基线：`7a2e214c3f266c294541127520dab7fce46787e7`
- Python：系统 3.13.9 不满足上游范围；脚本要求 uv 创建 Python 3.11
- uv：0.11.2

## 3. 实际架构

本地浏览器负责 Live2D、麦克风、Web Speech、音频播放和打断。服务器只监听 `127.0.0.1:12393`，通过 `/client-ws` 接收消息；Web Speech 成功时发送带 `utterance_id` 的文本，失败时上传 WAV 到 `/asr`，由 sherpa-onnx SenseVoice INT8 识别。LLM 走单一 `openai_compatible_llm`，TTS 为 Edge TTS。

## 4. 配置摘要

默认 `LLM_PROVIDER=deepseek`，但 Base URL、Key 和 model 必须由用户写入 `.env`。DeepSeek、Qwen、OpenAI 和 generic profile 无需改代码即可切换。ASR 默认 `auto`，前端优先 Web Speech，服务器 SenseVoice 回退；TTS 音色为 `zh-CN-XiaoxiaoNeural`。

## 5. 功能结果

| 项目 | 结果 | 证据/原因 |
|---|---|---|
| 服务启动 | PARTIAL | 上下文初始化和 Uvicorn 监听已通过；ffmpeg 警告存在，跨沙箱 HTTP 访问受隔离影响 |
| HTTP/health | PARTIAL | 路由处理函数自动测试通过；真实浏览器/端口访问待外部会话 |
| WebSocket | PENDING | 需启动服务与浏览器 |
| Live2D | PENDING | 上游示例模型存在，浏览器未运行 |
| Web Speech | PENDING | 需 Chrome/Edge + 本地麦克风 |
| SenseVoice INT8 | PASS（模型加载） | CPU 4 threads 构造成功，1 秒静音推理返回 `嗯。` |
| LLM 流式 | PENDING | provider 初始化通过，未提供真实 API 配置 |
| Edge TTS | PARTIAL | 引擎初始化通过，未执行联网合成与播放 |
| 打断 | PENDING | 前端复用上游音频队列和 interrupt 机制 |
| 自回声 | PENDING | 需本地音箱/麦克风人工测试 |
| 50 轮/两小时 | PENDING | 需服务运行后执行 |
| 密钥安全 | PASS（代码检查） | `.env`、logs、models、conf.yaml 已忽略，报告只写域名 |

## 6. 性能结果

SenseVoice 空音频构造/推理已完成，但 20 条真人语句耗时、LLM 首 token、TTS 首段、打断、CPU/RSS/GPU 峰值均为 `PENDING`。当前 `nvidia-smi` 不能通信，因此没有 GPU 通过证据。

## 7. 双 ASR 与隐私

实现了 `auto`、`web_speech`、`sherpa_onnx` 三种选择。Web Speech 失败后自动回退，`no-speech` 首次只提示，连续空结果才回退；明确拒绝权限时不循环申请。Web Speech 可能使用浏览器供应商服务，不能当作完全离线方案。

推荐架构是 `A. Web Speech 作为默认，SenseVoice 作为回退`。若学校隐私政策要求音频完全不出设备，应在一体机上选择 `C. 只使用 SenseVoice`。

## 8. 可复用与重构

建议保留：Live2D 渲染、WebSocket、音频队列、现有打断机制、ASR/TTS 接口和本次 provider profile。

必须替换或新增：陪伴型通用人格、学校 QA API、RAG 与引用、无依据拒答、内容审核、知识版本管理、隐私策略、健康监控和故障恢复。

## 9. 已知问题与下一步

先安装 ffmpeg、用 uv Python 3.11 完成 bootstrap，填写三项 LLM 变量，下载 SenseVoice，启动服务，再按 `docs/browser-asr-manual-test.md` 记录 Chrome/Edge 和两条 ASR 路径。迁移到 RTX 5070 一体机后必须重测浏览器支持、权限、AEC、模型加载、CPU/GPU、延迟、打断和两小时稳定性。

最终判断：`A. 适合作为后续原型底座`。建议完成上述人工和云端验证后，再进入学校知识问答 API 阶段；不要把本阶段配置直接扩展成学校数据接入层。
