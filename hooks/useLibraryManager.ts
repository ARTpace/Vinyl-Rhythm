
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

  /**
   * 仅注册文件夹，不进行扫描
   */
  const registerFolder = async (handle: FileSystemDirectoryHandle) => {
    const id = handle.name + "_" + Date.now();
    await saveLibraryFolder(id, handle);
    const newFolder: LibraryFolder = {
      id: id,
      name: handle.name,
      lastSync: 0, // 0 表示从未同步
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

    setIsImporting(true);
    setImportProgress(0);
    
    // 如果不是静默同步（手动点刷新），则保留现有曲目并追加新曲目
    // 如果是静默同步（初始化），则清空重新扫描
    let allProcessedTracks: Track[] = isSilent ? [] : [...tracks];
    let newImportedFolders: LibraryFolder[] = importedFolders.filter(f => f.id.startsWith('manual_'));

    // 第一步：先统计总文件数
    let totalFilesToScan: File[] = [];
    const folderFilesMap = new Map<string, File[]>();

    for (const folder of savedFolders) {
      try {
        let permission = await folder.handle.queryPermission({ mode: 'read' });
        if (permission !== 'granted' && !isSilent) {
          permission = await folder.handle.requestPermission({ mode: 'read' });
        }
        if (permission === 'granted') {
          const diskFiles = await scanDirectory(folder.handle);
          folderFilesMap.set(folder.id, diskFiles);
          
          const existingFingerprints = new Set(allProcessedTracks.map(t => t.fingerprint));
          const newFiles = diskFiles.filter(f => !existingFingerprints.has(`${f.name}-${f.size}`));
          totalFilesToScan = totalFilesToScan.concat(newFiles);
        } else {
          // 权限未授予且不是静默模式，视为同步失败或跳过
          const existing = importedFolders.find(f => f.id === folder.id);
          if (existing) newImportedFolders.push(existing);
        }
      } catch (e) { console.error(e); }
    }

    let processedCount = 0;
    const totalCount = totalFilesToScan.length;

    // 第二步：逐个处理并更新进度
    for (const folder of savedFolders) {
      const diskFiles = folderFilesMap.get(folder.id);
      if (!diskFiles) continue;

      const diskFingerprints = new Set(diskFiles.map(f => `${f.name}-${f.size}`));
      // 移除磁盘上已不存在的曲目
      allProcessedTracks = allProcessedTracks.filter(t => t.folderId !== folder.id || diskFingerprints.has(t.fingerprint));
      
      const localMetadata = await readLocalFolderMetadata(folder.handle);
      const existingFingerprints = new Set(allProcessedTracks.map(t => t.fingerprint));
      const newFiles = diskFiles.filter(f => !existingFingerprints.has(`${f.name}-${f.size}`));

      for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i];
        const fingerprint = `${file.name}-${file.size}`;
        setCurrentProcessingFile(file.name);
        
        try {
          const track = await parseFileToTrack(file);
          track.folderId = folder.id;
          if (localMetadata?.tracks?.[fingerprint]) {
            const saved = localMetadata.tracks[fingerprint];
            track.name = saved.name || track.name;
            track.artist = saved.artist || track.artist;
            track.album = saved.album || track.album;
          }
          allProcessedTracks.push(track);
          
          processedCount++;
          if (totalCount > 0) {
            setImportProgress(Math.round((processedCount / totalCount) * 100));
          }
          
          if (processedCount % 5 === 0) setTracks([...allProcessedTracks]);
        } catch (e) {}
      }
      
      const currentFolderTracks = allProcessedTracks.filter(t => t.folderId === folder.id);
      newImportedFolders.push({
        id: folder.id,
        name: folder.name,
        lastSync: Date.now(),
        trackCount: currentFolderTracks.length
      });
    }

    setTracks([...allProcessedTracks]);
    setImportedFolders(newImportedFolders);
    setImportProgress(100);
    setTimeout(() => {
      setIsImporting(false);
      setImportProgress(0);
      setCurrentProcessingFile('');
    }, 500);
    return true;
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
