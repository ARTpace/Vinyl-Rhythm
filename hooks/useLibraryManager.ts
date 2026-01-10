
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
          foundFiles.push(await entry.getFile());
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
   * 核心优化逻辑：同步所有文件夹
   * 如果 isSilent 为真，则尝试后台“重连”文件，而不重新解析元数据
   */
  const syncAll = async (isSilent: boolean = false) => {
    setIsImporting(true);
    setImportProgress(0);
    setCurrentProcessingFile(isSilent ? '正在恢复文件连接...' : '正在同步库...');

    return new Promise<boolean>(async (resolve) => {
      setTimeout(async () => {
        const savedFolders = await getAllLibraryFolders();
        if (savedFolders.length === 0) {
          setIsImporting(false);
          resolve(false);
          return;
        }

        // 建立当前内存中曲目的映射
        const currentTracksMap = new Map<string, Track>(tracks.map(t => [t.fingerprint, t]));
        let allUpdatedTracks: Track[] = [];
        let nextImportedFolders: LibraryFolder[] = importedFolders.filter(f => f.id.startsWith('manual_'));
        let filesToParse: { file: File, folderId: string }[] = [];

        for (const folder of savedFolders) {
          setCurrentProcessingFile(`检查文件夹: ${folder.name}`);
          try {
            let permission = await folder.handle.queryPermission({ mode: 'read' });
            // 如果是静默同步且没权限，跳过（防止弹窗干扰）
            if (permission !== 'granted' && !isSilent) {
              permission = await folder.handle.requestPermission({ mode: 'read' });
            }
            
            if (permission === 'granted') {
              const diskFiles = await scanDirectory(folder.handle);
              let folderTrackCount = 0;

              for (const file of diskFiles) {
                const fingerprint = `${file.name}-${file.size}`;
                const cachedTrack = currentTracksMap.get(fingerprint);

                if (cachedTrack) {
                  // 命中缓存：直接“重连” File 和 URL，跳过元数据解析
                  allUpdatedTracks.push({
                    ...cachedTrack,
                    file: file,
                    url: URL.createObjectURL(file)
                  });
                  folderTrackCount++;
                } else {
                  // 未命中的新文件才需要加入解析队列
                  filesToParse.push({ file, folderId: folder.id });
                }
              }
              
              nextImportedFolders.push({
                id: folder.id,
                name: folder.name,
                lastSync: Date.now(),
                trackCount: folderTrackCount
              });
            } else {
              // 没权限的文件夹，保留原有缓存（虽然不能播放，但能看）
              const orphanTracks = tracks.filter(t => t.folderId === folder.id);
              allUpdatedTracks.push(...orphanTracks);
              const existingFolder = importedFolders.find(f => f.id === folder.id);
              if (existingFolder) nextImportedFolders.push(existingFolder);
            }
          } catch (e) { console.error(e); }
        }

        // 深度解析新文件
        if (filesToParse.length > 0) {
          for (let i = 0; i < filesToParse.length; i++) {
            const item = filesToParse[i];
            setCurrentProcessingFile(`解析新曲目: ${item.file.name}`);
            try {
              const track: Track = await parseFileToTrack(item.file);
              track.folderId = item.folderId;
              allUpdatedTracks.push(track);
              setImportProgress(Math.round(((i + 1) / filesToParse.length) * 100));
              
              if (i % 5 === 0) setTracks([...allUpdatedTracks]);
            } catch (e) {}
          }
        }

        setTracks(allUpdatedTracks);
        setImportedFolders(nextImportedFolders);
        saveTracksToCache(allUpdatedTracks); // 更新数据库缓存

        setTimeout(() => {
          setIsImporting(false);
          setImportProgress(0);
          setCurrentProcessingFile('');
          resolve(allUpdatedTracks.length > 0);
        }, 500);
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
    setTimeout(() => {
      setIsImporting(false);
      setImportProgress(0);
      setCurrentProcessingFile('');
    }, 500);
    return true;
  };

  const removeFolder = async (id: string) => {
    await removeLibraryFolder(id);
    const nextTracks = tracks.filter(t => t.folderId !== id);
    setImportedFolders(prev => prev.filter(f => f.id !== id));
    setTracks(nextTracks);
    saveTracksToCache(nextTracks);
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
