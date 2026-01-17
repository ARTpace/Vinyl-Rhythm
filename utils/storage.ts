const DB_NAME = 'VinylRhythm_v2';
const DB_VERSION = 1;
const STORE_NAME = 'libraryHandles';
const STORIES_STORE = 'trackStories';
const HISTORY_STORE = 'playbackHistory';
const TRACKS_CACHE_STORE = 'tracksCache';
const ARTIST_METADATA_STORE = 'artistMetadata';
const PLAYLISTS_STORE = 'playlists';
const WEBDAV_FOLDERS_STORE = 'webdavFolders';
const FOLLOWED_ARTISTS_STORE = 'followedArtists';

let dbInstance: IDBDatabase | null = null;

const initDB = async (): Promise<IDBDatabase> => {
  if (dbInstance) return dbInstance;
  if (navigator.storage && navigator.storage.persist) {
    try {
      await navigator.storage.persist();
    } catch (e) {
      console.warn('storage.persist failed:', e);
    }
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORIES_STORE)) {
        const store = db.createObjectStore(STORIES_STORE, { keyPath: 'key' });
        store.createIndex('artist', 'artist', { unique: false });
      }
      if (!db.objectStoreNames.contains(HISTORY_STORE)) db.createObjectStore(HISTORY_STORE, { keyPath: 'fingerprint' });
      if (!db.objectStoreNames.contains(TRACKS_CACHE_STORE)) {
        const store = db.createObjectStore(TRACKS_CACHE_STORE, { keyPath: 'fingerprint' });
        store.createIndex('artist', 'artist', { unique: false });
        store.createIndex('album', 'album', { unique: false });
        store.createIndex('folderId', 'folderId', { unique: false });
        store.createIndex('dateAdded', 'dateAdded', { unique: false });
      }
      if (!db.objectStoreNames.contains(ARTIST_METADATA_STORE)) {
        db.createObjectStore(ARTIST_METADATA_STORE, { keyPath: 'name' });
      }
      // 核心修复：确保歌单存储空间存在
      if (!db.objectStoreNames.contains(PLAYLISTS_STORE)) {
        db.createObjectStore(PLAYLISTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(WEBDAV_FOLDERS_STORE)) {
        db.createObjectStore(WEBDAV_FOLDERS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(FOLLOWED_ARTISTS_STORE)) {
        db.createObjectStore(FOLLOWED_ARTISTS_STORE, { keyPath: 'name' });
      }
    };
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
};

export const savePlaylist = async (playlist: any) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PLAYLISTS_STORE, 'readwrite');
    const store = tx.objectStore(PLAYLISTS_STORE);
    const { coverUrl, ...serializablePlaylist } = playlist;
    const request = store.put(serializablePlaylist);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const updatePlaylist = async (updatedPlaylist: any) => {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(PLAYLISTS_STORE, 'readwrite');
        const store = tx.objectStore(PLAYLISTS_STORE);
        const { coverUrl, ...serializablePlaylist } = updatedPlaylist;
        const request = store.put(serializablePlaylist);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getPlaylist = async (id: string): Promise<any | undefined> => {
    const db = await initDB();
    const tx = db.transaction(PLAYLISTS_STORE, 'readonly');
    const request = tx.objectStore(PLAYLISTS_STORE).get(id);
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const getAllPlaylists = async (): Promise<any[]> => {
  const db = await initDB();
  const tx = db.transaction(PLAYLISTS_STORE, 'readonly');
  const request = tx.objectStore(PLAYLISTS_STORE).getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const results = request.result || [];
      const hydrated = results.map(p => {
        if (p.coverBlob) {
          try { return { ...p, coverUrl: URL.createObjectURL(p.coverBlob) }; } catch (e) { return p; }
        }
        return p;
      }).sort((a,b) => b.createdAt - a.createdAt);
      resolve(hydrated);
    };
    request.onerror = () => reject(request.error);
  });
};

export const removePlaylist = async (id: string) => {
  const db = await initDB();
  const tx = db.transaction(PLAYLISTS_STORE, 'readwrite');
  tx.objectStore(PLAYLISTS_STORE).delete(id);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const saveArtistMetadata = async (name: string, coverBlob: Blob) => {
    const db = await initDB();
    const tx = db.transaction(ARTIST_METADATA_STORE, 'readwrite');
    const store = tx.objectStore(ARTIST_METADATA_STORE);
    store.put({ name, coverBlob });
    return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const getAllArtistMetadata = async (): Promise<{name: string, coverUrl: string}[]> => {
    const db = await initDB();
    const tx = db.transaction(ARTIST_METADATA_STORE, 'readonly');
    const request = tx.objectStore(ARTIST_METADATA_STORE).getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            const results = (request.result || []).map(item => ({
                ...item,
                coverUrl: URL.createObjectURL(item.coverBlob)
            }));
            resolve(results);
        };
        request.onerror = () => reject(request.error);
    });
};

export const followArtist = async (name: string) => {
    const db = await initDB();
    const tx = db.transaction(FOLLOWED_ARTISTS_STORE, 'readwrite');
    const store = tx.objectStore(FOLLOWED_ARTISTS_STORE);
    store.put({ name, followedAt: Date.now() });
    return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const unfollowArtist = async (name: string) => {
    const db = await initDB();
    const tx = db.transaction(FOLLOWED_ARTISTS_STORE, 'readwrite');
    const store = tx.objectStore(FOLLOWED_ARTISTS_STORE);
    store.delete(name);
    return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const isArtistFollowed = async (name: string): Promise<boolean> => {
    const db = await initDB();
    const tx = db.transaction(FOLLOWED_ARTISTS_STORE, 'readonly');
    const store = tx.objectStore(FOLLOWED_ARTISTS_STORE);
    return new Promise((resolve, reject) => {
        const request = store.get(name);
        request.onsuccess = () => resolve(!!request.result);
        request.onerror = () => reject(request.error);
    });
};

export const getAllFollowedArtists = async (): Promise<string[]> => {
    const db = await initDB();
    const tx = db.transaction(FOLLOWED_ARTISTS_STORE, 'readonly');
    const store = tx.objectStore(FOLLOWED_ARTISTS_STORE);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            resolve((request.result || []).map((item: any) => item.name));
        };
        request.onerror = () => reject(request.error);
    });
};

export const saveTracksToCache = async (tracks: any[]) => {
  const db = await initDB();
  const tx = db.transaction(TRACKS_CACHE_STORE, 'readwrite');
  const store = tx.objectStore(TRACKS_CACHE_STORE);
  for (const track of tracks) {
    const { file, url, coverUrl, ...serializableTrack } = track;
    store.put(serializableTrack);
  }
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getCachedTracks = async (): Promise<any[]> => {
  const db = await initDB();
  const tx = db.transaction(TRACKS_CACHE_STORE, 'readonly');
  const request = tx.objectStore(TRACKS_CACHE_STORE).getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const results = request.result || [];
      const hydratedResults = results.map(track => {
        if (track.coverBlob) {
          try { return { ...track, coverUrl: URL.createObjectURL(track.coverBlob) }; } catch (e) { return track; }
        }
        return track;
      });
      resolve(hydratedResults);
    };
    request.onerror = () => reject(request.error);
  });
};

export const replaceTracksForFolderInCache = async (folderId: string, tracks: any[]) => {
  const db = await initDB();
  const tx = db.transaction(TRACKS_CACHE_STORE, 'readwrite');
  const store = tx.objectStore(TRACKS_CACHE_STORE);

  const index = store.index('folderId');
  const cursorRequest = index.openCursor(IDBKeyRange.only(folderId));

  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
      return;
    }

    for (const track of tracks) {
      const { file, url, coverUrl, ...serializableTrack } = track;
      store.put(serializableTrack);
    }
  };

  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const addToHistory = async (track: any) => {
  const db = await initDB();
  const tx = db.transaction(HISTORY_STORE, 'readwrite');
  const store = tx.objectStore(HISTORY_STORE);
  
  // 核心修复：不持久化 blob URL，因为它在重启后会失效
  const { coverUrl, ...serializableTrack } = track;
  const historyItem = {
    fingerprint: track.fingerprint,
    name: track.name,
    artist: track.artist,
    album: track.album,
    timestamp: Date.now()
  };

  // 如果 coverUrl 不是 blob，则可以保留（比如来自网络或本地服务器的持久 URL）
  if (coverUrl && !coverUrl.startsWith('blob:')) {
    (historyItem as any).coverUrl = coverUrl;
  }

  await store.put(historyItem);
};

export const getPlaybackHistory = async (): Promise<any[]> => {
  const db = await initDB();
  
  // 获取历史记录
  const tx = db.transaction([HISTORY_STORE, TRACKS_CACHE_STORE], 'readonly');
  const historyStore = tx.objectStore(HISTORY_STORE);
  const cacheStore = tx.objectStore(TRACKS_CACHE_STORE);
  
  const historyRequest = historyStore.getAll();
  
  return new Promise((resolve) => {
    historyRequest.onsuccess = async () => {
      const results = historyRequest.result || [];
      
      // 为没有有效 coverUrl 的历史记录尝试从缓存恢复封面
      const hydratedResults = await Promise.all(results.map(async (item) => {
        if (!item.coverUrl) {
          // 尝试从缓存中查找对应曲目以获取 coverBlob
          const cacheRequest = cacheStore.get(item.fingerprint);
          return new Promise((res) => {
            cacheRequest.onsuccess = () => {
              const cachedTrack = cacheRequest.result;
              if (cachedTrack && cachedTrack.coverBlob) {
                try {
                  res({
                    ...item,
                    coverUrl: URL.createObjectURL(cachedTrack.coverBlob)
                  });
                  return;
                } catch (e) {
                  console.error('Failed to create object URL for history item:', e);
                }
              }
              res(item);
            };
            cacheRequest.onerror = () => res(item);
          });
        }
        return item;
      }));

      resolve((hydratedResults as any[]).sort((a, b) => b.timestamp - a.timestamp));
    };
    historyRequest.onerror = () => resolve([]);
  });
};

export const clearPlaybackHistory = async () => {
  const db = await initDB();
  const tx = db.transaction(HISTORY_STORE, 'readwrite');
  tx.objectStore(HISTORY_STORE).clear();
};

const getFolderNameFromPath = (folderPath: string) => {
  const normalized = folderPath.replace(/[\\/]+$/, '');
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : folderPath;
};

export const saveLibraryFolder = async (
  id: string,
  handleOrPath: FileSystemDirectoryHandle | string,
  totalFilesCount?: number,
  lastSync?: number,
  customName?: string
) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => {
      const existing = request.result;
      const base: any = {
        id,
        name: customName || existing?.name || (typeof handleOrPath === 'string' ? getFolderNameFromPath(handleOrPath) : handleOrPath.name),
        addedAt: existing?.addedAt || Date.now(),
        lastSync: lastSync !== undefined ? lastSync : (existing?.lastSync || 0),
        totalFilesCount: totalFilesCount !== undefined ? totalFilesCount : existing?.totalFilesCount
      };
      if (typeof handleOrPath === 'string') {
        base.path = handleOrPath;
        base.handle = undefined;
      } else {
        base.handle = handleOrPath;
        base.path = undefined;
      }
      store.put(base);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getAllLibraryFolders = async (): Promise<{id: string, handle?: FileSystemDirectoryHandle, path?: string, name: string, totalFilesCount?: number, lastSync?: number, addedAt?: number}[]> => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const request = tx.objectStore(STORE_NAME).getAll();
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
};

export const removeLibraryFolder = async (id: string) => {
  const db = await initDB();
  const tx = db.transaction([STORE_NAME, TRACKS_CACHE_STORE], 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  const trackStore = tx.objectStore(TRACKS_CACHE_STORE);
  const index = trackStore.index('folderId');
  const request = index.openCursor(IDBKeyRange.only(id));
  return new Promise<void>((resolve, reject) => {
    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) { cursor.delete(); cursor.continue(); } else { resolve(); }
    };
    request.onerror = () => reject(request.error);
  });
};

export const saveWebdavFolder = async (folder: any) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(WEBDAV_FOLDERS_STORE, 'readwrite');
    const store = tx.objectStore(WEBDAV_FOLDERS_STORE);
    store.put(folder);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getWebdavFolder = async (id: string): Promise<any | undefined> => {
  const db = await initDB();
  const tx = db.transaction(WEBDAV_FOLDERS_STORE, 'readonly');
  const request = tx.objectStore(WEBDAV_FOLDERS_STORE).get(id);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getAllWebdavFolders = async (): Promise<any[]> => {
  const db = await initDB();
  const tx = db.transaction(WEBDAV_FOLDERS_STORE, 'readonly');
  const request = tx.objectStore(WEBDAV_FOLDERS_STORE).getAll();
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
};

export const removeWebdavFolder = async (id: string) => {
  const db = await initDB();
  const tx = db.transaction([WEBDAV_FOLDERS_STORE, TRACKS_CACHE_STORE], 'readwrite');
  tx.objectStore(WEBDAV_FOLDERS_STORE).delete(id);
  const trackStore = tx.objectStore(TRACKS_CACHE_STORE);
  const index = trackStore.index('folderId');
  const request = index.openCursor(IDBKeyRange.only(id));
  return new Promise<void>((resolve, reject) => {
    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const getStoredStory = async (artist: string, trackName: string): Promise<string | null> => {
  const db = await initDB();
  const key = `${artist}-${trackName}`;
  const tx = db.transaction(STORIES_STORE, 'readonly');
  const request = tx.objectStore(STORIES_STORE).get(key);
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result?.story || null);
    request.onerror = () => resolve(null);
  });
};

export const saveStoryToStore = async (artist: string, trackName: string, story: string) => {
  const db = await initDB();
  const key = `${artist}-${trackName}`;
  const tx = db.transaction(STORIES_STORE, 'readwrite');
  await tx.objectStore(STORIES_STORE).put({ key, artist, trackName, story, savedAt: Date.now() });
};

export const exportDatabase = async () => {
  const db = await initDB();
  const txFolders = db.transaction(STORE_NAME, 'readonly');
  const folders = await new Promise<any[]>(resolve => {
    txFolders.objectStore(STORE_NAME).getAll().onsuccess = (e: any) => {
      const raw = e.target.result || [];
      resolve(raw.map(({ handle, ...rest }: any) => rest));
    };
  });
  const txWebdav = db.transaction(WEBDAV_FOLDERS_STORE, 'readonly');
  const webdavFolders = await new Promise<any[]>(resolve => {
    txWebdav.objectStore(WEBDAV_FOLDERS_STORE).getAll().onsuccess = (e: any) => {
      const raw = e.target.result || [];
      resolve(raw.map(({ password, ...rest }: any) => rest));
    };
  });
  const txStories = db.transaction(STORIES_STORE, 'readonly');
  const stories = await new Promise<any[]>(resolve => {
    txStories.objectStore(STORIES_STORE).getAll().onsuccess = (e: any) => resolve(e.target.result);
  });
  const txTracks = db.transaction(TRACKS_CACHE_STORE, 'readonly');
  const tracks = await new Promise<any[]>(resolve => {
    txTracks.objectStore(TRACKS_CACHE_STORE).getAll().onsuccess = (e: any) => {
        const raw = e.target.result || [];
        resolve(raw.map(({ coverBlob, ...rest }: any) => rest));
    };
  });
  const data = { version: DB_VERSION, exportDate: Date.now(), folders, webdavFolders, stories, tracks, favorites: JSON.parse(localStorage.getItem('vinyl_favorites') || '[]') };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `VinylRhythm_Backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const importDatabase = async (jsonString: string) => {
  try {
    const data = JSON.parse(jsonString);
    const db = await initDB();
    if (data.folders && Array.isArray(data.folders)) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const item of data.folders) store.put(item);
      await new Promise(res => tx.oncomplete = res);
    }
    if (data.webdavFolders && Array.isArray(data.webdavFolders)) {
      const tx = db.transaction(WEBDAV_FOLDERS_STORE, 'readwrite');
      const store = tx.objectStore(WEBDAV_FOLDERS_STORE);
      for (const item of data.webdavFolders) store.put(item);
      await new Promise(res => tx.oncomplete = res);
    }
    if (data.stories && Array.isArray(data.stories)) {
      const tx = db.transaction(STORIES_STORE, 'readwrite');
      const store = tx.objectStore(STORIES_STORE);
      for (const item of data.stories) store.put(item);
      await new Promise(res => tx.oncomplete = res);
    }
    if (data.tracks && Array.isArray(data.tracks)) {
        const tx = db.transaction(TRACKS_CACHE_STORE, 'readwrite');
        const store = tx.objectStore(TRACKS_CACHE_STORE);
        for (const item of data.tracks) store.put(item);
        await new Promise(res => tx.oncomplete = res);
    }
    if (data.favorites) localStorage.setItem('vinyl_favorites', JSON.stringify(data.favorites));
    return true;
  } catch (e) { console.error("还原失败", e); return false; }
};
