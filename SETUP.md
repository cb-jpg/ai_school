# 部署指南（从零开始跑起来）

本项目是基于 [Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber) 定制的学校数字人（"小石"）。
本文档面向第一次克隆本仓库的人，照着做即可获得与作者一致的运行效果。

## 一、环境要求

| 依赖 | 版本要求 | 说明 |
|---|---|---|
| Python | 3.10 ~ 3.12 | 建议通过 uv 自动管理 |
| [uv](https://docs.astral.sh/uv/) | 最新版 | Python 包管理器，`pip install uv` 安装 |
| Node.js | 18+ | 构建前端用，自带 npm |
| [Ollama](https://ollama.com/) | 最新版 | 默认 LLM 后端（本地推理，无需 API Key） |

> LLM 默认配置为本地 Ollama + `qwen2.5`。如果你没有 GPU，可在 `conf.yaml` 中把
> `llm_provider` 改为其他提供商（如 `deepseek_llm`、`zhipu_llm`）并填入对应 API Key。

## 二、部署步骤

### 1. 克隆仓库

```bash
git clone https://github.com/cb-jpg/ai_school.git
cd ai_school
```

### 2. 安装后端依赖

```bash
uv sync
```

仓库自带 `uv.lock`，会安装与作者**完全相同版本**的依赖，请勿删除该文件。

### 3. 生成配置文件

```bash
# Windows (cmd)
copy conf.yaml.example conf.yaml

# Windows (PowerShell)
Copy-Item conf.yaml.example conf.yaml

# macOS / Linux
cp conf.yaml.example conf.yaml
```

默认配置即可跑通。需要改的地方（均可选）：

- 换 LLM 提供商：`character_config.agent_config.agent_settings.basic_memory_agent.llm_provider`
- 填 API Key：对应 `llm_configs` 下提供商的 `llm_api_key`
- 换数字人形象：`live2d_model_name`（内置 `hiyori_pro` / `hiyori_free` / `mao_pro` / `shizuku`）

### 4. 准备语音识别模型（ASR）

默认使用 sherpa-onnx 的 SenseVoice 中英日韩模型（约 150MB，一次性下载）：

1. 下载：<https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2>
2. 解压到项目的 `models/` 目录，最终路径为：
   `models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/model.int8.onnx`

> 不需要语音输入功能的话可以跳过此步（文字输入不受影响）。

### 5. 准备 LLM（二选一）

**方式 A：本地 Ollama（默认，无需密钥）**

```bash
ollama pull qwen2.5
```

**方式 B：云端 API**

编辑 `conf.yaml`，把 `llm_provider` 改成对应提供商并填入 API Key，
例如 `deepseek_llm` + DeepSeek Key。

### 6. 构建前端（两种方式二选一）

**方式 A：生产构建（推荐，之后只访问后端一个端口）**

```bash
cd frontend
npm install
npm run build:web
cd ..
```

构建产物在 `frontend/dist/web`，后端会自动托管，直接访问 <http://localhost:12393>。

**方式 B：开发模式（改前端代码时用）**

```bash
cd frontend
npm install
npm run dev:web
```

访问 <http://localhost:3000>（后端仍需另开终端启动）。

### 7. 启动服务

```bash
uv run run_server.py
```

首次启动时：

- 会自动从 HuggingFace 镜像（hf-mirror.com）下载知识库 embedding 模型（约 120MB，一次性）
- 会自动生成知识库索引等运行时数据

启动完成后：

- 方式 A：浏览器打开 <http://localhost:12393>
- 方式 B：浏览器打开 <http://localhost:3000>

## 三、知识库（RAG 问答）

把学校相关的文档（txt / md / pdf 等）放入：

```
data/knowledge/documents/
```

重启服务即可自动完成分块、向量化和索引构建，数字人会基于这些文档回答问题。

## 四、常见问题

| 现象 | 原因 / 解决 |
|---|---|
| 页面能打开但数字人不显示 | Live2D 模型缺失，确认 `live2d-models/` 下有 `hiyori_pro` |
| 语音识别报错找不到模型 | 未完成步骤 4，检查 `models/` 下的 SenseVoice 目录名是否一致 |
| LLM 不回复 | Ollama 未启动或未拉取模型；`ollama list` 检查 `qwen2.5` 是否存在 |
| `uv sync` 版本冲突 | 不要绕过 `uv.lock`，它是唯一被验证可用的依赖组合 |
| 下载 HuggingFace 模型超时 | `run_server.py` 已内置 hf-mirror 镜像，确认没有手动覆盖 `HF_ENDPOINT` |
| 端口被占用 | 改 `conf.yaml` 中 `system_config.port`（默认 12393） |

## 五、目录速览

```
├── conf.yaml.example   # 配置模板（复制为 conf.yaml 使用）
├── uv.lock             # 依赖版本锁定，务必保留
├── run_server.py       # 后端入口
├── SETUP.md            # 本文档
├── src/open_llm_vtuber # 后端源码
├── frontend/           # 前端源码（构建后生成 dist/web）
├── live2d-models/      # Live2D 形象
├── models/             # ASR 等本地模型（需按步骤 4 下载，不入库）
└── data/knowledge/     # 知识库（文档入 documents/，索引自动生成）
```
