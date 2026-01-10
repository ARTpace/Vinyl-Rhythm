# 黑胶时光 — 快速启动指南

## 环境准备

确保你的开发环境满足以下要求：

| 软件 | 要求 | 获取方式 |
|------|------|----------|
| Windows | 10 或 11 | 系统自带 |
| Node.js | 18.0 或更高 | [nodejs.org](https://nodejs.org/) |
| 磁盘空间 | 至少 2GB | - |

**安装 Node.js 后**，打开命令提示符（CMD）或 PowerShell，验证安装：

```bash
node --version
npm --version
```

如果看到版本号输出，说明安装成功。

## 快速开始

### 步骤 1：获取项目代码

如果你已有项目代码，直接进入项目目录：

```bash
cd h:\APP\音乐\Vinyl-Rhythm
```

### 步骤 2：安装依赖

```bash
npm install
```

首次安装需要下载约 200MB 的依赖包，请耐心等待。安装完成后会看到 `node_modules` 目录。

### 步骤 3：下载 BASS 音频库

双击运行 `scripts\download-bass.bat`，或使用命令：

```bash
scripts\download-bass.bat
```

脚本会自动从 un4seen 官网下载 BASS 核心库和 FLAC、ALAC、APE、WavPack、Opus、MIDI、DSD 等插件。下载完成后，所有 DLL 文件会保存在 `assets\` 目录。

### 步骤 4：启动开发环境

```bash
scripts\dev.bat
```

首次启动需要较长时间，请等待看到两个窗口：
- Vite 开发服务器窗口（显示编译信息）
- Electron 应用窗口（黑胶时光界面）

## 验证安装

应用启动后，按以下步骤验证所有组件正常工作：

1. 点击界面上的"打开文件"或"导入"按钮
2. 选择一个音频文件进行播放
3. 观察播放控制是否正常工作
4. 检查进度条是否随播放前进
5. 如果没有音频输出，检查系统音量是否开启

如果一切正常，说明 BASS 音频引擎已正确加载。

## 构建生产版本

开发测试完成后，构建可分发的安装包：

```bash
scripts\build.bat
```

构建完成后，产物位于：
- `dist-electron\win-unpacked\` — 便携版本，直接运行 `黑胶时光.exe`
- `dist-electron\黑胶时光-1.0.0.exe` — 安装包，双击运行安装

## 常见问题

**问题：npm install 失败**

关闭命令提示符，以管理员身份重新打开，然后重试。如果 ffi-napi 或 ref-napi 安装失败，需要安装 Visual Studio Build Tools。

**问题：找不到 bass.dll**

运行 `scripts\download-bass.bat` 下载 BASS 库。确保 `assets\bass.dll` 文件存在。

**问题：应用启动后没有声音**

打开开发者工具（按 F12），查看控制台是否有错误信息。确认音频文件格式受支持。

**问题：播放时卡顿**

尝试关闭其他占用 CPU 的程序，或使用更高配置的电脑。

## 下一步

| 任务 | 说明 |
|------|------|
| 阅读完整文档 | 查看 [BUILD.md](BUILD.md) 了解架构细节 |
| 添加音乐 | 使用"导入"功能添加本地音乐文件 |
| 个性化设置 | 在设置中调整外观和音频参数 |
| 提交改进 | 如果发现问题，请反馈 |

## 脚本说明

项目提供了以下便捷脚本：

| 脚本 | 用途 |
|------|------|
| `scripts\dev.bat` | 启动开发环境 |
| `scripts\build.bat` | 构建生产版本 |
| `scripts\download-bass.bat` | 下载 BASS 插件 |
| `scripts\compile-bass-helper.bat` | 编译 C++ 辅助模块 |

## 技术支持

遇到问题时：
1. 查看控制台错误信息
2. 搜索 [BUILD.md](BUILD.md) 中的相关章节
3. 检查系统事件查看器是否有相关日志

祝你使用愉快！
