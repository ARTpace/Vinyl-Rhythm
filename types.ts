
export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  url: string;
  coverUrl?: string;
  file: File;
  duration?: number;
  bitrate?: number;
  fingerprint: string; 
  folderId?: string; // 关联到具体的导入文件夹
  year?: number;      // 发行年份
  genre?: string;    // 流派
  lastModified: number; // 文件最后修改时间，用于“最近添加”排序
  historyTime?: number; // 播放历史时间戳
}

export interface HistoryEntry {
  fingerprint: string;
  name: string;
  artist: string;
  album: string;
  coverUrl?: string;
  timestamp: number;
}

export interface LibraryFolder {
  id: string;
  name: string;
  lastSync: number;
  trackCount: number;
}

export interface LibraryGroup {
  name: string;
  tracks: Track[];
  coverUrl?: string;
}

export type ViewType = 'all' | 'collection' | 'player' | 'favorites' | 'folders' | 'artistProfile' | 'settings' | 'history';

export type PlaybackMode = 'normal' | 'shuffle' | 'loop';

export interface AppSettings {
  enableAI: boolean;
  spinSpeed: number; // 1-20
  showParticles: boolean;
  showBlurBackground: boolean;
  useTraditionalChinese: boolean;
  showQualityTag: boolean;
}
