const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] Preload script starting...');
console.log('[Preload] UserAgent:', navigator.userAgent);

const windowBridge = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  openDirectory: () => ipcRenderer.invoke('dialog:open-directory'),
  scanDirectory: (path) => ipcRenderer.invoke('fs:scan-directory', path),
  getMetadata: (path) => ipcRenderer.invoke('metadata:get', path)
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
  getAudioUrl: (filePath) => `local-resource://${filePath}`
});
