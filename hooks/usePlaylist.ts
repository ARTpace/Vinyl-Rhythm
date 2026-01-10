
import { useState, useEffect, useCallback } from 'react';
import { Track } from '../types';

const PLAYLIST_STORAGE_KEY = 'vinyl_current_playlist';

export const usePlaylist = () => {
  const [playlist, setPlaylist] = useState<Track[]>(() => {
    const saved = localStorage.getItem(PLAYLIST_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    // 仅保存必要的元数据，不保存 File 对象或 Blob URL（因为它们会过期）
    const serializable = playlist.map(({ file, url, ...rest }) => rest);
    localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(serializable));
  }, [playlist]);

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
    reorderPlaylist
  };
};
