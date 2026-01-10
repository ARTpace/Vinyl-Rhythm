
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
import { Track, ViewType } from './types';
import { getTrackStory } from './services/geminiService';
import { s2t } from './utils/chineseConverter';

import { useLibraryManager } from './hooks/useLibraryManager';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer';
import { useThemeColor } from './hooks/useThemeColor';
import { useAppSettings } from './hooks/useAppSettings';
import { usePlaylist } from './hooks/usePlaylist';

const App: React.FC = () => {
  const { settings, updateSettings, resetSettings } = useAppSettings();
  const [view, setView] = useState<ViewType>('player');
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [isImportWindowOpen, setIsImportWindowOpen] = useState(false);
  const [navigationRequest, setNavigationRequest] = useState<{ type: any, name: string } | null>(null);

  const processDisplayString = useCallback((str: string) => {
    if (!str) return '';
    return settings.useTraditionalChinese ? s2t(str) : str;
  }, [settings.useTraditionalChinese]);

  const library = useLibraryManager();
  const { 
    playlist, 
    setPlaylist, 
    addToPlaylist, 
    removeFromPlaylist, 
    clearPlaylist, 
    reorderPlaylist,
    hydratePlaylist
  } = usePlaylist();

  // 核心修复逻辑：当主曲库从数据库加载出含有有效 Blob URL 的曲目后，同步给播放列表
  useEffect(() => {
    if (library.tracks.length > 0) {
      hydratePlaylist(library.tracks);
    }
  }, [library.tracks, hydratePlaylist]);

  // 核心变更：播放器现在仅对播放列表(playlist)负责
  const player = useAudioPlayer(playlist, library.resolveTrackFile);
  
  // 调用音频分析器，获取用于黑胶唱片视觉跳动的实时强度数据
  const { audioIntensity } = useAudioAnalyzer(player.audioRef, player.isPlaying);

  const currentTrack = player.currentTrackIndex !== null ? playlist[player.currentTrackIndex] : null;
  const { rhythmColor } = useThemeColor(currentTrack?.coverUrl);

  const [trackStory, setTrackStory] = useState('');
  const [isStoryLoading, setIsStoryLoading] = useState(false);

  const qualityInfo = useMemo(() => {
    if (!currentTrack) return null;
    const br = currentTrack.bitrate ? currentTrack.bitrate / 1000 : 0;
    let label = 'SD';
    let color = 'text-zinc-500';
    if (br >= 2000) { label = 'Hi-Res'; color = 'text-yellow-400'; }
    else if (br >= 800) { label = 'Lossless'; color = 'text-sky-400'; }
    else if (br >= 320) { label = 'HQ'; color = 'text-emerald-400'; }
    return { label, bitrate: br ? `${Math.round(br)} kbps` : 'Variable', color };
  }, [currentTrack]);

  useEffect(() => {
    if (currentTrack) {
      if (!settings.enableAI) { setTrackStory(''); setIsStoryLoading(false); return; }
      setIsStoryLoading(true);
      setTrackStory(''); 
      const timer = setTimeout(() => {
        getTrackStory(currentTrack.name, currentTrack.artist).then(story => {
          setTrackStory(processDisplayString(story));
          setIsStoryLoading(false);
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentTrack, settings.enableAI, processDisplayString]);

  useEffect(() => {
    library.fetchHistory(); 
  }, []);

  const handleNavigate = useCallback((type: string, name: string) => {
    if (type === 'artistProfile') { setSelectedArtist(name); setView('artistProfile'); }
    else if (type === 'albums') { setNavigationRequest({ type: 'albums', name }); setView('all'); }
    library.setSearchQuery('');
  }, [library]);

  const handleSidebarViewChange = (v: ViewType) => {
    setView(v);
    setNavigationRequest(null);
    setSelectedArtist(null);
    library.setSearchQuery('');
  };

  // 处理从曲库中点击“播放”
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

  // 新增：播放整张专辑
  const handlePlayAlbum = useCallback((albumName: string) => {
    const albumTracks = library.tracks.filter(t => t.album === albumName);
    if (albumTracks.length > 0) {
      setPlaylist(albumTracks);
      player.setCurrentTrackIndex(0);
      player.setIsPlaying(true);
      setView('player');
    }
  }, [library.tracks, setPlaylist, player]);

  // 处理从播放队列中选择并播放
  const handleSelectTrackFromQueue = useCallback((index: number) => {
    player.setCurrentTrackIndex(index);
    player.setIsPlaying(true); // 显式触发播放
  }, [player]);

  return (
    <div className="flex h-screen overflow-hidden font-sans selection:bg-yellow-500/30">
      <ImportWindow 
        isOpen={isImportWindowOpen} 
        onClose={() => setIsImportWindowOpen(false)} 
        onImport={async () => {
           try { const handle = await window.showDirectoryPicker(); await library.registerFolder(handle); library.syncAll(); } catch (e) {}
        }} 
        onManualFilesSelect={async (files) => {
          const ok = await library.handleManualFilesSelect(files);
          if (ok) { setView('all'); setIsImportWindowOpen(false); }
        }}
        onRemoveFolder={library.removeFolder} 
        importedFolders={library.importedFolders} 
        isImporting={library.isImporting}
      />
      
      <div className="hidden md:flex flex-col h-full z-50">
          <Sidebar activeView={view} onViewChange={handleSidebarViewChange} trackCount={library.tracks.length} />
      </div>

      <main className="flex-1 flex flex-col relative pb-32 md:pb-28 bg-gradient-to-br from-[#1c1c1c] via-[#121212] to-[#0a0a0a]">
        {library.needsPermission && !library.isImporting && (
          <div className="absolute top-0 left-0 right-0 z-[100] bg-yellow-500 text-black px-4 py-2 flex items-center justify-center gap-3 animate-in slide-in-from-top duration-500">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m21 21-4.3-4.3M11 8l3 3-3 3M8 11h6"/></svg>
            <span className="text-[10px] font-black uppercase tracking-widest">浏览器已重置文件夹访问权限，请点击同步按钮以恢复播放。</span>
            <button onClick={() => library.syncAll()} className="bg-black text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter hover:scale-105 transition-transform">立即恢复</button>
          </div>
        )}

        {settings.showBlurBackground && currentTrack && view === 'player' && (
          <div className="absolute inset-0 pointer-events-none transition-all duration-1000 overflow-hidden">
             {currentTrack.coverUrl ? <img src={currentTrack.coverUrl} className="w-full h-full object-cover scale-150 blur-[120px] opacity-[0.15]" /> : <div className="w-full h-full bg-gradient-to-br from-yellow-500/5 to-transparent blur-[120px]" />}
          </div>
        )}

        <header className="p-4 md:p-6 flex justify-between items-center z-50 relative gap-3">
          <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
             <div className="relative group max-w-md w-full">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></div>
                <input type="text" placeholder={processDisplayString("搜索...")} value={library.searchQuery} onChange={(e) => { library.setSearchQuery(e.target.value); if(view === 'player' && e.target.value) setView('all'); }} className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 px-11 text-sm text-white focus:border-yellow-500/50 outline-none backdrop-blur-md transition-all" />
             </div>
          </div>
          <div className="flex items-center gap-3">
            {library.isImporting && library.currentProcessingFile && (
              <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-black/40 border border-white/5 rounded-2xl backdrop-blur-md animate-in fade-in">
                <div className="flex flex-col items-end min-w-0 max-w-[120px]">
                  <span className="text-white text-[10px] font-black italic">{library.importProgress}%</span>
                  <span className="text-zinc-500 text-[8px] font-bold uppercase tracking-tighter truncate w-full text-right">{library.currentProcessingFile}</span>
                </div>
                <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)] transition-all duration-300" style={{ width: `${library.importProgress}%` }} />
                </div>
              </div>
            )}
            <button onClick={() => library.syncAll()} disabled={library.isImporting} title="同步音乐库" className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-full transition-all group">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`${library.isImporting ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`}><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24L21 8"/><path d="M21 3v5h-5"/></svg>
            </button>
            <button onClick={() => setIsImportWindowOpen(true)} className="bg-yellow-500 text-black px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-widest active:scale-95 transition-all">{processDisplayString("管理库")}</button>
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden">
            <div key={view + (selectedArtist || '')} className="absolute inset-0 flex flex-col animate-in fade-in duration-700">
                {view === 'player' ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 md:p-8 overflow-hidden relative">
                    <div className="text-center relative z-40 px-6 w-full max-w-4xl flex flex-col items-center mb-4">
                      <div className="w-full px-4 pb-4 md:pb-6">
                        <h2 className="text-2xl md:text-3xl lg:text-5xl font-black tracking-tight w-full truncate select-none leading-snug pb-2 bg-gradient-to-b from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
                          {processDisplayString(currentTrack?.name || "黑胶时光")}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2 mb-2 w-full justify-center truncate px-10">
                        <button onClick={() => handleNavigate('artistProfile', currentTrack?.artist || '')} className="text-zinc-400 font-bold uppercase tracking-[0.15em] text-[11px] md:text-xs hover:text-yellow-500 transition-colors flex-shrink-0">
                          {processDisplayString(currentTrack?.artist || "享受纯净音质")}
                        </button>
                        {currentTrack?.album && (
                          <>
                            <span className="text-zinc-800 font-black mx-1 flex-shrink-0">•</span>
                            <button onClick={() => handleNavigate('albums', currentTrack.album)} className="text-zinc-500 font-bold uppercase tracking-[0.15em] text-[11px] md:text-xs hover:text-white transition-colors truncate max-w-[200px]">
                              {processDisplayString(currentTrack.album)}
                            </button>
                          </>
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

                    {settings.showQualityTag && qualityInfo && (
                      <div className="mt-8 flex items-center gap-3 animate-in fade-in zoom-in duration-1000">
                        <div className="flex items-center gap-2 px-4 py-1 rounded-full bg-white/5 border border-white/5 backdrop-blur-sm">
                           <span className={`w-1.5 h-1.5 rounded-full ${qualityInfo.color} ${player.isPlaying ? 'animate-pulse' : 'opacity-50'}`} style={{ boxShadow: player.isPlaying ? `0 0 8px currentColor` : 'none' }}></span>
                           <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${qualityInfo.color}`}>{qualityInfo.label}</span>
                           <span className="text-[10px] text-zinc-600 font-mono tracking-tighter">{qualityInfo.bitrate}</span>
                        </div>
                      </div>
                    )}

                    {settings.enableAI && (
                      <div className={`mt-6 max-w-2xl text-center px-4 italic text-zinc-500 text-sm md:text-base transition-opacity duration-1000 leading-relaxed ${isStoryLoading ? 'opacity-20' : 'opacity-100'}`}>
                        {trackStory || (currentTrack ? processDisplayString("正在为您解读...") : processDisplayString("开启一段黑胶之旅。"))}
                      </div>
                    )}
                  </div>
                ) : view === 'artistProfile' && selectedArtist ? (
                  <ArtistProfile artistName={selectedArtist} allTracks={library.tracks} onBack={() => { setView('collection'); setSelectedArtist(null); }} onPlayTrack={handlePlayFromLibrary} onAddToPlaylist={addToPlaylist} onPlayAlbum={handlePlayAlbum} onNavigateToAlbum={(album) => handleNavigate('albums', album)} favorites={library.favorites} onToggleFavorite={library.handleToggleFavorite} />
                ) : view === 'settings' ? (
                  <SettingsView settings={settings} onUpdate={updateSettings} onReset={resetSettings} onClearHistory={library.clearHistory} />
                ) : (view === 'collection' || view === 'albums' || view === 'artists') ? (
                  <CollectionView tracks={library.tracks} onNavigate={handleNavigate} onPlayAlbum={handlePlayAlbum} displayConverter={processDisplayString} initialTab={view === 'albums' ? 'albums' : 'artists'} />
                ) : (
                  <LibraryView 
                    view={view} 
                    tracks={library.filteredTracks} 
                    onPlay={handlePlayFromLibrary} 
                    onAddToPlaylist={addToPlaylist}
                    favorites={library.favorites} 
                    navigationRequest={navigationRequest} 
                    onNavigationProcessed={() => setNavigationRequest(null)} 
                    onNavigate={handleNavigate} 
                    isSearching={library.searchQuery.length > 0} 
                    onToggleFavorite={library.handleToggleFavorite} 
                    onUpdateTrack={library.handleUpdateTrack} 
                    displayConverter={processDisplayString} 
                  />
                )}
            </div>
        </div>
        
        <audio ref={player.audioRef} src={currentTrack?.url} preload="auto" />
        <PlayerControls
          currentTrack={currentTrack} 
          tracks={playlist} 
          historyTracks={library.historyTracks} 
          currentIndex={player.currentTrackIndex}
          isPlaying={player.isPlaying} 
          onTogglePlay={player.togglePlay} 
          onNext={player.nextTrack} 
          onPrev={player.prevTrack} 
          onSelectTrack={handleSelectTrackFromQueue} 
          onRemoveTrack={removeFromPlaylist}
          progress={player.progress} 
          duration={player.duration} 
          volume={player.volume} 
          onVolumeChange={player.setVolume} 
          onSeek={player.seek} 
          isFavorite={currentTrack ? library.favorites.has(currentTrack.id) : false} 
          favorites={library.favorites} 
          onNavigate={handleNavigate} 
          onToggleFavorite={(id) => library.handleToggleFavorite(id || currentTrack?.id || '')}
          playbackMode={player.playbackMode} 
          onTogglePlaybackMode={() => player.setPlaybackMode(p => p === 'normal' ? 'shuffle' : p === 'shuffle' ? 'loop' : 'normal')}
          onReorder={reorderPlaylist} 
          onClearHistory={library.clearHistory} 
          onClearQueue={clearPlaylist} 
          onPlayFromHistory={handlePlayFromLibrary} 
          themeColor="#eab308" 
          settings={settings} 
          displayConverter={processDisplayString}
        />
        <MobileNav activeView={view} onViewChange={handleSidebarViewChange} trackCount={library.tracks.length} themeColor="#eab308" />
      </main>
    </div>
  );
};

export default App;
