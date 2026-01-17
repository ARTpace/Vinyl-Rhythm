interface FileSystemPermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemHandle {
  // 添加 readonly 修饰符以匹配其他声明
  readonly kind: 'file' | 'directory';
  // 添加 readonly 修饰符以匹配其他声明
  readonly name: string;
  isSameEntry: (other: FileSystemHandle) => Promise<boolean>;
  queryPermission: (descriptor?: FileSystemPermissionDescriptor) => Promise<PermissionState>;
  requestPermission: (descriptor?: FileSystemPermissionDescriptor) => Promise<PermissionState>;
}

interface FileSystemDirectoryHandle {
  readonly kind: 'directory';
  readonly name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface FileSystemFileHandle {
  readonly kind: 'file';
  readonly name: string;
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
  getFile(): Promise<File>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface Window {
  windowBridge?: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    openDirectory: () => Promise<string | null>;
    scanDirectory: (path: string) => Promise<Array<{
      path: string;
      name: string;
      ext: string;
      size: number;
      mtime: Date;
    }>>;
    getMetadata: (path: string) => Promise<{
      title?: string;
      artist?: string;
      album?: string;
      duration?: number;
      bitrate?: number;
      year?: number;
      genre?: string;
      cover?: {
        data: Uint8Array;
        format: string;
      };
    } | null>;
    webdavList: (options: { baseUrl: string; rootPath: string; username?: string; password?: string }) => Promise<Array<{
      remotePath: string;
      name: string;
      size: number;
      lastModified?: number;
    }>>;
    webdavListDir: (options: { baseUrl: string; rootPath?: string; username?: string; password?: string }) => Promise<Array<{
      remotePath: string;
      name: string;
      size: number;
      isCollection: boolean;
      lastModified?: number;
    }>>;
    webdavDownload: (options: { baseUrl: string; remotePath: string; username?: string; password?: string; folderId: string }) => Promise<{ localPath: string }>;
    webdavClearCache: (folderId: string) => Promise<void>;
  };
  shortcutBridge?: {
    onPlayPause: (callback: () => void) => () => void;
    onNext: (callback: () => void) => () => void;
    onPrev: (callback: () => void) => () => void;
    onStop: (callback: () => void) => () => void;
  };
  electronAPI?: {
    getAudioUrl: (filePath: string) => string;
  };
  showDirectoryPicker(options?: { id?: string; mode?: 'read' | 'readwrite'; startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' }): Promise<FileSystemDirectoryHandle>;
  showOpenFilePicker(options?: { multiple?: boolean; excludeAcceptAllOption?: boolean; types?: { description?: string; accept: Record<string, string[]> }[] }): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(options?: { suggestedName?: string; excludeAcceptAllOption?: boolean; types?: { description?: string; accept: Record<string, string[]> }[] }): Promise<FileSystemFileHandle>;
}
