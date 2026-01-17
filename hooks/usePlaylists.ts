
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Playlist, Track } from '../types';
import { savePlaylist, getAllPlaylists, removePlaylist, getPlaylist, updatePlaylist } from '../utils/storage';
import { generateCompositeCover } from '../utils/uiHelpers';
import { normalizeChinese } from '../utils/chineseConverter';

export const usePlaylists = (allTracks: Track[]) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

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

  const createPlaylist = useCallback(async (name: string, tracksInQueue: Track[] = []): Promise<Playlist> => {
    if (!name) {
      throw new Error("歌单名称不能为空。");
    }

    let coverBlob: Blob | undefined;
    try {
        coverBlob = await generateCompositeCover(tracksInQueue);
    } catch (err) {
        console.warn("无法生成歌单封面，使用默认占位符", err);
    }
    
    const newPlaylist: Playlist = {
      id: `playlist_${Date.now()}`,
      name,
      songFingerprints: tracksInQueue.map(t => t.fingerprint),
      coverBlob,
      createdAt: Date.now(),
    };

    await savePlaylist(newPlaylist);
    await fetchAllPlaylists();
    return newPlaylist;
  }, [fetchAllPlaylists]);

  const addTracksToPlaylist = useCallback(async (playlistId: string, tracks: Track[]) => {
    if (!tracks || tracks.length === 0) return;
    const playlist = await getPlaylist(playlistId);
    if (!playlist) {
        throw new Error("歌单未找到");
    }

    let changed = false;
    tracks.forEach(track => {
      if (!playlist.songFingerprints.includes(track.fingerprint)) {
        playlist.songFingerprints.push(track.fingerprint);
        changed = true;
      }
    });

    if (changed) {
        const trackMap = new Map(allTracks.map(t => [t.fingerprint, t]));
        const tracksInPlaylist = playlist.songFingerprints.map(fp => trackMap.get(fp)).filter(Boolean) as Track[];
        try {
            playlist.coverBlob = await generateCompositeCover(tracksInPlaylist);
        } catch (err) {
            console.warn("更新歌单封面失败");
        }

        await updatePlaylist(playlist);
        await fetchAllPlaylists();
    }
  }, [allTracks, fetchAllPlaylists]);

  const addTrackToPlaylist = useCallback(async (playlistId: string, track: Track) => {
    return addTracksToPlaylist(playlistId, [track]);
  }, [addTracksToPlaylist]);

  const deletePlaylist = useCallback(async (id: string) => {
    await removePlaylist(id);
    await fetchAllPlaylists();
  }, [fetchAllPlaylists]);

  const getPlaylistTracks = useCallback((playlist: Playlist | null): Track[] => {
    if (!playlist) return [];
    const trackMap = new Map(allTracks.map(t => [t.fingerprint, t]));
    return playlist.songFingerprints
      .map(fingerprint => trackMap.get(fingerprint))
      .filter(Boolean) as Track[];
  }, [allTracks]);

  const filteredPlaylists = useMemo(() => {
    if (!searchQuery.trim()) return playlists;
    const q = normalizeChinese(searchQuery);
    return playlists.filter(p => normalizeChinese(p.name).includes(q));
  }, [playlists, searchQuery]);

  return {
    playlists,
    searchQuery,
    setSearchQuery,
    filteredPlaylists,
    createPlaylist,
    addTrackToPlaylist,
    addTracksToPlaylist,
    deletePlaylist,
    fetchAllPlaylists,
    getPlaylistTracks,
  };
};
