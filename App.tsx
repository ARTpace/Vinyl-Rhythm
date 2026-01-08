
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import LibraryView from './components/LibraryView';
import PlayerControls from './components/PlayerControls';
import VinylRecord from './components/VinylRecord';
import { Track, ViewType, PlaybackMode, LibraryFolder } from './types';
import { parseFileToTrack } from './utils/audioParser';
import { SUPPORTED_FORMATS } from './constants';
import { getTrackStory } from './services/geminiService';

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>('player');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [trackStory, setTrackStory] = useState<string>('');
  const [isStoryLoading, setIsStoryLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<{current: number, total: number, added: number, skipped: number} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 音频分析相关
  const [audioIntensity, setAudioIntensity] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 库文件夹记录
  const [libraryFolders, setLibraryFolders] = useState<LibraryFolder[]>(() => {
    const saved = localStorage.getItem('vinyl_folders');
    return saved ? JSON.parse(saved) : [];
  });

  const [libraryNavigation, setLibraryNavigation] = useState<{ type: 'artists' | 'albums', name: string } | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('vinyl_favorites');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('normal');
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentTrack = currentTrackIndex !== null ? tracks[currentTrackIndex] : null;
  const isFavorite = currentTrack ? favorites.has(currentTrack.id) : false;

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return tracks.filter(t => 
      t.name.toLowerCase().includes(query) || 
      t.artist.toLowerCase().includes(query) || 
      t.album.toLowerCase().includes(query)
    ).slice(0, 8);
  }, [searchQuery, tracks]);

  // 初始化音频分析器
  const initAudioAnalyzer = useCallback(() => {
    if (!audioRef.current || audioContextRef.current) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch (e) {
      console.error("音频分析器初始化失败:", e);
    }
  }, []);

  // 循环更新音乐强度
  const updateIntensity = useCallback(() => {
    if (!analyserRef.current || !isPlaying) {
      setAudioIntensity(0);
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // 计算低频段强度 (0-10 索引通常对应低音)
    let sum = 0;
    const lowFreqRange = 10; 
    for (let i = 0; i < lowFreqRange; i++) {
      sum += dataArray[i];
    }
    const averageLow = sum / lowFreqRange;
    
    // 计算整体平均强度
    let totalSum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      totalSum += dataArray[i];
    }
    const averageTotal = totalSum / dataArray.length;

    // 混合强度: 侧重低音起伏
    const intensity = (averageLow * 0.7 + averageTotal * 0.3) / 255;
    setAudioIntensity(Math.pow(intensity, 1.2)); // 稍微增强对比度

    animationFrameRef.current = requestAnimationFrame(updateIntensity);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateIntensity);
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setAudioIntensity(0);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, updateIntensity]);

  useEffect(() => {
    localStorage.setItem('vinyl_favorites', JSON.stringify(Array.from(favorites)));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('vinyl_folders', JSON.stringify(libraryFolders));
  }, [libraryFolders]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleToggleFavorite = useCallback((trackId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(trackId)) {
        newFavorites.delete(trackId);
      } else {
        newFavorites.add(trackId);
      }
      return newFavorites;
    });
  }, []);

  const handleRemoveTrack = useCallback((trackId: string) => {
    setTracks(prev => {
      const indexToRemove = prev.findIndex(t => t.id === trackId);
      if (indexToRemove === -1) return prev;
      const newTracks = prev.filter(t => t.id !== trackId);
      if (currentTrackIndex === indexToRemove) {
          if (newTracks.length === 0) {
              setCurrentTrackIndex(null);
              setIsPlaying(false);
          } else {
              setCurrentTrackIndex(indexToRemove % newTracks.length);
          }
      } else if (currentTrackIndex !== null && indexToRemove < currentTrackIndex) {
          setCurrentTrackIndex(currentTrackIndex - 1);
      }
      return newTracks;
    });
  }, [currentTrackIndex]);

  const togglePlaybackMode = useCallback(() => {
    setPlaybackMode(prev => {
      if (prev === 'normal') return 'shuffle';
      if (prev === 'shuffle') return 'loop';
      return 'normal';
    });
  }, []);

  const shuffleArray = useCallback((array: number[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  useEffect(() => {
    if (tracks.length > 0) {
      const indices = tracks.map((_, i) => i);
      setShuffledIndices(shuffleArray(indices));
    }
  }, [tracks.length, shuffleArray]);

  const getNextTrackIndex = useCallback((currentIndex: number): number => {
    if (playbackMode === 'loop') return currentIndex;
    if (playbackMode === 'shuffle') {
      const currentShuffleIndex = shuffledIndices.indexOf(currentIndex);
      const nextShuffleIndex = (currentShuffleIndex + 1) % shuffledIndices.length;
      return shuffledIndices[nextShuffleIndex];
    }
    return (currentIndex + 1) % tracks.length;
  }, [playbackMode, shuffledIndices, tracks.length]);

  const getPrevTrackIndex = useCallback((currentIndex: number): number => {
    if (playbackMode === 'loop') return currentIndex;
    if (playbackMode === 'shuffle') {
      const currentShuffleIndex = shuffledIndices.indexOf(currentIndex);
      const prevShuffleIndex = (currentShuffleIndex - 1 + shuffledIndices.length) % shuffledIndices.length;
      return shuffledIndices[prevShuffleIndex];
    }
    return (currentIndex - 1 + tracks.length) % tracks.length;
  }, [playbackMode, shuffledIndices, tracks.length]);

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const audioFiles = files.filter(f =>
      SUPPORTED_FORMATS.some(format => f.name.toLowerCase().endsWith(format))
    );

    if (audioFiles.length === 0) {
      alert("未在此目录中发现支持的音频格式。");
      return;
    }

    const rootName = audioFiles[0].webkitRelativePath.split('/')[0] || "本地音乐库";
    
    setImportStatus({ current: 0, total: audioFiles.length, added: 0, skipped: 0 });
    const parsedTracks: Track[] = [];
    let skippedCount = 0;

    const existingFingerprints = new Set(tracks.map(t => t.fingerprint));

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      const fingerprint = `${file.name}-${file.size}`;
      
      if (existingFingerprints.has(fingerprint)) {
        skippedCount++;
      } else {
        const track = await parseFileToTrack(file);
        parsedTracks.push(track);
      }
      
      setImportStatus(prev => ({ 
        ...prev!, 
        current: i + 1, 
        added: parsedTracks.length, 
        skipped: skippedCount 
      }));
    }

    if (parsedTracks.length > 0) {
      setTracks(prev => [...prev, ...parsedTracks]);
      
      setLibraryFolders(prev => {
        const existingIdx = prev.findIndex(f => f.name === rootName);
        if (existingIdx > -1) {
          const updated = [...prev];
          const target = updated[existingIdx];
          if (target) {
            updated[existingIdx] = {
              ...target,
              lastSync: Date.now(),
              trackCount: target.trackCount + parsedTracks.length
            };
          }
          return updated;
        } else {
          return [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            name: rootName,
            pathPlaceholder: rootName,
            lastSync: Date.now(),
            trackCount: parsedTracks.length
          }];
        }
      });
    }

    setTimeout(() => {
        setImportStatus(null);
        if (parsedTracks.length > 0 && currentTrackIndex === null) {
            setCurrentTrackIndex(0);
            setView('player');
        }
    }, 2000);
  };

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !currentTrack) return;
    
    // 用户交互触发后初始化音频上下文
    initAudioAnalyzer();
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, currentTrack, initAudioAnalyzer]);

  const playTrack = useCallback((track: Track) => {
    const index = tracks.findIndex(t => t.id === track.id);
    if (index !== -1) {
      setCurrentTrackIndex(index);
      setView('player');
      setIsPlaying(true);
      setSearchQuery('');
      
      // 切换歌曲时也要确保上下文可用
      initAudioAnalyzer();
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    }
  }, [tracks, initAudioAnalyzer]);

  const nextTrack = useCallback(() => {
    if (tracks.length === 0 || currentTrackIndex === null) return;
    const nextIndex = getNextTrackIndex(currentTrackIndex);
    setCurrentTrackIndex(nextIndex);
    setIsPlaying(true);
  }, [tracks.length, currentTrackIndex, getNextTrackIndex]);

  const prevTrack = useCallback(() => {
    if (tracks.length === 0 || currentTrackIndex === null) return;
    const prevIndex = getPrevTrackIndex(currentTrackIndex);
    setCurrentTrackIndex(prevIndex);
    setIsPlaying(true);
  }, [tracks.length, currentTrackIndex, getPrevTrackIndex]);

  useEffect(() => {
    if (currentTrack) {
      setIsStoryLoading(true);
      getTrackStory(currentTrack.name, currentTrack.artist).then(story => {
        setTrackStory(story);
        setIsStoryLoading(false);
      });
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => setProgress(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      if (playbackMode === 'loop' && currentTrackIndex !== null) {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      } else {
        nextTrack();
      }
    };
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [nextTrack, playbackMode, currentTrackIndex]);

  useEffect(() => {
    if (currentTrack && isPlaying && audioRef.current) {
      audioRef.current.play().catch(console.error);
    }
  }, [currentTrack, isPlaying]);

  const jumpToArtist = (artist: string) => {
    setView('artists');
    setLibraryNavigation({ type: 'artists', name: artist });
  };

  const jumpToAlbum = (album: string) => {
    setView('albums');
    setLibraryNavigation({ type: 'albums', name: album });
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans selection:bg-yellow-500/30">
      <Sidebar activeView={view} onViewChange={setView} trackCount={tracks.length} />

      <main className="flex-1 flex flex-col relative pb-28 bg-gradient-to-br from-[#1c1c1c] via-[#121212] to-[#0a0a0a]">
        <header className="p-6 flex justify-between items-center z-40 relative">
          <div className="flex items-center gap-6 flex-1">
             <div className="relative group max-w-md w-full">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-yellow-500 transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <input
                  type="text"
                  placeholder="搜索库中的曲目、歌手、专辑..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-yellow-500/50 focus:bg-white/10 text-white rounded-full py-2.5 pl-11 pr-4 text-sm font-medium transition-all outline-none backdrop-blur-md"
                />
                
                {searchQuery.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="p-2 max-h-96 overflow-y-auto custom-scrollbar">
                      {searchResults.length > 0 ? (
                        searchResults.map((track) => (
                          <div
                            key={track.id}
                            onClick={() => playTrack(track)}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 cursor-pointer transition-all group/res"
                          >
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0 border border-white/5">
                              {track.coverUrl ? (
                                <img src={track.coverUrl} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center opacity-20">🎵</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white truncate group-hover/res:text-yellow-500 transition-colors">{track.name}</p>
                              <p className="text-xs text-zinc-500 font-medium truncate uppercase tracking-wider">{track.artist}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center">
                          <p className="text-zinc-500 text-sm font-bold">没有找到匹配的结果</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
             </div>

             {importStatus && (
               <div className="flex flex-col animate-in fade-in duration-300">
                 <div className="flex items-center gap-2 text-yellow-500 text-[10px] font-black uppercase tracking-wider">
                   <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                   <span>增量扫描中: {importStatus.added} 新曲 / {importStatus.skipped} 已跳过</span>
                 </div>
                 <div className="w-48 h-1 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                    <div
                        className="h-full bg-yellow-500 transition-all duration-300"
                        style={{width: `${(importStatus.current / importStatus.total) * 100}%`}}
                    ></div>
                 </div>
               </div>
             )}
          </div>
          
          <div className="flex gap-4 items-center">
            {libraryFolders.length > 0 && (
              <div className="hidden lg:flex flex-col items-end opacity-60">
                <span className="text-[9px] font-black text-zinc-400 tracking-widest uppercase">已关联目录</span>
                <div className="flex gap-1 mt-0.5">
                  {libraryFolders.map(f => (
                    <span key={f.id} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-500 text-[9px] rounded font-bold">{f.name}</span>
                  ))}
                </div>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFolderUpload}
              className="hidden"
              /* @ts-ignore */
              webkitdirectory="true"
              multiple
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="group bg-yellow-500 hover:bg-yellow-400 text-black px-5 py-2.5 rounded-full font-black text-sm transition-all shadow-xl shadow-yellow-500/20 flex items-center gap-2 active:scale-95"
              disabled={!!importStatus}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={importStatus ? 'animate-spin' : ''}>
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
              </svg>
              <span>{importStatus ? '扫描中' : libraryFolders.length > 0 ? '同步库' : '导入本地库'}</span>
            </button>
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden">
            <div 
              key={view} 
              className="absolute inset-0 flex flex-col animate-in fade-in slide-in-from-bottom-8 zoom-in-95 duration-700 cubic-bezier(0.16, 1, 0.3, 1) fill-mode-both"
            >
                {view === 'player' ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-12 p-8 overflow-y-auto custom-scrollbar">
                    <div className="text-center">
                      <div className="flex flex-col items-center gap-2 mb-3">
                         <h2 className="text-4xl font-black text-white tracking-tight">
                            {currentTrack?.name || "黑胶时光"}
                         </h2>
                         {currentTrack?.bitrate && (
                            <div className="px-2 py-0.5 bg-zinc-800 text-zinc-500 text-[9px] font-black rounded border border-white/5 animate-pulse uppercase tracking-widest">
                               {Math.floor(currentTrack.bitrate / 1000)} KBPS
                            </div>
                         )}
                      </div>
                      <div className="flex items-center justify-center gap-2 flex-wrap px-4">
                        <button 
                          onClick={() => currentTrack && jumpToArtist(currentTrack.artist)}
                          className="text-yellow-500 font-bold text-xl hover:text-yellow-400 transition-colors hover:underline decoration-2 underline-offset-4"
                        >
                            {currentTrack?.artist || "请选择您的音乐"}
                        </button>
                        {currentTrack?.album && (
                            <>
                                <span className="text-zinc-700 text-xl">•</span>
                                <button 
                                  onClick={() => jumpToAlbum(currentTrack.album)}
                                  className="text-zinc-500 font-medium text-lg hover:text-zinc-300 transition-colors hover:underline decoration-zinc-500 decoration-1 underline-offset-4"
                                >
                                    {currentTrack.album}
                                </button>
                            </>
                        )}
                      </div>
                    </div>

                    <VinylRecord isPlaying={isPlaying} coverUrl={currentTrack?.coverUrl} intensity={audioIntensity} />

                    <div className="max-w-2xl text-center px-4">
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="h-[1px] w-8 bg-zinc-800"></div>
                        <div className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.4em]">Gemini Insight</div>
                        <div className="h-[1px] w-8 bg-zinc-800"></div>
                      </div>
                      <div className={`text-zinc-400 italic text-lg leading-relaxed transition-all duration-1000 ${isStoryLoading ? 'opacity-20 scale-95' : 'opacity-100 scale-100'}`}>
                        {trackStory || "让 AI 为您的音乐解读背后的故事..."}
                      </div>
                    </div>
                  </div>
                ) : (
                  <LibraryView 
                    view={view} 
                    tracks={tracks} 
                    onPlay={playTrack} 
                    favorites={favorites} 
                    onToggleFavorite={handleToggleFavorite}
                    navigationRequest={libraryNavigation}
                    onNavigationProcessed={() => setLibraryNavigation(null)}
                  />
                )}
            </div>
        </div>

        <audio ref={audioRef} src={currentTrack?.url} crossOrigin="anonymous" />

        <PlayerControls
          currentTrack={currentTrack}
          tracks={tracks}
          currentIndex={currentTrackIndex}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onNext={nextTrack}
          onPrev={prevTrack}
          onSelectTrack={(idx) => {
            setCurrentTrackIndex(idx);
            setIsPlaying(true);
          }}
          onRemoveTrack={handleRemoveTrack}
          progress={progress}
          duration={duration}
          volume={volume}
          onVolumeChange={setVolume}
          onSeek={(val) => {
            if (audioRef.current) audioRef.current.currentTime = val;
          }}
          isFavorite={isFavorite}
          onToggleFavorite={() => currentTrack && handleToggleFavorite(currentTrack.id)}
          playbackMode={playbackMode}
          onTogglePlaybackMode={togglePlaybackMode}
        />
      </main>
    </div>
  );
};

export default App;
