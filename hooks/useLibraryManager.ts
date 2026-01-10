
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  const [importedFolders, setImportedFolders] = useState<LibraryFolder[]>(() => {
    const saved = localStorage.getItem('vinyl_folders');
    return saved ? JSON.parse(saved) : [];
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [currentProcessingFile, setCurrentProcessingFile] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [needsPermission, setNeedsPermission] = useState(false); // 新增：是否需要用户点击授权
  
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('vinyl_favorites');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const resolvedFolders = useRef<Set<string>>(new Set());

  // 初始化：从缓存加载列表
  useEffect(() => {
    const loadCache = async () => {
      const cached = await getCachedTracks();
      if (cached && cached.length > 0) {
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

  const scanDirectory = async (handle: FileSystemDirectoryHandle) => {
    const foundFiles: File[] = [];
    async function recursiveScan(dirHandle: FileSystemDirectoryHandle) {
      for await (const entry of (dirHandle as any).values()) {
        if (entry.kind === 'file' && SUPPORTED_FORMATS.some(ext => entry.name.toLowerCase().endsWith(ext))) {
          try {
            foundFiles.push(await entry.getFile());
          } catch (e) {}
        } else if (entry.kind === 'directory') {
          await recursiveScan(entry);
        }
      }
    }
    await recursiveScan(handle);
    return foundFiles;
  };

  /**
   * 同步逻辑：
   * isSilent = true 时，如果没权限就直接跳过，不弹窗。
   * 会检测是否所有文件夹都失去了权限，从而设置 needsPermission 状态。
   */
  const syncAll = async (isSilent: boolean = false) => {
    if (!isSilent) {
      setIsImporting(true);
      setImportProgress(0);
      setCurrentProcessingFile('正在扫描本地曲库...');
    }

    return new Promise<boolean>(async (resolve) => {
      setTimeout(async () => {
        const savedFolders = await getAllLibraryFolders();
        if (savedFolders.length === 0) {
          if (!isSilent) setIsImporting(false);
          resolve(false);
          return;
        }

        const currentTracksMap = new Map<string, Track>(tracks.map(t => [t.fingerprint, t]));
        let allUpdatedTracks: Track[] = [];
        let nextImportedFolders: LibraryFolder[] = [...importedFolders];
        let filesToParse: { file: File, folderId: string }[] = [];
        let totalNeedsPermission = false;

        for (const folder of savedFolders) {
          try {
            let permission = await folder.handle.queryPermission({ mode: 'read' });
            
            // 如果不是静默模式，且没权限，则主动申请
            if (permission !== 'granted' && !isSilent) {
              permission = await folder.handle.requestPermission({ mode: 'read' });
            }
            
            if (permission === 'granted') {
              if (!isSilent) setCurrentProcessingFile(`正在读取: ${folder.name}`);
              const diskFiles = await scanDirectory(folder.handle);
              let folderTrackCount = 0;

              for (const file of diskFiles) {
                const fingerprint = `${file.name}-${file.size}`;
                const cachedTrack = currentTracksMap.get(fingerprint);
                if (cachedTrack) {
                  allUpdatedTracks.push({ ...cachedTrack, file, url: URL.createObjectURL(file) });
                  folderTrackCount++;
                } else {
                  filesToParse.push({ file, folderId: folder.id });
                }
              }
              
              const folderIdx = nextImportedFolders.findIndex(f => f.id === folder.id);
              if (folderIdx > -1) {
                nextImportedFolders[folderIdx] = { ...nextImportedFolders[folderIdx], lastSync: Date.now(), trackCount: folderTrackCount + filesToParse.filter(f => f.folderId === folder.id).length };
              }
              resolvedFolders.current.add(folder.id);
            } else {
              // 权限缺失
              totalNeedsPermission = true;
              // 保留缓存中的记录，但标记文件不可用
              const folderTracks = tracks.filter(t => t.folderId === folder.id);
              allUpdatedTracks.push(...folderTracks);
            }
          } catch (e) { console.error(e); }
        }

        if (filesToParse.length > 0) {
          for (let i = 0; i < filesToParse.length; i++) {
            const item = filesToParse[i];
            if (!isSilent) {
              setCurrentProcessingFile(`解析新曲目: ${item.file.name}`);
              setImportProgress(Math.round(((i + 1) / filesToParse.length) * 100));
            }
            try {
              const track = await parseFileToTrack(item.file);
              track.folderId = item.folderId;
              allUpdatedTracks.push(track);
            } catch (e) {}
          }
        }

        setTracks(allUpdatedTracks);
        setImportedFolders(nextImportedFolders);
        setNeedsPermission(totalNeedsPermission);
        saveTracksToCache(allUpdatedTracks);

        if (!isSilent) {
          setIsImporting(false);
          setImportProgress(0);
          setCurrentProcessingFile('');
        }
        resolve(allUpdatedTracks.some(t => !!t.file));
      }, 50);
    });
  };

  const registerFolder = async (handle: FileSystemDirectoryHandle) => {
    const id = handle.name + "_" + Date.now();
    await saveLibraryFolder(id, handle);
    const newFolder: LibraryFolder = { id, name: handle.name, lastSync: 0, trackCount: 0 };
    setImportedFolders(prev => [...prev, newFolder]);
    return id;
  };

  const handleManualFilesSelect = async (fileList: FileList) => {
    const files = Array.from(fileList).filter(f => SUPPORTED_FORMATS.some(ext => f.name.toLowerCase().endsWith(ext)));
    if (files.length === 0) return;
    setIsImporting(true);
    const folderId = "manual_" + Date.now();
    const newTracks: Track[] = [];
    for (let i = 0; i < files.length; i++) {
      const t = await parseFileToTrack(files[i]);
      t.folderId = folderId;
      newTracks.push(t);
      setImportProgress(Math.round(((i + 1) / files.length) * 100));
    }
    const totalTracks = [...tracks, ...newTracks];
    setTracks(totalTracks);
    saveTracksToCache(totalTracks);
    setImportedFolders(prev => [...prev, { id: folderId, name: "手动导入", lastSync: Date.now(), trackCount: files.length }]);
    setIsImporting(false);
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
    tracks, setTracks, importedFolders,
    isImporting, importProgress, currentProcessingFile,
    searchQuery, setSearchQuery, filteredTracks,
    favorites, handleToggleFavorite, handleUpdateTrack,
    syncAll, registerFolder, removeFolder, handleManualFilesSelect,
    historyTracks, fetchHistory, clearHistory, needsPermission
  };
};
