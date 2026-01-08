
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

export type ViewType = 'all' | 'artists' | 'albums' | 'player' | 'favorites' | 'folders';

export type PlaybackMode = 'normal' | 'shuffle' | 'loop';
