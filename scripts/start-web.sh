#!/bin/bash
# Open-LLM-VTuber Web 端启动脚本
# 用于快速启动开发环境

echo "========================================"
echo "Open-LLM-VTuber Web 端开发环境启动"
echo "========================================"
echo ""

# 获取脚本目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 检查端口占用
echo "[1/3] 检查端口占用状态..."
if lsof -Pi :12393 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "[警告] 端口 12393 已被占用"
else
    echo "[OK] 后端端口 12393 可用"
fi

if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "[警告] 端口 3000 已被占用"
else
    echo "[OK] 前端端口 3000 可用"
fi
echo ""

# 启动后端服务
echo "[2/3] 启动后端服务器..."
echo "访问地址: http://localhost:12393"
echo "按 Ctrl+C 停止服务"
cd "$PROJECT_DIR"
uv run run_server.py &
BACKEND_PID=$!

# 等待后端启动
echo "等待后端服务启动..."
sleep 5

# 启动前端服务
echo "[3/3] 启动前端开发服务器..."
echo "访问地址: http://localhost:3000"
cd "$PROJECT_DIR/frontend"
npm run dev:web &
FRONTEND_PID=$!

echo "========================================"
echo "服务启动完成！"
echo "========================================"
echo ""
echo "后端服务: http://localhost:12393 (PID: $BACKEND_PID)"
echo "前端服务: http://localhost:3000 (PID: $FRONTEND_PID)"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 捕获退出信号
trap "echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM

# 等待进程
wait
