
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

  // 映射历史记录到当前库中的 Track 对象
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

  const syncAll = async (isSilent: boolean = false) => {
    const savedFolders = await getAllLibraryFolders();
    if (savedFolders.length === 0) {
      // 如果 IndexedDB 里没有任何句柄，且当前列表里也没 manual 导入，则清空
      setImportedFolders(prev => prev.filter(f => f.id.startsWith('manual_')));
      return false;
    }

    setIsImporting(true);
    let allProcessedTracks: Track[] = isSilent ? [] : [...tracks];
    
    // 初始化新的文件夹列表，先保留原有的手动导入项
    let newImportedFolders: LibraryFolder[] = importedFolders.filter(f => f.id.startsWith('manual_'));

    for (const folder of savedFolders) {
      try {
        // 检查权限
        let permission = await folder.handle.queryPermission({ mode: 'read' });
        if (permission !== 'granted' && !isSilent) {
          permission = await folder.handle.requestPermission({ mode: 'read' });
        }
        
        if (permission !== 'granted') {
          // 如果没有权限，仍然保留在列表里但无法同步歌曲
          const existing = importedFolders.find(f => f.id === folder.id);
          if (existing) newImportedFolders.push(existing);
          else newImportedFolders.push({ id: folder.id, name: folder.name, lastSync: Date.now(), trackCount: 0 });
          continue;
        }

        const localMetadata = await readLocalFolderMetadata(folder.handle);
        const diskFiles = await scanDirectory(folder.handle);
        const diskFingerprints = new Set(diskFiles.map(f => `${f.name}-${f.size}`));
        
        // 过滤掉已不存在的文件
        allProcessedTracks = allProcessedTracks.filter(t => t.folderId !== folder.id || diskFingerprints.has(t.fingerprint));
        
        const existingFingerprints = new Set(allProcessedTracks.map(t => t.fingerprint));
        const newFiles = diskFiles.filter(f => !existingFingerprints.has(`${f.name}-${f.size}`));
        
        if (newFiles.length > 0) {
          for (let i = 0; i < newFiles.length; i++) {
            const file = newFiles[i];
            const fingerprint = `${file.name}-${file.size}`;
            setCurrentProcessingFile(`扫描: ${file.name}`);
            
            try {
              const track = await parseFileToTrack(file);
              track.folderId = folder.id;
              // 应用本地缓存的元数据修改
              if (localMetadata?.tracks?.[fingerprint]) {
                const saved = localMetadata.tracks[fingerprint];
                track.name = saved.name || track.name;
                track.artist = saved.artist || track.artist;
                track.album = saved.album || track.album;
              }
              allProcessedTracks.push(track);
              // 每20首更新一下 UI 进度
              if (i % 20 === 0) setTracks([...allProcessedTracks]);
            } catch (e) {}
          }
        }
        
        setTracks([...allProcessedTracks]);
        const currentFolderTracks = allProcessedTracks.filter(t => t.folderId === folder.id);

        // 添加或更新文件夹信息到 UI 列表
        newImportedFolders.push({
          id: folder.id,
          name: folder.name,
          lastSync: Date.now(),
          trackCount: currentFolderTracks.length
        });

      } catch (e) {
        console.error(`同步文件夹 ${folder.name} 失败:`, e);
      }
    }

    setImportedFolders(newImportedFolders);
    setIsImporting(false);
    return true;
  };

  const handleManualFilesSelect = async (fileList: FileList) => {
    const files = Array.from(fileList).filter(f => SUPPORTED_FORMATS.some(ext => f.name.toLowerCase().endsWith(ext)));
    if (files.length === 0) return;
    setIsImporting(true);
    const folderId = "manual_" + Date.now();
    const newTracks: Track[] = [];
    for (const f of files) {
      const t = await parseFileToTrack(f);
      t.folderId = folderId;
      newTracks.push(t);
    }
    setTracks(prev => [...prev, ...newTracks]);
    setImportedFolders(prev => [...prev, { id: folderId, name: "本地导入", lastSync: Date.now(), trackCount: files.length }]);
    setIsImporting(false);
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
    syncAll, removeFolder, handleManualFilesSelect, persistFolderMetadataToDisk,
    historyTracks, fetchHistory, clearHistory
  };
};
