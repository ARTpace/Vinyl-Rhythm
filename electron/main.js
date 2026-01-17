/**
 * Vinyl-Rhythm Electron 主进程
 * 已转换为 ES Module 以适配 package.json 的 "type": "module"
 */

import { app, BrowserWindow, ipcMain, globalShortcut, shell, Tray, Menu, protocol, dialog, net } from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';
import { Readable } from 'stream';
import config from './config/index.js';
import { findFolderCover, readCoverAsUint8Array } from '../utils/coverUtil.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 清理和分割歌手名称
 * 支持使用 / & 、 , ; feat. ft. 等分隔符分割多个歌手
 */
const cleanArtistName = (artist) => {
  if (!artist) return '未知歌手';

  const standardDelimiters = /\s*[\/&、,;]\s*|\s+feat\.?\s+|\s+ft\.?\s+/i;
  let artists = String(artist).split(standardDelimiters)
    .map(a => a.trim())
    .filter(a => a.length > 0);

  return artists.join(' / ');
};

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
const dataRootName = app.isPackaged ? 'VinylRhythm' : 'VinylRhythmDev';
const dataRootPath = path.join(app.getPath('appData'), dataRootName);
const userDataPath = path.join(dataRootPath, 'Profile');
const cachePath = path.join(dataRootPath, 'Cache');

[dataRootPath, userDataPath, cachePath].forEach((p) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

app.setPath('userData', userDataPath);
app.setPath('cache', cachePath);
app.commandLine.appendSwitch('user-data-dir', userDataPath);
app.commandLine.appendSwitch('disk-cache-dir', cachePath);

let mainWindow = null;
let tray = null;
let isQuitting = false;

/**
 * 注册本地资源协议，允许加载本地音频文件
 */
function registerLocalResourceProtocol() {
  protocol.handle('local-resource', (request) => {
    console.log('[LocalResource] Request URL:', request.url);
    let decodedPath = '';

    try {
      const u = new URL(request.url);
      const hostname = u.hostname || '';
      const pathname = u.pathname || '';
      const decodedPathname = decodeURIComponent(pathname);

      console.log('[LocalResource] hostname:', hostname);
      console.log('[LocalResource] pathname:', pathname);
      console.log('[LocalResource] decodedPathname:', decodedPathname);

      if (hostname) {
        if (hostname.includes(':') && /^[A-Za-z]:$/.test(hostname)) {
          decodedPath = `${hostname}${decodedPathname}`.replace(/\//g, '\\');
        } else {
          decodedPath = `\\\\${hostname}${decodedPathname}`.replace(/\//g, '\\');
        }
      } else {
        let p = decodedPathname;
        if (p.startsWith('/')) p = p.slice(1);
        if (p.startsWith('//')) {
          decodedPath = `\\\\${p.slice(2)}`.replace(/\//g, '\\');
        } else {
          decodedPath = p.replace(/\//g, '\\');
        }
      }

      decodedPath = path.win32.normalize(decodedPath);
      if (decodedPath.endsWith('\\')) decodedPath = decodedPath.slice(0, -1);
      console.log('[LocalResource] normalized path:', decodedPath);
    } catch (e) {
      console.error('[LocalResource] URL parse error:', e);
      return new Response('Invalid URL', { status: 400 });
    }

    console.log('[LocalResource] Final path:', decodedPath);

    const isUncPath = decodedPath.startsWith('\\\\');
    let fileSize = null;
    let mimeType = 'application/octet-stream';

    try {
      const ext = path.extname(decodedPath).toLowerCase();
      mimeType = 'audio/mpeg';
      if (ext === '.flac') mimeType = 'audio/flac';
      else if (ext === '.wav') mimeType = 'audio/wav';
      else if (ext === '.ogg') mimeType = 'audio/ogg';
      else if (ext === '.m4a') mimeType = 'audio/mp4';
      else if (ext === '.aac') mimeType = 'audio/aac';

      if (!fs.existsSync(decodedPath)) {
        console.warn(`[LocalResource] File not found: ${decodedPath}`);
        return new Response('File Not Found', { status: 404 });
      }

      const stat = fs.statSync(decodedPath);
      fileSize = stat.size;

      const baseHeaders = new Headers();
      baseHeaders.set('Content-Type', mimeType);
      baseHeaders.set('Accept-Ranges', 'bytes');

      if (fileSize !== null) {
        baseHeaders.set('Content-Length', String(fileSize));
      }

      if (request.method === 'HEAD') {
        if (fileSize !== null) {
          baseHeaders.set('Content-Length', String(fileSize));
        }
        return new Response(null, { status: 200, headers: baseHeaders });
      }

      const rangeHeader = request.headers.get('range') || request.headers.get('Range');
      if (rangeHeader) {
        if (fileSize === null) {
          return new Response('Range requests require file size', { status: 416, headers: baseHeaders });
        }
        const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader);
        if (!match) {
          const headers = new Headers(baseHeaders);
          headers.set('Content-Range', `bytes */${fileSize}`);
          return new Response(null, { status: 416, headers });
        }

        let start = match[1] ? parseInt(match[1], 10) : NaN;
        let end = match[2] ? parseInt(match[2], 10) : NaN;

        if (Number.isNaN(start)) {
          const suffixLength = Number.isNaN(end) ? 0 : end;
          if (!suffixLength) {
            const headers = new Headers(baseHeaders);
            headers.set('Content-Range', `bytes */${fileSize}`);
            return new Response(null, { status: 416, headers });
          }
          start = Math.max(fileSize - suffixLength, 0);
          end = fileSize - 1;
        } else {
          if (Number.isNaN(end) || end >= fileSize) end = fileSize - 1;
        }

        if (start < 0 || start >= fileSize || start > end) {
          const headers = new Headers(baseHeaders);
          headers.set('Content-Range', `bytes */${fileSize}`);
          return new Response(null, { status: 416, headers });
        }

        const stream = fs.createReadStream(decodedPath, { start, end });
        const headers = new Headers(baseHeaders);
        headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        headers.set('Content-Length', String(end - start + 1));
        return new Response(Readable.toWeb(stream), { status: 206, headers });
      }

      const stream = fs.createReadStream(decodedPath);
      const headers = new Headers(baseHeaders);
      if (fileSize !== null) {
        headers.set('Content-Length', String(fileSize));
      }
      return new Response(Readable.toWeb(stream), { status: 200, headers });
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
  
  const preloadPath = isDev 
    ? path.join(__dirname, 'preload', 'index.cjs')
    : path.resolve(__dirname, 'preload', 'index.cjs');
    
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
  const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
  const prodIndexPath = path.join(app.getAppPath(), 'dist', 'index.html');

  if (isDev) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(prodIndexPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[Main] did-fail-load:', { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[Main] render-process-gone:', details);
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
      const props = {
        properties: ['openDirectory'],
        title: '选择音乐文件夹',
        buttonLabel: '选择文件夹'
      };

      const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
      let result;
      try {
        result = await dialog.showOpenDialog(parent, props);
      } catch (e) {
        console.error('[Main] showOpenDialog (with parent) failed:', e);
        result = await dialog.showOpenDialog(undefined, props);
      }

      const { canceled, filePaths } = result;
      
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
      throw new Error(`主进程打开对话框失败: ${error?.message || String(error)}`);
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
        console.log('[Main] Cover found in file:', pic.format, pic.data ? pic.data.length : 0);
        coverData = {
          data: pic.data ? new Uint8Array(pic.data) : null,
          format: pic.format
        };
      } else {
        console.log('[Main] No embedded cover, searching for folder cover...');
        const folderCoverPath = findFolderCover(filePath);
        if (folderCoverPath) {
          console.log('[Main] Folder cover found:', folderCoverPath);
          const folderCover = readCoverAsUint8Array(folderCoverPath);
          if (folderCover) {
            coverData = folderCover;
            console.log('[Main] Folder cover loaded:', folderCover.format, folderCover.data?.length);
          }
        } else {
          console.log('[Main] No folder cover found');
        }
      }

      return {
        title: common.title,
        artist: cleanArtistName(common.artist || (Array.isArray(common.artists) ? common.artists.join(' / ') : undefined) || common.albumartist),
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

  ipcMain.handle('webdav:list', async (_event, options) => {
    try {
      const { baseUrl, rootPath, username, password } = options || {};
      if (!baseUrl || !rootPath) return [];
      return await webdavListRecursive({ baseUrl, rootPath, username, password });
    } catch {
      return [];
    }
  });

  ipcMain.handle('webdav:download', async (_event, options) => {
    const { baseUrl, remotePath, username, password, folderId } = options || {};
    if (!baseUrl || !remotePath || !folderId) throw new Error('Invalid download options');
    const localPath = await webdavDownloadToCache({ baseUrl, remotePath, username, password, folderId });
    return { localPath };
  });

  ipcMain.handle('webdav:clear-cache', async (_event, folderId) => {
    if (!folderId) return;
    await webdavClearFolderCache(folderId);
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

function basicAuthHeader(username, password) {
  if (!username && !password) return undefined;
  const raw = `${username || ''}:${password || ''}`;
  return `Basic ${Buffer.from(raw, 'utf8').toString('base64')}`;
}

function normalizeWebdavRootPath(rootPath) {
  let p = String(rootPath || '').trim();
  p = p.replace(/^\/+/, '');
  return p;
}

function resolveWebdavUrl(baseUrl, pathname) {
  const u = new URL(baseUrl);
  let base = u.toString();
  if (!base.endsWith('/')) base = `${base}/`;
  const raw = String(pathname || '');
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return new URL(raw, base).toString();
}

function decodeXmlText(input) {
  return String(input || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseWebdavMultistatus(xmlText, requestPathname) {
  const xml = String(xmlText || '');
  const responses = xml.match(/<[^:>]*:response\b[\s\S]*?<\/[^:>]*:response>/gi) || [];
  const items = [];

  for (const block of responses) {
    const hrefMatch = block.match(/<[^:>]*:href>([\s\S]*?)<\/[^:>]*:href>/i);
    if (!hrefMatch) continue;
    const hrefRaw = decodeXmlText(hrefMatch[1].trim());

    let fullUrl;
    try {
      fullUrl = new URL(hrefRaw, 'http://placeholder/');
    } catch {
      fullUrl = null;
    }

    let pathname = hrefRaw;
    try {
      if (hrefRaw.startsWith('http://') || hrefRaw.startsWith('https://')) {
        pathname = new URL(hrefRaw).pathname;
      } else if (fullUrl && fullUrl.origin !== 'null') {
        pathname = fullUrl.pathname;
      }
    } catch {}

    try {
      pathname = decodeURIComponent(pathname);
    } catch {}

    const isCollection = /<[^:>]*:collection\s*\/\s*>/i.test(block) || /<[^:>]*:collection\b/i.test(block);
    const sizeMatch = block.match(/<[^:>]*:getcontentlength>(\d+)<\/[^:>]*:getcontentlength>/i);
    const lastModifiedMatch = block.match(/<[^:>]*:getlastmodified>([\s\S]*?)<\/[^:>]*:getlastmodified>/i);
    const size = sizeMatch ? Number(sizeMatch[1]) : 0;
    const lastModified = lastModifiedMatch ? Date.parse(decodeXmlText(lastModifiedMatch[1].trim())) : NaN;

    if (requestPathname && (pathname === requestPathname || pathname === `${requestPathname}/`)) continue;

    const name = pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop() || pathname;
    let decodedName = name;
    try {
      decodedName = decodeURIComponent(name);
    } catch {}
    items.push({
      remotePath: pathname,
      name: decodedName,
      size: Number.isFinite(size) ? size : 0,
      isCollection,
      lastModified: Number.isFinite(lastModified) ? lastModified : undefined
    });
  }

  return items;
}

function webdavPropfind({ url, username, password }) {
  const auth = basicAuthHeader(username, password);
  const body =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<d:propfind xmlns:d="DAV:">` +
    `<d:prop><d:resourcetype/><d:getcontentlength/><d:getlastmodified/></d:prop>` +
    `</d:propfind>`;

  return new Promise((resolve, reject) => {
    const req = net.request({
      method: 'PROPFIND',
      url
    });
    req.setHeader('Depth', '1');
    req.setHeader('Content-Type', 'application/xml; charset=utf-8');
    if (auth) req.setHeader('Authorization', auth);

    const chunks = [];
    req.on('response', (res) => {
      res.on('data', (d) => chunks.push(Buffer.from(d)));
      res.on('end', () => {
        const status = res.statusCode || 0;
        if (status >= 200 && status < 300) {
          resolve(Buffer.concat(chunks).toString('utf8'));
        } else {
          reject(new Error(`WebDAV PROPFIND failed: ${status}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function webdavListRecursive({ baseUrl, rootPath, username, password }) {
  const root = normalizeWebdavRootPath(rootPath);
  const visited = new Set();
  const out = [];

  const walk = async (currentUrl) => {
    const normalizedUrl = currentUrl.endsWith('/') ? currentUrl : `${currentUrl}/`;
    if (visited.has(normalizedUrl)) return;
    visited.add(normalizedUrl);

    const xml = await webdavPropfind({ url: normalizedUrl, username, password });
    let requestPathname = '';
    try {
      requestPathname = new URL(normalizedUrl).pathname;
    } catch {}
    const items = parseWebdavMultistatus(xml, requestPathname || '');

    for (const it of items) {
      if (it.isCollection) {
        const nextUrl = resolveWebdavUrl(baseUrl, it.remotePath);
        await walk(nextUrl);
      } else {
        out.push({
          remotePath: it.remotePath,
          name: it.name,
          size: it.size,
          lastModified: it.lastModified
        });
      }
    }
  };

  const rootUrl = resolveWebdavUrl(baseUrl, root ? `${root.replace(/\/+$/, '')}/` : '');
  await walk(rootUrl);
  return out;
}

function safePathSegment(seg) {
  return String(seg || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeRelativePathFromRemote(remotePath) {
  const normalized = String(remotePath || '').replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean).map(safePathSegment).filter(Boolean);
  const limited = parts.slice(-12);
  return limited.join(path.sep);
}

async function webdavDownloadToCache({ baseUrl, remotePath, username, password, folderId }) {
  const auth = basicAuthHeader(username, password);
  const remote = String(remotePath || '');
  const url = resolveWebdavUrl(baseUrl, remote);

  const baseDir = path.join(cachePath, 'webdav-cache', safePathSegment(folderId));
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

  const rel = safeRelativePathFromRemote(remote);
  const localPath = path.join(baseDir, rel);
  const localDir = path.dirname(localPath);
  if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const req = net.request(url);
    req.method = 'GET';
    if (auth) req.setHeader('Authorization', auth);
    req.on('response', (res) => {
      const status = res.statusCode || 0;
      if (status < 200 || status >= 300) {
        res.resume();
        reject(new Error(`WebDAV download failed: ${status}`));
        return;
      }
      const ws = fs.createWriteStream(localPath);
      res.on('error', reject);
      ws.on('error', reject);
      ws.on('finish', () => resolve(localPath));
      res.pipe(ws);
    });
    req.on('error', reject);
    req.end();
  });
}

async function webdavClearFolderCache(folderId) {
  const baseDir = path.join(cachePath, 'webdav-cache', safePathSegment(folderId));
  if (!fs.existsSync(baseDir)) return;
  await fs.promises.rm(baseDir, { recursive: true, force: true });
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
