
import React, { useState, useEffect, useRef } from 'react';
import { Track, AppSettings, Playlist } from '../types';
import { formatTime } from '../utils/audioParser';

interface PlayerControlsProps {
  currentTrack: Track | null;
  tracks: Track[];
  historyTracks?: Track[]; 
  currentIndex: number | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSelectTrack: (index: number) => void;
  onRemoveTrack: (trackId: string) => void;
  progress: number;
  duration: number;
  volume: number;
  onVolumeChange: (val: number) => void;
  onSeek: (val: number) => void;
  isFavorite: boolean;
  onToggleFavorite: (trackId?: string) => void;
  onAddToPlaylist: (track: Track) => void;
  onNavigate?: (type: 'artists' | 'albums' | 'folders' | 'artistProfile', name: string) => void;
  favorites?: Set<string>;
  playbackMode: 'normal' | 'shuffle' | 'loop';
  onTogglePlaybackMode: () => void;
  onReorder: (draggedId: string, targetId: string | null) => void;
  onClearHistory?: () => void;
  onClearQueue?: () => void;
  onPlayFromHistory?: (track: Track) => void;
  onSaveQueueAsPlaylist?: () => void;
  themeColor?: string;
  settings?: AppSettings; 
  displayConverter?: (str: string) => string; 
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
    currentTrack,
    tracks,
    historyTracks = [],
    currentIndex,
    isPlaying,
    onTogglePlay,
    onNext,
    onPrev,
    onSelectTrack,
    onRemoveTrack,
    progress,
    duration,
    volume,
    onVolumeChange,
    onSeek,
    isFavorite,
    onToggleFavorite,
    onAddToPlaylist,
    onNavigate,
    favorites = new Set(),
    playbackMode,
    onTogglePlaybackMode,
    onReorder,
    onClearHistory,
    onClearQueue,
    onPlayFromHistory,
    onSaveQueueAsPlaylist,
    themeColor = '#eab308',
    settings,
    displayConverter
  }) => {
  const [showQueue, setShowQueue] = useState(false);
  const [queueTab, setQueueTab] = useState<'queue' | 'history'>('queue');
  const [lastVolume, setLastVolume] = useState(0.8);
  const [isQueuePulsing, setIsQueuePulsing] = useState(false);
  const prevQueueLength = useRef(tracks.length);
  
  const [draggedOverId, setDraggedOverId] = useState<string | null>(null);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [localProgress, setLocalProgress] = useState(progress);
  const dragProgressRef = useRef(progress);
  const lastInteractionTimeRef = useRef(0);
  
  const progressBarRef = useRef<HTMLDivElement>(null);
  const mobileProgressBarRef = useRef<HTMLDivElement>(null);

  const convert = (s: string) => displayConverter ? displayConverter(s) : s;

  useEffect(() => {
    if (tracks.length > prevQueueLength.current) {
        setIsQueuePulsing(true);
        const timer = setTimeout(() => setIsQueuePulsing(false), 400);
        return () => clearTimeout(timer);
    }
    prevQueueLength.current = tracks.length;
  }, [tracks.length]);

  useEffect(() => {
    const now = Date.now();
    if (!isDraggingSeek && (now - lastInteractionTimeRef.current > 500)) {
      setLocalProgress(progress);
      dragProgressRef.current = progress;
    }
  }, [progress, isDraggingSeek]);

  const progressPercent = (localProgress / duration) * 100 || 0;

  const handleToggleMute = () => {
    if (volume > 0) {
      setLastVolume(volume);
      onVolumeChange(0);
    } else {
      onVolumeChange(lastVolume || 0.8);
    }
  };

  const getVolumeIcon = () => {
    const iconSize = "22";
    const stroke = "2.2";
    if (volume === 0) return <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}><path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"/></svg>;
    if (volume < 0.5) return <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}><path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.75"/></svg>;
    return <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>;
  };

  const handleSeekStart = (e: React.PointerEvent) => {
    if (!duration) return;
    e.preventDefault();
    setIsDraggingSeek(true);
    lastInteractionTimeRef.current = Date.now();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const newProgress = (x / rect.width) * duration;
    setLocalProgress(newProgress);
    dragProgressRef.current = newProgress;
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handleSeekMove = (e: React.PointerEvent) => {
    if (!isDraggingSeek || !duration) return;
    const rect = progressBarRef.current?.getBoundingClientRect() || mobileProgressBarRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const newProgress = (x / rect.width) * duration;
    setLocalProgress(newProgress);
    dragProgressRef.current = newProgress;
  };

  const handleSeekEnd = () => {
    if (!isDraggingSeek) return;
    lastInteractionTimeRef.current = Date.now();
    onSeek(dragProgressRef.current);
    setIsDraggingSeek(false);
  };

  const formatHistoryTime = (ts?: number) => {
    if (!ts) return '';
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff/60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h`;
    return new Date(ts).toLocaleDateString();
  };

  const metallicPanelClass = "bg-[#1a1a1a] border-t border-[#333] shadow-[0_-5px_20px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)]";
  const insetButtonClass = (active: boolean) => `
    relative flex items-center justify-center rounded-full transition-all duration-150
    ${active 
      ? 'bg-[#111] shadow-[inset_0_2px_4px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.1)]' 
      : 'bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] text-zinc-500 hover:text-zinc-300 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)] active:translate-y-[1px]'
    }
  `;
  const convexButtonClass = `relative flex items-center justify-center rounded-full bg-gradient-to-br from-[#333] via-[#222] to-[#111] shadow-[0_4px_8px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.5)] active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)] active:translate-y-[1px] transition-all duration-100 group border border-[#111]`;
  const trackGrooveClass = "bg-[#0a0a0a] rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.05)]";
  const metallicThumbClass = "bg-gradient-to-b from-[#ccc] to-[#888] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.8)] border border-[#555]";

  const handleClearAction = () => {
    if (queueTab === 'queue') {
        onClearQueue?.();
    } else {
        onClearHistory?.();
    }
  };

  return (
    <>
      {showQueue && <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowQueue(false)} />}
      
      <div className={`fixed right-0 md:right-6 bottom-16 md:bottom-28 w-full md:w-[480px] bg-[#161616] md:border border-[#333] rounded-t-3xl md:rounded-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.9)] z-[90] transform transition-all duration-300 flex flex-col overflow-hidden ${showQueue ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`} style={{ height: '60vh' }}>
        
        <div className="p-3 border-b border-[#2a2a2a] bg-gradient-to-b from-[#222] to-[#161616] shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex bg-black/40 p-1 rounded-2xl flex-1 border border-white/5">
               <button 
                  onClick={() => setQueueTab('queue')}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all ${queueTab === 'queue' ? 'bg-zinc-800 text-yellow-500 shadow-lg border border-white/10' : 'text-zinc-600 hover:text-zinc-400'}`}
               >
                  {convert('当前队列')}
               </button>
               <button 
                  onClick={() => setQueueTab('history')}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all ${queueTab === 'history' ? 'bg-zinc-800 text-yellow-500 shadow-lg border border-white/10' : 'text-zinc-600 hover:text-zinc-400'}`}
               >
                  {convert('播放历史')}
               </button>
            </div>
            <div className="flex items-center gap-2">
              {queueTab === 'queue' && (
                <button 
                  onClick={onSaveQueueAsPlaylist}
                  disabled={tracks.length === 0}
                  title="存为歌单"
                  className="w-10 h-10 flex items-center justify-center rounded-full transition-all shrink-0 border border-white/5 bg-white/5 active:scale-90 disabled:opacity-20 disabled:cursor-not-allowed text-zinc-400 hover:bg-yellow-500/20 hover:text-yellow-500 hover:border-yellow-500/20"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                </button>
              )}
              <button 
                onClick={handleClearAction}
                disabled={(queueTab === 'queue' && tracks.length === 0) || (queueTab === 'history' && historyTracks.length === 0)}
                title={convert(queueTab === 'queue' ? '清空队列' : '清空历史')}
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all shrink-0 border border-white/5 bg-white/5 active:scale-90 ${((queueTab === 'queue' && tracks.length === 0) || (queueTab === 'history' && historyTracks.length === 0)) ? 'opacity-10 cursor-not-allowed text-zinc-600' : 'text-zinc-400 hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/20'}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-2 flex-1 custom-scrollbar bg-[#111]">
          {queueTab === 'queue' ? (
            tracks.length > 0 ? (
                tracks.map((track, idx) => {
                    const isFav = favorites.has(track.id);
                    return (
                        <div 
                        key={track.id} 
                        draggable 
                        onDragStart={(e) => { e.dataTransfer.setData('trackId', track.id); }}
                        onDragOver={(e) => { e.preventDefault(); setDraggedOverId(track.id); }}
                        onDrop={(e) => { 
                            e.preventDefault(); 
                            setDraggedOverId(null); 
                            const draggedId = e.dataTransfer.getData('trackId');
                            if (draggedId !== track.id) onReorder(draggedId, track.id);
                        }}
                        className={`group flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all border mb-1 relative ${idx === currentIndex ? 'bg-[#1a1a1a] border-[#333]' : 'border-transparent hover:bg-white/[0.03]'} ${draggedOverId === track.id ? 'border-t-2 border-t-yellow-500 pt-6' : ''}`}
                        onClick={() => onSelectTrack(idx)}
                        >
                        <div className="w-8 flex items-center justify-center shrink-0">
                            <span className={`text-[11px] font-mono text-center ${idx === currentIndex ? 'text-yellow-500' : 'text-zinc-700'}`}>{String(idx + 1).padStart(2, '0')}</span>
                        </div>
                        <div className="w-11 h-11 rounded-xl bg-zinc-800 overflow-hidden shrink-0 shadow-lg">
                            {track.coverUrl ? <img src={track.coverUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" /> : <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-700"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/></svg></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className={`font-bold text-sm truncate mb-0.5 tracking-tight ${idx === currentIndex ? 'text-yellow-500' : 'text-zinc-100'}`}>{convert(track.name)}</div>
                            <div className="flex items-center gap-1 truncate">
                                {track.artist.split(' / ').map((artist, index, arr) => (
                                    <React.Fragment key={index}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); if (onNavigate) { onNavigate('artistProfile', artist.trim()); setShowQueue(false); } }}
                                            className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-left hover:text-yellow-500 transition-colors flex-shrink-0"
                                        >
                                            {convert(artist.trim())}
                                        </button>
                                        {index < arr.length - 1 && <span className="text-zinc-600 text-[10px] font-bold">/</span>}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={(e) => { e.stopPropagation(); onToggleFavorite(track.id); }}
                                className={`p-2 rounded-full transition-all active:scale-75 ${isFav ? 'text-red-500 opacity-100' : 'text-zinc-800 hover:text-zinc-400'}`}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="3"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onRemoveTrack(track.id); }}
                                className="p-2 rounded-full transition-all active:scale-75 text-zinc-800 hover:text-red-400"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                            </button>
                        </div>
                        <div className="text-[11px] font-mono text-zinc-600 group-hover:text-zinc-400 tabular-nums w-12 text-right shrink-0">{formatTime(track.duration || 0)}</div>
                        </div>
                    );
                })
            ) : (
                <div className="h-full flex flex-col items-center justify-center gap-5 opacity-20 animate-in fade-in zoom-in duration-700">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
                    <p className="text-[11px] font-black uppercase tracking-[0.4em]">{convert('播放队列为空')}</p>
                </div>
            )
          ) : (
            historyTracks.length > 0 ? (
                historyTracks.map((track, idx) => {
                const isFav = favorites.has(track.id);
                return (
                    <div 
                    key={track.id + (track.historyTime || idx)} 
                    className="group flex items-center gap-4 p-3 rounded-2xl cursor-pointer hover:bg-white/[0.03] transition-all mb-1 border border-transparent"
                    onClick={() => onPlayFromHistory?.(track)}
                    >
                    <div className="w-8 flex items-center justify-center shrink-0 text-zinc-700">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-zinc-800 overflow-hidden shrink-0 shadow-lg">
                        {track.coverUrl ? <img src={track.coverUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" /> : <div className="w-full h-full bg-zinc-900" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate mb-0.5 text-zinc-300 group-hover:text-white tracking-tight">{convert(track.name)}</div>
                        <div className="flex items-center gap-1 truncate">
                            {track.artist.split(' / ').map((artist, index, arr) => (
                                <React.Fragment key={index}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); if (onNavigate) { onNavigate('artistProfile', artist.trim()); setShowQueue(false); } }}
                                        className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-left hover:text-yellow-500 transition-colors flex-shrink-0"
                                    >
                                        {convert(artist.trim())}
                                    </button>
                                    {index < arr.length - 1 && <span className="text-zinc-600 text-[10px] font-bold">/</span>}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onToggleFavorite(track.id); }}
                            className={`p-2 rounded-full transition-all active:scale-75 ${isFav ? 'text-red-500 opacity-100' : 'text-zinc-800 hover:text-zinc-400'}`}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="3"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                        </button>
                    </div>
                    <div className="text-[10px] font-black text-zinc-600 group-hover:text-zinc-500 uppercase tracking-tighter w-12 text-right shrink-0">
                        {formatHistoryTime(track.historyTime)}
                    </div>
                    </div>
                );
                })
            ) : (
                <div className="h-full flex flex-col items-center justify-center gap-5 opacity-20">
                   <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                   <p className="text-[11px] font-black uppercase tracking-[0.4em]">{convert('暂无播放历史')}</p>
                </div>
            )
          )}
        </div>
        
        <div className="h-4 bg-gradient-to-t from-[#111] to-transparent shrink-0 pointer-events-none" />
      </div>

      <div className={`hidden md:flex fixed bottom-0 left-0 right-0 h-28 px-8 items-center justify-between z-[100] ${metallicPanelClass}`}>
        <div className="flex items-center gap-5 w-1/4 min-w-0">
           <div className="w-16 h-16 rounded-md bg-[#111] p-1 flex-shrink-0 relative overflow-hidden group">
              {currentTrack?.coverUrl ? <img src={currentTrack.coverUrl} className="w-full h-full object-cover rounded-sm" /> : <div className="w-full h-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 rounded-sm"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg></div>}
           </div>
           <div className="min-w-0 flex flex-col gap-1 pr-2">
              <h4 className="font-bold truncate text-sm text-yellow-500 select-none whitespace-nowrap overflow-hidden">{convert(currentTrack?.name || "等待选择曲目")}</h4>
              <div className="flex items-center gap-1.5 truncate">
                {currentTrack?.artist ? (
                  currentTrack.artist.split(' / ').map((artist, index, arr) => (
                    <React.Fragment key={index}>
                      <button onClick={() => onNavigate?.('artistProfile', artist.trim())} className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider text-left hover:text-yellow-500 transition-colors flex-shrink-0">
                        {convert(artist.trim())}
                      </button>
                      {index < arr.length - 1 && <span className="text-zinc-700 text-[10px] font-bold">/</span>}
                    </React.Fragment>
                  ))
                ) : (
                  <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider truncate text-left">{convert("Vinyl Rhythm")}</span>
                )}
              </div>
           </div>
           <button onClick={() => onToggleFavorite()} disabled={!currentTrack} className={`w-8 h-8 flex-shrink-0 ${insetButtonClass(isFavorite)} ${isFavorite ? 'text-yellow-500' : ''} disabled:opacity-30`}><svg width="14" height="14" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></button>
           <button onClick={() => currentTrack && onAddToPlaylist(currentTrack)} disabled={!currentTrack} className={`w-8 h-8 flex-shrink-0 ${insetButtonClass(false)} disabled:opacity-30`}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg></button>
        </div>

        <div className="flex flex-col items-center justify-center gap-1 w-2/4 h-full pt-1">
           <div className="w-full flex items-center gap-4 px-4 group select-none mb-1">
              <span className="text-sm text-zinc-400 font-mono font-bold min-w-[50px] text-right">{formatTime(localProgress)}</span>
              <div ref={progressBarRef} onPointerDown={handleSeekStart} onPointerMove={handleSeekMove} onPointerUp={handleSeekEnd} onPointerCancel={handleSeekEnd} className={`flex-1 h-2 ${trackGrooveClass} relative cursor-pointer touch-none`}>
                 <div className="absolute top-0 left-0 h-full bg-yellow-500 rounded-full opacity-80" style={{ width: `${progressPercent}%` }}></div>
                 <div className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 ${metallicThumbClass} -ml-2 transition-transform ${isDraggingSeek ? 'scale-125' : 'hover:scale-110'}`} style={{ left: `${progressPercent}%` }}>
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#111]"></div>
                 </div>
              </div>
              <span className="text-sm text-zinc-400 font-mono font-bold min-w-[50px]">{formatTime(duration)}</span>
           </div>
           <div className="flex items-center gap-6">
              <button onClick={onTogglePlaybackMode} className={`w-8 h-8 ${insetButtonClass(playbackMode !== 'normal')} ${playbackMode !== 'normal' ? 'text-yellow-500' : ''}`}>
                {playbackMode === 'shuffle' ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 22v-6h6"/><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 2v6h-6"/></svg>}
              </button>
              <button onClick={onPrev} disabled={tracks.length === 0} className={`w-10 h-10 ${convexButtonClass} disabled:opacity-30`}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 20L9 12l10-8v16zM5 19V5h2v14H5z"/></svg></button>
              <button onClick={onTogglePlay} disabled={tracks.length === 0} className="w-16 h-16 rounded-full flex items-center justify-center relative active:scale-[0.98] disabled:opacity-50">
                <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[#444] to-[#111]"></div>
                <div className="absolute inset-1 rounded-full bg-gradient-to-br from-[#2a2a2a] via-[#1a1a1a] to-[#000] flex items-center justify-center">
                    <div className={`transition-colors ${isPlaying ? 'text-yellow-500' : 'text-zinc-300'}`}>
                        {isPlaying ? <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> : <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><path d="M5 3l14 9-14 9V3z"/></svg>}
                    </div>
                </div>
              </button>
              <button onClick={onNext} disabled={tracks.length === 0} className={`w-10 h-10 ${convexButtonClass} disabled:opacity-30`}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4l10 8-10 8V4zM19 5v14h-2V5h2z"/></svg></button>
              <button 
                id="queue-target"
                onClick={() => setShowQueue(!showQueue)} 
                className={`w-8 h-8 ${insetButtonClass(showQueue)} ${showQueue ? 'text-yellow-500' : ''} ${isQueuePulsing ? 'animate-pulse-once' : ''}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
           </div>
        </div>

        <div className="flex items-center gap-5 w-1/4 justify-end pl-4">
           <div className="flex items-center gap-4 w-full max-w-[200px]">
              <button onClick={handleToggleMute} className="text-[#555] hover:text-white transition-colors">
                {getVolumeIcon()}
              </button>
              <div className={`flex-1 h-2 ${trackGrooveClass} relative cursor-pointer group/vol`}>
                <div className="absolute top-0 left-0 h-full bg-yellow-500 rounded-full" style={{ width: `${volume * 100}%` }}></div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={volume} 
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))} 
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" 
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/vol:opacity-100 transition-opacity pointer-events-none -ml-1.5"
                  style={{ left: `${volume * 100}%` }}
                />
              </div>
           </div>
        </div>
      </div>
    </>
  );
};

export default PlayerControls;
