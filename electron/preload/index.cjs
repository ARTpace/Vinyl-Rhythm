const { contextBridge, ipcRenderer } = require('electron');
const { pathToFileURL } = require('url');

console.log('[Preload] Preload script starting...');
console.log('[Preload] UserAgent:', navigator.userAgent);

const windowBridge = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  openDirectory: () => ipcRenderer.invoke('dialog:open-directory'),
  scanDirectory: (path) => ipcRenderer.invoke('fs:scan-directory', path),
  getMetadata: (path) => ipcRenderer.invoke('metadata:get', path),
  webdavList: (options) => ipcRenderer.invoke('webdav:list', options),
  webdavDownload: (options) => ipcRenderer.invoke('webdav:download', options),
  webdavClearCache: (folderId) => ipcRenderer.invoke('webdav:clear-cache', folderId)
};

const shortcutBridge = {
  onPlayPause: (callback) => {
    ipcRenderer.on('shortcut-play-pause', () => callback());
    return () => ipcRenderer.removeListener('shortcut-play-pause', callback);
  },
  onNext: (callback) => {
    ipcRenderer.on('shortcut-next', () => callback());
    return () => ipcRenderer.removeListener('shortcut-next', callback);
  },
  onPrev: (callback) => {
    ipcRenderer.on('shortcut-prev', () => callback());
    return () => ipcRenderer.removeListener('shortcut-prev', callback);
  },
  onStop: (callback) => {
    ipcRenderer.on('shortcut-stop', () => callback());
    return () => ipcRenderer.removeListener('shortcut-stop', callback);
  }
};

contextBridge.exposeInMainWorld('windowBridge', windowBridge);
contextBridge.exposeInMainWorld('shortcutBridge', shortcutBridge);
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 把 Windows 本地路径 / UNC 网络路径转换成 <audio> 能加载的 URL
   * - 本地盘符路径：C:\Music\a.flac => local-resource:///C:/Music/a.flac
   * - UNC 路径：\\192.168.1.10\share\a.flac => local-resource://192.168.1.10/share/a.flac
   */
  getAudioUrl: (filePath) => {
    if (!filePath) return '';

    const raw = String(filePath);
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('local-resource://') || raw.startsWith('file://')) {
      return raw;
    }

    const normalized = raw.replace(/\\/g, '/');

    if (normalized.startsWith('//')) {
      const withoutPrefix = normalized.replace(/^\/\//, '');
      const parts = withoutPrefix.split('/').filter(Boolean);
      const host = parts.shift();
      if (!host) return '';
      const rest = parts.map((p) => encodeURIComponent(p)).join('/');
      return `local-resource://${host}/${rest}`;
    }

    if (/^[a-zA-Z]:\//.test(normalized)) {
      const driveLetter = normalized.substring(0, 1).toUpperCase();
      const restPath = normalized.substring(2);
      const encodedParts = restPath.split('/').filter(Boolean).map(encodeURIComponent).join('/');
      return `file:///${driveLetter}:/${encodedParts}`;
    }

    try {
      return pathToFileURL(filePath).href;
    } catch (e) {
      const fallback = normalized.split('/').map(encodeURIComponent).join('/');
      return `local-resource:///${fallback}`;
    }
  }
});
