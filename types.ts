
export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  url: string;
  coverUrl?: string;
  file: File;
  duration?: number;
  // 新增指纹，用于增量识别
  fingerprint: string; 
}

export interface LibraryFolder {
  id: string;
  name: string;
  pathPlaceholder: string; // 在浏览器中通常是根文件夹名
  lastSync: number;
  trackCount: number;
}

export interface LibraryGroup {
  name: string;
  tracks: Track[];
  coverUrl?: string;
}

export type ViewType = 'all' | 'artists' | 'albums' | 'player' | 'favorites';

export type PlaybackMode = 'normal' | 'shuffle' | 'loop';
