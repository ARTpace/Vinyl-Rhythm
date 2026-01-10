
const DB_NAME = 'VinylRhythmDB';
const DB_VERSION = 7; // 升级版本
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
        store.createIndex('lastModified', 'lastModified', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * 分页获取曲目（不包含 Blob，仅元数据，极快）
 */
export const getTracksPaged = async (offset: number, limit: number): Promise<any[]> => {
  const db = await initDB();
  const tx = db.transaction(TRACKS_CACHE_STORE, 'readonly');
  const store = tx.objectStore(TRACKS_CACHE_STORE);
  const index = store.index('lastModified'); // 按时间排序
  const results: any[] = [];
  let skipped = 0;

  return new Promise((resolve) => {
    // 使用游标进行高性能分页
    index.openCursor(null, 'prev').onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (!cursor || results.length >= limit) {
        resolve(results);
        return;
      }
      if (skipped < offset) {
        skipped++;
        cursor.advance(offset - skipped + 1); // 快速跳过
        return;
      }
      results.push(cursor.value);
      cursor.continue();
    };
  });
};

/**
 * 获取特定曲目的封面 Blob（按需读取）
 */
export const getTrackCoverBlob = async (fingerprint: string): Promise<Blob | null> => {
  const db = await initDB();
  const tx = db.transaction(TRACKS_CACHE_STORE, 'readonly');
  const request = tx.objectStore(TRACKS_CACHE_STORE).get(fingerprint);
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result?.coverBlob || null);
    request.onerror = () => resolve(null);
  });
};

/**
 * 获取总曲目数
 */
export const getTracksCount = async (): Promise<number> => {
  const db = await initDB();
  const tx = db.transaction(TRACKS_CACHE_STORE, 'readonly');
  const request = tx.objectStore(TRACKS_CACHE_STORE).count();
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(0);
  });
};

/**
 * 搜索曲目（高性能游标检索）
 */
export const searchTracksInDB = async (query: string): Promise<any[]> => {
  const db = await initDB();
  const tx = db.transaction(TRACKS_CACHE_STORE, 'readonly');
  const store = tx.objectStore(TRACKS_CACHE_STORE);
  const results: any[] = [];
  const lowerQuery = query.toLowerCase();

  return new Promise((resolve) => {
    store.openCursor().onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (!cursor || results.length > 50) { // 限制返回结果
        resolve(results);
        return;
      }
      const t = cursor.value;
      if (
        t.name.toLowerCase().includes(lowerQuery) || 
        t.artist.toLowerCase().includes(lowerQuery) ||
        t.album.toLowerCase().includes(lowerQuery)
      ) {
        results.push(t);
      }
      cursor.continue();
    };
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
  return new Promise((resolve) => tx.oncomplete = resolve);
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

// Fix: Add clearPlaybackHistory function to match the call in useLibraryManager
export const clearPlaybackHistory = async () => {
  const db = await initDB();
  const tx = db.transaction(HISTORY_STORE, 'readwrite');
  tx.objectStore(HISTORY_STORE).clear();
  return new Promise((resolve) => (tx.oncomplete = resolve));
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
  request.onsuccess = (event: any) => {
    const cursor = event.target.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
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
  const data = { 
    version: DB_VERSION, 
    exportDate: Date.now(), 
    favorites: JSON.parse(localStorage.getItem('vinyl_favorites') || '[]') 
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `VinylRhythm_Backup.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const importDatabase = async (jsonString: string) => {
  try {
    const data = JSON.parse(jsonString);
    if (data.favorites) localStorage.setItem('vinyl_favorites', JSON.stringify(data.favorites));
    return true;
  } catch (e) { return false; }
};
