
const DB_NAME = 'VinylRhythmDB';
const DB_VERSION = 5; // 升级版本号以包含新的 tracksCache
const STORE_NAME = 'libraryHandles';
const STORIES_STORE = 'trackStories';
const HISTORY_STORE = 'playbackHistory';
const TRACKS_CACHE_STORE = 'tracksCache'; // 新增曲目缓存

const METADATA_FILENAME = '.vinyl_rhythm.json';

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
        db.createObjectStore(TRACKS_CACHE_STORE, { keyPath: 'fingerprint' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * 缓存所有曲目元数据
 */
export const saveTracksToCache = async (tracks: any[]) => {
  const db = await initDB();
  const tx = db.transaction(TRACKS_CACHE_STORE, 'readwrite');
  const store = tx.objectStore(TRACKS_CACHE_STORE);
  // 简单清理并保存
  for (const track of tracks) {
    const { file, url, ...serializableTrack } = track;
    store.put(serializableTrack);
  }
};

/**
 * 获取缓存的曲目元数据
 */
export const getCachedTracks = async (): Promise<any[]> => {
  const db = await initDB();
  const tx = db.transaction(TRACKS_CACHE_STORE, 'readonly');
  const request = tx.objectStore(TRACKS_CACHE_STORE).getAll();
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
};

/**
 * 记录播放历史
 */
export const addToHistory = async (track: any) => {
  const db = await initDB();
  const tx = db.transaction(HISTORY_STORE, 'readwrite');
  const store = tx.objectStore(HISTORY_STORE);
  
  const entry = {
    fingerprint: track.fingerprint,
    name: track.name,
    artist: track.artist,
    album: track.album,
    coverUrl: track.coverUrl,
    timestamp: Date.now()
  };
  
  await store.put(entry);

  const countRequest = store.count();
  countRequest.onsuccess = () => {
    if (countRequest.result > 100) {
      store.openCursor().onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) cursor.delete();
      };
    }
  };
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

export const readLocalFolderMetadata = async (dirHandle: FileSystemDirectoryHandle) => {
  try {
    const fileHandle = await dirHandle.getFileHandle(METADATA_FILENAME);
    const file = await fileHandle.getFile();
    const content = await file.text();
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
};

export const writeLocalFolderMetadata = async (dirHandle: FileSystemDirectoryHandle, metadata: any) => {
  try {
    const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      const request = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (request !== 'granted') return false;
    }
    const fileHandle = await dirHandle.getFileHandle(METADATA_FILENAME, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(metadata, null, 2));
    await writable.close();
    return true;
  } catch (e) {
    return false;
  }
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
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
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
  const txStories = db.transaction(STORIES_STORE, 'readonly');
  const stories = await new Promise<any[]>(resolve => {
    txStories.objectStore(STORIES_STORE).getAll().onsuccess = (e: any) => resolve(e.target.result);
  });
  const data = { version: DB_VERSION, exportDate: Date.now(), stories, favorites: JSON.parse(localStorage.getItem('vinyl_favorites') || '[]') };
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
    if (data.stories && Array.isArray(data.stories)) {
      const tx = db.transaction(STORIES_STORE, 'readwrite');
      const store = tx.objectStore(STORIES_STORE);
      for (const item of data.stories) store.put(item);
    }
    if (data.favorites) localStorage.setItem('vinyl_favorites', JSON.stringify(data.favorites));
    return true;
  } catch (e) { return false; }
};
