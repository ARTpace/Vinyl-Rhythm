
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
  const [importedFolders, setImportedFolders] = useState<(LibraryFolder & { hasHandle: boolean })[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [currentProcessingFile, setCurrentProcessingFile] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [needsPermission, setNeedsPermission] = useState(false);
  
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('vinyl_favorites');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const loadData = useCallback(async () => {
    const cached = await getCachedTracks();
    const foldersFromDB = await getAllLibraryFolders();
    
    setImportedFolders(foldersFromDB.map(f => ({
      id: f.id,
      name: f.name,
      lastSync: (f as any).addedAt || 0,
      trackCount: cached.filter(t => t.folderId === f.id).length,
      hasHandle: !!f.handle 
    })));

    if (cached && cached.length > 0) {
      setTracks(cached.map(t => ({ ...t, file: t.file || null as any, url: t.url || '' })));
    }

    if (foldersFromDB.length > 0 && foldersFromDB.some(f => !f.handle)) {
      setNeedsPermission(true);
    }
  }, []);

  useEffect(() => {
    loadData();
    fetchHistory();
  }, [loadData]);

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
        let updatedTrack = { ...track, file, url };
        if (!track.coverBlob) {
          const fresh = await parseFileToTrack(file);
          updatedTrack.coverBlob = fresh.coverBlob;
          updatedTrack.coverUrl = fresh.coverUrl;
          saveTracksToCache([updatedTrack]);
        }
        
        setTracks(prev => prev.map(t => t.fingerprint === track.fingerprint ? updatedTrack : t));
        return updatedTrack;
      }
    } catch (e) { console.error(e); }
    return null;
  }, []);

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
        } catch (e) { console.error(e); }
      }
      setImportProgress(Math.floor(((i + 1) / total) * 100));
      if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }

    setTracks(prev => {
      const combined = [...prev, ...newTracks];
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

  /**
   * 核心重构：支持局部文件夹同步
   * @param specificFolderId 如果传入 ID，则仅扫描该文件夹
   */
  const syncFolders = useCallback(async (specificFolderId?: string) => {
    setIsImporting(true);
    setImportProgress(0);
    setCurrentProcessingFile('正在盘点曲目...');

    const savedFolders = await getAllLibraryFolders();
    if (savedFolders.length === 0) { setIsImporting(false); return false; }

    // 确定本次需要扫描的文件夹范围
    const foldersToScan = specificFolderId 
      ? savedFolders.filter(f => f.id === specificFolderId)
      : savedFolders;

    const missingHandleFolders = foldersToScan.filter(f => !f.handle);
    if (missingHandleFolders.length > 0) {
      alert(`检测到断开的文件夹记录，请先在“管理库”中重新选择它们以恢复访问。`);
      setIsImporting(false);
      return false;
    }

    // 建立现有曲目映射，用于缓存对比
    const currentTracksMap = new Map<string, Track>(tracks.map(t => [t.fingerprint, t]));
    let folderTracks: Track[] = []; 
    let totalFilesCount = 0;
    const filesToProcess: { handle: FileSystemFileHandle, folderId: string }[] = [];

    for (const folder of foldersToScan) {
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

    if (totalFilesCount === 0) { 
        // 如果是特定文件夹且没东西，需要清空该文件夹记录
        if (specificFolderId) {
            setTracks(prev => prev.filter(t => t.folderId !== specificFolderId));
        }
        setIsImporting(false); 
        return true; 
    }

    let processedCount = 0;
    const batchSize = 10;
    for (let i = 0; i < filesToProcess.length; i += batchSize) {
      const batch = filesToProcess.slice(i, i + batchSize);
      await Promise.all(batch.map(async (item) => {
        try {
          const file = await item.handle.getFile();
          setCurrentProcessingFile(file.name);
          const fingerprint = `${file.name}-${file.size}`;
          const cached = currentTracksMap.get(fingerprint);
          
          if (cached && cached.coverBlob) {
            folderTracks.push({ ...cached, fileName: file.name, folderId: item.folderId } as any);
          } else {
            const t = await parseFileToTrack(file);
            t.folderId = item.folderId;
            (t as any).fileName = file.name;
            if (cached) t.id = cached.id;
            folderTracks.push(t);
          }
        } catch (err) { console.error(err); }
        finally { processedCount++; }
      }));
      setImportProgress(Math.floor((processedCount / totalFilesCount) * 100));
      await new Promise(r => setTimeout(r, 0));
    }

    // 增量合并逻辑：
    // 如果是同步特定文件夹，则保留其他文件夹的曲目，仅更新当前的
    setTracks(prev => {
      let finalTracks: Track[];
      if (specificFolderId) {
        const otherTracks = prev.filter(t => t.folderId !== specificFolderId);
        finalTracks = [...otherTracks, ...folderTracks];
      } else {
        finalTracks = folderTracks;
      }
      
      // 去重
      const seen = new Set();
      const unique = finalTracks.filter(t => {
        if (seen.has(t.fingerprint)) return false;
        seen.add(t.fingerprint);
        return true;
      });
      
      saveTracksToCache(unique);
      return unique;
    });

    setImportProgress(100);
    await loadData(); 
    setTimeout(() => setIsImporting(false), 500);
    return true;
  }, [tracks, loadData]);

  const registerFolder = async (handle: FileSystemDirectoryHandle) => {
    const id = handle.name + "_" + Date.now();
    await saveLibraryFolder(id, handle);
    await loadData();
    return id; // 返回新生成的 ID 以供定向同步使用
  };

  const reconnectFolder = async (folderId: string, handle: FileSystemDirectoryHandle) => {
    await saveLibraryFolder(folderId, handle);
    await loadData();
    // 成功重连后，仅同步该文件夹
    syncFolders(folderId);
  };

  const handleRemoveFolder = useCallback(async (id: string) => {
    if(confirm("确定要移除该文件夹吗？其下的曲目记录也将被从曲库移除。")) {
        await removeLibraryFolder(id);
        await loadData();
        setTracks(prev => prev.filter(t => t.folderId !== id));
    }
  }, [loadData]);

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
    syncAll: () => syncFolders(), // 默认全量
    syncFolder: (id: string) => syncFolders(id), // 定向同步
    registerFolder, reconnectFolder, removeFolder: handleRemoveFolder, resolveTrackFile,
    handleManualFilesSelect,
    historyTracks: historyEntries.map(e => tracks.find(t => t.fingerprint === e.fingerprint)).filter(Boolean) as Track[],
    fetchHistory, clearHistory, needsPermission
  };
};
