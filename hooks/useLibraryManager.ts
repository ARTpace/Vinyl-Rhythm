
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Track, LibraryFolder, HistoryEntry } from '../types';
import { parseFileToTrack, findFolderCoverFromHandle } from '../utils/audioParser';
import { SUPPORTED_FORMATS } from '../constants';
import {
  saveLibraryFolder,
  getAllLibraryFolders,
  removeLibraryFolder,
  saveWebdavFolder,
  getAllWebdavFolders,
  removeWebdavFolder,
  getPlaybackHistory,
  clearPlaybackHistory,
  saveTracksToCache,
  replaceTracksForFolderInCache,
  getCachedTracks,
  addToHistory,
  getAllArtistMetadata,
  followArtist,
  unfollowArtist,
  getAllFollowedArtists
} from '../utils/storage';
import { normalizeChinese } from '../utils/chineseConverter';

export const useLibraryManager = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [importedFolders, setImportedFolders] = useState<(LibraryFolder & { hasHandle: boolean })[]>([]);
  const [electronFolders, setElectronFolders] = useState<Array<{ id: string; name: string; path: string; lastSync: number; totalFilesCount?: number }>>([]);
  const [webdavFolderIds, setWebdavFolderIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [currentProcessingFile, setCurrentProcessingFile] = useState('');
  const [syncingFolderId, setSyncingFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [needsPermission, setNeedsPermission] = useState(false);
  const [nasMode, setNasMode] = useState(false);
  const [artistMetadata, setArtistMetadata] = useState<Map<string, string>>(new Map());
  const [followedArtists, setFollowedArtists] = useState<Set<string>>(new Set());
  const [lastWebdavConfig, setLastWebdavConfig] = useState<{ baseUrl: string; username?: string; password?: string } | null>(() => {
    const saved = localStorage.getItem('last_webdav_config');
    return saved ? JSON.parse(saved) : null;
  });

  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('vinyl_favorites');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const checkNasMode = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const status = await res.json();
        setNasMode(status.nasMode);
        return status.nasMode;
      }
    } catch (e) {
      return false;
    }
    return false;
  }, []);

  const syncNasLibrary = useCallback(async () => {
    if (isImporting) return;
    setIsImporting(true);
    setImportProgress(0);
    setCurrentProcessingFile('正在扫描 NAS 存储卷...');
    
    try {
      const res = await fetch('/api/scan');
      if (!res.ok) throw new Error('NAS API inaccessible');
      const nasFiles = await res.json();
      
      const cachedTracks = await getCachedTracks();
      const cachedByPath = new Map<string, any>();
      for (const t of cachedTracks as any[]) {
        if (!t || t.folderId !== 'NAS_ROOT') continue;
        const p = typeof t.path === 'string' ? t.path.replace(/^[/\\]+/, '') : '';
        if (p) {
          cachedByPath.set(p, t);
          continue;
        }
        const urlStr = typeof t.url === 'string' ? t.url : '';
        const match = urlStr.match(/[?&]path=([^&]+)/);
        if (match?.[1]) {
          try {
            cachedByPath.set(decodeURIComponent(match[1]).replace(/^[/\\]+/, ''), t);
          } catch {}
        }
      }
      const newTracks: Track[] = [];
      const total = nasFiles.length;
      
      for (let i = 0; i < total; i++) {
        const fileData = nasFiles[i];
        const relativePath = String(fileData.path || '').replace(/^[/\\]+/, '');
        const fingerprint = `NAS:${relativePath}`;

        const existing = cachedByPath.get(relativePath);

        const next: any = {
          ...(existing ? existing : {}),
          id: existing ? existing.id : Math.random().toString(36).substring(2, 9),
          fingerprint,
          folderId: 'NAS_ROOT',
          url: `/api/stream?path=${encodeURIComponent(relativePath)}`,
          path: relativePath,
          fileName: String(fileData.fileName || ''),
          lastModified: Number(fileData.lastModified || Date.now()),
          size: Number(fileData.size || 0),
          dateAdded: existing ? existing.dateAdded : Date.now(),
          file: null as any
        };

        const title = typeof fileData.title === 'string' ? fileData.title.trim() : '';
        const artist = typeof fileData.artist === 'string' ? fileData.artist.trim() : '';
        const album = typeof fileData.album === 'string' ? fileData.album.trim() : '';

        // 优先使用最新的元数据，如果元数据为空则回退到文件名
        next.name = title || String(fileData.name || '') || (existing ? existing.name : '未知曲目');
        next.artist = artist || '未知歌手';
        next.album = album || 'NAS 卷';
        
        if (fileData.duration != null) next.duration = fileData.duration;
        if (fileData.bitrate != null) next.bitrate = fileData.bitrate;

        newTracks.push(next as Track);
        
        if (i % 20 === 0) {
          setImportProgress(Math.floor((i / total) * 100));
        }
      }
      
      setTracks(newTracks);
      await replaceTracksForFolderInCache('NAS_ROOT', newTracks);
      setImportProgress(100);
    } catch (e) {
      console.error('NAS Sync Error:', e);
    } finally {
      setIsImporting(false);
    }
  }, [isImporting]);

  const loadData = useCallback(async () => {
    try {
      const isNas = await checkNasMode();

      let cached: any[] = [];
      try {
        cached = await getCachedTracks();
      } catch (e) {
        console.error('getCachedTracks failed:', e);
        cached = [];
      }

      try {
        const metaList = await getAllArtistMetadata();
        const metaMap = new Map<string, string>();
        metaList.forEach(m => metaMap.set(m.name, m.coverUrl));
        setArtistMetadata(metaMap);
      } catch (e) {
        console.error('getAllArtistMetadata failed:', e);
      }

      try {
        const followed = await getAllFollowedArtists();
        setFollowedArtists(new Set(followed));
      } catch (e) {
        console.error('getAllFollowedArtists failed:', e);
      }

      if (isNas) {
        setImportedFolders([{ id: 'NAS_ROOT', name: 'NAS 存储卷', lastSync: Date.now(), trackCount: cached.length, hasHandle: true }]);
        if (cached.length === 0) {
          syncNasLibrary();
        } else {
          setTracks(cached);
        }
        return;
      }

      let foldersFromDB: any[] = [];
      try {
        foldersFromDB = await getAllLibraryFolders();
      } catch (e) {
        console.error('getAllLibraryFolders failed:', e);
        foldersFromDB = [];
      }

      const mergedElectronFolders = electronFolders.filter(ef => !foldersFromDB.some((f: any) => f.id === ef.id || f.path === ef.path));
      let webdavFolders: any[] = [];
      try {
        webdavFolders = await getAllWebdavFolders();
      } catch (e) {
        webdavFolders = [];
      }
      setWebdavFolderIds(new Set(webdavFolders.map(f => f.id)));

      const combined = [...foldersFromDB, ...webdavFolders, ...mergedElectronFolders];

      setImportedFolders(combined.map((f: any) => ({
        ...f,
        lastSync: f.lastSync || 0,
        trackCount: cached.filter(t => t.folderId === f.id).length,
        hasHandle: f.sourceType === 'webdav' ? true : (window.windowBridge ? !!f.path : !!f.handle)
      })));

      if (cached.length > 0) setTracks(cached);
      if (foldersFromDB.length > 0 && !window.windowBridge && foldersFromDB.some((f: any) => !f.handle)) {
        setNeedsPermission(true);
      }
    } catch (e) {
      console.error('loadData failed:', e);
      setImportedFolders(electronFolders.map(f => ({ ...f, trackCount: 0, hasHandle: true } as any)));
    }
  }, [checkNasMode, syncNasLibrary, electronFolders]);

  useEffect(() => {
    loadData().catch((e) => console.error('loadData unhandled:', e));
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await getPlaybackHistory();
      setHistoryEntries(data);
    } catch (e) {
      console.error('getPlaybackHistory failed:', e);
      setHistoryEntries([]);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const clearHistory = useCallback(async () => {
    await clearPlaybackHistory();
    setHistoryEntries([]);
  }, []);

  const recordTrackPlayback = useCallback(async (track: Track) => {
    await addToHistory(track);
    await fetchHistory();
  }, [fetchHistory]);

  const resolveTrackFile = useCallback(async (track: Track): Promise<Track | null> => {
    if (window.windowBridge && (track as any).path) {
      return {
        ...track,
        url: (window as any).electronAPI.getAudioUrl((track as any).path)
      };
    }

    if (track.url && (track.url.startsWith('http') || track.url.startsWith('/api'))) return track;
    if (track.file && track.url) return track;

    if ((track as any).sourceType === 'webdav' && (track as any).remoteUrl) {
      const remoteUrl = String((track as any).remoteUrl);
      let webdavFolders: any[] = [];
      try {
        webdavFolders = await getAllWebdavFolders();
      } catch {
        webdavFolders = [];
      }
      const folder = webdavFolders.find(f => f.id === track.folderId);
      const username = folder?.username ? String(folder.username) : '';
      const password = folder?.password ? String(folder.password) : '';

      const toBase64 = (input: string) => {
        try {
          return btoa(unescape(encodeURIComponent(input)));
        } catch {
          return btoa(input);
        }
      };

      const headers: Record<string, string> = {};
      if (username || password) {
        headers.Authorization = `Basic ${toBase64(`${username}:${password}`)}`;
      }

      try {
        const res = await fetch(remoteUrl, { method: 'GET', headers });
        if (!res.ok) return null;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const fileName = String((track as any).fileName || '').trim() || 'webdav-audio';
        const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
        const updatedTrack: any = { ...track, file, url };
        setTracks(prev => prev.map(t => t.fingerprint === track.fingerprint ? updatedTrack : t));
        return updatedTrack;
      } catch {
        return null;
      }
    }
    
    let folders: any[] = [];
    try {
      folders = await getAllLibraryFolders();
    } catch (e) {
      console.error('getAllLibraryFolders failed:', e);
      folders = [];
    }
    const folder = folders.find((f: any) => f.id === track.folderId);
    
    if (!folder || !folder.handle) {
      if (!nasMode) setNeedsPermission(true);
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
          await saveTracksToCache([updatedTrack]);
        }
        
        setTracks(prev => prev.map(t => t.fingerprint === track.fingerprint ? updatedTrack : t));
        return updatedTrack;
      }
    } catch (e) { console.error(e); }
    return null;
  }, [nasMode]);

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

  const listWebdavDir = useCallback(async (config: { baseUrl: string; rootPath?: string; username?: string; password?: string }) => {
    const { baseUrl, rootPath = '', username, password } = config;
    if (!baseUrl) return [];

    if (window.windowBridge) {
      try {
        return await (window as any).windowBridge.webdavListDir({
          baseUrl,
          rootPath,
          username,
          password
        });
      } catch (e) {
        console.error('listWebdavDir failed:', e);
        return [];
      }
    }

    // Web Mode (Simple implementation for now, just to avoid errors)
    return [];
  }, []);

  const testWebdavConnection = useCallback(async (config: { baseUrl: string; rootPath: string; username?: string; password?: string }) => {
    const { baseUrl, rootPath, username, password } = config;
    if (!baseUrl || !rootPath) return { success: false, message: '地址和路径不能为空' };

    const toBase64 = (input: string) => {
      try {
        return btoa(unescape(encodeURIComponent(input)));
      } catch {
        return btoa(input);
      }
    };

    const ensureTrailingSlash = (u: string) => u.endsWith('/') ? u : `${u}/`;

    const buildWebdavRootUrl = (baseUrl: string, rootPath: string) => {
      const base = ensureTrailingSlash(baseUrl.trim());
      let sub = String(rootPath || '').trim().replace(/^\/+/, '');
      if (sub && !sub.endsWith('/')) sub = `${sub}/`;
      try {
        return new URL(sub, base).toString();
      } catch {
        return base + sub;
      }
    };

    const url = buildWebdavRootUrl(baseUrl, rootPath);

    if (window.windowBridge) {
      try {
        // 使用 listDir 而不是 list (recursive)，因为测试连接只需要确认目录可访问
        // 这样速度更快，且不容易因为子目录过多而超时
        const files = await window.windowBridge.webdavListDir({
          baseUrl,
          rootPath,
          username,
          password
        });
        if (files && Array.isArray(files)) {
          // 测试成功，保存配置
          const lastConfig = {
            baseUrl: baseUrl.trim(),
            username: username || '',
            password: password || ''
          };
          localStorage.setItem('last_webdav_config', JSON.stringify(lastConfig));
          setLastWebdavConfig(lastConfig);
          return { success: true, message: `连接成功！发现 ${files.length} 个文件。` };
        }
        return { success: false, message: '连接失败：未能获取文件列表' };
      } catch (e: any) {
        return { success: false, message: `连接失败：${e.message || '未知错误'}` };
      }
    }

    // Web Mode
    try {
      const headers: Record<string, string> = {
        Depth: '0',
        'Content-Type': 'application/xml; charset=utf-8'
      };
      if (username || password) {
        headers.Authorization = `Basic ${toBase64(`${username}:${password}`)}`;
      }
      const body =
        `<?xml version="1.0" encoding="utf-8"?>` +
        `<d:propfind xmlns:d="DAV:">` +
        `<d:prop><d:resourcetype/></d:prop>` +
        `</d:propfind>`;

      const res = await fetch(url, { method: 'PROPFIND', headers, body });
      if (res.ok) {
        // 测试成功，保存配置
        const lastConfig = {
          baseUrl: baseUrl.trim(),
          username: username || '',
          password: password || ''
        };
        localStorage.setItem('last_webdav_config', JSON.stringify(lastConfig));
        setLastWebdavConfig(lastConfig);
        return { success: true, message: '连接成功！' };
      }
      if (res.status === 401) return { success: false, message: '连接失败：用户名或密码错误 (401)' };
      if (res.status === 404) return { success: false, message: '连接失败：路径不存在 (404)' };
      if (res.status === 405) return { success: false, message: '连接失败：服务器不支持 PROPFIND (405)，请确认 WebDAV 已开启' };
      return { success: false, message: `连接失败：HTTP ${res.status}` };
    } catch (e: any) {
      console.error('WebDAV test failed:', e);
      // 检查是否可能是本地 IP 导致的跨域/证书问题
      const isLocal = baseUrl.includes('192.168.') || baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost') || baseUrl.includes('10.') || baseUrl.includes('172.');
      if (isLocal) {
        return { 
          success: false, 
          message: '连接失败：如果是网页版，浏览器会拦截私有网络请求。请确保您使用的是桌面客户端版本。' 
        };
      }
      return { success: false, message: '连接失败：网络错误或跨域拦截 (CORS)。' };
    }
  }, []);

  const updateWebdavFolder = useCallback(async (id: string, config: { baseUrl: string; rootPath: string; username?: string; password?: string; name?: string }) => {
    const folders = await getAllWebdavFolders();
    const existing = folders.find(f => f.id === id);
    if (!existing) return;

    const updated = {
      ...existing,
      ...config,
      name: config.name || existing.name
    };

    await saveWebdavFolder(updated);
    await loadData();
  }, [loadData]);

  const updateLibraryFolderName = useCallback(async (id: string, newName: string) => {
    const folders = await getAllLibraryFolders();
    const existing = folders.find(f => f.id === id);
    if (!existing) return;

    const updated = {
      ...existing,
      name: newName
    };

    await saveLibraryFolder(id, (existing.path || existing.handle) as any, existing.totalFilesCount, existing.lastSync, newName);
    await loadData();
  }, [loadData]);

  const syncFolders = useCallback(async (specificFolderId?: string) => {
    if (nasMode) {
      return syncNasLibrary();
    }

    if (window.windowBridge) {
      if (isImporting) return false;

      setIsImporting(true);
      setImportProgress(0);
      setSyncingFolderId(specificFolderId || 'ALL');
      setCurrentProcessingFile('正在扫描本地文件夹...');

      try {
        let savedFolders: any[] = [];
        try {
          savedFolders = await getAllLibraryFolders();
        } catch (e) {
          console.error('getAllLibraryFolders failed:', e);
          savedFolders = [];
        }

        let webdavFolders: any[] = [];
        try {
          webdavFolders = await getAllWebdavFolders();
        } catch (e) {
          webdavFolders = [];
        }

        const mergedFolders: any[] = [
          ...savedFolders,
          ...webdavFolders,
          ...electronFolders.filter(ef => !savedFolders.some((f: any) => f.id === ef.id || f.path === ef.path)).map(ef => ({
            id: ef.id,
            name: ef.name,
            path: ef.path,
            lastSync: ef.lastSync,
            totalFilesCount: ef.totalFilesCount
          }))
        ];

        if (mergedFolders.length === 0) {
          setIsImporting(false);
          setSyncingFolderId(null);
          return false;
        }

        const foldersToScan = specificFolderId
          ? mergedFolders.filter(f => f.id === specificFolderId)
          : mergedFolders;

        const foldersWithPath = foldersToScan.filter(f => (f as any).path);
        const foldersWithWebdav = foldersToScan.filter(f => f.sourceType === 'webdav');
        if (foldersWithPath.length === 0 && foldersWithWebdav.length === 0) {
          setIsImporting(false);
          setSyncingFolderId(null);
          return false;
        }

        let cachedTracks: any[] = [];
        try {
          cachedTracks = await getCachedTracks();
        } catch (e) {
          console.error('getCachedTracks failed:', e);
          cachedTracks = [];
        }
        const existingByFingerprint = new Map<string, any>();
        cachedTracks.forEach(t => existingByFingerprint.set(t.fingerprint, t));

        const SUPPORTED_EXT = new Set(SUPPORTED_FORMATS.map(s => s.toLowerCase()));

        const hashString = (input: string) => {
          let h = 5381;
          for (let i = 0; i < input.length; i++) h = ((h << 5) + h) ^ input.charCodeAt(i);
          return (h >>> 0).toString(36);
        };

        const toTimestamp = (v: any) => {
          if (!v) return Date.now();
          if (typeof v === 'number') return v;
          const d = new Date(v);
          const t = d.getTime();
          return Number.isFinite(t) ? t : Date.now();
        };

        const coverToBlob = (cover: any) => {
          if (!cover?.data) return undefined;
          const fmt = String(cover.format || '').toLowerCase();
          const mime =
            fmt.startsWith('image/') ? fmt :
            fmt === 'jpg' ? 'image/jpeg' :
            fmt === 'jpeg' ? 'image/jpeg' :
            fmt === 'png' ? 'image/png' :
            fmt === 'webp' ? 'image/webp' :
            fmt === 'gif' ? 'image/gif' :
            fmt ? `image/${fmt}` : 'application/octet-stream';
          try {
            return new Blob([cover.data], { type: mime });
          } catch {
            return undefined;
          }
        };

        const coverToUrl = (coverBlob: Blob | undefined) => {
          if (!coverBlob) return undefined;
          try {
            return URL.createObjectURL(coverBlob);
          } catch {
            return undefined;
          }
        };

        const allNewTracks: Track[] = [];
        const allUpdatedTracks: any[] = [];
        const scanResultsByFolder = new Map<string, any[]>();

        for (const folder of foldersWithPath) {
          const folderPath = (folder as any).path as string;
          if (!folderPath) continue;
          setCurrentProcessingFile(`扫描：${folder.name}`);
          const files = await window.windowBridge.scanDirectory(folderPath);
          scanResultsByFolder.set(folder.id, files || []);
          try {
            await saveLibraryFolder(folder.id, folderPath, (files || []).length, Date.now());
          } catch (e) {
            console.error('saveLibraryFolder failed:', e);
          }
        }

        const webdavResultsByFolder = new Map<string, any[]>();
        for (const folder of foldersWithWebdav) {
          setCurrentProcessingFile(`扫描：${folder.name}`);
          const files = await window.windowBridge.webdavList({
            baseUrl: folder.baseUrl,
            rootPath: folder.rootPath,
            username: folder.username,
            password: folder.password
          });
          webdavResultsByFolder.set(folder.id, files || []);
          try {
            await saveWebdavFolder({
              ...folder,
              lastSync: Date.now(),
              totalFilesCount: (files || []).length
            });
          } catch {}
        }

        const needsMetaUpdate = (t: any, currentFile?: any) => {
          // 1. 如果基本信息缺失，需要更新
          const artistMissing = !t?.artist || t.artist === '未知歌手';
          const albumMissing = !t?.album || t.album === '本地文件夹' || t.album === '未知专辑';
          const nameMissing = !t?.name;
          const durationMissing = !t?.duration;
          
          if (artistMissing || albumMissing || nameMissing || durationMissing) return true;

          // 2. 如果提供了当前文件信息，对比修改时间
          if (currentFile && currentFile.mtime) {
            const currentMtime = toTimestamp(currentFile.mtime);
            if (t.lastModified && Math.abs(Number(t.lastModified) - currentMtime) > 1000) {
              console.log(`[Library] File modified, triggering metadata update: ${t.name}`);
              return true;
            }
          }

          return false;
        };

        const filesToCreate: Array<{ folderId: string; folderName: string; file: any }> = [];
        const filesToUpdate: Array<{ folderId: string; folderName: string; file: any; existing: any }> = [];
        for (const folder of foldersWithPath) {
          const list = scanResultsByFolder.get(folder.id) || [];
          for (const file of list) {
            const ext = String(file.ext || '').toLowerCase();
            if (ext && !SUPPORTED_EXT.has(ext)) continue;
            const fp = `${file.path}-${file.size}`;
            const existing = existingByFingerprint.get(fp);
            if (!existing) {
              filesToCreate.push({ folderId: folder.id, folderName: folder.name, file });
              continue;
            }
            // 传入当前文件信息以检测修改时间
            if (needsMetaUpdate(existing, file) || !existing.path) {
              filesToUpdate.push({ folderId: folder.id, folderName: folder.name, file, existing });
            }
          }
        }

        const webdavFilesToCreate: Array<{ folder: any; file: any }> = [];
        for (const folder of foldersWithWebdav) {
          const list = webdavResultsByFolder.get(folder.id) || [];
          for (const file of list) {
            const name = String(file.name || '');
            if (!SUPPORTED_FORMATS.some(ext => name.toLowerCase().endsWith(ext))) continue;
            const fp = `${folder.id}:${file.remotePath}-${file.size}`;
            const existing = existingByFingerprint.get(fp);
            if (!existing || !existing.path) {
              webdavFilesToCreate.push({ folder, file });
            }
          }
        }

        const total = filesToCreate.length + filesToUpdate.length + webdavFilesToCreate.length;
        if (total === 0) {
          let updatedFolders: any[] = [];
          try {
            updatedFolders = await getAllLibraryFolders();
          } catch (e) {
            console.error('getAllLibraryFolders failed:', e);
            updatedFolders = [];
          }

          let updatedWebdav: any[] = [];
          try {
            updatedWebdav = await getAllWebdavFolders();
          } catch {
            updatedWebdav = [];
          }

          const merged = [
            ...updatedFolders,
            ...updatedWebdav,
            ...electronFolders.filter(ef => !updatedFolders.some((f: any) => f.id === ef.id || f.path === ef.path)).map(ef => ({ ...ef }))
          ];

          setImportedFolders(merged.map((f: any) => ({
            ...(f as any),
            lastSync: (f as any).lastSync || 0,
            trackCount: cachedTracks.filter(t => t.folderId === f.id).length,
            hasHandle: f.sourceType === 'webdav' ? true : !!(f as any).path
          })));
          setImportProgress(100);
          setTimeout(() => {
            setIsImporting(false);
            setSyncingFolderId(null);
          }, 300);
          return true;
        }

        const CONCURRENCY = 3;
        let processed = 0;

        const processOne = async (item: { folderId: string; folderName: string; file: any; existing?: any }) => {
          const filePath = item.file.path as string;
          const fileName = item.file.name as string;
          const ext = String(item.file.ext || '').toLowerCase();
          const size = Number(item.file.size || 0);
          const fingerprint = `${filePath}-${size}`;

          try {
            setCurrentProcessingFile(fileName);
            const meta = await window.windowBridge.getMetadata(filePath);
            const coverBlob = coverToBlob((meta as any)?.cover);
            const coverUrl = coverToUrl(coverBlob);

            if (item.existing) {
              const existing = item.existing;
              const updated: any = {
                ...existing,
                folderId: existing.folderId || item.folderId,
                lastModified: existing.lastModified || toTimestamp(item.file.mtime),
                path: filePath,
                fileName: existing.fileName || fileName,
                name: meta?.title || existing.name || fileName || existing.name,
                artist: meta?.artist || existing.artist || '未知歌手',
                album: meta?.album || existing.album || item.folderName || '本地文件夹',
                duration: meta?.duration ?? existing.duration,
                bitrate: meta?.bitrate ?? existing.bitrate,
                year: meta?.year ?? existing.year,
                genre: meta?.genre ?? existing.genre,
                coverBlob: coverBlob || existing.coverBlob,
                coverUrl: coverUrl || existing.coverUrl
              };
              allUpdatedTracks.push(updated);
            } else {
              const track: any = {
                id: hashString(fingerprint),
                name: meta?.title || fileName || (filePath ? filePath.split(/[\\/]/).pop() : '未知曲目'),
                artist: meta?.artist || '未知歌手',
                album: meta?.album || item.folderName || '本地文件夹',
                url: '',
                file: null as any,
                duration: meta?.duration,
                bitrate: meta?.bitrate,
                year: meta?.year,
                genre: meta?.genre,
                fingerprint,
                folderId: item.folderId,
                lastModified: toTimestamp(item.file.mtime),
                dateAdded: Date.now(),
                coverBlob,
                coverUrl,
                path: filePath,
                fileName
              };
              allNewTracks.push(track);
            }
          } catch (e) {
            if (item.existing) {
              const existing = item.existing;
              const updated: any = {
                ...existing,
                folderId: existing.folderId || item.folderId,
                lastModified: existing.lastModified || toTimestamp(item.file.mtime),
                path: filePath,
                fileName: existing.fileName || fileName
              };
              allUpdatedTracks.push(updated);
            } else {
              const track: any = {
                id: hashString(fingerprint),
                name: item.file.name || (filePath ? filePath.split(/[\\/]/).pop() : '未知曲目'),
                artist: '未知歌手',
                album: item.folderName || '本地文件夹',
                url: '',
                file: null as any,
                fingerprint,
                folderId: item.folderId,
                lastModified: toTimestamp(item.file.mtime),
                dateAdded: Date.now(),
                path: filePath,
                fileName
              };
              allNewTracks.push(track);
            }
          } finally {
            processed++;
            if (processed % 5 === 0 || processed === total) {
              setImportProgress(Math.floor((processed / total) * 100));
            }
          }
        };

        const allQueue: Array<{ folderId: string; folderName: string; file: any; existing?: any }> = [
          ...filesToUpdate.map(x => ({ folderId: x.folderId, folderName: x.folderName, file: x.file, existing: x.existing })),
          ...filesToCreate
        ];

        for (let i = 0; i < allQueue.length; i += CONCURRENCY) {
          const chunk = allQueue.slice(i, i + CONCURRENCY);
          await Promise.all(chunk.map(processOne));
          await new Promise(r => requestAnimationFrame(r));
        }

        const webdavConcurrency = 2;
        for (let i = 0; i < webdavFilesToCreate.length; i += webdavConcurrency) {
          const chunk = webdavFilesToCreate.slice(i, i + webdavConcurrency);
          await Promise.all(chunk.map(async ({ folder, file }) => {
            const name = String(file.name || '');
            setCurrentProcessingFile(name || 'WebDAV 文件');
            try {
              const dl = await window.windowBridge!.webdavDownload({
                baseUrl: folder.baseUrl,
                remotePath: file.remotePath,
                username: folder.username,
                password: folder.password,
                folderId: folder.id
              });
              const localPath = dl.localPath;
              const fingerprint = `${folder.id}:${file.remotePath}-${file.size}`;
              const meta = await window.windowBridge!.getMetadata(localPath);
              const coverBlob = coverToBlob((meta as any)?.cover);
              const coverUrl = coverToUrl(coverBlob);
              const track: any = {
                id: hashString(fingerprint),
                name: meta?.title || name.replace(/\.[^/.]+$/, "") || name,
                artist: meta?.artist || '未知歌手',
                album: meta?.album || folder.name || 'WebDAV',
                url: '',
                file: null as any,
                duration: meta?.duration,
                bitrate: meta?.bitrate,
                year: meta?.year,
                genre: meta?.genre,
                fingerprint,
                folderId: folder.id,
                lastModified: Number(file.lastModified || Date.now()),
                dateAdded: Date.now(),
                coverBlob,
                coverUrl,
                path: localPath,
                fileName: (localPath ? String(localPath).split(/[\\/]/).pop() : '') || name,
                remotePath: file.remotePath,
                sourceType: 'webdav'
              };
              allNewTracks.push(track);
            } catch (e) {
            } finally {
              processed++;
              if (processed % 5 === 0 || processed === total) {
                setImportProgress(Math.floor((processed / total) * 100));
              }
            }
          }));
          await new Promise(r => requestAnimationFrame(r));
        }

        const toSave: any[] = [...allNewTracks, ...allUpdatedTracks];
        if (toSave.length > 0) {
          await saveTracksToCache(toSave);
          setTracks(prev => {
            const byFp = new Map<string, any>();
            prev.forEach(t => byFp.set((t as any).fingerprint, t));
            allUpdatedTracks.forEach(t => byFp.set(t.fingerprint, { ...byFp.get(t.fingerprint), ...t }));
            allNewTracks.forEach(t => { if (!byFp.has((t as any).fingerprint)) byFp.set((t as any).fingerprint, t); });
            return Array.from(byFp.values());
          });
        }

        let updatedFolders: any[] = [];
        try {
          updatedFolders = await getAllLibraryFolders();
        } catch (e) {
          console.error('getAllLibraryFolders failed:', e);
          updatedFolders = [];
        }

        let updatedWebdav: any[] = [];
        try {
          updatedWebdav = await getAllWebdavFolders();
        } catch {
          updatedWebdav = [];
        }

        let refreshedCached: any[] = [];
        try {
          refreshedCached = await getCachedTracks();
        } catch (e) {
          console.error('getCachedTracks failed:', e);
          refreshedCached = [...cachedTracks, ...allNewTracks];
        }

        const merged = [
          ...updatedFolders,
          ...updatedWebdav,
          ...electronFolders.filter(ef => !updatedFolders.some((f: any) => f.id === ef.id || f.path === ef.path)).map(ef => ({ ...ef }))
        ];

        setImportedFolders(merged.map((f: any) => ({
          ...(f as any),
          lastSync: (f as any).lastSync || 0,
          trackCount: refreshedCached.filter(t => t.folderId === f.id).length,
          hasHandle: f.sourceType === 'webdav' ? true : !!(f as any).path
        })));

        setImportProgress(100);
        setTimeout(() => {
          setIsImporting(false);
          setSyncingFolderId(null);
        }, 500);
        return true;
      } catch (e) {
        console.error('Electron folder scan error:', e);
        setIsImporting(false);
        setSyncingFolderId(null);
        return false;
      }
    }

    setIsImporting(true);
    setImportProgress(0);
    setSyncingFolderId(specificFolderId || 'ALL');
    setCurrentProcessingFile('正在盘点本地路径...');

    const savedFolders = await getAllLibraryFolders();
    let webdavFolders: any[] = [];
    try {
      webdavFolders = await getAllWebdavFolders();
    } catch {
      webdavFolders = [];
    }
    if (savedFolders.length === 0 && webdavFolders.length === 0) { setIsImporting(false); setSyncingFolderId(null); return false; }

    const localFoldersToScan = specificFolderId 
      ? savedFolders.filter(f => f.id === specificFolderId)
      : savedFolders;

    const webdavFoldersToScan = specificFolderId
      ? webdavFolders.filter(f => f.id === specificFolderId)
      : webdavFolders;

    const hashString = (input: string) => {
      let h = 5381;
      for (let i = 0; i < input.length; i++) h = ((h << 5) + h) ^ input.charCodeAt(i);
      return (h >>> 0).toString(36);
    };

    const toBase64 = (input: string) => {
      try {
        return btoa(unescape(encodeURIComponent(input)));
      } catch {
        return btoa(input);
      }
    };

    const ensureTrailingSlash = (u: string) => u.endsWith('/') ? u : `${u}/`;

    const buildWebdavRootUrl = (baseUrl: string, rootPath: string) => {
      const base = ensureTrailingSlash(baseUrl.trim());
      let sub = String(rootPath || '').trim().replace(/^\/+/, '');
      if (sub && !sub.endsWith('/')) sub = `${sub}/`;
      return new URL(sub, base).toString();
    };

    const webdavPropfind = async (url: string, username?: string, password?: string) => {
      const raw = `${username || ''}:${password || ''}`;
      const headers: Record<string, string> = {
        Depth: '1',
        'Content-Type': 'application/xml; charset=utf-8'
      };
      if (username || password) headers.Authorization = `Basic ${toBase64(raw)}`;
      const body =
        `<?xml version="1.0" encoding="utf-8"?>` +
        `<d:propfind xmlns:d="DAV:">` +
        `<d:prop><d:resourcetype/><d:getcontentlength/><d:getlastmodified/></d:prop>` +
        `</d:propfind>`;

      const res = await fetch(url, { method: 'PROPFIND', headers, body });
      if (!res.ok) throw new Error(`WebDAV PROPFIND failed: ${res.status}`);
      return await res.text();
    };

    const parseWebdavMultistatus = (xmlText: string, requestUrl: string) => {
      const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
      const responses = Array.from(doc.getElementsByTagNameNS('*', 'response'));
      const reqPath = (() => {
        try {
          return new URL(requestUrl).pathname.replace(/\/?$/, '/');
        } catch {
          return '';
        }
      })();

      return responses.map((r) => {
        const href = r.getElementsByTagNameNS('*', 'href')[0]?.textContent?.trim() || '';
        let remoteUrl = '';
        try {
          remoteUrl = new URL(href, requestUrl).toString();
        } catch {
          remoteUrl = href;
        }

        const pathname = (() => {
          try {
            return new URL(remoteUrl).pathname;
          } catch {
            return '';
          }
        })();

        const isCollection = r.getElementsByTagNameNS('*', 'collection').length > 0 || pathname.endsWith('/');
        const sizeText = r.getElementsByTagNameNS('*', 'getcontentlength')[0]?.textContent?.trim() || '';
        const size = sizeText ? Number(sizeText) : 0;
        const lastModifiedText = r.getElementsByTagNameNS('*', 'getlastmodified')[0]?.textContent?.trim() || '';
        const lastModified = lastModifiedText ? Date.parse(lastModifiedText) : NaN;
        const nameRaw = pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop() || pathname;
        let name = nameRaw;
        try { name = decodeURIComponent(nameRaw); } catch {}

        return {
          remoteUrl,
          remotePath: pathname,
          name,
          size: Number.isFinite(size) ? size : 0,
          lastModified: Number.isFinite(lastModified) ? lastModified : undefined,
          isCollection,
          isSelf: !!reqPath && (pathname === reqPath || pathname === reqPath.replace(/\/$/, ''))
        };
      }).filter(x => x.remoteUrl && x.remotePath && !x.isSelf);
    };

    const webdavListRecursive = async (folder: any) => {
      const rootUrl = buildWebdavRootUrl(String(folder.baseUrl || ''), String(folder.rootPath || ''));
      const visited = new Set<string>();
      const out: Array<{ remoteUrl: string; remotePath: string; name: string; size: number; lastModified?: number }> = [];

      const walk = async (dirUrl: string) => {
        const normalized = ensureTrailingSlash(dirUrl);
        if (visited.has(normalized)) return;
        visited.add(normalized);

        const xml = await webdavPropfind(normalized, folder.username, folder.password);
        const items = parseWebdavMultistatus(xml, normalized);
        for (const it of items) {
          if (it.isCollection) {
            await walk(it.remoteUrl);
          } else {
            out.push({
              remoteUrl: it.remoteUrl,
              remotePath: it.remotePath,
              name: it.name,
              size: it.size,
              lastModified: it.lastModified
            });
          }
        }
      };

      await walk(rootUrl);
      return out;
    };

    const filesToProcess: { handle: FileSystemFileHandle, folderId: string, folderHandle: FileSystemDirectoryHandle }[] = [];

    for (const folder of localFoldersToScan) {
      if (!folder.handle) continue;
      try {
        let permission = await folder.handle.queryPermission({ mode: 'read' });
        if (permission !== 'granted') permission = await folder.handle.requestPermission({ mode: 'read' });
        
        if (permission === 'granted') {
          const fastScan = async (dirHandle: FileSystemDirectoryHandle) => {
            for await (const [name, entry] of (dirHandle as any)) {
              if (entry.kind === 'file' && SUPPORTED_FORMATS.some(ext => name.toLowerCase().endsWith(ext))) {
                filesToProcess.push({ handle: entry as FileSystemFileHandle, folderId: folder.id, folderHandle: folder.handle! });
              } else if (entry.kind === 'directory') await fastScan(entry as FileSystemDirectoryHandle);
            }
          };
          await fastScan(folder.handle);
        }
      } catch (e) { console.error(e); }
    }

    for (const folder of localFoldersToScan) {
        const count = filesToProcess.filter(f => f.folderId === folder.id).length;
        if (folder.handle) {
            await saveLibraryFolder(folder.id, folder.handle, count, Date.now());
        }
    }
    
    let cachedTracks: any[] = [];
    try {
      cachedTracks = await getCachedTracks();
    } catch {
      cachedTracks = [];
    }
    const existingMap = new Map<string, any>();
    cachedTracks.forEach(t => existingMap.set(t.fingerprint, t));

    const webdavNewTracks: any[] = [];
    if (webdavFoldersToScan.length > 0) {
      setCurrentProcessingFile('正在扫描 WebDAV...');
      let errorShown = false;
      for (const folder of webdavFoldersToScan) {
        try {
          const files = await webdavListRecursive(folder);
          await saveWebdavFolder({
            ...folder,
            lastSync: Date.now(),
            totalFilesCount: files.length
          });
          for (const file of files) {
            const name = String(file.name || '');
            if (!SUPPORTED_FORMATS.some(ext => name.toLowerCase().endsWith(ext))) continue;
            const fingerprint = `${folder.id}:${file.remotePath}-${file.size}`;
            
            const existing = existingMap.get(fingerprint);
            const isModified = existing && (Number(existing.lastModified) !== Number(file.lastModified || 0));

            if (existing && !isModified) continue;

            const needsAuth = !!(folder.username || folder.password);
            const track: any = {
              id: existing ? existing.id : hashString(fingerprint),
              name: name.replace(/\.[^/.]+$/, "") || name,
              artist: '未知歌手',
              album: folder.name || 'WebDAV',
              url: needsAuth ? '' : String(file.remoteUrl),
              file: null as any,
              fingerprint,
              folderId: folder.id,
              lastModified: Number(file.lastModified || Date.now()),
              dateAdded: existing ? existing.dateAdded : Date.now(),
              remoteUrl: String(file.remoteUrl),
              remotePath: String(file.remotePath),
              fileName: name,
              sourceType: 'webdav'
            };
            webdavNewTracks.push(track);
            existingMap.set(fingerprint, track);
          }
        } catch (e) {
          console.error('WebDAV scan failed:', e);
          if (!errorShown) {
            errorShown = true;
            alert('WebDAV 扫描失败：请检查地址/账号密码，以及服务器是否开启 CORS 并允许 PROPFIND。');
          }
        }
      }
    }

    if (webdavNewTracks.length > 0) {
      await saveTracksToCache(webdavNewTracks);
      setTracks(prev => {
        const byFp = new Map<string, any>();
        prev.forEach(t => byFp.set((t as any).fingerprint, t));
        webdavNewTracks.forEach(t => { if (!byFp.has(t.fingerprint)) byFp.set(t.fingerprint, t); });
        return Array.from(byFp.values());
      });
    }

    const updatedFolders = await getAllLibraryFolders();
    let updatedWebdav: any[] = [];
    try {
      updatedWebdav = await getAllWebdavFolders();
    } catch {
      updatedWebdav = [];
    }
    let refreshedCached: any[] = [];
    try {
      refreshedCached = await getCachedTracks();
    } catch {
      refreshedCached = cachedTracks;
    }
    setImportedFolders(prev => ([...updatedFolders, ...updatedWebdav].map(f => ({
        ...f,
        lastSync: f.lastSync || 0,
        trackCount: refreshedCached.filter(t => t.folderId === f.id).length,
        hasHandle: f.sourceType === 'webdav' ? true : !!(f as any).handle
    }))));

    const total = filesToProcess.length;
    if (total === 0) { setIsImporting(false); setSyncingFolderId(null); return true; }

    const BATCH_SIZE = 15;
    let processedCount = 0;

    const uniqueFolders = [...new Set(filesToProcess.map(f => f.folderId))];
    const folderCoverBlobs = new Map<string, Blob | null>();

    setCurrentProcessingFile('正在查找文件夹封面...');
    for (const folderId of uniqueFolders) {
      const folderItem = filesToProcess.find(f => f.folderId === folderId);
      if (folderItem?.folderHandle) {
        const cover = await findFolderCoverFromHandle(folderItem.folderHandle);
        folderCoverBlobs.set(folderId, cover);
      } else {
        folderCoverBlobs.set(folderId, null);
      }
    }

    for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
      const batch = filesToProcess.slice(i, i + BATCH_SIZE);
      const batchResults: Track[] = [];

      await Promise.all(batch.map(async (item) => {
        try {
          const file = await item.handle.getFile();
          const fingerprint = `${file.name}-${file.size}`;
          
          const existing = existingMap.get(fingerprint);
          const isModified = existing && (Math.abs(Number(existing.lastModified) - Number(file.lastModified)) > 1000);

          if (existing && !isModified) {
              processedCount++;
              return;
          }

          setCurrentProcessingFile(file.name);
          const t = await parseFileToTrack(file, folderCoverBlobs.get(item.folderId) || null);
          t.folderId = item.folderId;
          (t as any).fileName = file.name;
          
          if (existing) {
            t.id = existing.id;
            t.dateAdded = existing.dateAdded;
          }

          batchResults.push(t);
          existingMap.set(fingerprint, t);
          processedCount++;
        } catch (err) { 
            console.error(err); 
            processedCount++;
        }
      }));

      if (batchResults.length > 0) {
        await saveTracksToCache(batchResults);
        setTracks(prev => {
          const byFp = new Map<string, any>();
          prev.forEach(t => byFp.set(t.fingerprint, t));
          batchResults.forEach(t => byFp.set(t.fingerprint, t));
          return Array.from(byFp.values());
        });
      }

      setImportProgress(Math.floor((processedCount / total) * 100));
      await new Promise(r => requestAnimationFrame(r));
    }

    setImportProgress(100);
    setTimeout(() => {
        setIsImporting(false);
        setSyncingFolderId(null);
    }, 800);
    return true;
  }, [nasMode, syncNasLibrary, tracks.length, isImporting]);

  const registerFolder = async (handleOrPath?: FileSystemDirectoryHandle | string) => {
    if (nasMode) return 'NAS_ROOT';
    if (!handleOrPath) return null;

    if (window.windowBridge && typeof handleOrPath === 'string') {
      const existingInState = electronFolders.find(f => f.path === handleOrPath);
      if (existingInState) return existingInState.id;

      try {
        const existing = (await getAllLibraryFolders()).find(f => (f as any).path === handleOrPath);
        if (existing) return (existing as any).id;
      } catch (e) {
        console.error('getAllLibraryFolders failed:', e);
      }

      const safeName = handleOrPath.replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean).pop() || handleOrPath;
      const id = `${safeName}_${Date.now()}`;
      const entry = { id, name: safeName, path: handleOrPath, lastSync: 0 };
      setElectronFolders(prev => prev.some(f => f.path === handleOrPath) ? prev : [entry, ...prev]);
      setImportedFolders(prev => prev.some(f => f.id === id) ? prev : ([{ ...(entry as any), trackCount: 0, hasHandle: true } as any, ...prev]));

      try {
        await saveLibraryFolder(id, handleOrPath);
      } catch (e) {
        console.error('saveLibraryFolder failed:', e);
      }

      loadData().catch((e) => console.error('loadData unhandled:', e));
      return id;
    }

    if (typeof handleOrPath === 'string') return null;
    const id = handleOrPath.name + "_" + Date.now();
    try {
      await saveLibraryFolder(id, handleOrPath);
    } catch (e) {
      console.error('saveLibraryFolder failed:', e);
    }
    loadData().catch((e) => console.error('loadData unhandled:', e));
    return id; 
  };

  const reconnectFolder = async (folderId: string, handleOrPath: FileSystemDirectoryHandle | string) => {
    if (nasMode) return;
    if (window.windowBridge && typeof handleOrPath === 'string') {
      const safeName = handleOrPath.replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean).pop() || handleOrPath;
      const entry = { id: folderId, name: safeName, path: handleOrPath, lastSync: 0 };
      setElectronFolders(prev => [entry, ...prev.filter(f => f.id !== folderId && f.path !== handleOrPath)]);
      setImportedFolders(prev => prev.map(f => f.id === folderId ? ({ ...(f as any), name: safeName, path: handleOrPath, hasHandle: true } as any) : f));
    }

    try {
      await saveLibraryFolder(folderId, handleOrPath as any);
    } catch (e) {
      console.error('saveLibraryFolder failed:', e);
    }
    loadData().catch((e) => console.error('loadData unhandled:', e));
    syncFolders(folderId);
  };

  const handleRemoveFolder = useCallback(async (id: string) => {
    if (nasMode) return;
    try {
      setElectronFolders(prev => prev.filter(f => f.id !== id));
      setImportedFolders(prev => prev.filter(f => f.id !== id));
      setTracks(prev => prev.filter(t => t.folderId !== id));
      await Promise.allSettled([
        removeLibraryFolder(id),
        removeWebdavFolder(id)
      ]);
      if (window.windowBridge && webdavFolderIds.has(id)) {
        await window.windowBridge.webdavClearCache(id);
      }
    } catch (e) {
      console.error('removeLibraryFolder failed:', e);
    } finally {
      loadData().catch((e) => console.error('loadData unhandled:', e));
    }
  }, [loadData, nasMode, webdavFolderIds]);

  const updateWebdavConfig = useCallback((config: { baseUrl: string; username?: string; password?: string }) => {
        const lastConfig = {
            baseUrl: config.baseUrl.trim(),
            username: config.username || '',
            password: config.password || ''
        };
        localStorage.setItem('last_webdav_config', JSON.stringify(lastConfig));
        setLastWebdavConfig(lastConfig);
    }, []);

    const registerWebdavFolder = useCallback(async (config: { baseUrl: string; rootPath: string; username?: string; password?: string; name?: string }) => {
    if (!config?.baseUrl || !config?.rootPath) return null;
    const id = `WEBDAV_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let hostName = '';
    try {
      hostName = new URL(config.baseUrl).hostname || '';
    } catch {}
    
    // 智能推断名称：如果用户没填名称，则取路径的最后一个层级作为名称
    const lastSegment = config.rootPath.replace(/\/+$/, '').split('/').pop();
    const name = config.name?.trim() || (lastSegment ? `${lastSegment} (WebDAV)` : hostName) || 'WebDAV';
    
    const entry: any = {
      id,
      name,
      sourceType: 'webdav',
      baseUrl: config.baseUrl.trim(),
      rootPath: config.rootPath.trim(),
      username: config.username || '',
      password: config.password || '',
      lastSync: 0,
      totalFilesCount: 0,
      addedAt: Date.now()
    };
    try {
      await saveWebdavFolder(entry);
      // 保存最近使用的 WebDAV 配置（不保存 rootPath，因为用户通常会添加不同的子目录）
      const lastConfig = {
        baseUrl: config.baseUrl.trim(),
        username: config.username || '',
        password: config.password || ''
      };
      localStorage.setItem('last_webdav_config', JSON.stringify(lastConfig));
      setLastWebdavConfig(lastConfig);
    } catch {}
    setWebdavFolderIds(prev => new Set([...Array.from(prev), id]));
    loadData().catch((e) => console.error('loadData unhandled:', e));
    return id;
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

  const handleFollowArtist = useCallback(async (artistName: string) => {
    await followArtist(artistName);
    setFollowedArtists(prev => new Set([...prev, artistName]));
  }, []);

  const handleUnfollowArtist = useCallback(async (artistName: string) => {
    await unfollowArtist(artistName);
    setFollowedArtists(prev => {
      const newSet = new Set(prev);
      newSet.delete(artistName);
      return newSet;
    });
  }, []);

  return {
    tracks, setTracks, importedFolders,
    isImporting, importProgress, currentProcessingFile, syncingFolderId,
    searchQuery, setSearchQuery, filteredTracks,
    favorites, handleToggleFavorite, handleUpdateTrack, reorderTracks,
    syncAll: () => syncFolders(), 
    syncFolder: (id: string) => syncFolders(id), 
    registerFolder, registerWebdavFolder, updateWebdavConfig, reconnectFolder, updateWebdavFolder, updateLibraryFolderName, testWebdavConnection, listWebdavDir, removeFolder: handleRemoveFolder, resolveTrackFile,
    handleManualFilesSelect,
    historyTracks,
    recordTrackPlayback,
    fetchHistory, clearHistory, needsPermission, nasMode, artistMetadata,
    followedArtists, handleFollowArtist, handleUnfollowArtist,
    lastWebdavConfig
  };
};
