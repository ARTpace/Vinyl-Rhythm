
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

  // 主题色提取优化
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
            
            // 提亮暗色封面，确保光晕可见
            const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            if (luminance < 50) {
              r = Math.min(255, r + 60);
              g = Math.min(255, g + 60);
              b = Math.min(255, b + 60);
            }
            setThemeColor(`rgba(${r}, ${g}, ${b}, 1)`);
        };
        img.onerror = () => setThemeColor('rgba(234, 179, 8, 1)');
    } else {
        setThemeColor('rgba(234, 179, 8, 1)');
    }
  }, [currentTrack]);

  const initAudioAnalyzer = useCallback(() => {
    if (!audioRef.current || audioContextRef.current) {
        if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
        }
        return;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64; // 进一步减小，提高爆发性响应
      analyser.smoothingTimeConstant = 0.3; // 极大降低平滑度，让律动更“脆”
      
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch (e) {
      console.error("音频引擎启动失败:", e);
    }
  }, []);

  // --- 极致律动算法优化 ---
  const updateIntensity = useCallback(() => {
    if (!analyserRef.current || !isPlaying) {
      setAudioIntensity(0);
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // 1. 低音增强（Bass）: 0-4 频段通常代表鼓声和贝斯
    let bass = 0;
    for (let i = 0; i < 4; i++) bass += dataArray[i];
    bass /= 4;

    // 2. 高音（Treble）: 捕捉人声和清脆乐器
    let mid = 0;
    for (let i = 4; i < 16; i++) mid += dataArray[i];
    mid /= 12;

    // 3. 动态映射：使用 Math.pow(x, 1.5) 拉大差距，让静默和高潮的视觉效果差 10 倍以上
    const rawValue = (bass * 0.9 + mid * 0.1) / 255;
    const dynamicIntensity = Math.pow(rawValue, 1.3) * 1.5; 
    
    // 设置一个小阈值，过滤掉微弱底噪
    setAudioIntensity(dynamicIntensity > 0.05 ? Math.min(1.1, dynamicIntensity) : 0);

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

  // 播放逻辑...
  const togglePlay = useCallback(() => {
    if (!audioRef.current || !currentTrack) return;
    initAudioAnalyzer();
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  }, [isPlaying, currentTrack, initAudioAnalyzer]);

  const playTrack = useCallback((track: Track) => {
    const index = tracks.findIndex(t => t.id === track.id);
    if (index !== -1) {
      setCurrentTrackIndex(index);
      setView('player');
      setIsPlaying(true);
      initAudioAnalyzer();
    }
  }, [tracks, initAudioAnalyzer]);

  // 其他 Effect 和辅助函数
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
    if (isPlaying && audioRef.current && currentTrack) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
  }, [currentTrack, isPlaying]);

  const nextTrack = useCallback(() => {
    if (tracks.length === 0 || currentTrackIndex === null) return;
    setCurrentTrackIndex((currentTrackIndex + 1) % tracks.length);
    setIsPlaying(true);
  }, [tracks.length, currentTrackIndex]);

  const prevTrack = useCallback(() => {
    if (tracks.length === 0 || currentTrackIndex === null) return;
    setCurrentTrackIndex((currentTrackIndex - 1 + tracks.length) % tracks.length);
    setIsPlaying(true);
  }, [tracks.length, currentTrackIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => setProgress(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => (playbackMode === 'loop' ? (audio.currentTime = 0, audio.play()) : nextTrack());
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [playbackMode, currentTrackIndex, nextTrack]);

  return (
    <div className="flex h-screen overflow-hidden font-sans selection:bg-yellow-500/30">
      <Sidebar activeView={view} onViewChange={setView} trackCount={tracks.length} />
      <main className="flex-1 flex flex-col relative pb-28 bg-gradient-to-br from-[#1c1c1c] via-[#121212] to-[#0a0a0a]">
        <header className="p-6 flex justify-between items-center z-50 relative">
          <div className="flex items-center gap-6 flex-1">
             <div className="relative group max-w-md w-full">
                <input
                  type="text"
                  placeholder="搜索库中的曲目..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 px-11 text-sm text-white focus:border-yellow-500 outline-none backdrop-blur-md transition-all"
                />
             </div>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-yellow-500 text-black px-6 py-2.5 rounded-full font-black text-sm shadow-xl active:scale-95 transition-all"
          >
            导入库
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            {...({ webkitdirectory: "true", directory: "" } as any)} 
            multiple 
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              const audioFiles = files.filter(f => SUPPORTED_FORMATS.some(ext => f.name.toLowerCase().endsWith(ext)));
              Promise.all(audioFiles.map(parseFileToTrack)).then(newTracks => setTracks(prev => [...prev, ...newTracks]));
            }} 
          />
        </header>

        <div className="flex-1 relative overflow-hidden">
            <div key={view} className="absolute inset-0 flex flex-col animate-in fade-in duration-700">
                {view === 'player' ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-10 p-8">
                    <div className="text-center relative z-40">
                      <h2 className="text-4xl font-black text-white tracking-tight mb-2">
                        {currentTrack?.name || "黑胶时光"}
                      </h2>
                      <div className="font-bold text-xl" style={{ color: themeColor }}>
                        {currentTrack?.artist || "享受纯净音质"}
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
                      <div className={`text-zinc-500 italic text-lg leading-relaxed transition-opacity duration-1000 ${isStoryLoading ? 'opacity-20' : 'opacity-100'}`}>
                        {trackStory || (currentTrack ? "正在通过 AI 为您解读..." : "开始一段跨越时空的黑胶之旅。")}
                      </div>
                    </div>
                  </div>
                ) : (
                  <LibraryView 
                    view={view} tracks={tracks} onPlay={playTrack} 
                    favorites={favorites} onToggleFavorite={(id) => setFavorites(prev => {
                      const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
                    })}
                  />
                )}
            </div>
        </div>

        <audio ref={audioRef} src={currentTrack?.url} />

        <PlayerControls
          currentTrack={currentTrack} tracks={tracks} currentIndex={currentTrackIndex}
          isPlaying={isPlaying} onTogglePlay={togglePlay} onNext={nextTrack} onPrev={prevTrack}
          onSelectTrack={setCurrentTrackIndex} onRemoveTrack={(id) => setTracks(prev => prev.filter(t => t.id !== id))}
          progress={progress} duration={duration} volume={volume} onVolumeChange={setVolume}
          onSeek={(val) => audioRef.current && (audioRef.current.currentTime = val)}
          isFavorite={currentTrack ? favorites.has(currentTrack.id) : false} 
          onToggleFavorite={() => currentTrack && setFavorites(prev => {
            const n = new Set(prev); if (n.has(currentTrack.id)) n.delete(currentTrack.id); else n.add(currentTrack.id); return n;
          })}
          playbackMode={playbackMode} onTogglePlaybackMode={() => setPlaybackMode(p => p === 'normal' ? 'shuffle' : p === 'shuffle' ? 'loop' : 'normal')}
        />
      </main>
    </div>
  );
};

export default App;
