
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
  folderId?: string;
  isUnsupported?: boolean; // 新增：是否为浏览器不支持的格式
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

export type ViewType = 'all' | 'artists' | 'albums' | 'player' | 'favorites' | 'folders' | 'artistProfile';

export type PlaybackMode = 'normal' | 'shuffle' | 'loop';
