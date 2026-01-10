
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
import { saveLibraryFolder } from './utils/storage';
import { s2t } from './utils/chineseConverter';

// 导入模块化 Hooks
import { useLibraryManager } from './hooks/useLibraryManager';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer';
import { useThemeColor } from './hooks/useThemeColor';
import { useAppSettings } from './hooks/useAppSettings';

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
  const player = useAudioPlayer(library.tracks);
  const { audioIntensity } = useAudioAnalyzer(player.audioRef, player.isPlaying);
  
  const currentTrack = player.currentTrackIndex !== null ? library.tracks[player.currentTrackIndex] : null;
  const { rhythmColor } = useThemeColor(currentTrack?.coverUrl);

  const [trackStory, setTrackStory] = useState('');
  const [isStoryLoading, setIsStoryLoading] = useState(false);

  // 音质等级计算
  const qualityInfo = useMemo(() => {
    if (!currentTrack) return null;
    const br = currentTrack.bitrate ? currentTrack.bitrate / 1000 : 0;
    const ext = currentTrack.file.name.toLowerCase();
    
    let label = 'SD';
    let colorClass = 'text-zinc-500';
    let glowClass = 'shadow-zinc-500/20';
    let borderClass = 'border-zinc-800';

    if (ext.endsWith('.flac') || ext.endsWith('.wav') || br > 1000) {
      label = br > 2000 ? 'HI-RES' : 'LOSSLESS';
      colorClass = 'text-yellow-500';
      glowClass = 'shadow-yellow-500/40';
      borderClass = 'border-yellow-500/40';
    } else if (br >= 320) {
      label = 'HQ';
      colorClass = 'text-emerald-500';
      glowClass = 'shadow-emerald-500/30';
      borderClass = 'border-emerald-500/30';
    }

    return { label, bitrate: br ? `${Math.round(br)}` : null, colorClass, borderClass, glowClass };
  }, [currentTrack]);

  useEffect(() => {
    if (currentTrack) {
      if (!settings.enableAI) {
        setTrackStory('');
        setIsStoryLoading(false);
        return;
      }
      setIsStoryLoading(true);
      setTrackStory(''); 
      const timer = setTimeout(() => {
        getTrackStory(currentTrack.name, currentTrack.artist).then(story => {
          setTrackStory(processDisplayString(story));
          setIsStoryLoading(false);
          if (currentTrack.folderId) {
            library.persistFolderMetadataToDisk(currentTrack.folderId);
          }
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentTrack, settings.enableAI, processDisplayString]);

  useEffect(() => {
    if (player.isPlaying) {
      library.fetchHistory();
    }
  }, [player.isPlaying, player.currentTrackIndex]);

  useEffect(() => {
    library.syncAll(true).then(hasData => {
      if (hasData && player.currentTrackIndex === null && library.tracks.length > 0) {
        player.setCurrentTrackIndex(0);
      }
    });
    library.fetchHistory(); 
  }, []);

  const handleNavigate = useCallback((type: string, name: string) => {
    if (type === 'artistProfile') {
      setSelectedArtist(name);
      setView('artistProfile');
    } else if (type === 'albums') {
      setNavigationRequest({ type: 'albums', name });
      setView('all');
    }
    library.setSearchQuery('');
  }, [library.setSearchQuery]);

  const handleSidebarViewChange = (v: ViewType) => {
    setView(v);
    setNavigationRequest(null);
    setSelectedArtist(null);
    library.setSearchQuery('');
  };

  const handleReorder = useCallback((draggedId: string, targetId: string | null) => {
    const prevTracks = [...library.tracks];
    const fromIndex = prevTracks.findIndex(t => t.id === draggedId);
    if (fromIndex === -1) return;
    const playingTrackId = library.tracks[player.currentTrackIndex || 0]?.id;
    const [trackToMove] = prevTracks.splice(fromIndex, 1);
    let toIndex = targetId === null ? prevTracks.length : prevTracks.findIndex(t => t.id === targetId);
    if (toIndex === -1) toIndex = prevTracks.length;
    prevTracks.splice(toIndex, 0, trackToMove);
    library.setTracks(prevTracks);
    if (playingTrackId) {
      const newCurrentIndex = prevTracks.findIndex(t => t.id === playingTrackId);
      if (newCurrentIndex !== -1) player.setCurrentTrackIndex(newCurrentIndex);
    }
  }, [library.tracks, player.currentTrackIndex]);

  return (
    <div className="flex h-screen overflow-hidden font-sans selection:bg-yellow-500/30">
      <ImportWindow 
        isOpen={isImportWindowOpen} onClose={() => setIsImportWindowOpen(false)} 
        onImport={async () => {
           try {
             const handle = await window.showDirectoryPicker();
             await saveLibraryFolder(handle.name, handle);
             await library.syncAll();
             if (player.currentTrackIndex === null) player.setCurrentTrackIndex(0);
             setView('player');
             setIsImportWindowOpen(false);
           } catch (e) {}
        }} 
        onManualFilesSelect={async (files) => {
          const ok = await library.handleManualFilesSelect(files);
          if (ok) {
            if (player.currentTrackIndex === null) player.setCurrentTrackIndex(0);
            setView('player');
            setIsImportWindowOpen(false);
          }
        }}
        onRemoveFolder={library.removeFolder} importedFolders={library.importedFolders} 
      />
      
      <div className="hidden md:flex flex-col h-full z-50">
          <Sidebar activeView={view} onViewChange={handleSidebarViewChange} trackCount={library.tracks.length} />
      </div>

      <main className="flex-1 flex flex-col relative pb-32 md:pb-28 bg-gradient-to-br from-[#1c1c1c] via-[#121212] to-[#0a0a0a]">
        {settings.showBlurBackground && currentTrack && view === 'player' && (
          <div className="absolute inset-0 pointer-events-none transition-all duration-1000 overflow-hidden">
             {currentTrack.coverUrl ? <img src={currentTrack.coverUrl} className="w-full h-full object-cover scale-150 blur-[120px] opacity-[0.15]" /> : <div className="w-full h-full bg-gradient-to-br from-yellow-500/5 to-transparent blur-[120px]" />}
          </div>
        )}

        <header className="p-4 md:p-6 flex justify-between items-center z-50 relative gap-3">
          <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
             <div className="relative group max-w-md w-full">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 transition-colors"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></div>
                <input type="text" placeholder={processDisplayString("搜索...")} value={library.searchQuery} onChange={(e) => { library.setSearchQuery(e.target.value); if(view === 'player' && e.target.value) setView('all'); }} className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 px-11 text-sm text-white focus:border-yellow-500/50 outline-none backdrop-blur-md transition-all" />
             </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => library.syncAll()} disabled={library.isImporting} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-full transition-all active:scale-90"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={library.isImporting ? 'animate-spin' : ''}><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24L21 8"/><path d="M21 3v5h-5"/></svg></button>
            <button onClick={() => setIsImportWindowOpen(true)} className="bg-yellow-500 text-black px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-widest active:scale-95 transition-all">{processDisplayString("管理库")}</button>
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden">
            <div key={view + (selectedArtist || '')} className="absolute inset-0 flex flex-col animate-in fade-in duration-700">
                {view === 'player' ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 overflow-hidden relative">
                    
                    {/* 信息展示区 */}
                    <div className="text-center relative z-40 px-6 max-w-4xl flex flex-col items-center">
                      <h2 className="text-2xl md:text-3xl lg:text-5xl font-bold mb-4 tracking-tight text-white drop-shadow-xl">
                        {processDisplayString(currentTrack?.name || "黑胶时光")}
                      </h2>

                      <div className="flex items-center gap-2 mb-2">
                        <button onClick={() => handleNavigate('artistProfile', currentTrack?.artist || '')} className="text-zinc-400 font-bold uppercase tracking-[0.15em] text-[11px] md:text-xs hover:text-yellow-500 transition-colors">
                          {processDisplayString(currentTrack?.artist || "享受纯净音质")}
                        </button>
                        {currentTrack?.album && (
                          <>
                            <span className="text-zinc-800 font-black mx-1">•</span>
                            <button onClick={() => handleNavigate('albums', currentTrack.album)} className="text-zinc-500 font-bold uppercase tracking-[0.15em] text-[11px] md:text-xs hover:text-white transition-colors">
                              {processDisplayString(currentTrack.album)}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 黑胶区域 */}
                    <div className="relative mt-2">
                      <SwipeableTrack onNext={player.nextTrack} onPrev={player.prevTrack} currentId={currentTrack?.id || 'empty'}>
                        <VinylRecord isPlaying={player.isPlaying} coverUrl={currentTrack?.coverUrl} intensity={audioIntensity} themeColor={rhythmColor} spinSpeed={settings.spinSpeed} showParticles={settings.showParticles} />
                      </SwipeableTrack>
                      
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-30">
                          <div className="relative w-[60vw] h-[60vw] max-w-[16rem] max-h-[16rem] sm:w-[70vw] sm:h-[70vw] sm:max-w-[18rem] sm:max-h-[18rem] md:w-96 md:h-96 flex-shrink-0">
                              <ToneArm trackId={currentTrack?.id} isPlaying={player.isPlaying} progress={player.duration > 0 ? player.progress / player.duration : 0} onClick={player.togglePlay} />
                          </div>
                      </div>
                    </div>

                    {/* Hi-Fi 仪表盘 (音质显示在黑胶下面) */}
                    {settings.showQualityTag && qualityInfo && (
                      <div className="mt-6 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-1000">
                        <div className="flex items-center gap-4 bg-black/40 px-5 py-2 rounded-2xl border border-white/5 backdrop-blur-md shadow-2xl">
                          <div className="flex flex-col items-start">
                             <span className="text-[7px] text-zinc-600 font-black uppercase tracking-widest mb-0.5">SIGNAL QUALITY</span>
                             <span className={`px-2 py-0.5 border ${qualityInfo.borderClass} ${qualityInfo.colorClass} rounded-sm text-[9px] font-black tracking-[0.15em] shadow-lg ${qualityInfo.glowClass}`}>
                                {qualityInfo.label}
                             </span>
                          </div>
                          
                          <div className="w-px h-6 bg-zinc-800/50" />
                          
                          <div className="flex flex-col items-end">
                             <span className="text-[7px] text-zinc-600 font-black uppercase tracking-widest mb-0.5">BITRATE</span>
                             <div className="flex items-baseline gap-1">
                                <span className={`text-lg font-mono font-bold leading-none tracking-tighter transition-all duration-500 ${player.isPlaying ? qualityInfo.colorClass : 'text-zinc-800'}`}>
                                  {qualityInfo.bitrate || '000'}
                                </span>
                                <span className="text-[8px] text-zinc-700 font-black">kbps</span>
                             </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AI 解读区 */}
                    {settings.enableAI && (
                      <div className={`mt-6 max-w-2xl text-center px-4 italic text-zinc-500 text-sm md:text-base transition-opacity duration-1000 leading-relaxed ${isStoryLoading ? 'opacity-20' : 'opacity-100'}`}>
                        {trackStory || (currentTrack ? processDisplayString("正在为您解读...") : processDisplayString("开启一段黑胶之旅。"))}
                      </div>
                    )}
                  </div>
                ) : view === 'artistProfile' && selectedArtist ? (
                  <ArtistProfile artistName={selectedArtist} allTracks={library.tracks} onBack={() => { setView('collection'); setSelectedArtist(null); }} onPlayTrack={(t) => { const idx = library.tracks.findIndex(item => item.id === t.id); player.setCurrentTrackIndex(idx); setView('player'); player.setIsPlaying(true); }} onNavigateToAlbum={(album) => handleNavigate('albums', album)} favorites={library.favorites} onToggleFavorite={library.handleToggleFavorite} />
                ) : view === 'settings' ? (
                  <SettingsView settings={settings} onUpdate={updateSettings} onReset={resetSettings} onClearHistory={library.clearHistory} />
                ) : view === 'collection' ? (
                  <CollectionView tracks={library.tracks} onNavigate={handleNavigate} displayConverter={processDisplayString} />
                ) : (
                  <LibraryView view={view} tracks={library.filteredTracks} onPlay={(t) => { const idx = library.tracks.findIndex(item => item.id === t.id); player.setCurrentTrackIndex(idx); setView('player'); player.setIsPlaying(true); }} favorites={library.favorites} navigationRequest={navigationRequest} onNavigationProcessed={() => setNavigationRequest(null)} onNavigate={handleNavigate} isSearching={library.searchQuery.length > 0} onToggleFavorite={library.handleToggleFavorite} onUpdateTrack={library.handleUpdateTrack} displayConverter={processDisplayString} />
                )}
            </div>
        </div>
        
        <audio ref={player.audioRef} src={currentTrack?.url} preload="auto" />
        <PlayerControls
          currentTrack={currentTrack} tracks={library.tracks} historyTracks={library.historyTracks} currentIndex={player.currentTrackIndex}
          isPlaying={player.isPlaying} onTogglePlay={player.togglePlay} onNext={player.nextTrack} onPrev={player.prevTrack} onSelectTrack={player.setCurrentTrackIndex} onRemoveTrack={(id) => library.setTracks(prev => prev.filter(t => t.id !== id))}
          progress={player.progress} duration={player.duration} volume={player.volume} onVolumeChange={player.setVolume} onSeek={player.seek} isFavorite={currentTrack ? library.favorites.has(currentTrack.id) : false} favorites={library.favorites} onNavigate={handleNavigate} onToggleFavorite={(id) => library.handleToggleFavorite(id || currentTrack?.id || '')}
          playbackMode={player.playbackMode} onTogglePlaybackMode={() => player.setPlaybackMode(p => p === 'normal' ? 'shuffle' : p === 'shuffle' ? 'loop' : 'normal')}
          onReorder={handleReorder} onClearHistory={library.clearHistory} onPlayFromHistory={(t) => { const idx = library.tracks.findIndex(item => item.fingerprint === t.fingerprint); if(idx !== -1) { player.setCurrentTrackIndex(idx); setView('player'); player.setIsPlaying(true); } }} themeColor="#eab308" settings={settings} displayConverter={processDisplayString}
        />
        <MobileNav activeView={view} onViewChange={handleSidebarViewChange} trackCount={library.tracks.length} themeColor="#eab308" />
      </main>
    </div>
  );
};

export default App;
