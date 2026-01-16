
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Track, LibraryFolder, HistoryEntry } from '../types';
import { parseFileToTrack } from '../utils/audioParser';
import { SUPPORTED_FORMATS } from '../constants';
import { 
  saveLibraryFolder, 
  getAllLibraryFolders, 
  removeLibraryFolder, 
  getPlaybackHistory,
  clearPlaybackHistory,
  saveTracksToCache,
  getCachedTracks,
  addToHistory
} from '../utils/storage';
import { normalizeChinese } from '../utils/chineseConverter';

export const useLibraryManager = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [importedFolders, setImportedFolders] = useState<(LibraryFolder & { hasHandle: boolean })[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [currentProcessingFile, setCurrentProcessingFile] = useState('');
  const [syncingFolderId, setSyncingFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [needsPermission, setNeedsPermission] = useState(false);
  const [nasMode, setNasMode] = useState(false);
  
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('vinyl_favorites');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const checkNasMode = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const status = await res.json();
        setNasMode(status.nasMode);
        return status.nasMode;
      }
    } catch (e) {
      return false;
    }
    return false;
  }, []);

  const syncNasLibrary = useCallback(async () => {
    if (isImporting) return;
    setIsImporting(true);
    setImportProgress(0);
    setCurrentProcessingFile('正在扫描 NAS 存储卷...');
    
    try {
      const res = await fetch('/api/scan');
      if (!res.ok) throw new Error('NAS API inaccessible');
      const nasFiles = await res.json();
      
      const cachedTracks = await getCachedTracks();
      const newTracks: Track[] = [];
      const total = nasFiles.length;
      
      for (let i = 0; i < total; i++) {
        const fileData = nasFiles[i];
        // 指纹保持一致性，确保即使从本地切换到 NAS 也能识别同一首歌
        const fingerprint = `${fileData.name}-${fileData.size}`;
        
        const existing = cachedTracks.find((t: any) => t.fingerprint === fingerprint);
        if (existing) {
           newTracks.push({
             ...existing,
             url: `/api/stream?path=${encodeURIComponent(fileData.path)}`
           });
        } else {
           newTracks.push({
             id: Math.random().toString(36).substring(2, 9),
             name: fileData.name.replace(/\.[^/.]+$/, ""),
             artist: '未知歌手',
             album: 'NAS 卷',
             url: `/api/stream?path=${encodeURIComponent(fileData.path)}`,
             fingerprint: fingerprint,
             folderId: 'NAS_ROOT',
             lastModified: fileData.lastModified,
             dateAdded: Date.now(),
             file: null as any
           });
        }
        
        if (i % 20 === 0) {
          setImportProgress(Math.floor((i / total) * 100));
        }
      }
      
      setTracks(newTracks);
      await saveTracksToCache(newTracks);
      setImportProgress(100);
    } catch (e) {
      console.error('NAS Sync Error:', e);
    } finally {
      setIsImporting(false);
    }
  }, [isImporting]);

  const loadData = useCallback(async () => {
    console.log("loadData: starting...");
    const isNas = await checkNasMode();
    const cached = await getCachedTracks();
    console.log("loadData: cached tracks count:", cached.length);
    
    if (isNas) {
      console.log("loadData: NAS mode active");
      // NAS 模式下忽略文件夹记录，直接同步
      setImportedFolders([{ id: 'NAS_ROOT', name: 'NAS 存储卷', lastSync: Date.now(), trackCount: cached.length, hasHandle: true }]);
      if (cached.length === 0) {
        syncNasLibrary();
      } else {
        setTracks(cached);
      }
    } else {
      console.log("loadData: Local mode active, fetching folders");
      const foldersFromDB = await getAllLibraryFolders();
      console.log("loadData: foldersFromDB count:", foldersFromDB.length);
      setImportedFolders(foldersFromDB.map(f => ({
        ...f,
        lastSync: f.lastSync || 0,
        trackCount: cached.filter(t => t.folderId === f.id).length,
        hasHandle: window.windowBridge ? !!f.path : !!f.handle 
      })));
      if (cached && cached.length > 0) {
        console.log("loadData: setting tracks from cache");
        setTracks(cached);
      }
      if (foldersFromDB.length > 0 && !window.windowBridge && foldersFromDB.some(f => !f.handle)) {
        console.log("loadData: needs permission");
        setNeedsPermission(true);
      } else {
        setNeedsPermission(false);
      }
    }
    console.log("loadData: finished");
  }, [checkNasMode, syncNasLibrary]);

  useEffect(() => {
    loadData();
  }, []);

  const fetchHistory = useCallback(async () => {
    const data = await getPlaybackHistory();
    setHistoryEntries(data);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const clearHistory = useCallback(async () => {
    await clearPlaybackHistory();
    setHistoryEntries([]);
  }, []);

  const recordTrackPlayback = useCallback(async (track: Track) => {
    await addToHistory(track);
    await fetchHistory();
  }, [fetchHistory]);

  const resolveTrackFile = useCallback(async (track: Track): Promise<Track | null> => {
    // Electron 环境下使用自定义协议
    if (window.electronAPI && track.path) {
      return {
        ...track,
        url: window.electronAPI.getAudioUrl(track.path)
      };
    }

    // NAS 模式下的曲目自带 /api/stream 的 URL，直接播放即可
    if (track.url && (track.url.startsWith('http') || track.url.startsWith('/api'))) return track;
    if (track.file && track.url) return track;
    
    const folders = await getAllLibraryFolders();
    const folder = folders.find(f => f.id === track.folderId);
    
    if (!folder || !folder.handle) {
      if (!nasMode) setNeedsPermission(true);
      return null;
    }

    try {
      let permission = await folder.handle.queryPermission({ mode: 'read' });
      if (permission !== 'granted') {
        permission = await folder.handle.requestPermission({ mode: 'read' });
      }
      if (permission !== 'granted') return null;

      const findFile = async (dirHandle: FileSystemDirectoryHandle, fileName: string): Promise<File | null> => {
        for await (const entry of (dirHandle as any).values()) {
          if (entry.kind === 'file' && entry.name === fileName) {
            return await entry.getFile();
          } else if (entry.kind === 'directory') {
            const result = await findFile(entry as FileSystemDirectoryHandle, fileName);
            if (result) return result;
          }
        }
        return null;
      };

      const file = await findFile(folder.handle, (track as any).fileName || "");
      if (file) {
        const url = URL.createObjectURL(file);
        let updatedTrack = { ...track, file, url };
        if (!track.coverBlob) {
          const fresh = await parseFileToTrack(file);
          updatedTrack.coverBlob = fresh.coverBlob;
          updatedTrack.coverUrl = fresh.coverUrl;
          await saveTracksToCache([updatedTrack]);
        }
        
        setTracks(prev => prev.map(t => t.fingerprint === track.fingerprint ? updatedTrack : t));
        return updatedTrack;
      }
    } catch (e) { console.error(e); }
    return null;
  }, [nasMode]);

  const handleManualFilesSelect = useCallback(async (files: FileList) => {
    setIsImporting(true);
    setImportProgress(0);
    const total = files.length;
    
    const BATCH_SIZE = 15;
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batchFiles = Array.from(files).slice(i, i + BATCH_SIZE);
      const batchTracks: Track[] = [];
      
      for (const file of batchFiles) {
        if (SUPPORTED_FORMATS.some(ext => file.name.toLowerCase().endsWith(ext))) {
          setCurrentProcessingFile(file.name);
          try {
            const track = await parseFileToTrack(file);
            batchTracks.push(track);
          } catch (e) { console.error(e); }
        }
      }

      if (batchTracks.length > 0) {
        await saveTracksToCache(batchTracks);
        setTracks(prev => {
          const existingFingerprints = new Set(prev.map(t => t.fingerprint));
          const newUnique = batchTracks.filter(t => !existingFingerprints.has(t.fingerprint));
          return [...prev, ...newUnique];
        });
      }

      setImportProgress(Math.floor((Math.min(i + BATCH_SIZE, total) / total) * 100));
      await new Promise(r => requestAnimationFrame(r));
    }

    setIsImporting(false);
    return true;
  }, []);

  const syncFolders = useCallback(async (specificFolderId?: string) => {
    if (nasMode) {
      return syncNasLibrary();
    }

    setIsImporting(true);
    setImportProgress(0);
    setSyncingFolderId(specificFolderId || 'ALL');
    setCurrentProcessingFile('正在盘点本地路径...');

    const savedFolders = await getAllLibraryFolders();
    if (savedFolders.length === 0) { setIsImporting(false); setSyncingFolderId(null); return false; }

    const foldersToScan = specificFolderId 
      ? savedFolders.filter(f => f.id === specificFolderId)
      : savedFolders;

    if (window.windowBridge) {
      console.log("syncFolders: In Electron environment, starting native scan");
      // Electron 环境下的原生扫描
      for (const folder of foldersToScan) {
        if (!folder.path) {
          console.warn(`syncFolders: Folder ${folder.name} has no path, skipping`);
          continue;
        }
        console.log(`syncFolders: Scanning folder ${folder.name} at path ${folder.path}`);
        setCurrentProcessingFile(`正在扫描 ${folder.name}...`);
        
        try {
          const files = await window.windowBridge.scanDirectory(folder.path);
          console.log(`syncFolders: scanDirectory found ${files.length} files`);
          const total = files.length;
          let processedCount = 0;
          const batchResults: Track[] = [];

          const BATCH_SIZE = 15;
          for (let i = 0; i < files.length; i += BATCH_SIZE) {
            const batch = files.slice(i, i + BATCH_SIZE);
            const batchTracks: Track[] = [];

            for (const fileData of batch) {
              const fingerprint = `${fileData.name}-${fileData.size}`;
              const isExisting = tracks.some(t => t.fingerprint === fingerprint);
              
              if (!isExisting) {
                setCurrentProcessingFile(fileData.name);
                try {
                  // 确保 mtime 是 Date 对象
                  const mtime = fileData.mtime instanceof Date ? fileData.mtime : new Date(fileData.mtime);

                  // 在 Electron 中，直接调用主进程获取元数据
                  const nativeMetadata = await window.windowBridge.getMetadata(fileData.path);
                  
                  if (nativeMetadata) {
                    let coverUrl: string | undefined = undefined;
                    let coverBlob: Blob | undefined = undefined;

                    if (nativeMetadata.cover) {
                      // 强制转换为 any 以绕过 Uint8Array/SharedArrayBuffer 的类型检查
                      coverBlob = new Blob([nativeMetadata.cover.data as any], { type: nativeMetadata.cover.format });
                      coverUrl = URL.createObjectURL(coverBlob);
                    }

                    const track: Track = {
                      id: Math.random().toString(36).substring(2, 9),
                      name: nativeMetadata.title || fileData.name,
                      artist: nativeMetadata.artist || '未知歌手',
                      album: nativeMetadata.album || '本地曲库',
                      path: fileData.path,
                      url: window.electronAPI.getAudioUrl(fileData.path),
                      coverUrl,
                      coverBlob,
                      duration: nativeMetadata.duration,
                      bitrate: nativeMetadata.bitrate,
                      fingerprint: fingerprint,
                      folderId: folder.id,
                      year: nativeMetadata.year,
                      genre: nativeMetadata.genre,
                      lastModified: mtime.getTime(),
                      dateAdded: Date.now()
                    };
                    batchTracks.push(track);
                  } else {
                    throw new Error("Native metadata parsing returned null");
                  }
                } catch (e) {
                  console.error(`Error parsing ${fileData.name}:`, e);
                  const mtime = fileData.mtime instanceof Date ? fileData.mtime : new Date(fileData.mtime);
                  
                  // 回退到基本信息
                  batchTracks.push({
                    id: Math.random().toString(36).substring(2, 9),
                    name: fileData.name,
                    artist: '未知歌手',
                    album: '本地曲库',
                    path: fileData.path,
                    url: window.electronAPI.getAudioUrl(fileData.path),
                    fingerprint: fingerprint,
                    folderId: folder.id,
                    lastModified: mtime.getTime(),
                    dateAdded: Date.now()
                  });
                }
              }
              processedCount++;
            }

            if (batchTracks.length > 0) {
              await saveTracksToCache(batchTracks);
              setTracks(prev => {
                const existingFingerprints = new Set(prev.map(t => t.fingerprint));
                const newUnique = batchTracks.filter(t => !existingFingerprints.has(t.fingerprint));
                return [...prev, ...newUnique];
              });
            }
            setImportProgress(Math.floor((processedCount / total) * 100));
          }

          await saveLibraryFolder(folder.id, undefined as any, total, Date.now(), folder.path);
        } catch (e) {
          console.error(`Failed to scan ${folder.path}`, e);
        }
      }
      
      setIsImporting(false);
      setSyncingFolderId(null);
      await loadData();
      return true;
    }

    const filesToProcess: { handle: FileSystemFileHandle, folderId: string, folderHandle: FileSystemDirectoryHandle }[] = [];

    for (const folder of foldersToScan) {
      if (!folder.handle) continue;
      try {
        let permission = await folder.handle.queryPermission({ mode: 'read' });
        if (permission !== 'granted') permission = await folder.handle.requestPermission({ mode: 'read' });
        
        if (permission === 'granted') {
          const fastScan = async (dirHandle: FileSystemDirectoryHandle) => {
            for await (const [name, entry] of (dirHandle as any)) {
              if (entry.kind === 'file' && SUPPORTED_FORMATS.some(ext => name.toLowerCase().endsWith(ext))) {
                filesToProcess.push({ handle: entry as FileSystemFileHandle, folderId: folder.id, folderHandle: folder.handle! });
              } else if (entry.kind === 'directory') await fastScan(entry as FileSystemDirectoryHandle);
            }
          };
          await fastScan(folder.handle);
        }
      } catch (e) { console.error(e); }
    }

    for (const folder of foldersToScan) {
        const count = filesToProcess.filter(f => f.folderId === folder.id).length;
        if (folder.handle) {
            await saveLibraryFolder(folder.id, folder.handle, count, Date.now());
        }
    }
    
    const updatedFolders = await getAllLibraryFolders();
    setImportedFolders(prev => updatedFolders.map(f => ({
        ...f,
        lastSync: f.lastSync || 0,
        trackCount: prev.find(p => p.id === f.id)?.trackCount || 0,
        hasHandle: !!f.handle
    })));

    const total = filesToProcess.length;
    if (total === 0) { setIsImporting(false); setSyncingFolderId(null); return true; }

    const BATCH_SIZE = 15; 
    let processedCount = 0;

    for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
      const batch = filesToProcess.slice(i, i + BATCH_SIZE);
      const batchResults: Track[] = [];

      await Promise.all(batch.map(async (item) => {
        try {
          const file = await item.handle.getFile();
          const fingerprint = `${file.name}-${file.size}`;
          
          const isExisting = tracks.some(t => t.fingerprint === fingerprint);
          if (isExisting) {
              processedCount++;
              return;
          }

          setCurrentProcessingFile(file.name);
          const t = await parseFileToTrack(file);
          t.folderId = item.folderId;
          (t as any).fileName = file.name;
          batchResults.push(t);
          processedCount++;
        } catch (err) { 
            console.error(err); 
            processedCount++;
        }
      }));

      if (batchResults.length > 0) {
        await saveTracksToCache(batchResults);
        setTracks(prev => [...prev, ...batchResults]);
      }

      setImportProgress(Math.floor((processedCount / total) * 100));
      await new Promise(r => requestAnimationFrame(r));
    }

    setImportProgress(100);
    setTimeout(() => {
        setIsImporting(false);
        setSyncingFolderId(null);
    }, 800);
    return true;
  }, [nasMode, syncNasLibrary, tracks.length]);

  const registerFolder = async (handle?: FileSystemDirectoryHandle) => {
    if (nasMode) return 'NAS_ROOT';

    let id: string;
    let folderPath: string | undefined;
    let name: string;

    console.log("registerFolder: starting with handle:", !!handle);

    if (window.windowBridge && !handle) {
      // Electron 环境下
      console.log("registerFolder: In Electron environment, calling windowBridge.openDirectory");
      try {
        const selectedPath = await window.windowBridge.openDirectory();
        console.log("registerFolder: openDirectory selectedPath:", selectedPath);
        if (!selectedPath) {
          console.log("registerFolder: user canceled folder selection");
          return null;
        }
        folderPath = selectedPath;
        name = folderPath.split(/[\\/]/).pop() || folderPath;
        id = name + "_" + Date.now();
        console.log("registerFolder: saving library folder to storage", { id, folderPath });
        await saveLibraryFolder(id, undefined as any, 0, 0, folderPath);
      } catch (err) {
        console.error("registerFolder: openDirectory failed error:", err);
        // 向上抛出错误，以便 App.tsx 捕获并显示
        throw new Error(`无法打开目录选择器: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if (handle) {
      // 浏览器环境下
      console.log("registerFolder: In Browser environment, using handle:", handle.name);
      id = handle.name + "_" + Date.now();
      name = handle.name;
      await saveLibraryFolder(id, handle);
    } else {
      console.warn("registerFolder: No windowBridge and no handle provided");
      return null;
    }

    console.log("registerFolder: loading data after save");
    await loadData();
    console.log("registerFolder: success, returning id:", id);
    return id; 
  };

  const reconnectFolder = async (folderId: string, handle: FileSystemDirectoryHandle) => {
    if (nasMode) return;
    await saveLibraryFolder(folderId, handle);
    await loadData();
    syncFolders(folderId);
  };

  const handleRemoveFolder = useCallback(async (id: string) => {
    if (nasMode) return; // NAS 模式不允许移除系统卷
    if(confirm("确定要移除该文件夹吗？其下的曲目记录也将被从曲库移除。")) {
        await removeLibraryFolder(id);
        setTracks(prev => prev.filter(t => t.folderId !== id));
        await loadData();
    }
  }, [loadData, nasMode]);

  const handleUpdateTrack = useCallback((trackId: string, updates: Partial<Track>) => {
    setTracks(prev => {
      const next = prev.map(t => t.id === trackId ? { ...t, ...updates } : t);
      const updatedTrack = next.find(t => t.id === trackId);
      if (updatedTrack) saveTracksToCache([updatedTrack]);
      return next;
    });
  }, []);

  const handleToggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      localStorage.setItem('vinyl_favorites', JSON.stringify(Array.from(n)));
      return n;
    });
  }, []);

  const reorderTracks = useCallback((draggedId: string, targetId: string | null) => {
    setTracks(prev => {
      const draggedIndex = prev.findIndex(t => t.id === draggedId);
      if (draggedIndex === -1) return prev;
      const newTracks = [...prev];
      const [draggedItem] = newTracks.splice(draggedIndex, 1);
      if (targetId === null) newTracks.push(draggedItem);
      else {
        const targetIndex = newTracks.findIndex(t => t.id === targetId);
        if (targetIndex !== -1) newTracks.splice(targetIndex, 0, draggedItem);
        else newTracks.push(draggedItem);
      }
      return newTracks;
    });
  }, []);

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    const q = normalizeChinese(searchQuery);
    return tracks.filter(t => 
      normalizeChinese(t.name).includes(q) || 
      normalizeChinese(t.artist).includes(q) || 
      normalizeChinese(t.album).includes(q)
    );
  }, [tracks, searchQuery]);

  const historyTracks = useMemo(() => {
    return historyEntries.map(entry => {
      const track = tracks.find(t => t.fingerprint === entry.fingerprint);
      if (!track) return null;
      return { ...track, historyTime: entry.timestamp };
    }).filter(Boolean) as Track[];
  }, [tracks, historyEntries]);

  return {
    tracks, setTracks, importedFolders,
    isImporting, importProgress, currentProcessingFile, syncingFolderId,
    searchQuery, setSearchQuery, filteredTracks,
    favorites, handleToggleFavorite, handleUpdateTrack, reorderTracks,
    syncAll: () => syncFolders(), 
    syncFolder: (id: string) => syncFolders(id), 
    registerFolder, reconnectFolder, removeFolder: handleRemoveFolder, resolveTrackFile,
    handleManualFilesSelect,
    historyTracks,
    recordTrackPlayback,
    fetchHistory, clearHistory, needsPermission, nasMode
  };
};
