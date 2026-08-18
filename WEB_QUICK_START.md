# Web 端快速开始

## 🚀 一键启动

### Windows

```bash
# 双击运行
scripts\start-web.bat
```

### Linux/Mac

```bash
bash scripts/start-web.sh
```

## 📦 构建 Web 端

### Windows

```bash
# 双击运行
scripts\build-web.bat
```

### 手动构建

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 开发模式
npm run dev:web

# 生产构建
npm run build:web
```

## 🌐 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端开发 | http://localhost:3000 | 热重载开发模式 |
| 后端服务 | http://localhost:12393 | API 和 WebSocket |
| 管理后台 | http://localhost:8001 | 知识库管理 (需单独启动) |

## 📋 启动管理后台

```bash
# 启动知识库管理后台
uv run python school_admin/app.py

# 访问: http://localhost:8001
# API 文档: http://localhost:8001/docs
```

## 🔧 环境配置

编辑 `frontend/.env.web`:

```env
VITE_API_BASE_URL=http://localhost:12393
VITE_WS_URL=ws://localhost:12393/client-ws
```

## 📚 相关文档

- [完整部署指南](WEB_DEPLOYMENT.md)
- [测试指南](TEST_GUIDE.md)
- [开发总结](SCHOOL_RAG_SUMMARY.md)

## ⚡ 常用命令

```bash
# 后端服务
uv run run_server.py

# 前端开发
cd frontend && npm run dev:web

# 前端构建
cd frontend && npm run build:web

# 管理后台
uv run python school_admin/app.py

# 测试 API
python test_campus_api.py

# 测试数据文件
python test_data_files.py
```

## 🐛 常见问题

### 1. 端口被占用

```bash
# Windows: 查找占用端口的进程
netstat -ano | findstr :12393

# Linux/Mac:
lsof -i :12393
```

### 2. 依赖安装失败

```bash
# 清除缓存重试
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### 3. 模型下载慢

- SenseVoice 模型 (~999MB) 首次启动会自动下载
- 可以手动下载并放到 `models/` 目录
- 或使用其他 ASR 引擎

---

**版本**: v1.2.1
**更新**: 2026-08-19
