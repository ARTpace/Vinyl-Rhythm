
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
  getTracksPaged,
  getTracksCount,
  searchTracksInDB
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

  // 1. 启动优化：只加载第一页元数据，其余延迟加载
  useEffect(() => {
    const loadCache = async () => {
      const count = await getTracksCount();
      // 如果曲目不多，直接全量加载；如果很多，先加载前300条保证瞬间响应
      const initialLoadCount = count > 1000 ? 500 : 5000;
      const cached = await getTracksPaged(0, initialLoadCount);
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
        return { ...track, file, url };
      }
    } catch (e) {
      console.error("文件解析失败", e);
    }
    return null;
  }, []);

  // Fix: Implement handleManualFilesSelect for traditional file selection
  const handleManualFilesSelect = async (files: FileList) => {
    setIsImporting(true);
    setImportProgress(0);
    const newTracks: Track[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (SUPPORTED_FORMATS.some(ext => file.name.toLowerCase().endsWith(ext))) {
        setCurrentProcessingFile(file.name);
        const t = await parseFileToTrack(file);
        // 手动导入不关联特定文件夹 ID
        (t as any).fileName = file.name;
        newTracks.push(t);
      }
      setImportProgress(Math.round(((i + 1) / files.length) * 100));
    }

    if (newTracks.length > 0) {
      await saveTracksToCache(newTracks);
      setTracks(prev => [...prev, ...newTracks]);
    }
    
    setIsImporting(false);
    return true;
  };

  const syncAll = async (isSilent: boolean = false) => {
    setIsImporting(true);
    setImportProgress(0);
    setCurrentProcessingFile('正在扫描...');

    const savedFolders = await getAllLibraryFolders();
    if (savedFolders.length === 0) {
      setIsImporting(false);
      return false;
    }

    // 为了对比增量，获取当前所有指纹
    const count = await getTracksCount();
    const allExisting = await getTracksPaged(0, count);
    const currentFingerprints = new Set(allExisting.map(t => t.fingerprint));
    
    let allUpdatedTracks: Track[] = [...allExisting];
    let newTracks: Track[] = [];

    for (const folder of savedFolders) {
      try {
        let permission = await folder.handle.queryPermission({ mode: 'read' });
        if (permission !== 'granted' && !isSilent) {
          permission = await folder.handle.requestPermission({ mode: 'read' });
        }

        if (permission === 'granted') {
          setNeedsPermission(false);
          const scan = async (dirHandle: FileSystemDirectoryHandle) => {
            for await (const entry of (dirHandle as any).values()) {
              if (entry.kind === 'file' && SUPPORTED_FORMATS.some(ext => entry.name.toLowerCase().endsWith(ext))) {
                setCurrentProcessingFile(entry.name);
                const file = await entry.getFile();
                const fingerprint = `${file.name}-${file.size}`;
                
                if (!currentFingerprints.has(fingerprint)) {
                  const t = await parseFileToTrack(file);
                  t.folderId = folder.id;
                  (t as any).fileName = file.name;
                  newTracks.push(t);
                  allUpdatedTracks.push(t);
                }
                setImportProgress(prev => Math.min(99, prev + 0.05));
              } else if (entry.kind === 'directory') {
                await scan(entry);
              }
            }
          };
          await scan(folder.handle);
        } else {
          setNeedsPermission(true);
        }
      } catch (e) { console.error(e); }
    }

    if (newTracks.length > 0) {
      await saveTracksToCache(newTracks); // 只保存新的到 DB
      setTracks(allUpdatedTracks.map(t => ({ ...t, file: null as any, url: '' })));
    }
    
    setImportProgress(100);
    setIsImporting(false);
    return true;
  };

  const registerFolder = async (handle: FileSystemDirectoryHandle) => {
    const id = handle.name + "_" + Date.now();
    await saveLibraryFolder(id, handle);
    setImportedFolders(prev => [...prev, { id, name: handle.name, lastSync: Date.now(), trackCount: 0 }]);
    return id;
  };

  const handleUpdateTrack = useCallback((trackId: string, updates: Partial<Track>) => {
    setTracks(prev => {
      const target = prev.find(t => t.id === trackId);
      if (!target) return prev;
      const next = prev.map(t => t.id === trackId ? { ...t, ...updates } : t);
      saveTracksToCache([{ ...target, ...updates }]);
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

  // 搜索优化：如果数据量大，使用内存过滤；如果超级大，应该调用 searchTracksInDB
  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    const q = normalizeChinese(searchQuery);
    return tracks.filter(t => 
      normalizeChinese(t.name).includes(q) || 
      normalizeChinese(t.artist).includes(q)
    );
  }, [tracks, searchQuery]);

  return {
    tracks, setTracks, importedFolders,
    isImporting, importProgress, currentProcessingFile,
    searchQuery, setSearchQuery, filteredTracks,
    favorites, handleToggleFavorite, handleUpdateTrack,
    syncAll, registerFolder, removeFolder: removeLibraryFolder, resolveTrackFile,
    handleManualFilesSelect, // Fix: Export handleManualFilesSelect
    historyTracks: historyEntries.map(e => tracks.find(t => t.fingerprint === e.fingerprint)).filter(Boolean) as Track[],
    fetchHistory, clearHistory, needsPermission
  };
};
