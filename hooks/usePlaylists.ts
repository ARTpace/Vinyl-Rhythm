import { useState, useCallback, useEffect } from 'react';
import { Playlist, Track } from '../types';
import { savePlaylist, getAllPlaylists, removePlaylist } from '../utils/storage';
import { generateCompositeCover } from '../utils/uiHelpers';

export const usePlaylists = (allTracks: Track[]) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  const fetchAllPlaylists = useCallback(async () => {
    try {
      const data = await getAllPlaylists();
      setPlaylists(data);
    } catch (e) {
      console.error("加载歌单列表失败:", e);
    }
  }, []);

  useEffect(() => {
    fetchAllPlaylists();
  }, [fetchAllPlaylists]);

  const createPlaylist = useCallback(async (name: string, tracksInQueue: Track[] = []) => {
    if (!name) {
      throw new Error("歌单名称不能为空。");
    }

    // 优先使用当前队列中的完整信息（包含已激活的 blob url）
    const coverBlob = await generateCompositeCover(tracksInQueue);
    
    const newPlaylist: Playlist = {
      id: `playlist_${Date.now()}`,
      name,
      songFingerprints: tracksInQueue.map(t => t.fingerprint),
      coverBlob,
      createdAt: Date.now(),
    };

    await savePlaylist(newPlaylist);
    await fetchAllPlaylists();
  }, [fetchAllPlaylists]);

  const deletePlaylist = useCallback(async (id: string) => {
    await removePlaylist(id);
    await fetchAllPlaylists();
  }, [fetchAllPlaylists]);

  const getPlaylistTracks = useCallback((playlist: Playlist | null): Track[] => {
    if (!playlist) return [];
    // 建立指纹映射以快速查找
    const trackMap = new Map(allTracks.map(t => [t.fingerprint, t]));
    return playlist.songFingerprints
      .map(fingerprint => trackMap.get(fingerprint))
      .filter(Boolean) as Track[];
  }, [allTracks]);

  return {
    playlists,
    createPlaylist,
    deletePlaylist,
    fetchAllPlaylists,
    getPlaylistTracks,
  };
};