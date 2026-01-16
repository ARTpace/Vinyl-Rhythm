/**
 * Vinyl-Rhythm Electron 配置
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  // 窗口配置
  window: {
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#1a1a2e'
  },

  // 路径配置
  paths: {
    // 托盘图标
    // trayIcon: path.join(__dirname, '../../public/icon-tray.png'),

    // 应用图标
    // appIcon: path.join(__dirname, '../../public/icon.ico')
  },

  // 支持的音频格式
  supportedFormats: [
    { name: 'FLAC', extensions: ['.flac'] },
    { name: 'ALAC', extensions: ['.m4a', '.alac'] },
    { name: 'APE', extensions: ['.ape'] },
    { name: 'WavPack', extensions: ['.wv'] },
    { name: 'Opus', extensions: ['.opus'] },
    { name: 'MIDI', extensions: ['.mid', '.midi'] },
    { name: 'DSD', extensions: ['.dsf', '.dff'] },
    { name: 'WAV', extensions: ['.wav'] },
    { name: 'MP3', extensions: ['.mp3'] },
    { name: 'AAC', extensions: ['.aac', '.m4a'] },
    { name: 'OGG', extensions: ['.ogg'] }
  ]
};
