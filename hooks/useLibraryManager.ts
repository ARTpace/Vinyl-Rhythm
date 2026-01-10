
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
    // --- 性能关键：立即触发 UI 状态，不等待任何异步 ---
    setIsImporting(true);
    setImportProgress(0);
    setCurrentProcessingFile('初始化扫描中...');

    // 延迟一小会儿开始真正的扫描，确保主线程有机会渲染加载状态
    return new Promise<boolean>(async (resolve) => {
      setTimeout(async () => {
        const savedFolders = await getAllLibraryFolders();
        if (savedFolders.length === 0) {
          setIsImporting(false);
          resolve(false);
          return;
        }

        const currentTracksMap = new Map<string, Track>(tracks.map(t => [t.fingerprint, t]));
        let allUpdatedTracks: Track[] = [];
        let nextImportedFolders: LibraryFolder[] = importedFolders.filter(f => f.id.startsWith('manual_'));
        let filesToParse: { file: File, folderId: string, localMeta?: any }[] = [];

        // 第一阶段：读取目录结构
        for (const folder of savedFolders) {
          setCurrentProcessingFile(`访问目录: ${folder.name}`);
          try {
            let permission = await folder.handle.queryPermission({ mode: 'read' });
            if (permission !== 'granted' && !isSilent) {
              permission = await folder.handle.requestPermission({ mode: 'read' });
            }
            
            if (permission === 'granted') {
              const diskFiles = await scanDirectory(folder.handle);
              const localMetadata = await readLocalFolderMetadata(folder.handle);
              
              let folderTrackCount = 0;
              for (const file of diskFiles) {
                const fingerprint = `${file.name}-${file.size}`;
                if (currentTracksMap.has(fingerprint)) {
                  allUpdatedTracks.push(currentTracksMap.get(fingerprint)!);
                  folderTrackCount++;
                } else if (localMetadata?.tracks?.[fingerprint]) {
                  const cached = localMetadata.tracks[fingerprint];
                  allUpdatedTracks.push({
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
                  folderTrackCount++;
                } else {
                  filesToParse.push({ file, folderId: folder.id, localMeta: localMetadata });
                }
              }
              
              nextImportedFolders.push({
                id: folder.id,
                name: folder.name,
                lastSync: Date.now(),
                trackCount: folderTrackCount
              });
            }
          } catch (e) { console.error(e); }
        }

        // 第二阶段：深度解析新发现的文件
        if (filesToParse.length > 0) {
          for (let i = 0; i < filesToParse.length; i++) {
            const item = filesToParse[i];
            setCurrentProcessingFile(`解析元数据: ${item.file.name}`);
            try {
              const track: Track = await parseFileToTrack(item.file);
              track.folderId = item.folderId;
              allUpdatedTracks.push(track);
              setImportProgress(Math.round(((i + 1) / filesToParse.length) * 100));
              
              // 分批次更新 UI 以保持平滑感
              if (i % 5 === 0) setTracks([...allUpdatedTracks]);
            } catch (e) {}
          }
        }

        setTracks([...allUpdatedTracks]);
        setImportedFolders(nextImportedFolders);

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
