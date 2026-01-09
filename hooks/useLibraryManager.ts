
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Track, LibraryFolder } from '../types';
import { parseFileToTrack } from '../utils/audioParser';
import { SUPPORTED_FORMATS } from '../constants';
import { 
  saveLibraryFolder, 
  getAllLibraryFolders, 
  removeLibraryFolder, 
  readLocalFolderMetadata, 
  writeLocalFolderMetadata 
} from '../utils/storage';
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

  // 新增：手动触发将当前内存中的某个文件夹数据同步到它的本地 JSON 文件
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
        // 这里可以扩展存储更多信息，如 AI 故事（如果想实现故事也随歌走）
      };
    });

    await writeLocalFolderMetadata(target.handle, metadata);
  }, [tracks]);

  const handleUpdateTrack = useCallback((trackId: string, updates: Partial<Track>) => {
    setTracks(prev => {
      const next = prev.map(t => t.id === trackId ? { ...t, ...updates } : t);
      // 检查被更新的歌曲所属文件夹，并尝试异步同步到磁盘
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

        // 1. 尝试读取本地 JSON 配置文件
        const localMetadata = await readLocalFolderMetadata(folder.handle);
        
        const diskFiles = await scanDirectory(folder.handle);
        const diskFingerprints = new Set(diskFiles.map(f => `${f.name}-${f.size}`));
        
        // 2. 移除不存在的文件
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

              // 3. 如果本地 JSON 里有这首歌的记录，覆盖解析出的元数据
              if (localMetadata?.tracks?.[fingerprint]) {
                const saved = localMetadata.tracks[fingerprint];
                track.name = saved.name || track.name;
                track.artist = saved.artist || track.artist;
                track.album = saved.album || track.album;
              }

              allProcessedTracks.push(track);
              if (i % 20 === 0) setTracks([...allProcessedTracks]);
            } catch (e) {}
          }
        }
        
        setTracks([...allProcessedTracks]);

        // 4. 更新完成后，将最新的状态同步回本地 JSON
        const currentFolderTracks = allProcessedTracks.filter(t => t.folderId === folder.id);
        const newMetadata = {
          folderId: folder.id,
          lastSync: Date.now(),
          tracks: currentFolderTracks.reduce((acc: any, t) => {
            acc[t.fingerprint] = { name: t.name, artist: t.artist, album: t.album };
            return acc;
          }, {})
        };
        await writeLocalFolderMetadata(folder.handle, newMetadata);

        const fIdx = updatedFolders.findIndex(f => f.id === folder.id);
        if (fIdx !== -1) {
          updatedFolders[fIdx] = { 
            ...updatedFolders[fIdx], 
            lastSync: Date.now(), 
            trackCount: currentFolderTracks.length 
          };
        }
      } catch (e) {}
    }
    setImportedFolders(updatedFolders);
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
    syncAll, removeFolder, handleManualFilesSelect, persistFolderMetadataToDisk
  };
};
