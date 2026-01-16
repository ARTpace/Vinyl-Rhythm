@echo off
chcp 65001 >nul
echo ============================================
echo        黑胶时光 - Electron 构建脚本
echo ============================================
echo.

REM ============================================================================
REM 第一部分：环境检查
REM 确保 Node.js 和 npm 已正确安装，这是运行项目的基础要求
REM ============================================================================

REM 检查 Node.js 是否安装
echo [1/5] 检查 Node.js 环境...
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 Node.js，请先安装 Node.js 18+ 版本
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

REM 获取 Node.js 版本号用于显示
for /f tokens^=2delims^=^" %%i in ('node -v') do set NODE_VERSION=%%i
echo      Node.js 版本: %NODE_VERSION%

REM 检查 npm 是否安装
echo [2/5] 检查 npm 环境...
npm --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 npm，请重新安装 Node.js
    pause
    exit /b 1
)
echo      npm 版本: %npm_version%

REM ============================================================================
REM 第二部分：安装项目依赖
REM 使用 npm install 安装 package.json 中声明的所有依赖包
REM 这包括运行时依赖（dependencies）和开发时依赖（devDependencies）
REM ============================================================================

REM 安装依赖
echo [3/5] 安装项目依赖...
echo      这可能需要几分钟时间...
call npm install
if errorlevel 1 (
    echo 错误: npm install 失败
    pause
    exit /b 1
)
echo      依赖安装完成

REM ============================================================================
REM 第三部分：执行 Electron 构建
REM 调用 npm run build 执行完整的构建流程：
REM 1. vite build - 打包前端资源到 dist 目录
REM 2. electron-builder - 将所有资源打包为 Windows 安装程序
REM ============================================================================

REM 构建应用
echo [5/5] 构建 Electron 应用...
echo      正在构建，请稍候...
call npm run build
if errorlevel 1 (
    echo 错误: 构建失败
    pause
    exit /b 1
)

REM ============================================================================
REM 第五部分：构建完成提示
REM 显示构建产物的位置和后续操作指南
REM ============================================================================

echo.
echo ============================================
echo           构建完成！
echo ============================================
echo.
echo 构建产物保存在: dist-electron\win-unpacked\
echo 安装包保存在: dist-electron\黑胶时光-*.exe
echo.
echo 下一步:
echo  1. 直接运行安装包或解压版应用即可
echo.
pause
