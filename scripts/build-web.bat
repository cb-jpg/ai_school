@echo off
REM Open-LLM-VTuber Web 端构建脚本

echo ========================================
echo Open-LLM-VTuber Web 端构建
echo ========================================
echo.

REM 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

echo [1/3] 安装前端依赖...
cd /d %~dp0..\frontend
call npm install
if %errorlevel% neq 0 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
)
echo [OK] 依赖安装完成
echo.

echo [2/3] 构建 Web 端...
call npm run build:web
if %errorlevel% neq 0 (
    echo [错误] 构建失败
    pause
    exit /b 1
)
echo [OK] 构建完成
echo.

echo [3/3] 验证构建输出...
if not exist "dist\web\index.html" (
    echo [错误] 构建输出文件不存在
    pause
    exit /b 1
)
echo [OK] 构建输出验证通过
echo.

echo ========================================
echo 构建成功！
echo ========================================
echo.
echo 输出目录: %cd%\dist\web
echo.
echo 下一步:
echo 1. 将 dist\web 目录部署到服务器
echo 2. 参考 WEB_DEPLOYMENT.md 进行配置
echo.
pause
