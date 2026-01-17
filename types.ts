
export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  url: string;
  coverUrl?: string;
  coverBlob?: Blob; 
  file: File;
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

export interface Playlist {
  id: string;
  name: string;
  songFingerprints: string[];
  coverUrl?: string;
  coverBlob?: Blob;
  createdAt: number;
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
  totalFilesCount?: number; 
  sourceType?: 'local' | 'webdav' | 'nas';
}

export interface LibraryGroup {
  name: string;
  tracks: Track[];
  coverUrl?: string;
}

export type ViewType = 'all' | 'collection' | 'player' | 'favorites' | 'folders' | 'artistProfile' | 'settings' | 'history' | 'albums' | 'artists' | 'playlists';

export type PlaybackMode = 'normal' | 'shuffle' | 'loop';

export interface AppSettings {
  enableAI: boolean;
  geminiApiKey: string;
  spinSpeed: number; 
  showParticles: boolean;
  showBlurBackground: boolean;
  useTraditionalChinese: boolean;
  showQualityTag: boolean;
}