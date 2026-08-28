"""Open-LLM-VTuber 学校问答系统。"""

import os
from pathlib import Path

# HuggingFace 下载默认走国内镜像并落在项目内缓存目录。
# huggingface.co 直连在国内不可达；新版 hub 的 Xet 分块协议也无法穿透镜像（401）。
# 全部用 setdefault：用户自设的同名环境变量优先生效（如海外用户想直连）。
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault(
    "HF_HOME", str(Path(__file__).resolve().parents[2] / ".hf-cache")
)
