
import { useState, useEffect, useCallback } from 'react';
import { Track } from '../types';

const PLAYLIST_STORAGE_KEY = 'vinyl_current_playlist';

export const usePlaylist = () => {
  const [playlist, setPlaylist] = useState<Track[]>(() => {
    const saved = localStorage.getItem(PLAYLIST_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    // 序列化时排除 file, url 以及无法正确序列化的 Blob 对象
    const serializable = playlist.map(({ file, url, coverUrl, coverBlob, ...rest }) => rest);
    localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(serializable));
  }, [playlist]);

  const hydratePlaylist = useCallback((libraryTracks: Track[]) => {
    setPlaylist(currentPlaylist => {
      if (currentPlaylist.length === 0) return currentPlaylist;
      
      let changed = false;
      const nextPlaylist = currentPlaylist.map(pTrack => {
        const freshTrack = libraryTracks.find(t => t.fingerprint === pTrack.fingerprint);
        if (freshTrack) {
          changed = true;
          return { ...freshTrack, id: pTrack.id };
        }
        return pTrack;
      });
      return changed ? nextPlaylist : currentPlaylist;
    });
  }, []);

  const addToPlaylist = useCallback((track: Track) => {
    if (!track) return;
    setPlaylist(prev => {
      // 如果已经存在（基于指纹），则不重复添加
      if (prev.some(t => t.fingerprint === track.fingerprint)) {
        return prev;
      }
      return [...prev, { ...track }];
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
        if (targetIndex !== -1) newList.splice(targetIndex, 0, draggedItem);
        else newList.push(draggedItem);
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
