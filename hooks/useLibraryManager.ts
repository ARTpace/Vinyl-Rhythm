
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
  clearPlaybackHistory
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

  const syncAll = async (isSilent: boolean = false) => {
    const savedFolders = await getAllLibraryFolders();
    if (savedFolders.length === 0) {
      setImportedFolders(prev => prev.filter(f => f.id.startsWith('manual_')));
      return false;
    }

    // 状态准备
    // 为 Map 显式指定类型，避免空数组导致的 any 类型推断问题
    const currentTracksMap = new Map<string, Track>(tracks.map(t => [t.fingerprint, t]));
    let allUpdatedTracks: Track[] = [];
    let nextImportedFolders: LibraryFolder[] = importedFolders.filter(f => f.id.startsWith('manual_'));
    
    // 待深度解析的文件
    let filesToParse: { file: File, folderId: string, localMeta?: any }[] = [];

    // 第一阶段：快速扫描目录结构 (并行)
    const scanResults = await Promise.all(savedFolders.map(async (folder) => {
      try {
        let permission = await folder.handle.queryPermission({ mode: 'read' });
        if (permission !== 'granted' && !isSilent) {
          permission = await folder.handle.requestPermission({ mode: 'read' });
        }
        if (permission === 'granted') {
          const diskFiles = await scanDirectory(folder.handle);
          const localMetadata = await readLocalFolderMetadata(folder.handle);
          return { folder, diskFiles, localMetadata, success: true };
        }
      } catch (e) { console.error(e); }
      return { folder, success: false };
    }));

    // 第二阶段：增量逻辑判断
    for (const result of scanResults) {
      if (!result || !result.success || !result.diskFiles) {
        const existing = importedFolders.find(f => f.id === result.folder.id);
        if (existing) nextImportedFolders.push(existing);
        continue;
      }

      const { folder, diskFiles, localMetadata } = result;
      let folderTracks: Track[] = [];

      for (const file of diskFiles) {
        const fingerprint = `${file.name}-${file.size}`;
        
        // 1. 优先从内存恢复
        if (currentTracksMap.has(fingerprint)) {
          // 确保从 Map 获取的是定义的 Track 类型
          const existingTrack = currentTracksMap.get(fingerprint);
          if (existingTrack) folderTracks.push(existingTrack);
          continue;
        }

        // 2. 其次从本地 .vinyl_rhythm.json 缓存恢复 (避免读取大文件元数据)
        if (localMetadata?.tracks?.[fingerprint]) {
          const cached = localMetadata.tracks[fingerprint];
          folderTracks.push({
            id: Math.random().toString(36).substring(2, 9),
            name: cached.name || file.name,
            artist: cached.artist || "未知歌手",
            album: cached.album || "未知专辑",
            url: URL.createObjectURL(file),
            file: file,
            duration: cached.duration,
            bitrate: cached.bitrate,
            fingerprint: fingerprint,
            year: cached.year,
            genre: cached.genre,
            lastModified: file.lastModified,
            folderId: folder.id
          });
          continue;
        }

        // 3. 实在没有，加入深度解析队列
        filesToParse.push({ file, folderId: folder.id, localMeta: localMetadata });
      }

      allUpdatedTracks = [...allUpdatedTracks, ...folderTracks];
    }

    // 第三阶段：如果有新文件，执行深度解析 (此时才开启 UI 进度条)
    if (filesToParse.length > 0) {
      setIsImporting(true);
      setImportProgress(0);
      
      for (let i = 0; i < filesToParse.length; i++) {
        const item = filesToParse[i];
        setCurrentProcessingFile(item.file.name);
        try {
          // 显式标注解析结果为 Track 类型，修复可能存在的 unknown 类型赋值错误
          const track: Track = await parseFileToTrack(item.file);
          track.folderId = item.folderId;
          allUpdatedTracks.push(track);
          
          setImportProgress(Math.round(((i + 1) / filesToParse.length) * 100));
          // 每 10 首歌更新一次 UI，防止界面卡死
          if (i % 10 === 0) setTracks([...allUpdatedTracks]);
        } catch (e) {}
      }
    }

    // 最终状态更新
    setTracks([...allUpdatedTracks]);
    
    // 更新文件夹列表中的统计信息
    const finalImportedFolders = [...nextImportedFolders];
    for (const result of scanResults) {
        if (!result.success) continue;
        const count = allUpdatedTracks.filter(t => t.folderId === result.folder.id).length;
        finalImportedFolders.push({
            id: result.folder.id,
            name: result.folder.name,
            lastSync: Date.now(),
            trackCount: count
        });
    }
    setImportedFolders(finalImportedFolders);

    // 延迟关闭进度条
    setTimeout(() => {
      setIsImporting(false);
      setImportProgress(0);
      setCurrentProcessingFile('');
    }, 500);

    return allUpdatedTracks.length > 0;
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
    setTracks(prev => [...prev, ...newTracks]);
    setImportedFolders(prev => [...prev, { id: folderId, name: "本地导入", lastSync: Date.now(), trackCount: files.length }]);
    setImportProgress(100);
    setTimeout(() => {
      setIsImporting(false);
      setImportProgress(0);
      setCurrentProcessingFile('');
    }, 500);
    return true;
  };

  const removeFolder = async (id: string) => {
    await removeLibraryFolder(id);
    setImportedFolders(prev => prev.filter(f => f.id !== id));
    setTracks(prev => prev.filter(t => t.folderId !== id));
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
