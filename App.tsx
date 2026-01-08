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
  const [themeColor, setThemeColor] = useState('rgba(234, 179, 8, 1)'); 
  
  // 音频分析相关
  const [audioIntensity, setAudioIntensity] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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

  // 改进的主题色提取：确保输出标准 rgba 格式
  useEffect(() => {
    if (currentTrack?.coverUrl) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = currentTrack.coverUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            canvas.width = 1;
            canvas.height = 1;
            ctx.drawImage(img, 0, 0, 1, 1);
            const data = ctx.getImageData(0, 0, 1, 1).data;
            let [r, g, b] = [data[0], data[1], data[2]];
            
            // 亮度调整：如果太暗，调亮一点以保证动画可见度
            const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            if (luminance < 60) {
              const boost = 1.6;
              r = Math.min(255, r * boost);
              g = Math.min(255, g * boost);
              b = Math.min(255, b * boost);
            }
            setThemeColor(`rgba(${r}, ${g}, ${b}, 1)`);
        };
        img.onerror = () => setThemeColor('rgba(234, 179, 8, 1)');
    } else {
        setThemeColor('rgba(234, 179, 8, 1)');
    }
  }, [currentTrack]);

  // 初始化音频分析器
  const initAudioAnalyzer = useCallback(() => {
    if (!audioRef.current || audioContextRef.current) {
        // 如果已经初始化，尝试恢复 context
        if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
        }
        return;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128; // 更小的 FFT 尺寸，灵敏度更高
      analyser.smoothingTimeConstant = 0.5; // 降低平滑度，让跳动更干脆
      
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {
      console.error("音频分析器初始化失败:", e);
    }
  }, []);

  // 极致律动算法
  const updateIntensity = useCallback(() => {
    if (!analyserRef.current || !isPlaying) {
      setAudioIntensity(0);
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // 针对低音部分进行强力提取 (Bass: 前 10% 的频段)
    let bassSum = 0;
    const bassRange = Math.floor(dataArray.length * 0.15) || 5; 
    for (let i = 0; i < bassRange; i++) {
      bassSum += dataArray[i];
    }
    const averageBass = bassSum / bassRange;
    
    // 整体强度
    let totalSum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        totalSum += dataArray[i];
    }
    const averageTotal = totalSum / dataArray.length;

    // 综合强度计算：非线性映射增强重音感
    const normalized = (averageBass * 0.85 + averageTotal * 0.15) / 255;
    const finalIntensity = Math.min(1.2, Math.pow(normalized, 0.9) * 1.8); 
    setAudioIntensity(finalIntensity);

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

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !currentTrack) return;
    
    initAudioAnalyzer();
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
          setIsPlaying(true);
      }).catch(err => {
          console.error("播放失败:", err);
          // 如果是因为 context 问题，再次尝试
          if (audioContextRef.current) audioContextRef.current.resume();
      });
    }
  }, [isPlaying, currentTrack, initAudioAnalyzer]);

  const playTrack = useCallback((track: Track) => {
    const index = tracks.findIndex(t => t.id === track.id);
    if (index !== -1) {
      setCurrentTrackIndex(index);
      setView('player');
      setIsPlaying(true);
      setSearchQuery('');
      
      initAudioAnalyzer();
    }
  }, [tracks, initAudioAnalyzer]);

  // Fix: 添加 useEffect 当歌曲切换时调用 Gemini API 获取专属故事
  useEffect(() => {
    if (!currentTrack) {
      setTrackStory('');
      return;
    }

    const fetchStory = async () => {
      setIsStoryLoading(true);
      const story = await getTrackStory(currentTrack.name, currentTrack.artist);
      setTrackStory(story);
      setIsStoryLoading(false);
    };

    fetchStory();
  }, [currentTrack]);

  // Fix: 处理切歌后的自动播放，确保在 isPlaying 状态下 src 变更后音频能正常播放
  useEffect(() => {
    if (isPlaying && audioRef.current && currentTrack) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("切歌自动播放失败:", error);
        });
      }
    }
  }, [currentTrack, isPlaying]);

  const handleToggleFavorite = useCallback((trackId?: string) => {
    const targetId = trackId || currentTrack?.id;
    if (!targetId) return;
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(targetId)) newFavorites.delete(targetId);
      else newFavorites.add(targetId);
      return newFavorites;
    });
  }, [currentTrack]);

  const handleRemoveTrack = useCallback((trackId: string) => {
    setTracks(prev => prev.filter(t => t.id !== trackId));
  }, []);

  const togglePlaybackMode = useCallback(() => {
    setPlaybackMode(prev => prev === 'normal' ? 'shuffle' : prev === 'shuffle' ? 'loop' : 'normal');
  }, []);

  const jumpToArtist = (artist: string) => {
    setView('artists');
    setLibraryNavigation({ type: 'artists', name: artist });
  };

  const jumpToAlbum = (album: string) => {
    setView('albums');
    setLibraryNavigation({ type: 'albums', name: album });
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => setProgress(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => playbackMode === 'loop' ? (audio.currentTime = 0, audio.play()) : nextTrack();
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [playbackMode, currentTrackIndex]);

  const nextTrack = useCallback(() => {
    if (tracks.length === 0 || currentTrackIndex === null) return;
    const nextIdx = (currentTrackIndex + 1) % tracks.length;
    setCurrentTrackIndex(nextIdx);
    setIsPlaying(true);
  }, [tracks.length, currentTrackIndex]);

  const prevTrack = useCallback(() => {
    if (tracks.length === 0 || currentTrackIndex === null) return;
    const prevIdx = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    setCurrentTrackIndex(prevIdx);
    setIsPlaying(true);
  }, [tracks.length, currentTrackIndex]);

  return (
    <div className="flex h-screen overflow-hidden font-sans selection:bg-yellow-500/30">
      <Sidebar activeView={view} onViewChange={setView} trackCount={tracks.length} />

      <main className="flex-1 flex flex-col relative pb-28 bg-gradient-to-br from-[#1c1c1c] via-[#121212] to-[#0a0a0a]">
        <header className="p-6 flex justify-between items-center z-50 relative">
          <div className="flex items-center gap-6 flex-1">
             <div className="relative group max-w-md w-full">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-yellow-500 transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <input
                  type="text"
                  placeholder="搜索库中的曲目..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-11 pr-4 text-sm text-white focus:border-yellow-500 transition-all outline-none backdrop-blur-md"
                />
             </div>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-yellow-500 text-black px-5 py-2.5 rounded-full font-black text-sm shadow-xl flex items-center gap-2 active:scale-95"
          >
            导入音乐库
          </button>
          {/* Fix: 使用类型断言解决 React 对 webkitdirectory 属性的类型校验错误 */}
          <input type="file" ref={fileInputRef} className="hidden" {...({ webkitdirectory: "true", directory: "" } as any)} multiple onChange={(e) => {
              const files = Array.from(e.target.files || []);
              const audioFiles = files.filter(f => SUPPORTED_FORMATS.some(ext => f.name.toLowerCase().endsWith(ext)));
              Promise.all(audioFiles.map(parseFileToTrack)).then(newTracks => setTracks(prev => [...prev, ...newTracks]));
          }} />
        </header>

        <div className="flex-1 relative overflow-hidden">
            <div key={view} className="absolute inset-0 flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-700">
                {view === 'player' ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-12 p-8 overflow-y-auto custom-scrollbar">
                    <div className="text-center relative z-40">
                      <h2 className="text-4xl font-black text-white tracking-tight mb-2">
                        {currentTrack?.name || "黑胶时光"}
                      </h2>
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => currentTrack && jumpToArtist(currentTrack.artist)}
                          className="font-bold text-xl hover:underline"
                          style={{ color: themeColor }}
                        >
                            {currentTrack?.artist || "请选择您的音乐"}
                        </button>
                      </div>
                    </div>

                    <VinylRecord 
                        isPlaying={isPlaying} 
                        coverUrl={currentTrack?.coverUrl} 
                        intensity={audioIntensity} 
                        progress={duration > 0 ? progress / duration : 0}
                        themeColor={themeColor}
                    />

                    <div className="max-w-2xl text-center px-4 relative z-40">
                      <div className={`text-zinc-400 italic text-lg transition-all duration-1000 ${isStoryLoading ? 'opacity-20' : 'opacity-100'}`}>
                        {trackStory || (currentTrack ? "正在准备您的专属音乐故事..." : "开始一段跨越时空的黑胶之旅。")}
                      </div>
                    </div>
                  </div>
                ) : (
                  <LibraryView 
                    view={view} tracks={tracks} onPlay={playTrack} 
                    favorites={favorites} onToggleFavorite={handleToggleFavorite}
                  />
                )}
            </div>
        </div>

        <audio ref={audioRef} src={currentTrack?.url} />

        <PlayerControls
          currentTrack={currentTrack} tracks={tracks} currentIndex={currentTrackIndex}
          isPlaying={isPlaying} onTogglePlay={togglePlay} onNext={nextTrack} onPrev={prevTrack}
          onSelectTrack={setCurrentTrackIndex} onRemoveTrack={handleRemoveTrack}
          progress={progress} duration={duration} volume={volume} onVolumeChange={setVolume}
          onSeek={(val) => audioRef.current && (audioRef.current.currentTime = val)}
          isFavorite={isFavorite} onToggleFavorite={handleToggleFavorite} favorites={favorites}
          playbackMode={playbackMode} onTogglePlaybackMode={togglePlaybackMode}
        />
      </main>
    </div>
  );
};

export default App;