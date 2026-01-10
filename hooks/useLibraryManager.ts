
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
        // 还原回来的 tracks 可能没有 coverUrl（因为没有 blob）
        setTracks(cached.map(t => ({ ...t, file: null as any, url: '' })));
      }

      if (folders.length > 0 && folders.some(f => !f.handle)) {
        setNeedsPermission(true);
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
    
    if (!folder || !folder.handle) {
      setNeedsPermission(true);
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
        // 如果顺便发现没有封面，补一下
        let updatedTrack = { ...track, file, url };
        if (!track.coverBlob) {
          const fresh = await parseFileToTrack(file);
          updatedTrack.coverBlob = fresh.coverBlob;
          updatedTrack.coverUrl = fresh.coverUrl;
          // 异步存入 DB，不阻塞播放
          saveTracksToCache([updatedTrack]);
        }
        
        setTracks(prev => prev.map(t => t.fingerprint === track.fingerprint ? updatedTrack : t));
        return updatedTrack;
      }
    } catch (e) { console.error(e); }
    return null;
  }, []);

  // 修复: 实现 handleManualFilesSelect 方法，支持通过传统的 FileList (非 FileSystem API) 导入音乐
  const handleManualFilesSelect = useCallback(async (files: FileList) => {
    setIsImporting(true);
    setImportProgress(0);
    const total = files.length;
    const newTracks: Track[] = [];
    
    for (let i = 0; i < total; i++) {
      const file = files[i];
      if (SUPPORTED_FORMATS.some(ext => file.name.toLowerCase().endsWith(ext))) {
        setCurrentProcessingFile(file.name);
        try {
          const track = await parseFileToTrack(file);
          newTracks.push(track);
        } catch (e) {
          console.error(`解析文件失败: ${file.name}`, e);
        }
      }
      setImportProgress(Math.floor(((i + 1) / total) * 100));
      // 让出主线程，防止 UI 冻结
      if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }

    setTracks(prev => {
      const combined = [...prev, ...newTracks];
      // 简单去重
      const seen = new Set();
      const unique = combined.filter(t => {
        if (seen.has(t.fingerprint)) return false;
        seen.add(t.fingerprint);
        return true;
      });
      saveTracksToCache(unique);
      return unique;
    });

    setIsImporting(false);
    return true;
  }, []);

  const syncAll = useCallback(async () => {
    setIsImporting(true);
    setImportProgress(0);
    setCurrentProcessingFile('正在盘点曲目...');

    const savedFolders = await getAllLibraryFolders();
    if (savedFolders.length === 0) { setIsImporting(false); return false; }

    const missingHandleFolders = savedFolders.filter(f => !f.handle);
    if (missingHandleFolders.length > 0) {
      alert(`还原后的 ${missingHandleFolders.length} 个文件夹需要“重新添加”以恢复封面和播放功能。`);
      setIsImporting(false);
      return false;
    }

    const currentTracksMap = new Map<string, Track>(tracks.map(t => [t.fingerprint, t]));
    let allUpdatedTracks: Track[] = []; 
    
    let totalFilesCount = 0;
    const filesToProcess: { handle: FileSystemFileHandle, folderId: string }[] = [];

    for (const folder of savedFolders) {
      if (!folder.handle) continue;
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
              } else if (entry.kind === 'directory') await fastScan(entry as FileSystemDirectoryHandle);
            }
          };
          await fastScan(folder.handle);
        } else { setNeedsPermission(true); }
      } catch (e) { console.error(e); }
    }

    if (totalFilesCount === 0) { setIsImporting(false); return false; }

    let processedCount = 0;
    const batchSize = 5; // 修复封面比较耗能，减小并发
    
    for (let i = 0; i < filesToProcess.length; i += batchSize) {
      const batch = filesToProcess.slice(i, i + batchSize);
      await Promise.all(batch.map(async (item) => {
        try {
          const file = await item.handle.getFile();
          setCurrentProcessingFile(file.name);
          const fingerprint = `${file.name}-${file.size}`;
          const cached = currentTracksMap.get(fingerprint);
          
          // 修复核心逻辑：如果 cached 存在但没有封面，我们需要重新解析文件来补齐封面
          if (cached && cached.coverBlob) {
            allUpdatedTracks.push({ ...cached, fileName: file.name, folderId: item.folderId } as any);
          } else {
            // 重新提取（涵盖了新文件和从还原回来的无封面记录）
            const t = await parseFileToTrack(file);
            t.folderId = item.folderId;
            (t as any).fileName = file.name;
            // 继承原来可能存在的收藏状态或ID
            if (cached) t.id = cached.id;
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
    setImportedFolders(prev => prev.map(f => ({
        ...f,
        lastSync: Date.now(),
        trackCount: allUpdatedTracks.filter(t => t.folderId === f.id).length
    })));
    setTimeout(() => setIsImporting(false), 500);
    return true;
  }, [tracks]);

  const registerFolder = async (handle: FileSystemDirectoryHandle) => {
    const existing = importedFolders.find(f => f.name === handle.name);
    const id = existing ? existing.id : handle.name + "_" + Date.now();
    await saveLibraryFolder(id, handle);
    
    if (!existing) {
      setImportedFolders(prev => [...prev, { id, name: handle.name, lastSync: 0, trackCount: 0 }]);
    } else {
      setNeedsPermission(false);
    }
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
