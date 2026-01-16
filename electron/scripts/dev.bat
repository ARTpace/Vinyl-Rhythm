@echo off
chcp 65001 >nul
echo ============================================
echo        黑胶时光 - 开发环境启动脚本
echo ============================================
echo.

REM ============================================================================
REM 第一部分：环境检查
REM 验证 Node.js 是否已安装，这是运行 Electron 应用的前提条件
REM ============================================================================

REM 检查环境
echo [检查] 验证 Node.js 环境...
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)
echo      Node.js 已就绪

REM ============================================================================
REM 第二部分：依赖验证
REM 检查 node_modules 目录是否存在，不存在时执行 npm install
REM ============================================================================

REM 检查依赖
echo [检查] 验证项目依赖...
if not exist "node_modules" (
    echo      未找到 node_modules，正在安装...
    call npm install
    if errorlevel 1 (
        echo 错误: 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo      依赖已安装
)

REM ============================================================================
REM 第三部分：启动开发服务器
REM 使用 concurrently 并行启动 Vite 开发服务器和 Electron 应用
REM Vite 默认监听 3000 端口，提供热重载功能
REM wait-on 工具确保 Vite 服务器就绪后才启动 Electron
REM ============================================================================

REM 启动开发服务器
echo.
echo [启动] 正在启动开发服务器...
echo      Vite 服务器将运行在 http://localhost:3000
echo      Electron 应用将自动启动
echo.
echo      按 Ctrl+C 停止服务器
echo.
echo ============================================

REM 调用 package.json 中定义的 dev:electron 脚本
call npm run dev:electron

echo.
echo 开发服务器已停止
pause
