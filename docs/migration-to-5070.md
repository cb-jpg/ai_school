# 迁移到 RTX 5070 一体机

当前验证服务器是 Ubuntu 22.04、无可用 NVIDIA 驱动、无麦克风和音箱；一体机的 RTX 5070、驱动、浏览器和音频设备必须重新验收，当前 GPU 结果不能外推。

迁移时固定后端 tag/commit、前端构建 commit、Python 3.11、uv 依赖和 SenseVoice 模型目录。重新创建 `.venv`，不要复制服务器 `.venv`；复制 `models/` 仅限已经核验的模型文件，不复制 `cache/`、`logs/` 和 `run/`。API Key 在一体机上重新写入权限为 600 的 `.env`。

Linux 可用 systemd 管理 `scripts/start.sh`；Windows 可用任务计划程序或服务包装器。浏览器建议 kiosk 模式，但先在实际版本 Chrome/Edge 测试 Web Speech、麦克风权限、音箱输出和 AEC。无论 AEC 是否稳定，首版保留点击或按住说话，并分别测试 Web Speech 和 SenseVoice 两条路径。

后续本地 LLM、CosyVoice、GPU 推理和离线部署必须单独做依赖、显存、许可证和故障恢复验证，本阶段不部署。
