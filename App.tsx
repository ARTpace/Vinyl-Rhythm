
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import ImportWindow from './components/ImportWindow';
import LibraryView from './components/LibraryView';
import PlayerControls from './components/PlayerControls';
import VinylRecord, { ToneArm } from './components/VinylRecord';
import SwipeableTrack from './components/SwipeableTrack';
import { Track, ViewType, PlaybackMode, LibraryFolder } from './types';
import { parseFileToTrack } from './utils/audioParser';
import { SUPPORTED_FORMATS } from './constants';
import { getTrackStory } from './services/geminiService';
import { saveLibraryFolder, getAllLibraryFolders, removeLibraryFolder } from './utils/storage';

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>('player');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [importedFolders, setImportedFolders] = useState<LibraryFolder[]>(() => {
    const saved = localStorage.getItem('vinyl_folders');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [trackStory, setTrackStory] = useState<string>('');
  const [isStoryLoading, setIsStoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [rhythmColor, setRhythmColor] = useState('rgba(234, 179, 8, 1)');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [currentProcessingFile, setCurrentProcessingFile] = useState<string>('');
  const [isImportWindowOpen, setIsImportWindowOpen] = useState<boolean>(false);

  const [navigationRequest, setNavigationRequest] = useState<{ type: 'artists' | 'albums' | 'folders', name: string } | null>(null);
  const [audioIntensity, setAudioIntensity] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('vinyl_favorites');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('normal');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrack = currentTrackIndex !== null ? tracks[currentTrackIndex] : null;

  useEffect(() => {
    const autoLoad = async () => {
      const savedFolders = await getAllLibraryFolders();
      if (savedFolders.length > 0) {
        handleSyncAll(true);
      }
    };
    autoLoad();
  }, []);

  useEffect(() => {
    localStorage.setItem('vinyl_folders', JSON.stringify(importedFolders));
  }, [importedFolders]);

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
    } catch (e) { console.error(e); }
  }, []);

  const updateIntensity = useCallback(() => {
    if (!analyserRef.current || !isPlaying) { setAudioIntensity(0); return; }
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    let bass = 0; for (let i = 0; i < 3; i++) bass += dataArray[i];
    const val = (bass / 3) / 255;
    setAudioIntensity(Math.pow(val, 1.2) * 1.6);
    animationFrameRef.current = requestAnimationFrame(updateIntensity);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) animationFrameRef.current = requestAnimationFrame(updateIntensity);
    else if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  }, [isPlaying, updateIntensity]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && currentTrack?.url && isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (error.name === 'NotAllowedError') setIsPlaying(false);
        });
      }
      initAudioAnalyzer();
    }
  }, [currentTrack?.url, isPlaying, initAudioAnalyzer]);

  useEffect(() => {
    if (currentTrack?.coverUrl) {
      const img = new Image();
      img.src = currentTrack.coverUrl;
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = 1; canvas.height = 1;
          ctx.drawImage(img, 0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          setRhythmColor(brightness < 40 ? `rgba(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)}, 1)` : `rgba(${r}, ${g}, ${b}, 1)`);
        }
      };
      img.onerror = () => setRhythmColor('rgba(234, 179, 8, 1)');
    } else {
      setRhythmColor('rgba(234, 179, 8, 1)');
    }
  }, [currentTrack?.coverUrl]);

  const scanDirectory = async (handle: FileSystemDirectoryHandle) => {
    const foundFiles: File[] = [];
    async function recursiveScan(dirHandle: FileSystemDirectoryHandle) {
      for await (const entry of (dirHandle as any).values()) {
        if (entry.kind === 'file') {
          if (SUPPORTED_FORMATS.some(ext => entry.name.toLowerCase().endsWith(ext))) {
            foundFiles.push(await entry.getFile());
          }
        } else if (entry.kind === 'directory') {
          await recursiveScan(entry);
        }
      }
    }
    await recursiveScan(handle);
    return foundFiles;
  };

  const handleSyncAll = async (isSilent: boolean = false) => {
    if (isImporting) return;
    const savedFolders = await getAllLibraryFolders();
    if (savedFolders.length === 0) {
      if (!isSilent) handleInitialImport();
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    
    let latestTracks = isSilent ? [] : [...tracks];
    let updatedFolders = [...importedFolders];

    for (const folder of savedFolders) {
      try {
        let permission = await folder.handle.queryPermission({ mode: 'read' });
        if (permission !== 'granted' && isSilent) continue;

        if (permission !== 'granted') {
          try { permission = await folder.handle.requestPermission({ mode: 'read' }); } catch (err) { console.warn(err); }
        }
        if (permission !== 'granted') continue;

        setCurrentProcessingFile(`正在扫描: ${folder.name}`);
        const diskFiles = await scanDirectory(folder.handle);
        const diskFingerprints = new Set(diskFiles.map(f => `${f.name}-${f.size}`));

        latestTracks = latestTracks.filter(t => {
          if (t.folderId !== folder.id) return true;
          return diskFingerprints.has(t.fingerprint);
        });
        
        const existingFingerprints = new Set(latestTracks.map(t => t.fingerprint));
        const newFiles = diskFiles.filter(f => !existingFingerprints.has(`${f.name}-${f.size}`));
        
        for (let i = 0; i < newFiles.length; i++) {
          const file = newFiles[i];
          setImportProgress(Math.round(((i + 1) / newFiles.length) * 100));
          setCurrentProcessingFile(`导入: ${file.name}`);
          try {
            const track = await parseFileToTrack(file);
            track.folderId = folder.id;
            latestTracks.push(track);
          } catch (e) { console.warn(e); }
          if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
        }

        const fIdx = updatedFolders.findIndex(f => f.id === folder.id);
        if (fIdx !== -1) {
          updatedFolders[fIdx] = {
            ...updatedFolders[fIdx],
            lastSync: Date.now(),
            trackCount: latestTracks.filter(t => t.folderId === folder.id).length
          };
        }
      } catch (e) { console.warn(`同步失败:`, e); }
    }

    setTracks(latestTracks);
    setImportedFolders(updatedFolders);
    if (latestTracks.length > 0 && currentTrackIndex === null) {
      setCurrentTrackIndex(0);
      setView('player'); 
    }
    setIsImporting(false);
    setImportProgress(0);
    setCurrentProcessingFile('');
  };

  const handleInitialImport = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const handle = await window.showDirectoryPicker().catch(err => {
          throw err;
        });
        
        const folderId = handle.name;
        await saveLibraryFolder(folderId, handle);
        
        setIsImporting(true);
        const files = await scanDirectory(handle);
        
        let newTracks: Track[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setImportProgress(Math.round(((i + 1) / files.length) * 100));
          setCurrentProcessingFile(`导入: ${file.name}`);
          try {
            const track = await parseFileToTrack(file);
            track.folderId = folderId;
            newTracks.push(track);
          } catch (e) { console.warn(e); }
          if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
        }

        setTracks(prev => [...prev, ...newTracks]);
        setImportedFolders(prev => [...prev, { id: folderId, name: handle.name, lastSync: Date.now(), trackCount: newTracks.length }]);
        
        if (newTracks.length > 0) {
          setCurrentTrackIndex(0);
          setView('player');
          setIsImportWindowOpen(false);
        }
        setIsImporting(false);
        setImportProgress(0);
      } else {
        fallbackInputRef.current?.click();
      }
    } catch (e) {
      console.warn("现代文件 API 被禁用或被取消，切换到传统模式", e);
      setIsImporting(false);
      fallbackInputRef.current?.click();
    }
  };

  const handleRemoveFolder = async (id: string) => {
    if (confirm('确定要从库中移除此文件夹吗？')) {
      await removeLibraryFolder(id);
      setImportedFolders(prev => prev.filter(f => f.id !== id));
      setTracks(prev => {
        const newTracks = prev.filter(t => t.folderId !== id);
        if (currentTrackIndex !== null) {
          if (prev[currentTrackIndex].folderId === id) {
            setIsPlaying(false);
            setCurrentTrackIndex(newTracks.length > 0 ? 0 : null);
          } else {
            const currentlyPlayingId = prev[currentTrackIndex].id;
            setCurrentTrackIndex(newTracks.findIndex(t => t.id === currentlyPlayingId));
          }
        }
        return newTracks;
      });
    }
  };

  const playTrack = useCallback((track: Track) => {
    const index = tracks.findIndex(t => t.id === track.id);
    if (index !== -1) {
      setCurrentTrackIndex(index);
      setView('player');
      setIsPlaying(true);
    }
  }, [tracks]);

  const moveTrack = useCallback((draggedId: string, targetId: string | null) => {
    const prevTracks = [...tracks]; 
    const fromIndex = prevTracks.findIndex(t => t.id === draggedId);
    if (fromIndex === -1) return;
    const [trackToMove] = prevTracks.splice(fromIndex, 1);
    const toIndex = targetId === null ? prevTracks.length : prevTracks.findIndex(t => t.id === targetId);
    prevTracks.splice(toIndex === -1 ? prevTracks.length : toIndex, 0, trackToMove);
    const playingTrackId = currentTrackIndex !== null ? tracks[currentTrackIndex].id : null;
    const newCurrentIndex = playingTrackId ? prevTracks.findIndex(t => t.id === playingTrackId) : currentTrackIndex;
    setTracks(prevTracks);
    setCurrentTrackIndex(newCurrentIndex);
  }, [tracks, currentTrackIndex]);

  useEffect(() => {
    if (currentTrack) {
      setIsStoryLoading(true);
      setTrackStory(''); 
      const timer = setTimeout(() => {
        getTrackStory(currentTrack.name, currentTrack.artist).then(story => {
          setTrackStory(story);
          setIsStoryLoading(false);
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentTrack]);

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
  }, [playbackMode, nextTrack]);

  return (
    <div className="flex h-screen overflow-hidden font-sans selection:bg-yellow-500/30">
      <input 
        type="file" 
        ref={fallbackInputRef} 
        className="hidden" 
        {...({ webkitdirectory: "true", directory: "", multiple: true } as any)} 
        onChange={(e) => {
          const files = Array.from(e.target.files || []) as File[];
          if (files.length > 0) { 
            setIsImporting(true);
            const folderId = "手动导入-" + Date.now();
            Promise.all(files.map(async (f) => {
              if (SUPPORTED_FORMATS.some(ext => f.name.toLowerCase().endsWith(ext))) {
                const t = await parseFileToTrack(f);
                t.folderId = folderId;
                return t;
              }
              return null;
            })).then(ts => {
              const validTracks = ts.filter(t => t !== null) as Track[];
              setTracks(prev => [...prev, ...validTracks]);
              setImportedFolders(prev => [...prev, { id: folderId, name: "手动导入文件", lastSync: Date.now(), trackCount: validTracks.length }]);
              if (currentTrackIndex === null && validTracks.length > 0) {
                setCurrentTrackIndex(0);
                setView('player');
              }
              setIsImporting(false);
              setIsImportWindowOpen(false);
            });
          }
          e.target.value = ''; 
        }} 
      />

      <ImportWindow 
        isOpen={isImportWindowOpen} 
        onClose={() => setIsImportWindowOpen(false)} 
        onImport={handleInitialImport} 
        onFallbackImport={() => fallbackInputRef.current?.click()}
        onRemoveFolder={handleRemoveFolder} 
        importedFolders={importedFolders} 
      />
      
      <div className="hidden md:flex flex-col h-full z-50">
          <Sidebar activeView={view} onViewChange={(v) => { setView(v); setNavigationRequest(null); }} trackCount={tracks.length} />
      </div>

      <main className="flex-1 flex flex-col relative pb-32 md:pb-28 bg-gradient-to-br from-[#1c1c1c] via-[#121212] to-[#0a0a0a]">
        {isImporting && (
          <div className="absolute top-0 left-0 right-0 z-[100] h-1.5 bg-zinc-900">
            <div className="h-full bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,1)] transition-all duration-300" style={{ width: `${importProgress}%` }} />
          </div>
        )}

        <header className="p-4 md:p-6 flex justify-between items-center z-50 relative gap-3">
          <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
             <div className="relative group max-w-md w-full">
                <input
                  type="text" placeholder="搜索曲目..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-full py-2 px-4 md:py-2.5 md:px-11 text-sm text-white focus:border-yellow-500 outline-none backdrop-blur-md transition-all"
                />
             </div>
             {isImporting && (
               <div className="hidden md:flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/5">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(234,179,8,1)]"></div>
                  <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest whitespace-nowrap truncate max-w-[200px]"> 同步中: {currentProcessingFile} </span>
               </div>
             )}
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <button onClick={() => handleSyncAll()} title="同步并清理失效曲目" disabled={isImporting} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-full transition-all active:scale-90 disabled:opacity-30 group">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`${isImporting ? 'animate-spin text-yellow-500' : 'group-hover:rotate-180 transition-transform duration-700'}`}>
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24L21 8"/><path d="M21 3v5h-5"/>
              </svg>
            </button>
            <button onClick={() => setIsImportWindowOpen(true)} className="bg-yellow-500 text-black px-4 md:px-6 py-2 md:py-2.5 rounded-full font-black text-[10px] md:text-xs shadow-xl uppercase tracking-widest active:scale-95 transition-all whitespace-nowrap">
              库管理
            </button>
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden">
            <div key={view} className="absolute inset-0 flex flex-col animate-in fade-in duration-700">
                {view === 'player' ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-10 p-4 md:p-8">
                    {/* 优化标题区域：移除 truncate，增加换行支持与艺术字样式 */}
                    <div className="text-center relative z-40 px-4 max-w-3xl min-h-[120px] flex flex-col justify-center">
                      <h2 className="text-3xl md:text-5xl lg:text-6xl font-black mb-4 leading-[1.1] md:leading-tight tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-zinc-500 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] [text-wrap:balance] line-clamp-2">
                        {currentTrack?.name || (tracks.length > 0 ? "准备播放" : "黑胶时光")}
                      </h2>
                      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 opacity-80">
                        <button 
                          onClick={() => { setNavigationRequest({ type: 'artists', name: currentTrack?.artist || '' }); setView('artists'); }} 
                          className="text-zinc-400 font-black uppercase tracking-[0.25em] text-[10px] md:text-xs hover:text-yellow-500 transition-colors"
                        >
                          {currentTrack?.artist || (tracks.length > 0 ? "等待开启旋律" : "享受纯净音质")}
                        </button>
                        {(currentTrack?.album || tracks.length > 0) && <span className="w-1.5 h-1.5 bg-zinc-800 rounded-full" />}
                        <span className="text-zinc-500 font-black uppercase tracking-[0.15em] text-[10px] md:text-xs truncate max-w-[280px]">
                          {currentTrack?.album || (tracks.length > 0 ? "选一支喜欢的歌吧" : "请先添加音乐文件夹")}
                        </span>
                      </div>
                    </div>
                    
                    <div className="relative flex flex-col items-center justify-center">
                        <SwipeableTrack onNext={nextTrack} onPrev={prevTrack} currentId={currentTrack?.id || 'empty'}>
                          <VinylRecord 
                            isPlaying={isPlaying} 
                            coverUrl={currentTrack?.coverUrl} 
                            intensity={audioIntensity} 
                            themeColor={rhythmColor} 
                          />
                        </SwipeableTrack>
                        
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-30">
                            <div className="relative w-[70vw] h-[70vw] max-w-[18rem] max-h-[18rem] md:w-96 md:h-96 flex-shrink-0">
                                <ToneArm isPlaying={isPlaying} progress={duration > 0 ? progress / duration : 0} />
                            </div>
                        </div>

                        {currentTrack?.bitrate && (
                          <div className="mt-8 px-5 py-2 rounded-full bg-white/5 border border-white/5 backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-1000">
                            <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)] ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
                            <div className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-widest text-zinc-500">
                               <span className="text-zinc-300">{Math.round(currentTrack.bitrate / 1000)} KBPS</span>
                               <span className="opacity-30">/</span>
                               <span className="text-zinc-500">{currentTrack.name.toLowerCase().endsWith('.flac') ? 'Lossless' : 'Hifi Audio'}</span>
                            </div>
                          </div>
                        )}
                    </div>
                    
                    <div className={`max-w-xs md:max-w-2xl text-center px-4 italic text-zinc-500 text-sm md:text-lg transition-opacity duration-1000 ${isStoryLoading ? 'opacity-20' : 'opacity-100'}`}>
                      {trackStory || (currentTrack ? "正在为您解读..." : (tracks.length > 0 ? "黑胶唱片已准备就绪。" : "开启一段黑胶之旅。"))}
                    </div>
                  </div>
                ) : (
                  <LibraryView 
                    view={view} tracks={tracks} onPlay={playTrack} favorites={favorites} 
                    navigationRequest={navigationRequest} onNavigationProcessed={() => setNavigationRequest(null)}
                    onToggleFavorite={(id) => setFavorites(prev => {
                      const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id);
                      localStorage.setItem('vinyl_favorites', JSON.stringify(Array.from(n)));
                      return n;
                    })}
                  />
                )}
            </div>
        </div>
        <audio ref={audioRef} src={currentTrack?.url} />
        <PlayerControls
          currentTrack={currentTrack} tracks={tracks} currentIndex={currentTrackIndex}
          isPlaying={isPlaying} onTogglePlay={() => { if (isPlaying) audioRef.current?.pause(); else audioRef.current?.play(); setIsPlaying(!isPlaying); }}
          onNext={nextTrack} onPrev={prevTrack} onSelectTrack={setCurrentTrackIndex} onRemoveTrack={(id) => setTracks(prev => prev.filter(t => t.id !== id))}
          progress={progress} duration={duration} volume={volume} onVolumeChange={(v) => { setVolume(v); if (audioRef.current) audioRef.current.volume = v; }}
          onSeek={(val) => audioRef.current && (audioRef.current.currentTime = val)}
          isFavorite={currentTrack ? favorites.has(currentTrack.id) : false} 
          favorites={favorites}
          onToggleFavorite={(id) => {
            const targetId = id || currentTrack?.id;
            if (!targetId) return;
            setFavorites(prev => {
              const n = new Set(prev);
              if (n.has(targetId)) n.delete(targetId); else n.add(targetId);
              localStorage.setItem('vinyl_favorites', JSON.stringify(Array.from(n)));
              return n;
            });
          }}
          playbackMode={playbackMode} onTogglePlaybackMode={() => setPlaybackMode(p => p === 'normal' ? 'shuffle' : p === 'shuffle' ? 'loop' : 'normal')}
          onReorder={moveTrack}
          themeColor="#eab308" 
        />
        <MobileNav activeView={view} onViewChange={(v) => { setView(v); setNavigationRequest(null); }} trackCount={tracks.length} themeColor="#eab308" />
      </main>
    </div>
  );
};

export default App;
