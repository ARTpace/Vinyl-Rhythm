
import { useState, useEffect, useCallback } from 'react';
import { Track } from '../types';

const PLAYLIST_STORAGE_KEY = 'vinyl_current_playlist';

export const usePlaylist = () => {
  const [playlist, setPlaylist] = useState<Track[]>(() => {
    const saved = localStorage.getItem(PLAYLIST_STORAGE_KEY);
    // 初始加载时，这些 track 的 coverUrl 往往是失效的 blob 链接
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    // 序列化时排除 file, url 以及无法正确序列化的 Blob 对象
    // coverUrl 虽然是字符串但刷新即失效，也不建议长期依赖存储的版本
    const serializable = playlist.map(({ file, url, coverUrl, coverBlob, ...rest }) => rest);
    localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(serializable));
  }, [playlist]);

  /**
   * 核心修复：激活/同步播放列表元数据
   * 当主曲库从 IndexedDB 加载完毕后，调用此方法用最新的包含有效 Blob URL 的对象替换旧对象
   */
  const hydratePlaylist = useCallback((libraryTracks: Track[]) => {
    setPlaylist(currentPlaylist => {
      let changed = false;
      const nextPlaylist = currentPlaylist.map(pTrack => {
        const freshTrack = libraryTracks.find(t => t.fingerprint === pTrack.fingerprint);
        if (freshTrack) {
          changed = true;
          // 保留播放列表特有的 ID（如果有的话），但使用曲库中新鲜的封面和元数据
          return { ...freshTrack, id: pTrack.id };
        }
        return pTrack;
      });
      return changed ? nextPlaylist : currentPlaylist;
    });
  }, []);

  const addToPlaylist = useCallback((track: Track) => {
    setPlaylist(prev => {
      if (prev.find(t => t.fingerprint === track.fingerprint)) return prev;
      return [...prev, track];
    });
  }, []);

  const removeFromPlaylist = useCallback((trackId: string) => {
    setPlaylist(prev => prev.filter(t => t.id !== trackId));
  }, []);

  const clearPlaylist = useCallback(() => {
    setPlaylist([]);
  }, []);

  const reorderPlaylist = useCallback((draggedId: string, targetId: string | null) => {
    setPlaylist(prev => {
      const draggedIndex = prev.findIndex(t => t.id === draggedId);
      if (draggedIndex === -1) return prev;
      const newList = [...prev];
      const [draggedItem] = newList.splice(draggedIndex, 1);
      if (targetId === null) {
        newList.push(draggedItem);
      } else {
        const targetIndex = newList.findIndex(t => t.id === targetId);
        newList.splice(targetIndex, 0, draggedItem);
      }
      return newList;
    });
  }, []);

  return {
    playlist,
    setPlaylist,
    addToPlaylist,
    removeFromPlaylist,
    clearPlaylist,
    reorderPlaylist,
    hydratePlaylist
  };
};
