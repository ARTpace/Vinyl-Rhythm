/**
 * Vinyl-Rhythm Electron 主进程
 * 已转换为 ES Module 以适配 package.json 的 "type": "module"
 */

import { app, BrowserWindow, ipcMain, globalShortcut, shell, Tray, Menu, protocol, dialog, net } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import config from './config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 注册特权协议，必须在 app ready 之前调用
protocol.registerSchemesAsPrivileged([
  { 
    scheme: 'local-resource', 
    privileges: { 
      secure: true, 
      standard: true, 
      supportFetchAPI: true, 
      bypassCSP: true, 
      stream: true 
    } 
  }
]);

// 设置用户数据目录，避免权限问题
const userDataPath = path.join(app.getPath('appData'), 'VinylRhythm');
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}
app.setPath('userData', userDataPath);

let mainWindow = null;
let tray = null;
let isQuitting = false;

/**
 * 注册本地资源协议，允许加载本地音频文件
 */
function registerLocalResourceProtocol() {
  protocol.handle('local-resource', (request) => {
    // 处理 URL，提取路径部分
    let urlPath = request.url.replace(/^local-resource:\/\//, '');
    
    // 处理 Windows 盘符前的斜杠（有些浏览器/环境会自动加上 /C:/...）
    if (urlPath.startsWith('/') && /^[a-zA-Z]:/.test(urlPath.substring(1))) {
      urlPath = urlPath.substring(1);
    }
    
    // 解码路径（处理空格和特殊字符）
    const decodedPath = decodeURIComponent(urlPath);
    
    try {
      // 检查文件是否存在
      if (!fs.existsSync(decodedPath)) {
        console.warn(`File not found: ${decodedPath}`);
        return new Response('File Not Found', { status: 404 });
      }

      // 使用 net.fetch 获取本地文件流
      // 在 Windows 下，需要使用 file:/// 协议，并且路径中的 \ 需要换成 /
      const normalizedPath = path.normalize(decodedPath).replace(/\\/g, '/');
      const fileUrl = `file:///${normalizedPath}`;
      
      return net.fetch(fileUrl);
    } catch (e) {
      console.error('Failed to serve local resource:', e);
      return new Response('Internal Error', { status: 500 });
    }
  });
}

/**
 * 创建应用主窗口
 */
function createWindow() {
  const isDev = !app.isPackaged;
  
  // 更加鲁棒的 preload 路径获取方式
  const preloadPath = isDev 
    ? path.join(__dirname, 'preload', 'index.cjs')
    : path.join(app.getAppPath(), 'electron', 'preload', 'index.cjs');
    
  console.log('[Main] Preload path:', preloadPath);
  if (!fs.existsSync(preloadPath)) {
    console.error('[Main] Preload script NOT found at:', preloadPath);
  }

  mainWindow = new BrowserWindow({
    ...config.window,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      devTools: true,
      webSecurity: false // 允许加载本地资源
    },
    show: false
  });

  // 开发环境下连接到 Vite 服务器，生产环境下加载本地文件
  const startUrl = process.env.ELECTRON_START_URL || (isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../dist/index.html')}`);
  
  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // 注册媒体快捷键
  globalShortcut.register('MediaPlayPause', () => {
    mainWindow?.webContents.send('shortcut-play-pause');
  });

  globalShortcut.register('MediaNextTrack', () => {
    mainWindow?.webContents.send('shortcut-next');
  });

  globalShortcut.register('MediaPreviousTrack', () => {
    mainWindow?.webContents.send('shortcut-prev');
  });

  globalShortcut.register('MediaStop', () => {
    mainWindow?.webContents.send('shortcut-stop');
  });
}

/**
 * 创建系统托盘图标
 */
function createTray() {
  if (config.paths.trayIcon && fs.existsSync(config.paths.trayIcon)) {
    tray = new Tray(config.paths.trayIcon);
    const contextMenu = Menu.buildFromTemplate([
      { label: '播放/暂停', click: () => mainWindow?.webContents.send('shortcut-play-pause') },
      { label: '下一首', click: () => mainWindow?.webContents.send('shortcut-next') },
      { type: 'separator' },
      { label: '退出', click: () => {
        isQuitting = true;
        app.quit();
      }}
    ]);
    tray.setToolTip('黑胶时光');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => mainWindow?.show());
  } else {
    console.log('[Main] 托盘图标不存在，跳过托盘创建');
  }
}

/**
 * 创建应用菜单
 */
function createMenu() {
  const isMac = process.platform === 'darwin';
  
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: '文件',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' },
              { role: 'stopSpeaking' }
            ]
          }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    }
  ];
  
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/**
 * 初始化 IPC 通信处理器
 */
function initializeIpcHandlers() {
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.hide();
  });

  ipcMain.handle('window:is-maximized', () => {
    return mainWindow?.isMaximized();
  });

  // 文件夹选择器
  ipcMain.handle('dialog:open-directory', async () => {
    console.log('[Main] Received dialog:open-directory request');
    try {
      console.log('[Main] Opening directory dialog with mainWindow:', !!mainWindow);
      if (!mainWindow) {
        console.warn('[Main] mainWindow is null, dialog might not appear correctly');
      }
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow || undefined, {
        properties: ['openDirectory'],
        title: '选择音乐文件夹',
        buttonLabel: '选择文件夹'
      });
      
      console.log('[Main] Dialog result:', { canceled, filePathsCount: filePaths?.length });
      
      if (canceled || !filePaths || filePaths.length === 0) {
        console.log('[Main] Dialog canceled or no folder selected');
        return null;
      } else {
        console.log('[Main] Folder selected:', filePaths[0]);
        return filePaths[0];
      }
    } catch (error) {
      console.error('[Main] Failed to open directory dialog:', error);
      // 将错误信息返回给渲染进程，以便调试
      throw new Error(`主进程打开对话框失败: ${error.message}`);
    }
  });

  // 目录扫描
  ipcMain.handle('fs:scan-directory', async (event, dirPath) => {
    console.log('[Main] Received fs:scan-directory request for path:', dirPath);
    try {
      if (!dirPath) {
        console.warn('[Main] scan-directory: No path provided');
        return [];
      }
      const files = await scanAudioFiles(dirPath);
      console.log(`[Main] scan-directory: Found ${files.length} audio files in ${dirPath}`);
      return files;
    } catch (error) {
      console.error('[Main] Failed to scan directory:', error);
      return [];
    }
  });

  /**
 * 获取音频文件元数据
 * 直接在主进程解析，避免将大文件传给渲染进程
 */
ipcMain.handle('metadata:get', async (event, filePath) => {
  console.log('[Main] Parsing metadata for:', filePath);
  try {
    // 动态导入 music-metadata，提高兼容性并减少启动开销
    const { parseFile } = await import('music-metadata');
    const metadata = await parseFile(filePath);
    const { common, format } = metadata;
      
      // 提取封面
      let coverData = null;
      if (common.picture && common.picture.length > 0) {
        const pic = common.picture[0];
        coverData = {
          data: pic.data, // Buffer 会被自动转为 Uint8Array 传给渲染进程
          format: pic.format
        };
      }

      return {
        title: common.title,
        artist: common.artist || common.albumartist,
        album: common.album,
        duration: format.duration,
        bitrate: format.bitrate,
        year: common.year,
        genre: common.genre ? common.genre[0] : undefined,
        cover: coverData
      };
    } catch (error) {
      console.error('[Main] Failed to parse metadata:', error);
      return null;
    }
  });
}

/**
 * 递归扫描音频文件
 */
async function scanAudioFiles(dirPath) {
  const audioExtensions = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac'];
  let results = [];

  try {
    const list = fs.readdirSync(dirPath);
    for (let file of list) {
      const fullPath = path.resolve(dirPath, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        const subFiles = await scanAudioFiles(fullPath);
        results = results.concat(subFiles);
      } else {
        const ext = path.extname(fullPath).toLowerCase();
        if (audioExtensions.includes(ext)) {
          results.push({
            path: fullPath,
            name: path.basename(fullPath, ext),
            ext: ext,
            size: stat.size,
            mtime: stat.mtime
          });
        }
      }
    }
  } catch (e) {
    console.error(`Error scanning ${dirPath}:`, e);
  }
  return results;
}

// 应用准备就绪
app.whenReady().then(async () => {
  registerLocalResourceProtocol();
  createWindow();
  createMenu();
  createTray();
  initializeIpcHandlers();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

// 所有窗口关闭
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 退出前清理
app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
});

// 监听 WebContents 创建，增加安全性
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const allowedDomains = ['localhost'];
    try {
      const url = new URL(navigationUrl);
      if (!allowedDomains.includes(url.hostname)) {
        event.preventDefault();
      }
    } catch (e) {
      event.preventDefault();
    }
  });
  
  contents.setWindowOpenHandler(({ url }) => {
    const allowedDomains = ['localhost'];
    try {
      const targetUrl = new URL(url);
      if (allowedDomains.includes(targetUrl.hostname)) {
        return { action: 'allow' };
      }
    } catch (e) {
      // 忽略错误
    }
    
    shell.openExternal(url);
    return { action: 'deny' };
  });
});
