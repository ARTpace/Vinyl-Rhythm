
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Track, LibraryFolder } from '../types';
import { parseFileToTrack } from '../utils/audioParser';
import { SUPPORTED_FORMATS } from '../constants';
import { saveLibraryFolder, getAllLibraryFolders, removeLibraryFolder } from '../utils/storage';
import { normalizeChinese } from '../utils/chineseConverter';

export const useLibraryManager = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
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
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, ...updates } : t));
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
          foundFiles.push(await entry.getFile());
        } else if (entry.kind === 'directory') {
          await recursiveScan(entry);
        }
      }
    }
    await recursiveScan(handle);
    return foundFiles;
  };

  const processFiles = async (files: File[], folderId: string) => {
    setIsImporting(true);
    let localBatch: Track[] = [];
    const BATCH_SIZE = 50;
    for (let i = 0; i < files.length; i++) {
      setImportProgress(Math.round(((i + 1) / files.length) * 100));
      setCurrentProcessingFile(`导入: ${files[i].name}`);
      try {
        const track = await parseFileToTrack(files[i]);
        track.folderId = folderId;
        localBatch.push(track);
        if (localBatch.length >= BATCH_SIZE) {
          const batch = [...localBatch];
          setTracks(prev => [...prev, ...batch]);
          localBatch = [];
        }
      } catch (e) { console.warn(e); }
      if (i % 10 === 0) await new Promise(r => setTimeout(r, 0));
    }
    if (localBatch.length > 0) setTracks(prev => [...prev, ...localBatch]);
    setIsImporting(false);
  };

  const handleManualFilesSelect = async (fileList: FileList) => {
    const files = Array.from(fileList).filter(f => SUPPORTED_FORMATS.some(ext => f.name.toLowerCase().endsWith(ext)));
    if (files.length === 0) return;
    const folderId = "manual_" + Date.now();
    await processFiles(files, folderId);
    setImportedFolders(prev => [...prev, { id: folderId, name: "本地导入", lastSync: Date.now(), trackCount: files.length }]);
    return true;
  };

  const syncAll = async (isSilent: boolean = false) => {
    const savedFolders = await getAllLibraryFolders();
    if (savedFolders.length === 0) return false;
    setIsImporting(true);
    let allProcessedTracks: Track[] = isSilent ? [] : [...tracks];
    let updatedFolders = [...importedFolders];

    for (const folder of savedFolders) {
      try {
        if (folder.id.startsWith('manual_')) continue;
        let permission = await folder.handle.queryPermission({ mode: 'read' });
        if (permission !== 'granted' && !isSilent) permission = await folder.handle.requestPermission({ mode: 'read' });
        if (permission !== 'granted') continue;

        const diskFiles = await scanDirectory(folder.handle);
        const diskFingerprints = new Set(diskFiles.map(f => `${f.name}-${f.size}`));
        allProcessedTracks = allProcessedTracks.filter(t => t.folderId !== folder.id || diskFingerprints.has(t.fingerprint));
        
        const existingFingerprints = new Set(allProcessedTracks.map(t => t.fingerprint));
        const newFiles = diskFiles.filter(f => !existingFingerprints.has(`${f.name}-${f.size}`));
        
        for (let i = 0; i < newFiles.length; i++) {
          setCurrentProcessingFile(`扫描: ${newFiles[i].name}`);
          try {
            const track = await parseFileToTrack(newFiles[i]);
            track.folderId = folder.id;
            allProcessedTracks.push(track);
          } catch (e) {}
        }
        setTracks([...allProcessedTracks]);
        const fIdx = updatedFolders.findIndex(f => f.id === folder.id);
        if (fIdx !== -1) updatedFolders[fIdx] = { ...updatedFolders[fIdx], lastSync: Date.now(), trackCount: allProcessedTracks.filter(t => t.folderId === folder.id).length };
      } catch (e) {}
    }
    setImportedFolders(updatedFolders);
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
    syncAll, removeFolder, handleManualFilesSelect, processFiles
  };
};
