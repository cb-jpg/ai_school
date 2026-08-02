# 验证计划

## 固定版本

- 后端仓库：Open-LLM-VTuber `v1.2.1`
- 后端 commit：`3afa41014b4548a0842e9ee2f576f4b164b48886`
- 前端源码基线：Open-LLM-VTuber-Web `7a2e214c3f266c294541127520dab7fce46787e`
- 运行环境：uv + Python 3.11

## 链路

浏览器先按键启动 Web Speech，成功后只提交最终文本；不再上传同一段音频。浏览器不支持、识别服务报错、超时或连续空结果时，`auto` 模式使用 MediaRecorder 上传 WAV 到服务器 `/asr`，由 sherpa-onnx SenseVoice INT8 识别。LLM 始终走 `openai_compatible_llm`，TTS 使用 Edge TTS，Live2D 使用上游示例模型。

## 验证顺序

1. `scripts/bootstrap.sh`、配置渲染和启动。
2. `/health`、HTTP 页面和 `/client-ws`。
3. Live2D 显示、待机动作、口型和缩放。
4. Web Speech 全部 20 条语句。
5. 手动 `sherpa_onnx` 全部 20 条语句。
6. LLM 流式、错误和首 token 延迟。
7. Edge TTS、打断和自回声。
8. 50 轮与两小时运行；真人麦克风和听感结果单独记录。

未执行的人工测试必须标记为 `PENDING`，不能从服务存活推断交互通过。
