# 环境报告

记录时间：2026-07-30（Asia/Shanghai）

## 服务器

| 项目 | 实际结果 |
|---|---|
| OS | Ubuntu 22.04.5 LTS，kernel 6.8.0-48-generic |
| 架构 | x86_64 |
| CPU | Intel Xeon Gold 6226R @ 2.90GHz，1 socket，16 cores / 32 threads |
| 内存 | 125 GiB，总可用约 91 GiB |
| 磁盘 | `/home/dbh/live2D` 所在盘 11T，总剩余 2.7T |
| GPU | `nvidia-smi` 无法与驱动通信，型号和显存暂不可确认 |
| Python | 系统 Python 3.13.9；上游 v1.2.1 要求 `>=3.10,<3.13`，需用 uv 创建 3.11 环境 |
| Git | 2.34.1 |
| uv | 0.11.2 |
| ffmpeg | 未安装 |
| sudo | 当前用户无免密 sudo |
| 音频设备 | 无声卡，PulseAudio 连接失败；这是预期的服务器无麦克风场景 |
| 虚拟化 | `systemd-detect-virt` 返回 `none`，未发现 Docker 标记 |

## 网络

沙箱内网络检查失败；授权网络下已成功读取 GitHub tag 和克隆仓库。Edge TTS、模型下载源和 LLM 端点仍需在实际运行环境中检查。

## 影响

当前证据只能支持环境和代码层面的 PARTIAL 结论。GPU、ffmpeg、服务器音频设备、真实浏览器麦克风和真实云端 LLM 仍不能在此环境中判定通过。
