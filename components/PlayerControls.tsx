
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
  onToggleFavorite: (trackId?: string) => void; // 允许指定 ID
  favorites?: Set<string>; // 传入全部收藏列表
  playbackMode: 'normal' | 'shuffle' | 'loop';
  onTogglePlaybackMode: () => void;
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
  onTogglePlaybackMode
}) => {
  const [showQueue, setShowQueue] = useState(false);
  const [lastVolume, setLastVolume] = useState(0.8);
  const queueEndRef = useRef<HTMLDivElement>(null);

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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"/>
      </svg>
    );
    if (volume < 0.5) return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07"/>
      </svg>
    );
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
      </svg>
    );
  };

  return (
    <>
      {/* 播放队列侧边面板 */}
      <div 
        className={`fixed top-0 right-0 h-[calc(100vh-112px)] w-80 bg-zinc-950/90 backdrop-blur-2xl border-l border-white/5 z-[60] shadow-2xl transition-all duration-500 flex flex-col ${
          showQueue ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-white font-black text-xl tracking-tight">播放队列</h3>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">
              {tracks.length} Tracks in Line
            </p>
          </div>
          <button 
            onClick={() => setShowQueue(false)}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {tracks.map((track, idx) => {
            const isTrackFavorite = favorites.has(track.id);
            return (
              <div 
                key={track.id}
                onClick={() => onSelectTrack(idx)}
                className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-l-4 ${
                  currentIndex === idx 
                  ? 'bg-yellow-500/10 border-yellow-500' 
                  : 'hover:bg-white/5 border-transparent'
                }`}
              >
                <div className="w-10 h-10 bg-zinc-800 rounded-lg overflow-hidden shrink-0 border border-white/5">
                  {track.coverUrl ? (
                    <img src={track.coverUrl} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-20">🎵</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${currentIndex === idx ? 'text-yellow-500' : 'text-white'}`}>
                    {track.name}
                  </p>
                  <p className="text-zinc-500 text-[10px] font-bold uppercase truncate">
                    {track.artist}
                  </p>
                </div>
                
                <div className="flex items-center">
                   {/* 队列中的收藏按钮 */}
                   <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(track.id);
                    }}
                    className={`p-2 transition-all ${isTrackFavorite ? 'text-red-500 opacity-100' : 'text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-400'}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={isTrackFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5">
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                    </svg>
                  </button>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTrack(track.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-red-400 transition-all"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
          <div ref={queueEndRef} />
        </div>
      </div>

      <div className="h-28 bg-[#0a0a0a]/95 backdrop-blur-2xl border-t border-white/5 px-8 flex items-center justify-between gap-8 fixed bottom-0 left-0 right-0 z-50 shadow-2xl shadow-black/50">
        <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/3 to-transparent pointer-events-none" />

        <div className="flex items-center gap-5 w-1/4 relative z-10">
          <div className="w-16 h-16 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-xl overflow-hidden flex-shrink-0 shadow-xl border border-zinc-700/50 flex items-center justify-center group relative">
            {currentTrack.coverUrl ? (
              <img
                src={currentTrack.coverUrl}
                className={`w-full h-full object-cover ${isPlaying ? 'animate-pulse' : ''}`}
                style={{ animationDuration: '3s' }}
                alt=""
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-600">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="3"/>
                  <line x1="12" y1="2" x2="12" y2="6"/>
                  <line x1="12" y1="18" x2="12" y2="22"/>
                  <line x1="2" y1="12" x2="6" y2="12"/>
                  <line x1="18" y1="12" x2="22" y2="12"/>
                </svg>
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
          </div>
          <div className="min-w-0">
            <h4 className="text-white font-bold text-lg truncate leading-tight tracking-wide">
              {currentTrack.name}
            </h4>
            <p className="text-zinc-500 text-sm truncate mt-1.5 font-medium">
              {currentTrack.artist}
            </p>
          </div>
          <button
            onClick={() => onToggleFavorite()}
            className={`p-2.5 transition-all rounded-full hover:bg-zinc-800/50 ${
              isFavorite ? 'text-red-500' : 'text-zinc-500 hover:text-red-400'
            }`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={isFavorite ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center max-w-xl relative z-10">
          <div className="flex items-center gap-6 mb-3">
            <button
              onClick={onPrev}
              className="group p-3 text-zinc-500 hover:text-white transition-all rounded-full hover:bg-white/5"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="group-active:scale-90 transition-transform">
                <polygon points="19 20 9 12 19 4 19 20"/>
                <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>

            <button
              onClick={onTogglePlay}
              className="w-14 h-14 bg-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-white/10 hover:shadow-white/20"
            >
              {isPlaying ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-black ml-0.5">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-black ml-1">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              )}
            </button>

            <button
              onClick={onNext}
              className="group p-3 text-zinc-500 hover:text-white transition-all rounded-full hover:bg-white/5"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="group-active:scale-90 transition-transform">
                <polygon points="5 4 15 12 5 20 5 4"/>
                <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
          </div>

          <div className="w-full flex items-center gap-4 text-xs text-zinc-500 font-mono">
            <span className="w-12 text-right tabular-nums">{formatTime(progress)}</span>
            <div
              className="relative flex-1 h-1.5 bg-zinc-800/80 rounded-full cursor-pointer group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                onSeek((x / rect.width) * duration);
              }}
            >
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full shadow-[0_0_12px_rgba(234,179,8,0.4)]"
                style={{ width: `${progressPercent}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-all cursor-pointer ring-4 ring-yellow-500/20"
                style={{ left: `calc(${progressPercent}% - 7px)` }}
              />
            </div>
            <span className="w-12 tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="w-1/3 flex justify-end items-center gap-4 relative z-10">
          <div className="flex items-center gap-3 group/volume mr-2">
            <button 
              onClick={handleToggleMute}
              className="text-zinc-500 hover:text-yellow-500 transition-colors p-2"
            >
              {getVolumeIcon()}
            </button>
            <div 
              className="w-24 h-1 bg-zinc-800 rounded-full cursor-pointer relative group/slider"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                onVolumeChange(Math.max(0, Math.min(1, x / rect.width)));
              }}
            >
               <div 
                className="absolute top-0 left-0 h-full bg-yellow-500 rounded-full"
                style={{ width: `${volume * 100}%` }}
               />
               <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg scale-0 group-hover/slider:scale-100 group-active/slider:scale-110 transition-all ring-2 ring-yellow-500/30"
                style={{ left: `calc(${volume * 100}% - 6px)` }}
               />
            </div>
          </div>

          <div className="h-6 w-[1px] bg-zinc-800 hidden md:block" />

          <div className="hidden xl:flex flex-col items-end">
            <span className="text-[9px] font-bold text-yellow-500/70 tracking-[0.2em]">{currentTrack.bitrate && currentTrack.bitrate > 1000000 ? 'HI-RES' : 'STANDARD'}</span>
            <span className="text-[10px] font-mono text-zinc-600 leading-none mt-1 uppercase">
                {currentTrack.bitrate ? `${Math.floor(currentTrack.bitrate / 1000)}kbps` : '24-BIT'}
            </span>
          </div>

          <button
            onClick={onTogglePlaybackMode}
            className={`group relative p-2.5 transition-all rounded-full hover:bg-zinc-800/50 ${
              playbackMode === 'shuffle' ? 'text-yellow-500' : 'text-zinc-500 hover:text-yellow-500'
            }`}
          >
            {playbackMode === 'loop' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>
                <text x="12" y="15" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold">1</text>
              </svg>
            ) : playbackMode === 'shuffle' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
            )}
          </button>

          <button 
            onClick={() => setShowQueue(!showQueue)}
            className={`group relative p-2.5 transition-all rounded-full hover:bg-zinc-800/50 ${
              showQueue ? 'text-yellow-500' : 'text-zinc-500 hover:text-white'
            }`}
          >
            <div className="flex gap-0.5 items-end">
              <div className={`w-1 bg-current rounded-full transition-all ${isPlaying ? 'h-2.5 group-hover:h-3.5' : 'h-1.5'}`}/>
              <div className={`w-1 bg-current rounded-full transition-all ${isPlaying ? 'h-4 group-hover:h-2.5' : 'h-3'}`}/>
              <div className={`w-1 bg-current rounded-full transition-all ${isPlaying ? 'h-1.5 group-hover:h-4' : 'h-0.5'}`}/>
            </div>
          </button>
        </div>
      </div>
    </>
  );
};

export default PlayerControls;
