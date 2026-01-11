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
  addToHistory,
  getAllArtistMetadata,
  saveArtistMetadata
} from '../utils/storage';
import { normalizeChinese } from '../utils/chineseConverter';

export const useLibraryManager = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [importedFolders, setImportedFolders] = useState<(LibraryFolder & { hasHandle: boolean })[]>([]);
  const [artistMetadata, setArtistMetadata] = useState<Map<string, string>>(new Map());
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
    // FIX: Add a filter to ensure cached tracks are valid objects before casting, and check for a key property like fingerprint.
    const cached = ((await getCachedTracks())?.filter(t => t && typeof t === 'object' && t.fingerprint) ?? []) as Track[];
    const foldersFromDB = await getAllLibraryFolders();
    const artistsMeta = await getAllArtistMetadata();

    setArtistMetadata(new Map(artistsMeta.map(m => [m.name, m.coverUrl])));
    
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
    // FIX: Add a filter to ensure history entries are valid objects before casting, and check for a key property like fingerprint.
    const data = ((await getPlaybackHistory())?.filter(e => e && typeof e === 'object' && e.fingerprint) ?? []) as HistoryEntry[];
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
  
    const filesToProcess: { handle: FileSystemFileHandle, folderId: string, directoryCoverBlob: Blob | null, artistImageBlob: Blob | null }[] = [];
  
    const scanDirectoryRecursive = async (dirHandle: FileSystemDirectoryHandle, folderId: string, inheritedArtistImageBlob: Blob | null = null) => {
      const musicFileEntries: FileSystemFileHandle[] = [];
      const subDirectories: FileSystemDirectoryHandle[] = [];
      let coverHandle: FileSystemFileHandle | undefined;
      let artistImageHandle: FileSystemFileHandle | undefined;
      const coverFileNames = ['cover.jpg', 'cover.png', 'folder.jpg', 'albumart.jpg', 'album.jpg', 'cover.jpeg'];
      const artistImageNames = ['folder.jpg', 'folder.png', 'artist.jpg', 'artist.png'];
  
      for await (const entry of (dirHandle as any).values()) {
        if (entry.kind === 'directory') {
          subDirectories.push(entry as FileSystemDirectoryHandle);
        } else if (entry.kind === 'file') {
          const lowerName = entry.name.toLowerCase();
          if (SUPPORTED_FORMATS.some(ext => lowerName.endsWith(ext))) {
            musicFileEntries.push(entry as FileSystemFileHandle);
          } else {
            if (!coverHandle && coverFileNames.includes(lowerName)) {
              coverHandle = entry as FileSystemFileHandle;
            }
            if (!artistImageHandle && artistImageNames.includes(lowerName)) {
              artistImageHandle = entry as FileSystemFileHandle;
            }
          }
        }
      }
  
      let directoryCoverBlob: Blob | null = null;
      if (coverHandle) { try { directoryCoverBlob = await coverHandle.getFile(); } catch (e) { console.warn(`Could not read cover file ${coverHandle.name}`, e); } }
  
      let currentArtistImageBlob: Blob | null = null;
      if (artistImageHandle) { try { currentArtistImageBlob = await artistImageHandle.getFile(); } catch (e) { console.warn(`Could not read artist image file ${artistImageHandle.name}`, e); } }
      
      const effectiveArtistImageBlob = currentArtistImageBlob || inheritedArtistImageBlob;

      for (const musicHandle of musicFileEntries) {
        filesToProcess.push({ handle: musicHandle, folderId, directoryCoverBlob, artistImageBlob: effectiveArtistImageBlob });
      }
      
      for (const subDir of subDirectories) {
        await scanDirectoryRecursive(subDir, folderId, effectiveArtistImageBlob);
      }
    };
  
    for (const folder of foldersToScan) {
      if (!folder.handle) continue;
      try {
        let permission = await folder.handle.queryPermission({ mode: 'read' });
        if (permission !== 'granted') permission = await folder.handle.requestPermission({ mode: 'read' });
        
        if (permission === 'granted') {
          await scanDirectoryRecursive(folder.handle, folder.id);
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
  
    const tracksByFingerprint = new Map(tracks.map(t => [t.fingerprint, t]));
    const BATCH_SIZE = 15; 
    let processedCount = 0;
  
    for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
      const batch = filesToProcess.slice(i, i + BATCH_SIZE);
      const batchResults: Track[] = [];
      const artistMetadataToUpdate: { name: string; blob: Blob }[] = [];
  
      await Promise.all(batch.map(async (item) => {
        try {
          const file = await item.handle.getFile();
          const fingerprint = `${file.name}-${file.size}`;
          // FIX: Explicitly cast the result from the map. The TypeScript compiler was inferring
          // `existingTrack` as `unknown`, leading to errors when accessing its properties.
          // This assertion ensures it's correctly typed as `Track | undefined`.
          const existingTrack = tracksByFingerprint.get(fingerprint) as Track | undefined;
          const needsCoverUpdate = existingTrack && !existingTrack.coverBlob && item.directoryCoverBlob;
          
          if (!existingTrack || needsCoverUpdate) {
              setCurrentProcessingFile(file.name);
              const newTrackData = await parseFileToTrack(file, item.directoryCoverBlob);
              
              const finalTrack = existingTrack ? { ...existingTrack, ...newTrackData, id: existingTrack.id } : newTrackData;
              finalTrack.folderId = item.folderId;
              (finalTrack as any).fileName = file.name;
              batchResults.push(finalTrack);

              if (item.artistImageBlob && finalTrack.artist !== '未知歌手') {
                const artists = finalTrack.artist.split(' / ').map(a => a.trim());
                artists.forEach(artistName => {
                  artistMetadataToUpdate.push({ name: artistName, blob: item.artistImageBlob! });
                });
              }
          }
          processedCount++;
        } catch (err) { 
            console.error(`Failed to process ${item.handle.name}:`, err); 
            processedCount++;
        }
      }));
  
      if (batchResults.length > 0) {
        await saveTracksToCache(batchResults);
        setTracks(prev => {
            const newAndUpdatedMap = new Map(batchResults.map(t => [t.fingerprint, t]));
            const oldTracksKept = prev.filter(t => !newAndUpdatedMap.has(t.fingerprint));
            return [...oldTracksKept, ...batchResults];
        });
      }
      if (artistMetadataToUpdate.length > 0) {
        for (const meta of artistMetadataToUpdate) {
          await saveArtistMetadata(meta.name, meta.blob);
        }
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
    await removeLibraryFolder(id);
    await loadData();
    setTracks(prev => prev.filter(t => t.folderId !== id));
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
    artistMetadata,
    syncAll: () => syncFolders(), 
    syncFolder: (id: string) => syncFolders(id), 
    registerFolder, reconnectFolder, removeFolder: handleRemoveFolder, resolveTrackFile,
    handleManualFilesSelect,
    historyTracks,
    recordTrackPlayback,
    fetchHistory, clearHistory, needsPermission
  };
};