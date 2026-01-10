
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
  getCachedTracks
} from '../utils/storage';
import { normalizeChinese } from '../utils/chineseConverter';

export const useLibraryManager = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [importedFolders, setImportedFolders] = useState<LibraryFolder[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [currentProcessingFile, setCurrentProcessingFile] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [needsPermission, setNeedsPermission] = useState(false);
  
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('vinyl_favorites');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // 加载初始缓存
  useEffect(() => {
    const loadCache = async () => {
      const cached = await getCachedTracks();
      const folders = await getAllLibraryFolders();
      setImportedFolders(folders.map(f => ({
        id: f.id,
        name: f.name,
        lastSync: (f as any).addedAt || 0,
        trackCount: cached.filter(t => t.folderId === f.id).length
      })));

      if (cached && cached.length > 0) {
        setTracks(cached.map(t => ({ ...t, file: null as any, url: '' })));
      }
    };
    loadCache();
    fetchHistory();
  }, []);

  const fetchHistory = useCallback(async () => {
    const data = await getPlaybackHistory();
    setHistoryEntries(data);
  }, []);

  const clearHistory = useCallback(async () => {
    await clearPlaybackHistory();
    setHistoryEntries([]);
  }, []);

  const resolveTrackFile = useCallback(async (track: Track): Promise<Track | null> => {
    if (track.file && track.url) return track;
    const folders = await getAllLibraryFolders();
    const folder = folders.find(f => f.id === track.folderId);
    if (!folder) return null;

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
            const result = await findFile(entry, fileName);
            if (result) return result;
          }
        }
        return null;
      };

      const file = await findFile(folder.handle, (track as any).fileName || "");
      if (file) {
        const url = URL.createObjectURL(file);
        setTracks(prev => prev.map(t => t.fingerprint === track.fingerprint ? { ...t, file, url } : t));
        return { ...track, file, url };
      }
    } catch (e) { console.error(e); }
    return null;
  }, []);

  const handleManualFilesSelect = async (files: FileList) => {
    setIsImporting(true);
    setImportProgress(0);
    const newTracks: Track[] = [];
    const validFiles = Array.from(files).filter(f => SUPPORTED_FORMATS.some(ext => f.name.toLowerCase().endsWith(ext)));
    const total = validFiles.length;

    if (total === 0) { setIsImporting(false); return false; }

    const batchSize = 10;
    for (let i = 0; i < total; i += batchSize) {
      const batch = validFiles.slice(i, i + batchSize);
      for (const file of batch) {
        setCurrentProcessingFile(file.name);
        try {
          const track = await parseFileToTrack(file);
          newTracks.push(track);
        } catch (e) { console.error(e); }
      }
      // 强制取整，解决小数点问题
      setImportProgress(Math.floor(((i + batch.length) / total) * 100));
      await new Promise(r => setTimeout(r, 0));
    }

    if (newTracks.length > 0) {
      setTracks(prev => {
        const next = [...prev, ...newTracks];
        saveTracksToCache(next);
        return next;
      });
    }
    setImportProgress(100);
    setIsImporting(false);
    return true;
  };

  const syncAll = useCallback(async () => {
    setIsImporting(true);
    setImportProgress(0);
    setCurrentProcessingFile('正在盘点文件...');

    const savedFolders = await getAllLibraryFolders();
    if (savedFolders.length === 0) { setIsImporting(false); return false; }

    const currentTracksMap = new Map<string, Track>(tracks.map(t => [t.fingerprint, t]));
    let allUpdatedTracks: Track[] = tracks.filter(t => !t.folderId); 
    
    // 第一阶段：预扫描文件总数，确保进度条准确
    let totalFilesCount = 0;
    const filesToProcess: { handle: FileSystemFileHandle, folderId: string }[] = [];

    for (const folder of savedFolders) {
      try {
        let permission = await folder.handle.queryPermission({ mode: 'read' });
        if (permission !== 'granted') permission = await folder.handle.requestPermission({ mode: 'read' });
        
        if (permission === 'granted') {
          setNeedsPermission(false);
          const fastScan = async (dirHandle: FileSystemDirectoryHandle) => {
            for await (const entry of (dirHandle as any).values()) {
              if (entry.kind === 'file' && SUPPORTED_FORMATS.some(ext => entry.name.toLowerCase().endsWith(ext))) {
                totalFilesCount++;
                filesToProcess.push({ handle: entry as FileSystemFileHandle, folderId: folder.id });
              } else if (entry.kind === 'directory') await fastScan(entry);
            }
          };
          await fastScan(folder.handle);
        } else { setNeedsPermission(true); }
      } catch (e) { console.error(e); }
    }

    if (totalFilesCount === 0) { setIsImporting(false); return false; }

    // 第二阶段：分批解析，取整进度
    let processedCount = 0;
    const batchSize = 8;
    
    for (let i = 0; i < filesToProcess.length; i += batchSize) {
      const batch = filesToProcess.slice(i, i + batchSize);
      await Promise.all(batch.map(async (item) => {
        try {
          const file = await item.handle.getFile();
          setCurrentProcessingFile(file.name);
          const fingerprint = `${file.name}-${file.size}`;
          const cached = currentTracksMap.get(fingerprint);
          if (cached) {
            allUpdatedTracks.push({ ...cached, fileName: file.name, folderId: item.folderId } as any);
          } else {
            const t = await parseFileToTrack(file);
            t.folderId = item.folderId;
            (t as any).fileName = file.name;
            allUpdatedTracks.push(t);
          }
        } catch (err) { console.error(err); }
        finally { processedCount++; }
      }));

      setImportProgress(Math.floor((processedCount / totalFilesCount) * 100));
      await new Promise(r => setTimeout(r, 0));
    }

    setTracks(allUpdatedTracks);
    await saveTracksToCache(allUpdatedTracks);
    setImportProgress(100);
    // 强制更新文件夹列表中的计数
    setImportedFolders(prev => prev.map(f => ({
        ...f,
        lastSync: Date.now(),
        trackCount: allUpdatedTracks.filter(t => t.folderId === f.id).length
    })));
    setTimeout(() => setIsImporting(false), 500);
    return true;
  }, [tracks]);

  const registerFolder = async (handle: FileSystemDirectoryHandle) => {
    const id = handle.name + "_" + Date.now();
    await saveLibraryFolder(id, handle);
    setImportedFolders(prev => [...prev, { id, name: handle.name, lastSync: 0, trackCount: 0 }]);
    return id;
  };

  const handleRemoveFolder = useCallback(async (id: string) => {
    await removeLibraryFolder(id);
    setImportedFolders(prev => prev.filter(f => f.id !== id));
    setTracks(prev => prev.filter(t => t.folderId !== id));
  }, []);

  const handleUpdateTrack = useCallback((trackId: string, updates: Partial<Track>) => {
    setTracks(prev => {
      const next = prev.map(t => t.id === trackId ? { ...t, ...updates } : t);
      saveTracksToCache(next);
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
      saveTracksToCache(newTracks);
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

  return {
    tracks, setTracks, importedFolders,
    isImporting, importProgress, currentProcessingFile,
    searchQuery, setSearchQuery, filteredTracks,
    favorites, handleToggleFavorite, handleUpdateTrack, reorderTracks,
    syncAll, registerFolder, removeFolder: handleRemoveFolder, resolveTrackFile,
    handleManualFilesSelect,
    historyTracks: historyEntries.map(e => tracks.find(t => t.fingerprint === e.fingerprint)).filter(Boolean) as Track[],
    fetchHistory, clearHistory, needsPermission
  };
};
