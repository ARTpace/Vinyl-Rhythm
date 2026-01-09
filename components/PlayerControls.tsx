
import React, { useState, useEffect, useRef } from 'react';
import { Track } from '../types';
import { formatTime } from '../utils/audioParser';

interface PlayerControlsProps {
  currentTrack: Track | null;
  tracks: Track[];
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
  favorites?: Set<string>;
  playbackMode: 'normal' | 'shuffle' | 'loop';
  onTogglePlaybackMode: () => void;
  onReorder: (draggedId: string, targetId: string | null) => void;
  themeColor?: string;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
  currentTrack,
  tracks,
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
  favorites = new Set(),
  playbackMode,
  onTogglePlaybackMode,
  onReorder,
  themeColor = '#eab308'
}) => {
  const [showQueue, setShowQueue] = useState(false);
  const [lastVolume, setLastVolume] = useState(0.8);
  const queueEndRef = useRef<HTMLDivElement>(null);
  const queueRef = useRef<HTMLDivElement>(null);
  const [isDraggingOverQueueBtn, setIsDraggingOverQueueBtn] = useState(false);

  if (!currentTrack) return null;

  const progressPercent = (progress / duration) * 100 || 0;

  const handleToggleMute = () => {
    if (volume > 0) {
      setLastVolume(volume);
      onVolumeChange(0);
    } else {
      onVolumeChange(lastVolume || 0.8);
    }
  };

  const getVolumeIcon = () => {
    if (volume === 0) return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"/>
      </svg>
    );
    if (volume < 0.5) return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.75"/>
      </svg>
    );
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
      </svg>
    );
  };

  const handleDragStart = (e: React.DragEvent, trackId: string) => {
    e.dataTransfer.setData('text/plain', trackId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleQueueButtonDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDraggingOverQueueBtn) setIsDraggingOverQueueBtn(true);
  };

  const handleQueueButtonDragLeave = () => {
    setIsDraggingOverQueueBtn(false);
  };

  const handleQueueButtonDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverQueueBtn(false);
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId) {
      onReorder(draggedId, null);
      setShowQueue(true);
      setTimeout(() => {
        queueEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleListDrop = (e: React.DragEvent, targetTrackId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId !== targetTrackId) {
      onReorder(draggedId, targetTrackId);
    }
  };

  const metallicPanelClass = "bg-[#1a1a1a] border-t border-[#333] shadow-[0_-5px_20px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)]";
  const insetButtonClass = (active: boolean) => `
    relative flex items-center justify-center rounded-full transition-all duration-150
    ${active 
      ? 'bg-[#111] shadow-[inset_0_2px_4px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.1)]' 
      : 'bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] text-zinc-500 hover:text-zinc-300 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)] active:translate-y-[1px]'
    }
  `;
  const convexButtonClass = `
    relative flex items-center justify-center rounded-full bg-gradient-to-br from-[#333] via-[#222] to-[#111]
    shadow-[0_4px_8px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.5)]
    active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)] active:translate-y-[1px] active:bg-gradient-to-br active:from-[#222] active:to-[#111]
    transition-all duration-100 group border border-[#111]
  `;
  const trackGrooveClass = "bg-[#0a0a0a] rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.05)]";
  const metallicThumbClass = "bg-gradient-to-b from-[#ccc] to-[#888] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.8)] border border-[#555]";

  return (
    <>
      {showQueue && (
        <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowQueue(false)} />
      )}

      <div 
        ref={queueRef}
        className={`fixed right-0 md:right-6 bottom-16 md:bottom-28 w-full md:w-96 bg-[#161616] md:border border-[#333] rounded-t-3xl md:rounded-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.9)] z-[90] transform transition-all duration-300 flex flex-col ${showQueue ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`} 
        style={{ maxHeight: '70vh' }}
      >
        <div className="p-4 border-b border-[#2a2a2a] flex justify-between items-center bg-gradient-to-b from-[#222] to-[#161616] rounded-t-3xl cursor-pointer" onClick={() => setShowQueue(false)}>
          <h3 className="text-zinc-200 font-bold text-sm tracking-widest uppercase pl-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shadow-[0_0_5px_rgba(234,179,8,0.8)]" style={{ backgroundColor: themeColor }}></div>
            Playlist
          </h3>
          <span className="text-[#555] text-[10px] font-mono border border-[#333] px-2 py-0.5 rounded shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] bg-[#111]">{tracks.length}</span>
        </div>
        <div className="overflow-y-auto p-2 flex-1 custom-scrollbar bg-[#111]">
          {tracks.map((track, idx) => (
            <div 
              key={track.id}
              draggable
              onDragStart={(e) => handleDragStart(e, track.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleListDrop(e, track.id)}
              className={`
                 group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border mb-1
                 ${idx === currentIndex 
                    ? 'bg-[#1a1a1a] border-[#333] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]' 
                    : 'border-transparent hover:bg-[#1a1a1a] hover:border-[#222]'}
              `}
              onClick={() => onSelectTrack(idx)}
            >
              {idx === currentIndex && isPlaying ? (
                 <div className="w-4 h-4 flex items-end justify-center gap-0.5 shrink-0">
                    <div className="w-0.5 animate-[bounce_1s_infinite] h-2" style={{ backgroundColor: themeColor }}></div>
                    <div className="w-0.5 animate-[bounce_1.2s_infinite] h-4" style={{ backgroundColor: themeColor }}></div>
                    <div className="w-0.5 animate-[bounce_0.8s_infinite] h-3" style={{ backgroundColor: themeColor }}></div>
                 </div>
              ) : (
                 <span className={`text-[10px] font-mono w-4 text-center ${idx === currentIndex ? 'text-yellow-500' : 'text-zinc-700'}`} style={idx === currentIndex ? { color: themeColor } : {}}>{idx + 1}</span>
              )}
              
              <div className="flex-1 min-w-0">
                <div className={`font-medium text-sm truncate ${idx === currentIndex ? 'shadow-black drop-shadow-md' : 'text-zinc-400'}`} style={idx === currentIndex ? { color: themeColor } : {}}>{track.name}</div>
                <div className="text-[10px] text-zinc-600 truncate">{track.artist}</div>
              </div>
            </div>
          ))}
          <div ref={queueEndRef} />
        </div>
      </div>

      <div className={`hidden md:flex fixed bottom-0 left-0 right-0 h-28 px-8 items-center justify-between z-[100] ${metallicPanelClass}`}>
        <div className="flex items-center gap-5 w-1/4 min-w-0">
           <div className="w-16 h-16 rounded-md bg-[#111] shadow-[inset_0_2px_5px_rgba(0,0,0,0.8),0_1px_0_rgba(255,255,255,0.1)] p-1 flex-shrink-0 relative overflow-hidden group">
              {currentTrack.coverUrl ? (
                <img src={currentTrack.coverUrl} alt="" className={`w-full h-full object-cover rounded-sm opacity-90 transition-transform duration-[10s] ease-linear ${isPlaying ? 'scale-110' : 'scale-100'}`} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-900 rounded-sm" style={{ backgroundColor: themeColor + '22' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none rounded-sm"></div>
           </div>

           <div className="min-w-0 flex flex-col gap-1">
              <h4 className="font-medium truncate text-sm tracking-wide drop-shadow-[0_0_2px_rgba(234,179,8,0.5)]" style={{ color: themeColor }}>{currentTrack.name}</h4>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider truncate">{currentTrack.artist}</p>
           </div>
           
           <button onClick={() => onToggleFavorite()} className={`w-8 h-8 ${insetButtonClass(isFavorite)}`} style={isFavorite ? { color: themeColor } : {}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
           </button>
        </div>

        <div className="flex flex-col items-center justify-center gap-1 w-2/4 h-full pt-1">
           <div className="w-full flex items-center gap-4 px-4 group select-none mb-1">
              <span className="text-[10px] text-[#444] font-mono font-bold min-w-[35px] text-right drop-shadow-[0_1px_0_rgba(255,255,255,0.05)]">{formatTime(progress)}</span>
              <div className={`flex-1 h-2 ${trackGrooveClass} relative cursor-pointer`} onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const percent = (e.clientX - rect.left) / rect.width;
                    onSeek(percent * duration);
              }}>
                 <div className="absolute top-0 left-0 h-full rounded-full opacity-80 shadow-[0_0_5px_rgba(234,179,8,0.3)]" style={{ width: `${progressPercent}%`, backgroundColor: themeColor }}></div>
                 <div className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 ${metallicThumbClass} -ml-2 cursor-grab active:cursor-grabbing hover:scale-110 transition-transform`} style={{ left: `${progressPercent}%` }}>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#111] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"></div>
                 </div>
              </div>
              <span className="text-[10px] text-[#444] font-mono font-bold min-w-[35px] drop-shadow-[0_1px_0_rgba(255,255,255,0.05)]">{formatTime(duration)}</span>
           </div>

           <div className="flex items-center gap-6">
              <button onClick={onTogglePlaybackMode} className={`w-8 h-8 ${insetButtonClass(playbackMode !== 'normal')}`} style={playbackMode !== 'normal' ? { color: themeColor } : {}}>
                {playbackMode !== 'normal' && (
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full shadow-[0_0_4px_currentColor]" style={{ backgroundColor: themeColor }}></div>
                )}
                {playbackMode === 'shuffle' ? (
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>
                ) : playbackMode === 'loop' ? (
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 22v-6h6"/><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 2v6h-6"/></svg>
                ) : (
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-50"><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 22v-6h6"/><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 2v6h-6"/></svg>
                )}
              </button>

              <button onClick={onPrev} className={`w-10 h-10 ${convexButtonClass}`}>
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="text-zinc-400 group-hover:text-zinc-200 group-active:text-yellow-600"><path d="M19 20L9 12l10-8v16zM5 19V5h2v14H5z"/></svg>
              </button>

              <button onClick={onTogglePlay} className="w-16 h-16 rounded-full flex items-center justify-center relative transition-all group active:scale-[0.98]">
                <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[#444] to-[#111] shadow-[0_10px_20px_rgba(0,0,0,0.6)]"></div>
                <div className="absolute inset-1 rounded-full bg-gradient-to-br from-[#2a2a2a] via-[#1a1a1a] to-[#000] border-t border-[#444] border-b border-black shadow-[inset_0_2px_5px_rgba(255,255,255,0.05)] flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full opacity-20 bg-[repeating-conic-gradient(#333_0deg,#222_10deg,#333_20deg)] mix-blend-overlay"></div>
                    <div className={`transition-colors ${isPlaying ? 'shadow-[0_0_10px_rgba(234,179,8,0.2)]' : 'text-zinc-300'}`} style={isPlaying ? { color: themeColor } : {}}>
                        {isPlaying ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="filter drop-shadow-[0_-1px_1px_rgba(0,0,0,0.8)]"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                        ) : (
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="filter drop-shadow-[0_-1px_1px_rgba(0,0,0,0.8)] ml-1"><path d="M5 3l14 9-14 9V3z"/></svg>
                        )}
                    </div>
                </div>
              </button>

              <button onClick={onNext} className={`w-10 h-10 ${convexButtonClass}`}>
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="text-zinc-400 group-hover:text-zinc-200 group-active:text-yellow-600"><path d="M5 4l10 8-10 8V4zM19 5v14h-2V5h2z"/></svg>
              </button>

              <button onClick={() => setShowQueue(!showQueue)} className={`w-8 h-8 ${insetButtonClass(showQueue)}`} style={showQueue ? { color: themeColor } : {}}>
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
           </div>
        </div>

        <div className="flex items-center gap-5 w-1/4 justify-end pl-4">
           <div className="flex items-center gap-3 group w-full max-w-[140px]">
              <button onClick={handleToggleMute} className="text-[#444] transition-colors drop-shadow-[0_1px_0_rgba(255,255,255,0.05)] active:scale-95 hover:text-white" style={volume > 0 ? { '--hover-color': themeColor } as any : {}}>
                 {getVolumeIcon()}
              </button>
              <div className={`flex-1 h-1.5 ${trackGrooveClass} relative cursor-pointer`}>
                 <div className="absolute top-0 left-0 h-full rounded-full" style={{ width: `${volume * 100}%`, backgroundColor: themeColor }}></div>
                 <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => onVolumeChange(parseFloat(e.target.value))} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </div>
           </div>
           
           <div className={`p-1.5 rounded-xl transition-all border-2 border-dashed ${isDraggingOverQueueBtn ? 'border-yellow-500 bg-yellow-500/10' : 'border-transparent'}`} onDragOver={handleQueueButtonDragOver} onDragLeave={handleQueueButtonDragLeave} onDrop={handleQueueButtonDrop}>
              <button onClick={() => setShowQueue(!showQueue)} className={`w-8 h-8 ${insetButtonClass(false)}`}>
                 <span className="text-[9px] font-bold">Q</span>
              </button>
           </div>
        </div>
      </div>

      <div className="flex md:hidden fixed bottom-16 left-0 right-0 h-14 bg-[#1e1e1e] border-t border-white/5 z-[60] items-center px-3 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
         <div className="absolute top-0 left-0 right-0 h-[2px] bg-zinc-800" onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                onSeek(percent * duration);
            }}>
            <div className="h-full" style={{ width: `${progressPercent}%`, backgroundColor: themeColor }}></div>
         </div>
         <div className="relative w-10 h-10 flex-shrink-0 mr-3">
             <div className={`w-full h-full rounded-full overflow-hidden border border-white/10 ${isPlaying ? 'animate-spin-slow' : ''}`} style={{ animationDuration: '4s' }}>
                {currentTrack.coverUrl ? (
                    <img src={currentTrack.coverUrl} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                        <div className="w-3 h-3 bg-black rounded-full border border-zinc-700"></div>
                    </div>
                )}
             </div>
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="w-1.5 h-1.5 bg-[#1e1e1e] rounded-full border border-zinc-700"></div>
             </div>
         </div>
         <div className="flex-1 min-w-0 flex flex-col justify-center mr-2" onClick={() => onSelectTrack(currentIndex || 0)}>
             <span className="text-white text-xs font-bold truncate leading-tight">{currentTrack.name}</span>
             <span className="text-zinc-500 text-[10px] truncate leading-tight">{currentTrack.artist}</span>
         </div>
         <div className="flex items-center gap-3">
             <button onClick={onTogglePlay} className="text-white p-1">
                 {isPlaying ? (
                     <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                 ) : (
                     <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                 )}
             </button>
             <button onClick={onNext} className="text-zinc-400 p-1">
                 <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
             </button>
             <button onClick={() => setShowQueue(!showQueue)} className={`p-1 ${showQueue ? 'text-yellow-500' : 'text-zinc-400'}`} style={showQueue ? { color: themeColor } : {}}>
                 <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
             </button>
         </div>
      </div>
    </>
  );
};

export default PlayerControls;
