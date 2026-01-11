
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import ImportWindow from './components/ImportWindow';
import LibraryView from './components/LibraryView';
import CollectionView from './components/CollectionView';
import ArtistProfile from './components/ArtistProfile';
import SettingsView from './components/SettingsView';
import PlayerControls from './components/PlayerControls';
import VinylRecord, { ToneArm } from './components/VinylRecord';
import SwipeableTrack from './components/SwipeableTrack';
import PlaylistsView from './components/PlaylistsView';
import PlaylistDetailView from './components/PlaylistDetailView';
import CreatePlaylistModal from './components/CreatePlaylistModal';
import AddToPlaylistModal from './components/AddToPlaylistModal';
import ImportPlaylistModal from './components/ImportPlaylistModal';
import AddTracksByTextModal from './components/AddTracksByTextModal';
import ConfirmModal from './components/ConfirmModal'; // 引入确认弹窗
import { Track, ViewType, Playlist } from './types';
import { getTrackStory } from './services/geminiService';
import { s2t } from './utils/chineseConverter';

import { useLibraryManager } from './hooks/useLibraryManager';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer';
import { useThemeColor } from './hooks/useThemeColor';
import { useAppSettings } from './hooks/useAppSettings';
import { usePlaylist } from './hooks/usePlaylist';
import { usePlaylists } from './hooks/usePlaylists';

const App: React.FC = () => {
  // 定义搜索框占位符文字
  const searchPlaceholder = "搜索曲目、艺人、专辑...";
  const { settings, updateSettings, resetSettings } = useAppSettings();
  const [view, setView] = useState<ViewType>('player');
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [isImportWindowOpen, setIsImportWindowOpen] = useState(false);
  
  // 弹窗状态管理
  const [playlistModalConfig, setPlaylistModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    defaultValue: string;
    confirmText: string;
    onConfirm: (name: string) => Promise<void>;
  } | null>(null);
  
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    onConfirm: () => void;
  } | null>(null);

  const [isAddToPlaylistModalOpen, setIsAddToPlaylistModalOpen] = useState(false);
  const [isImportPlaylistModalOpen, setIsImportPlaylistModalOpen] = useState(false);
  const [isAddByTextModalOpen, setIsAddByTextModalOpen] = useState(false);
  const [trackToAddToPlaylist, setTrackToAddToPlaylist] = useState<Track | null>(null);
  const [navigationRequest, setNavigationRequest] = useState<{ type: any, name: string, from?: string } | null>(null);

  const processDisplayString = useCallback((str: string) => {
    if (!str) return '';
    return settings.useTraditionalChinese ? s2t(str) : str;
  }, [settings.useTraditionalChinese]);

  const library = useLibraryManager();
  const { playlists, createPlaylist, addTrackToPlaylist, addTracksToPlaylist, deletePlaylist, getPlaylistTracks } = usePlaylists(library.tracks);
  
  const { 
    playlist, 
    setPlaylist, 
    addToPlaylist, 
    removeFromPlaylist, 
    clearPlaylist, 
    reorderPlaylist,
    hydratePlaylist
  } = usePlaylist();

  useEffect(() => {
    if (library.tracks.length > 0) {
      hydratePlaylist(library.tracks);
    }
  }, [library.tracks, hydratePlaylist]);

  const player = useAudioPlayer(playlist, library.resolveTrackFile, library.recordTrackPlayback);
  
  const { audioIntensity } = useAudioAnalyzer(player.audioRef, player.isPlaying);
  const currentTrack = player.currentTrackIndex !== null ? playlist[player.currentTrackIndex] : null;
  const { rhythmColor } = useThemeColor(currentTrack?.coverUrl);

  const [trackStory, setTrackStory] = useState('');
  const [isStoryLoading, setIsStoryLoading] = useState(false);

  // 处理导航逻辑，增加来源追踪
  const handleNavigate = useCallback((type: string, name: string) => {
    if (type === 'artistProfile') { 
      setSelectedArtist(name); 
      setView('artistProfile'); 
    }
    else if (type === 'albums') { 
      // 如果当前在歌手页，记录来源以便回退
      const from = (view === 'artistProfile') ? 'artistProfile' : undefined;
      setNavigationRequest({ type: 'albums', name, from }); 
      setView('all'); 
    }
    library.setSearchQuery('');
  }, [library, view]);

  // 处理专辑详情页的回退逻辑
  const handleAlbumBack = useCallback(() => {
    if (navigationRequest?.from === 'artistProfile' && selectedArtist) {
      setView('artistProfile');
      setNavigationRequest(null);
    } else {
      setNavigationRequest(null);
    }
  }, [navigationRequest, selectedArtist]);

  const handleSidebarViewChange = (v: ViewType) => {
    setView(v);
    setNavigationRequest(null);
    setSelectedArtist(null);
    setSelectedPlaylist(null);
    library.setSearchQuery('');
  };

  const handlePlayFromLibrary = useCallback((track: Track) => {
    const idx = playlist.findIndex(t => t.fingerprint === track.fingerprint);
    if (idx !== -1) {
      player.setCurrentTrackIndex(idx);
    } else {
      const newPlaylist = [...playlist, track];
      setPlaylist(newPlaylist);
      player.setCurrentTrackIndex(newPlaylist.length - 1);
    }
    setView('player');
    player.setIsPlaying(true);
  }, [playlist, player, setPlaylist]);

  const handlePlayAlbum = useCallback((albumName: string) => {
    const albumTracks = library.tracks.filter(t => t.album === albumName);
    if (albumTracks.length > 0) {
      setPlaylist(albumTracks);
      player.setCurrentTrackIndex(0);
      player.setIsPlaying(true);
      setView('player');
    }
  }, [library.tracks, setPlaylist, player]);

  const handlePlayArtist = useCallback((artistName: string) => {
    const artistTracks = library.tracks.filter(t => (t.artist || '').split(' / ').includes(artistName));
    if (artistTracks.length > 0) {
      setPlaylist(artistTracks);
      player.setCurrentTrackIndex(0);
      player.setIsPlaying(true);
      setView('player');
    }
  }, [library.tracks, setPlaylist, player]);

  const handleSelectTrackFromQueue = useCallback((index: number) => {
    player.setCurrentTrackIndex(index);
    player.setIsPlaying(true); 
  }, [player]);

  // 修改：保存队列为歌单，使用自定义 Modal
  const handleSaveQueueAsPlaylist = useCallback(() => {
    if (playlist.length === 0) return;
    setPlaylistModalConfig({
      isOpen: true,
      title: "保存当前队列为歌单",
      defaultValue: `播放队列_${new Date().toLocaleDateString()}`,
      confirmText: "确认保存",
      onConfirm: async (name: string) => {
        try {
          await createPlaylist(name, playlist);
          setPlaylistModalConfig(null);
        } catch (error: any) {
          alert(`保存失败: ${error.message}`);
        }
      },
    });
  }, [playlist, createPlaylist]);

  // 修改：清空队列确认
  const handleRequestClearQueue = useCallback(() => {
    if (playlist.length === 0) return;
    setConfirmModalConfig({
      isOpen: true,
      title: "确认清空队列",
      message: "此操作将移除当前播放列表中的所有歌曲，是否继续？",
      onConfirm: () => {
        if (player.isPlaying) player.togglePlay();
        setTimeout(clearPlaylist, 200);
        setConfirmModalConfig(null);
      }
    });
  }, [playlist, clearPlaylist, player]);

  // 修改：清空历史确认
  const handleRequestClearHistory = useCallback(() => {
    setConfirmModalConfig({
      isOpen: true,
      title: "确认清空历史",
      message: "确定要彻底删除您的播放历史记录吗？",
      onConfirm: () => {
        library.clearHistory();
        setConfirmModalConfig(null);
      }
    });
  }, [library]);

  const handleCreateNewPlaylist = useCallback(() => {
    setPlaylistModalConfig({
      isOpen: true,
      title: "创建新歌单",
      defaultValue: "我的新歌单",
      confirmText: "确认创建",
      onConfirm: async (name: string) => {
        try {
          await createPlaylist(name, []);
          setPlaylistModalConfig(null);
        } catch (error: any) {
          alert(`创建失败: ${error.message}`);
        }
      },
    });
  }, [createPlaylist]);

  const handleImportPlaylistFromText = useCallback(async (name: string, tracks: Track[]) => {
    if (!name || tracks.length === 0) return;
    try {
      await createPlaylist(name, tracks);
      setIsImportPlaylistModalOpen(false);
    } catch (error: any) {
      alert(`导入失败: ${error.message}`);
    }
  }, [createPlaylist]);

  const handleAddTracksByText = useCallback(async (tracks: Track[]) => {
    if (!selectedPlaylist || tracks.length === 0) return;
    try {
      await addTracksToPlaylist(selectedPlaylist.id, tracks);
      const updated = playlists.find(p => p.id === selectedPlaylist.id);
      if (updated) setSelectedPlaylist(updated);
      setIsAddByTextModalOpen(false);
    } catch (error: any) {
      alert(`追加失败: ${error.message}`);
    }
  }, [selectedPlaylist, addTracksToPlaylist, playlists]);

  const handleDeletePlaylist = (id: string) => {
    setConfirmModalConfig({
      isOpen: true,
      title: "确认删除歌单",
      message: "删除后将无法恢复，确定要删除此歌单吗？",
      onConfirm: () => {
        deletePlaylist(id);
        setSelectedPlaylist(null);
        setConfirmModalConfig(null);
      }
    });
  };

  const handlePlayPlaylist = (p: Playlist) => {
    const playlistTracks = getPlaylistTracks(p);
    if (playlistTracks.length > 0) {
      setPlaylist(playlistTracks);
      player.setCurrentTrackIndex(0);
      player.setIsPlaying(true);
      setView('player');
    }
  };

  const openAddToPlaylistModal = useCallback((track: Track) => {
    setTrackToAddToPlaylist(track);
    setIsAddToPlaylistModalOpen(true);
  }, []);

  const handleAddToExistingPlaylist = useCallback(async (playlistId: string) => {
    if (!trackToAddToPlaylist) return;
    try {
      await addTrackToPlaylist(playlistId, trackToAddToPlaylist);
    } finally {
      setIsAddToPlaylistModalOpen(false);
      setTrackToAddToPlaylist(null);
    }
  }, [trackToAddToPlaylist, addTrackToPlaylist]);

  const handleCreateAndAddToPlaylist = useCallback(async (playlistName: string) => {
    if (!trackToAddToPlaylist) return;
    try {
      await createPlaylist(playlistName, [trackToAddToPlaylist]);
    } finally {
      setIsAddToPlaylistModalOpen(false);
      setTrackToAddToPlaylist(null);
    }
  }, [trackToAddToPlaylist, createPlaylist]);

  return (
    <div className="flex h-screen overflow-hidden font-sans selection:bg-yellow-500/30">
      <ImportWindow isOpen={isImportWindowOpen} onClose={() => setIsImportWindowOpen(false)} onFolderSelected={async (handle) => { const newFolderId = await library.registerFolder(handle); library.syncFolder(newFolderId); }} onReconnectFolder={library.reconnectFolder} onManualFilesSelect={async (files) => { const ok = await library.handleManualFilesSelect(files); if (ok) { setView('all'); setIsImportWindowOpen(false); } }} onSyncFolder={library.syncFolder} onRemoveFolder={library.removeFolder} importedFolders={library.importedFolders} isImporting={library.isImporting} syncingFolderId={library.syncingFolderId} />
      
      <CreatePlaylistModal 
        isOpen={playlistModalConfig?.isOpen || false} 
        onCancel={() => setPlaylistModalConfig(null)} 
        onConfirm={async (name) => { if (playlistModalConfig) await playlistModalConfig.onConfirm(name); }} 
        title={playlistModalConfig?.title} 
        defaultValue={playlistModalConfig?.defaultValue} 
        confirmText={playlistModalConfig?.confirmText} 
      />

      <ConfirmModal
        isOpen={confirmModalConfig?.isOpen || false}
        title={confirmModalConfig?.title || ""}
        message={confirmModalConfig?.message || ""}
        onConfirm={confirmModalConfig?.onConfirm || (() => {})}
        onCancel={() => setConfirmModalConfig(null)}
      />

      <AddToPlaylistModal isOpen={isAddToPlaylistModalOpen} playlists={playlists} onClose={() => setIsAddToPlaylistModalOpen(false)} onSelectPlaylist={handleAddToExistingPlaylist} onCreateAndAdd={handleCreateAndAddToPlaylist} />
      <ImportPlaylistModal isOpen={isImportPlaylistModalOpen} allTracks={library.tracks} onClose={() => setIsImportPlaylistModalOpen(false)} onImport={handleImportPlaylistFromText} />
      
      {selectedPlaylist && (
        <AddTracksByTextModal isOpen={isAddByTextModalOpen} playlist={selectedPlaylist} allTracks={library.tracks} onClose={() => setIsAddByTextModalOpen(false)} onAdd={handleAddTracksByText} />
      )}

      <div className="hidden md:flex flex-col h-full z-50">
          <Sidebar activeView={view} onViewChange={handleSidebarViewChange} trackCount={library.tracks.length} />
      </div>

      <main className="flex-1 flex flex-col relative pb-32 md:pb-28 bg-gradient-to-br from-[#1c1c1c] via-[#121212] to-[#0a0a0a]">
        <header className="p-4 md:p-6 flex justify-between items-center z-50 relative gap-3">
          <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
             <div className="relative group max-w-md w-full">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></div>
                <input type="text" placeholder={processDisplayString(searchPlaceholder)} value={library.searchQuery} onChange={(e) => { library.setSearchQuery(e.target.value); if(view === 'player' && e.target.value) setView('all'); }} className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 px-11 text-sm text-white focus:border-yellow-500/50 outline-none backdrop-blur-md transition-all" />
             </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => library.syncAll()} disabled={library.isImporting} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-full transition-all group">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`${library.isImporting ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`}><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24L21 8"/><path d="M21 3v5h-5"/></svg>
            </button>
            <button onClick={() => setIsImportWindowOpen(true)} className="bg-yellow-500 text-black px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-widest active:scale-95 transition-all">{processDisplayString("管理库")}</button>
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden">
            <div key={view + (selectedArtist || '') + (selectedPlaylist?.id || '')} className="absolute inset-0 flex flex-col animate-in fade-in duration-700">
                {view === 'player' ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 md:p-8 overflow-hidden relative">
                    <div className="text-center relative z-40 px-6 w-full max-w-4xl flex flex-col items-center mb-4">
                      <div className="w-full px-4 pb-4 md:pb-6">
                        <h2 className="text-2xl md:text-3xl lg:text-5xl font-black tracking-tight w-full truncate select-none leading-snug pb-2 bg-gradient-to-b from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
                          {processDisplayString(currentTrack?.name || "黑胶时光")}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2 mb-2 w-full justify-center flex-wrap px-10">
                        {currentTrack?.artist ? (
                          currentTrack.artist.split(' / ').map((artist, index, arr) => (
                            <React.Fragment key={index}>
                              <button onClick={() => handleNavigate('artistProfile', artist.trim())} className="text-zinc-400 font-bold uppercase tracking-[0.15em] text-[11px] md:text-xs hover:text-yellow-500 transition-colors">
                                {processDisplayString(artist.trim())}
                              </button>
                              {index < arr.length - 1 && <span className="text-zinc-700 font-black mx-1">/</span>}
                            </React.Fragment>
                          ))
                        ) : (
                          <span className="text-zinc-400 font-bold uppercase tracking-[0.15em] text-[11px] md:text-xs">
                            {processDisplayString("享受纯净音质")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="relative mt-4">
                      <SwipeableTrack onNext={player.nextTrack} onPrev={player.prevTrack} currentId={currentTrack?.id || 'empty'}>
                        <VinylRecord isPlaying={player.isPlaying} coverUrl={currentTrack?.coverUrl} intensity={audioIntensity} themeColor={rhythmColor} spinSpeed={settings.spinSpeed} showParticles={settings.showParticles} />
                      </SwipeableTrack>
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-30">
                          <div className="relative w-[60vw] h-[60vw] max-w-[16rem] max-h-[16rem] sm:w-[70vw] sm:h-[70vw] md:w-96 md:h-96 flex-shrink-0">
                              <ToneArm trackId={currentTrack?.id} isPlaying={player.isPlaying} progress={player.duration > 0 ? player.progress / player.duration : 0} onClick={player.togglePlay} />
                          </div>
                      </div>
                    </div>
                  </div>
                ) : view === 'playlists' ? (
                  selectedPlaylist ? (
                    <PlaylistDetailView 
                        playlist={selectedPlaylist}
                        allTracks={library.tracks}
                        onBack={() => setSelectedPlaylist(null)}
                        onPlayTrack={handlePlayFromLibrary}
                        onPlayPlaylist={handlePlayPlaylist}
                        onDeletePlaylist={handleDeletePlaylist}
                        onOpenAddByText={() => setIsAddByTextModalOpen(true)}
                        favorites={library.favorites}
                        onToggleFavorite={library.handleToggleFavorite}
                        displayConverter={processDisplayString}
                    />
                  ) : (
                    <PlaylistsView playlists={playlists} onSelectPlaylist={setSelectedPlaylist} onPlayPlaylist={handlePlayPlaylist} onCreatePlaylist={handleCreateNewPlaylist} onImportPlaylist={() => setIsImportPlaylistModalOpen(true)} displayConverter={processDisplayString} />
                  )
                ) : view === 'artistProfile' && selectedArtist ? (
                  <ArtistProfile artistName={selectedArtist} allTracks={library.tracks} onBack={() => { setView('collection'); setSelectedArtist(null); }} onPlayTrack={handlePlayFromLibrary} onAddToQueue={addToPlaylist} onAddToPlaylist={openAddToPlaylistModal} onPlayAlbum={handlePlayAlbum} onPlayArtist={handlePlayArtist} onNavigateToAlbum={(album) => handleNavigate('albums', album)} favorites={library.favorites} onToggleFavorite={library.handleToggleFavorite} artistMetadata={library.artistMetadata} />
                ) : view === 'settings' ? (
                  <SettingsView settings={settings} onUpdate={updateSettings} onReset={resetSettings} onClearHistory={handleRequestClearHistory} />
                ) : (view === 'collection' || view === 'albums' || view === 'artists') ? (
                  <CollectionView tracks={library.tracks} onNavigate={handleNavigate} onPlayAlbum={handlePlayAlbum} displayConverter={processDisplayString} searchQuery={library.searchQuery} initialTab={view === 'albums' ? 'albums' : 'artists'} onTabChange={(newTab) => setView(newTab)} artistMetadata={library.artistMetadata} />
                ) : (
                  <LibraryView view={view} tracks={library.filteredTracks} folders={library.importedFolders} onPlay={handlePlayFromLibrary} onAddToQueue={addToPlaylist} onAddToPlaylist={openAddToPlaylistModal} favorites={library.favorites} navigationRequest={navigationRequest} onNavigationProcessed={() => setNavigationRequest(null)} onNavigate={handleNavigate} onBack={handleAlbumBack} isSearching={library.searchQuery.length > 0} onToggleFavorite={library.handleToggleFavorite} onUpdateTrack={library.handleUpdateTrack} displayConverter={processDisplayString} />
                )}
            </div>
        </div>
        
        <audio ref={player.audioRef} preload="auto" />
        
        <PlayerControls currentTrack={currentTrack} tracks={playlist} historyTracks={library.historyTracks} currentIndex={player.currentTrackIndex} isPlaying={player.isPlaying} onTogglePlay={player.togglePlay} onNext={player.nextTrack} onPrev={player.prevTrack} onSelectTrack={handleSelectTrackFromQueue} onRemoveTrack={removeFromPlaylist} progress={player.progress} duration={player.duration} volume={player.volume} onVolumeChange={player.setVolume} onSeek={player.seek} isFavorite={currentTrack ? library.favorites.has(currentTrack.id) : false} favorites={library.favorites} onNavigate={handleNavigate} onToggleFavorite={(id) => library.handleToggleFavorite(id || currentTrack?.id || '')} onAddToPlaylist={openAddToPlaylistModal} playbackMode={player.playbackMode} onTogglePlaybackMode={() => player.setPlaybackMode(p => p === 'normal' ? 'shuffle' : p === 'shuffle' ? 'loop' : 'normal')} onReorder={reorderPlaylist} onClearHistory={handleRequestClearHistory} onClearQueue={handleRequestClearQueue} onPlayFromHistory={handlePlayFromLibrary} onSaveQueueAsPlaylist={handleSaveQueueAsPlaylist} themeColor="#eab308" settings={settings} displayConverter={processDisplayString} />
        <MobileNav activeView={view} onViewChange={handleSidebarViewChange} trackCount={library.tracks.length} themeColor="#eab308" />
      </main>
    </div>
  );
};

export default App;
