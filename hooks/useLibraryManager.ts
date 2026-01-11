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
  const [syncingFolderId, setSyncingFolderId] = useState<string | null>(null); // 新增：当前正在同步的文件夹ID
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
      ...f,
      lastSync: f.lastSync || 0,
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

  const fetchHistory = useCallback(async () => {
    const data = await getPlaybackHistory();
    setHistoryEntries(data);
  }, []);

  useEffect(() => {
    loadData();
    fetchHistory();
  }, [loadData, fetchHistory]);

  const clearHistory = useCallback(async () => {
    await clearPlaybackHistory();
    setHistoryEntries([]);
  }, []);

  const recordTrackPlayback = useCallback(async (track: Track) => {
    await addToHistory(track);
    await fetchHistory();
  }, [fetchHistory]);

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
    setIsImporting(true);
    setImportProgress(0);
    setSyncingFolderId(specificFolderId || 'ALL');
    setCurrentProcessingFile('正在盘点本地路径...');

    const savedFolders = await getAllLibraryFolders();
    if (savedFolders.length === 0) { setIsImporting(false); setSyncingFolderId(null); return false; }

    const foldersToScan = specificFolderId 
      ? savedFolders.filter(f => f.id === specificFolderId)
      : savedFolders;

    const filesToProcess: { handle: FileSystemFileHandle, folderId: string, folderHandle: FileSystemDirectoryHandle }[] = [];

    // 1. 快速扫描
    for (const folder of foldersToScan) {
      if (!folder.handle) continue;
      try {
        let permission = await folder.handle.queryPermission({ mode: 'read' });
        if (permission !== 'granted') permission = await folder.handle.requestPermission({ mode: 'read' });
        
        if (permission === 'granted') {
          const fastScan = async (dirHandle: FileSystemDirectoryHandle) => {
            for await (const entry of (dirHandle as any).values()) {
              if (entry.kind === 'file' && SUPPORTED_FORMATS.some(ext => entry.name.toLowerCase().endsWith(ext))) {
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
    await loadData(); 

    const total = filesToProcess.length;
    if (total === 0) { setIsImporting(false); setSyncingFolderId(null); return true; }

    // 2. 增量解析与实时 UI 更新
    const currentFingerprints = new Set(tracks.map(t => t.fingerprint));
    const BATCH_SIZE = 15; 
    let processedCount = 0;

    for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
      const batch = filesToProcess.slice(i, i + BATCH_SIZE);
      const batchResults: Track[] = [];

      await Promise.all(batch.map(async (item) => {
        try {
          const file = await item.handle.getFile();
          const fingerprint = `${file.name}-${file.size}`;
          
          if (currentFingerprints.has(fingerprint)) {
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
        
        // 更新曲目列表
        setTracks(prev => [...prev, ...batchResults]);

        // 核心修复：同步更新 importedFolders 的本地状态，实现 UI 实时跳动
        setImportedFolders(prev => prev.map(folder => {
            const batchAddedCount = batchResults.filter(t => t.folderId === folder.id).length;
            if (batchAddedCount > 0) {
                return { ...folder, trackCount: folder.trackCount + batchAddedCount };
            }
            return folder;
        }));
      }

      setImportProgress(Math.floor((processedCount / total) * 100));
      await new Promise(r => requestAnimationFrame(r));
    }

    setImportProgress(100);
    await loadData();
    setTimeout(() => {
        setIsImporting(false);
        setSyncingFolderId(null);
    }, 800);
    return true;
  }, [tracks, loadData]);

  const registerFolder = async (handle: FileSystemDirectoryHandle) => {
    const id = handle.name + "_" + Date.now();
    await saveLibraryFolder(id, handle);
    await loadData();
    return id; 
  };

  const reconnectFolder = async (folderId: string, handle: FileSystemDirectoryHandle) => {
    await saveLibraryFolder(folderId, handle);
    await loadData();
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
    fetchHistory, clearHistory, needsPermission
  };
};
