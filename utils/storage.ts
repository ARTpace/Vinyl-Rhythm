
const DB_NAME = 'VinylRhythmDB';
const DB_VERSION = 6;
const STORE_NAME = 'libraryHandles';
const STORIES_STORE = 'trackStories';
const HISTORY_STORE = 'playbackHistory';
const TRACKS_CACHE_STORE = 'tracksCache';

const initDB = async (): Promise<IDBDatabase> => {
  if (navigator.storage && navigator.storage.persist) {
    await navigator.storage.persist();
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORIES_STORE)) {
        const store = db.createObjectStore(STORIES_STORE, { keyPath: 'key' });
        store.createIndex('artist', 'artist', { unique: false });
      }
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        db.createObjectStore(HISTORY_STORE, { keyPath: 'fingerprint' });
      }
      if (!db.objectStoreNames.contains(TRACKS_CACHE_STORE)) {
        const store = db.createObjectStore(TRACKS_CACHE_STORE, { keyPath: 'fingerprint' });
        store.createIndex('artist', 'artist', { unique: false });
        store.createIndex('album', 'album', { unique: false });
        store.createIndex('folderId', 'folderId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
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
          try {
            return {
              ...track,
              coverUrl: URL.createObjectURL(track.coverBlob)
            };
          } catch (e) {
            return track;
          }
        }
        return track;
      });
      resolve(hydratedResults);
    };
    request.onerror = () => reject(request.error);
  });
};

export const clearTracksCache = async () => {
  const db = await initDB();
  const tx = db.transaction(TRACKS_CACHE_STORE, 'readwrite');
  tx.objectStore(TRACKS_CACHE_STORE).clear();
};

export const addToHistory = async (track: any) => {
  const db = await initDB();
  const tx = db.transaction(HISTORY_STORE, 'readwrite');
  const store = tx.objectStore(HISTORY_STORE);
  await store.put({
    fingerprint: track.fingerprint,
    name: track.name,
    artist: track.artist,
    album: track.album,
    coverUrl: track.coverUrl,
    timestamp: Date.now()
  });
};

export const getPlaybackHistory = async (): Promise<any[]> => {
  const db = await initDB();
  const tx = db.transaction(HISTORY_STORE, 'readonly');
  const request = tx.objectStore(HISTORY_STORE).getAll();
  return new Promise((resolve) => {
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.sort((a, b) => b.timestamp - a.timestamp));
    };
    request.onerror = () => resolve([]);
  });
};

export const clearPlaybackHistory = async () => {
  const db = await initDB();
  const tx = db.transaction(HISTORY_STORE, 'readwrite');
  tx.objectStore(HISTORY_STORE).clear();
};

export const saveLibraryFolder = async (id: string, handle: FileSystemDirectoryHandle) => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.objectStore(STORE_NAME).put({ id, handle, name: handle.name, addedAt: Date.now() });
};

export const getAllLibraryFolders = async (): Promise<{id: string, handle: FileSystemDirectoryHandle, name: string}[]> => {
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
  
  // 1. 获取文件夹元数据 (Handle 不能序列化，但我们要保留名字和ID)
  const txFolders = db.transaction(STORE_NAME, 'readonly');
  const folders = await new Promise<any[]>(resolve => {
    txFolders.objectStore(STORE_NAME).getAll().onsuccess = (e: any) => {
      const raw = e.target.result || [];
      resolve(raw.map(({ handle, ...rest }: any) => rest));
    };
  });

  // 2. 获取 AI 解读
  const txStories = db.transaction(STORIES_STORE, 'readonly');
  const stories = await new Promise<any[]>(resolve => {
    txStories.objectStore(STORIES_STORE).getAll().onsuccess = (e: any) => resolve(e.target.result);
  });

  // 3. 获取曲库缓存
  const txTracks = db.transaction(TRACKS_CACHE_STORE, 'readonly');
  const tracks = await new Promise<any[]>(resolve => {
    txTracks.objectStore(TRACKS_CACHE_STORE).getAll().onsuccess = (e: any) => {
        const raw = e.target.result || [];
        resolve(raw.map(({ coverBlob, ...rest }: any) => rest));
    };
  });

  const data = { 
    version: DB_VERSION, 
    exportDate: Date.now(), 
    folders,
    stories, 
    tracks,
    favorites: JSON.parse(localStorage.getItem('vinyl_favorites') || '[]') 
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `VinylRhythm_FullBackup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const importDatabase = async (jsonString: string) => {
  try {
    const data = JSON.parse(jsonString);
    const db = await initDB();
    
    // 恢复文件夹元数据 (无 handle 模式)
    if (data.folders && Array.isArray(data.folders)) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const item of data.folders) {
        store.put(item);
      }
      await new Promise(res => tx.oncomplete = res);
    }

    // 恢复 AI Stories
    if (data.stories && Array.isArray(data.stories)) {
      const tx = db.transaction(STORIES_STORE, 'readwrite');
      const store = tx.objectStore(STORIES_STORE);
      for (const item of data.stories) store.put(item);
      await new Promise(res => tx.oncomplete = res);
    }

    // 恢复曲目元数据
    if (data.tracks && Array.isArray(data.tracks)) {
        const tx = db.transaction(TRACKS_CACHE_STORE, 'readwrite');
        const store = tx.objectStore(TRACKS_CACHE_STORE);
        // 使用批处理写入以提高性能并确保完整性
        for (const item of data.tracks) {
          store.put(item);
        }
        await new Promise(res => tx.oncomplete = res);
    }

    if (data.favorites) localStorage.setItem('vinyl_favorites', JSON.stringify(data.favorites));
    return true;
  } catch (e) { 
    console.error("还原失败", e);
    return false; 
  }
};
