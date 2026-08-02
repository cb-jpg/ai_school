# LLM Provider 对比

代码路径统一为 `openai_compatible_llm`。DeepSeek、Qwen、OpenAI 和 generic gateway 仅改变 `.env` 中的 `LLM_PROVIDER`、`LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`，不需要修改学校业务代码。

当前没有提供真实密钥，因此连接、模型有效性、中文回答、流式首 token 和错误恢复均为 `PENDING`。运行 `scripts/check_llm.sh` 后，脱敏结果写入 `logs/llm-check.json`，只包含 provider、model、Base URL 域名、流式状态、延迟和结果。

| Provider | OpenAI-compatible | 需改代码 | 实测 |
|---|---|---|---|
| deepseek | 是 | 否 | PENDING |
| qwen | 是 | 否 | PENDING |
| openai | 是 | 否 | PENDING |
| openai_compatible | 是 | 否 | PENDING |
