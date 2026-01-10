
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Track, LibraryFolder, HistoryEntry } from '../types';
import { parseFileToTrack } from '../utils/audioParser';
import { SUPPORTED_FORMATS } from '../constants';
import { 
  saveLibraryFolder, 
  getAllLibraryFolders, 
  removeLibraryFolder, 
  readLocalFolderMetadata, 
  writeLocalFolderMetadata,
  getPlaybackHistory,
  clearPlaybackHistory,
  saveTracksToCache,
  getCachedTracks
} from '../utils/storage';
import { normalizeChinese } from '../utils/chineseConverter';

export const useLibraryManager = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [importedFolders, setImportedFolders] = useState<LibraryFolder[]>(() => {
    const saved = localStorage.getItem('vinyl_folders');
    return saved ? JSON.parse(saved) : [];
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [currentProcessingFile, setCurrentProcessingFile] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('vinyl_favorites');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // 记录文件夹是否在本次会话中已成功重连
  const resolvedFolders = useRef<Set<string>>(new Set());

  // 1. 初始化时优先从数据库缓存加载
  useEffect(() => {
    const loadCache = async () => {
      const cached = await getCachedTracks();
      if (cached && cached.length > 0) {
        // 缓存中没有 File 和 URL，此时只能显示，不能播放
        setTracks(cached.map(t => ({ ...t, file: null, url: '' })));
      }
    };
    loadCache();
  }, []);

  useEffect(() => {
    localStorage.setItem('vinyl_folders', JSON.stringify(importedFolders));
  }, [importedFolders]);

  const fetchHistory = useCallback(async () => {
    const data = await getPlaybackHistory();
    setHistoryEntries(data);
  }, []);

  const clearHistory = useCallback(async () => {
    await clearPlaybackHistory();
    setHistoryEntries([]);
  }, []);

  const historyTracks = useMemo(() => {
    return historyEntries.map(entry => {
      const match = tracks.find(t => t.fingerprint === entry.fingerprint);
      if (match) return { ...match, historyTime: entry.timestamp };
      return null;
    }).filter(t => t !== null) as (Track & { historyTime: number })[];
  }, [tracks, historyEntries]);

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    const q = normalizeChinese(searchQuery);
    return tracks.filter(t => 
      normalizeChinese(t.name).includes(q) || 
      normalizeChinese(t.artist).includes(q) || 
      normalizeChinese(t.album).includes(q)
    );
  }, [tracks, searchQuery]);

  const persistFolderMetadataToDisk = useCallback(async (folderId: string) => {
    const folders = await getAllLibraryFolders();
    const target = folders.find(f => f.id === folderId);
    if (!target) return;

    const folderTracks = tracks.filter(t => t.folderId === folderId);
    const metadata: any = {
      folderId,
      lastUpdate: Date.now(),
      tracks: {}
    };

    folderTracks.forEach(t => {
      metadata.tracks[t.fingerprint] = {
        name: t.name,
        artist: t.artist,
        album: t.album,
        year: t.year,
        genre: t.genre,
        duration: t.duration,
        bitrate: t.bitrate
      };
    });

    await writeLocalFolderMetadata(target.handle, metadata);
  }, [tracks]);

  const handleUpdateTrack = useCallback((trackId: string, updates: Partial<Track>) => {
    setTracks(prev => {
      const next = prev.map(t => t.id === trackId ? { ...t, ...updates } : t);
      const updatedTrack = next.find(t => t.id === trackId);
      if (updatedTrack?.folderId) {
        persistFolderMetadataToDisk(updatedTrack.folderId);
      }
      saveTracksToCache(next);
      return next;
    });
  }, [persistFolderMetadataToDisk]);

  const handleToggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      localStorage.setItem('vinyl_favorites', JSON.stringify(Array.from(n)));
      return n;
    });
  }, []);

  const scanDirectory = async (handle: FileSystemDirectoryHandle) => {
    const foundFiles: File[] = [];
    async function recursiveScan(dirHandle: FileSystemDirectoryHandle) {
      for await (const entry of (dirHandle as any).values()) {
        if (entry.kind === 'file' && SUPPORTED_FORMATS.some(ext => entry.name.toLowerCase().endsWith(ext))) {
          // getFile() 是耗时操作，但在 Web File System API 中获取大小必须调用它
          try {
            foundFiles.push(await entry.getFile());
          } catch (e) {}
        } else if (entry.kind === 'directory') {
          await recursiveScan(entry);
        }
      }
    }
    await recursiveScan(handle);
    return foundFiles;
  };

  const registerFolder = async (handle: FileSystemDirectoryHandle) => {
    const id = handle.name + "_" + Date.now();
    await saveLibraryFolder(id, handle);
    const newFolder: LibraryFolder = {
      id: id,
      name: handle.name,
      lastSync: 0,
      trackCount: 0
    };
    setImportedFolders(prev => [...prev, newFolder]);
    return id;
  };

  /**
   * 同步所有文件夹
   * 优化：如果是静默模式，不显示任何 UI，不设置 isImporting
   */
  const syncAll = async (isSilent: boolean = false) => {
    // 静默模式下不触发全局加载状态
    if (!isSilent) {
      setIsImporting(true);
      setImportProgress(0);
      setCurrentProcessingFile('正在检查本地曲库...');
    }

    return new Promise<boolean>(async (resolve) => {
      // 稍微延迟确保不会阻塞主线程 UI
      setTimeout(async () => {
        const savedFolders = await getAllLibraryFolders();
        if (savedFolders.length === 0) {
          if (!isSilent) setIsImporting(false);
          resolve(false);
          return;
        }

        const currentTracksMap = new Map<string, Track>(tracks.map(t => [t.fingerprint, t]));
        let allUpdatedTracks: Track[] = [];
        let nextImportedFolders: LibraryFolder[] = [...importedFolders];
        let filesToParse: { file: File, folderId: string }[] = [];
        let hasChanges = false;

        for (let i = 0; i < savedFolders.length; i++) {
          const folder = savedFolders[i];
          
          // 如果是静默模式且文件夹已解析过，跳过
          if (isSilent && resolvedFolders.current.has(folder.id)) {
            const folderTracks = tracks.filter(t => t.folderId === folder.id);
            allUpdatedTracks.push(...folderTracks);
            continue;
          }

          try {
            let permission = await folder.handle.queryPermission({ mode: 'read' });
            // 静默模式下如果没权限，直接保留缓存记录（不尝试播放），不弹窗
            if (permission !== 'granted' && !isSilent) {
              permission = await folder.handle.requestPermission({ mode: 'read' });
            }
            
            if (permission === 'granted') {
              if (!isSilent) setCurrentProcessingFile(`正在读取: ${folder.name}`);
              
              const diskFiles = await scanDirectory(folder.handle);
              let folderTrackCount = 0;

              for (const file of diskFiles) {
                const fingerprint = `${file.name}-${file.size}`;
                const cachedTrack = currentTracksMap.get(fingerprint);

                if (cachedTrack) {
                  // 命中缓存：快速重连，不需要重新解析元数据
                  allUpdatedTracks.push({
                    ...cachedTrack,
                    file: file,
                    url: URL.createObjectURL(file)
                  });
                  folderTrackCount++;
                } else {
                  // 新文件
                  filesToParse.push({ file, folderId: folder.id });
                }
              }
              
              // 更新文件夹状态
              const folderIdx = nextImportedFolders.findIndex(f => f.id === folder.id);
              if (folderIdx > -1) {
                nextImportedFolders[folderIdx] = {
                  ...nextImportedFolders[folderIdx],
                  lastSync: Date.now(),
                  trackCount: folderTrackCount + filesToParse.filter(f => f.folderId === folder.id).length
                };
              }
              
              resolvedFolders.current.add(folder.id);
              hasChanges = true;
            } else {
              // 没权限时，保留原样（显示但不能播放）
              const folderTracks = tracks.filter(t => t.folderId === folder.id);
              allUpdatedTracks.push(...folderTracks);
            }
          } catch (e) { console.error(e); }
        }

        // 解析新发现的文件（这是最慢的一步）
        if (filesToParse.length > 0) {
          hasChanges = true;
          for (let i = 0; i < filesToParse.length; i++) {
            const item = filesToParse[i];
            if (!isSilent) {
              setCurrentProcessingFile(`解析新曲目: ${item.file.name}`);
              setImportProgress(Math.round(((i + 1) / filesToParse.length) * 100));
            }
            try {
              const track: Track = await parseFileToTrack(item.file);
              track.folderId = item.folderId;
              allUpdatedTracks.push(track);
              // 增量更新 UI
              if (i % 10 === 0 && !isSilent) setTracks([...allUpdatedTracks]);
            } catch (e) {}
          }
        }

        if (hasChanges) {
          setTracks(allUpdatedTracks);
          setImportedFolders(nextImportedFolders);
          saveTracksToCache(allUpdatedTracks);
        }

        if (!isSilent) {
          setIsImporting(false);
          setImportProgress(0);
          setCurrentProcessingFile('');
        }
        resolve(allUpdatedTracks.length > 0);
      }, 50);
    });
  };

  const handleManualFilesSelect = async (fileList: FileList) => {
    const files = Array.from(fileList).filter(f => SUPPORTED_FORMATS.some(ext => f.name.toLowerCase().endsWith(ext)));
    if (files.length === 0) return;
    setIsImporting(true);
    setImportProgress(0);
    const folderId = "manual_" + Date.now();
    const newTracks: Track[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setCurrentProcessingFile(f.name);
      const t = await parseFileToTrack(f);
      t.folderId = folderId;
      newTracks.push(t);
      setImportProgress(Math.round(((i + 1) / files.length) * 100));
    }
    const totalTracks = [...tracks, ...newTracks];
    setTracks(totalTracks);
    saveTracksToCache(totalTracks);
    setImportedFolders(prev => [...prev, { id: folderId, name: "本地导入", lastSync: Date.now(), trackCount: files.length }]);
    setIsImporting(false);
    return true;
  };

  const removeFolder = async (id: string) => {
    await removeLibraryFolder(id);
    const nextTracks = tracks.filter(t => t.folderId !== id);
    setImportedFolders(prev => prev.filter(f => f.id !== id));
    setTracks(nextTracks);
    saveTracksToCache(nextTracks);
    resolvedFolders.current.delete(id);
  };

  return {
    tracks, setTracks, importedFolders, setImportedFolders,
    isImporting, importProgress, currentProcessingFile,
    searchQuery, setSearchQuery, filteredTracks,
    favorites, handleToggleFavorite, handleUpdateTrack,
    syncAll, registerFolder, removeFolder, handleManualFilesSelect, persistFolderMetadataToDisk,
    historyTracks, fetchHistory, clearHistory
  };
};
