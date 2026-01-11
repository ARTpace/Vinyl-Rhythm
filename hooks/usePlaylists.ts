import { useState, useCallback, useEffect } from 'react';
import { Playlist, Track } from '../types';
import { savePlaylist, getAllPlaylists, removePlaylist } from '../utils/storage';
import { generateCompositeCover } from '../utils/uiHelpers';

export const usePlaylists = (allTracks: Track[]) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  const fetchAllPlaylists = useCallback(async () => {
    const data = await getAllPlaylists();
    setPlaylists(data);
  }, []);

  useEffect(() => {
    fetchAllPlaylists();
  }, [fetchAllPlaylists]);

  const createPlaylist = useCallback(async (name: string, tracksInQueue: Track[]) => {
    if (!name || tracksInQueue.length === 0) return;

    const relevantTracks = tracksInQueue
      .map(t => allTracks.find(libTrack => libTrack.fingerprint === t.fingerprint))
      .filter(Boolean) as Track[];
    
    const coverBlob = await generateCompositeCover(relevantTracks);
    const newPlaylist: Playlist = {
      id: `playlist_${Date.now()}`,
      name,
      songFingerprints: tracksInQueue.map(t => t.fingerprint),
      coverBlob,
      createdAt: Date.now(),
    };

    await savePlaylist(newPlaylist);
    await fetchAllPlaylists();
  }, [allTracks, fetchAllPlaylists]);

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

  return {
    playlists,
    createPlaylist,
    deletePlaylist,
    fetchAllPlaylists,
    getPlaylistTracks,
  };
};
