@echo off
REM Open-LLM-VTuber Web 端启动脚本
REM 用于快速启动开发环境

echo ========================================
echo Open-LLM-VTuber Web 端开发环境启动
echo ========================================
echo.

REM 检查端口占用
echo [1/3] 检查端口占用状态...
netstat -ano | findstr :12393 >nul
if %errorlevel% == 0 (
    echo [警告] 端口 12393 已被占用，请先关闭后端服务
) else (
    echo [OK] 后端端口 12393 可用
)

netstat -ano | findstr :3000 >nul
if %errorlevel% == 0 (
    echo [警告] 端口 3000 已被占用，请先关闭前端服务
) else (
    echo [OK] 前端端口 3000 可用
)
echo.

REM 启动后端服务
echo [2/3] 启动后端服务器...
echo 访问地址: http://localhost:12393
echo 按 Ctrl+C 停止服务
echo.
start "Open-LLM-VTuber Backend" cmd /k "cd /d %~dp0.. && uv run run_server.py"

REM 等待后端启动
echo 等待后端服务启动...
timeout /t 5 /nobreak >nul

REM 启动前端服务
echo [3/3] 启动前端开发服务器...
echo 访问地址: http://localhost:3000
echo.
start "Open-LLM-VTuber Frontend" cmd /k "cd /d %~dp0..\frontend && npm run dev:web"

echo ========================================
echo 服务启动完成！
echo ========================================
echo.
echo 后端服务: http://localhost:12393
echo 前端服务: http://localhost:3000
echo.
echo 按任意键关闭此窗口...
pause >nul
