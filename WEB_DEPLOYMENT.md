# Web 端部署指南

## 📋 目录

- [环境准备](#环境准备)
- [构建配置](#构建配置)
- [本地测试](#本地测试)
- [生产部署](#生产部署)
- [Nginx 配置](#nginx-配置)
- [常见问题](#常见问题)

---

## 环境准备

### 前置要求

- Node.js 18+
- Python 3.8+
- uv (Python 包管理器)

### 依赖安装

```bash
# 前端依赖
cd frontend
npm install

# 后端依赖 (已在项目根目录)
cd ..
uv sync
```

---

## 构建配置

### 1. 环境变量配置

编辑 `frontend/.env.web`:

```env
# 本地开发
VITE_API_BASE_URL=http://localhost:12393
VITE_WS_URL=ws://localhost:12393/client-ws

# 生产环境 (修改为实际域名)
# VITE_API_BASE_URL=https://yourdomain.com
# VITE_WS_URL=wss://yourdomain.com/client-ws
```

### 2. 构建命令

```bash
# 进入前端目录
cd frontend

# 开发模式 (热重载)
npm run dev:web

# 生产构建
npm run build:web
```

### 3. 构建输出

构建完成后，静态文件位于 `frontend/dist/web/`:

```
dist/web/
├── index.html
├── assets/           # 静态资源 (JS, CSS)
├── libs/             # 第三方库 (VAD, ONNX)
└── ...
```

---

## 本地测试

### 方式一：分别启动前后端

**终端 1 - 启动后端服务器**:
```bash
cd D:\SRP\AI_school\Open-LLM-VTuber
uv run run_server.py
```

**终端 2 - 启动前端开发服务器**:
```bash
cd D:\SRP\AI_school\Open-LLM-VTuber\frontend
npm run dev:web
```

访问: http://localhost:3000

### 方式二：使用构建文件

**终端 1 - 启动后端服务器**:
```bash
cd D:\SRP\AI_school\Open-LLM-VTuber
uv run run_server.py
```

**终端 2 - 启动静态文件服务器**:
```bash
cd D:\SRP\AI_school\Open-LLM-VTuber\frontend\dist\web
python -m http.server 8080
```

访问: http://localhost:8080

---

## 生产部署

### 目录结构

```
/var/www/open-llm-vtuber/
├── backend/              # 后端代码
│   ├── src/
│   ├── run_server.py
│   └── ...
├── frontend/            # 前端构建输出
│   └── dist/web/
├── cache/               # 缓存目录
├── live2d-models/       # Live2D 模型
├── school_data/         # 学校数据
└── config.yaml          # 配置文件
```

### 部署步骤

#### 1. 构建前端

```bash
cd frontend
npm run build:web
```

#### 2. 配置后端

编辑 `conf.yaml`:

```yaml
system_config:
  host: '0.0.0.0'  # 监听所有接口
  port: 12393
```

#### 3. 启动后端服务

```bash
# 使用 uv
uv run run_server.py

# 或使用 systemd (生产环境推荐)
sudo systemctl start open-llm-vtuber
```

---

## Nginx 配置

### 基础配置

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # 前端静态文件
    location / {
        root /var/www/open-llm-vtuber/frontend/dist/web;
        try_files $uri $uri/ /index.html;
        
        # 缓存配置
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # WebSocket 连接
    location /client-ws {
        proxy_pass http://127.0.0.1:12393;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # API 接口
    location /api/ {
        proxy_pass http://127.0.0.1:12393;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 静态资源
    location /cache/ {
        alias /var/www/open-llm-vtuber/cache/;
        expires 1y;
        add_header Cache-Control "public";
    }

    location /live2d-models/ {
        alias /var/www/open-llm-vtuber/live2d-models/;
        expires 1y;
        add_header Cache-Control "public";
    }
}
```

### HTTPS 配置 (使用 Let's Encrypt)

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d yourdomain.com

# 自动续期
sudo certbot renew --dry-run
```

---

## 常见问题

### 1. WebSocket 连接失败

**问题**: 前端无法连接 WebSocket

**解决**:
- 检查后端服务是否运行
- 检查防火墙设置
- 验证 `VITE_WS_URL` 配置

### 2. API 跨域问题

**问题**: 浏览器控制台显示 CORS 错误

**解决**:
后端已在 `server.py` 中添加 CORS 中间件，如仍有问题，检查:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 3. 静态资源 404

**问题**: 图片、模型等静态资源加载失败

**解决**:
- 检查文件路径是否正确
- 验证 Nginx 中的 `alias` 配置
- 检查文件权限

### 4. 内存占用过高

**问题**: 服务占用内存过多

**解决**:
- 调整 VAD 模型大小
- 减少并发连接数
- 配置适当的缓存策略

---

## 性能优化建议

### 前端优化

1. **启用 CDN**: 将静态资源托管到 CDN
2. **代码分割**: 利用 Vite 的代码分割功能
3. **资源压缩**: 启用 gzip/brotli 压缩
4. **图片优化**: 使用 WebP 格式

### 后端优化

1. **连接池**: 配置数据库/向量库连接池
2. **缓存策略**: 使用 Redis 缓存热点数据
3. **负载均衡**: 使用多进程/多服务器部署
4. **监控**: 配置日志和性能监控

---

## 监控和日志

### 日志文件位置

```
logs/
├── debug_YYYY-MM-DD.log    # 调试日志
└── error_YYYY-MM-DD.log    # 错误日志
```

### 系统监控

推荐使用以下工具:
- **Prometheus + Grafana**: 性能监控
- **ELK Stack**: 日志分析
- **Sentry**: 错误追踪

---

## 更新部署

### 滚动更新流程

1. 构建新版本前端
2. 备份当前版本
3. 替换前端文件
4. 重启后端服务 (如需要)
5. 清除浏览器缓存

```bash
# 备份
cp -r /var/www/open-llm-vtuber /var/www/open-llm-vtuber.backup

# 构建新版本
cd frontend && npm run build:web

# 部署
rm -rf /var/www/open-llm-vtuber/frontend/dist/web
cp -r dist/web /var/www/open-llm-vtuber/frontend/dist/

# 重启服务
sudo systemctl restart open-llm-vtuber
```

---

## 安全建议

1. **HTTPS**: 生产环境必须使用 HTTPS
2. **CORS**: 限制 `allow_origins` 为具体域名
3. **认证**: 添加管理后台登录认证
4. **防火墙**: 只开放必要端口 (80, 443)
5. **更新**: 定期更新依赖包

---

**当前版本**: v1.2.1
**最后更新**: 2026-08-18
