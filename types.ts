
export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  url: string;
  path?: string; // 新增：本地文件路径 (Electron)
  coverUrl?: string;
  coverBlob?: Blob; 
  file?: File; // 修改为可选
  duration?: number;
  bitrate?: number;
  fingerprint: string; 
  folderId?: string; 
  year?: number;      
  genre?: string;    
  lastModified: number; 
  dateAdded: number; // 新增：记录加入曲库的实际时间
  historyTime?: number; 
  duplicateCount?: number; 
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
  path?: string; // 新增：本地文件夹路径 (Electron)
  lastSync: number;
  trackCount: number;
  totalFilesCount?: number; 
}

export interface LibraryGroup {
  name: string;
  tracks: Track[];
  coverUrl?: string;
}

export type ViewType = 'all' | 'collection' | 'player' | 'favorites' | 'folders' | 'artistProfile' | 'settings' | 'history' | 'albums' | 'artists';

export type PlaybackMode = 'normal' | 'shuffle' | 'loop';

export interface AppSettings {
  enableAI: boolean;
  spinSpeed: number; 
  showParticles: boolean;
  showBlurBackground: boolean;
  useTraditionalChinese: boolean;
  showQualityTag: boolean;
}
