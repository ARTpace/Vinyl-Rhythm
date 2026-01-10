
import { Track, ViewType } from '../types';
import { formatTime } from '../utils/audioParser';
import { getTrackCoverBlob } from '../utils/storage';
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';

interface LibraryViewProps {
  view: ViewType;
  tracks: Track[];
  onPlay: (track: Track) => void;
  favorites: Set<string>;
  onToggleFavorite: (trackId: string) => void;
  onUpdateTrack?: (trackId: string, updates: Partial<Track>) => void;
  onNavigate?: (type: 'artists' | 'albums' | 'folders' | 'artistProfile', name: string) => void;
  displayConverter?: (str: string) => string; 
  // Fix: Added missing props used in App.tsx
  navigationRequest?: { type: any, name: string } | null;
  onNavigationProcessed?: () => void;
  isSearching?: boolean;
}

/**
 * 高性能曲目行：只有在出现在屏幕上时才去加载封面 Blob
 */
const TrackRow = React.memo<{
  track: Track;
  index: number;
  isFavorite: boolean;
  onPlay: (track: Track) => void;
  onToggleFavorite: (id: string) => void;
  onNavigate?: (type: 'artists' | 'albums' | 'folders' | 'artistProfile', name: string) => void;
  displayConverter?: (str: string) => string;
}>(({ track, index, isFavorite, onPlay, onToggleFavorite, onNavigate, displayConverter }) => {
  const [coverUrl, setCoverUrl] = useState<string | null>(track.coverUrl || null);
  const [isLoadingCover, setIsLoadingCover] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const convert = (s: string) => displayConverter ? displayConverter(s) : s;

  // 懒加载封面逻辑
  useEffect(() => {
    if (coverUrl) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !coverUrl && !isLoadingCover) {
        setIsLoadingCover(true);
        getTrackCoverBlob(track.fingerprint).then(blob => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            setCoverUrl(url);
          }
          setIsLoadingCover(false);
        });
        observer.disconnect();
      }
    }, { rootMargin: '100px' });

    if (rowRef.current) observer.observe(rowRef.current);
    return () => {
      observer.disconnect();
      // 注意：这里不立即 revoke，因为组件卸载可能很快，会导致图片闪烁
    };
  }, [track.fingerprint, coverUrl, isLoadingCover]);

  // 组件彻底销毁时清理内存
  useEffect(() => {
    return () => {
      if (coverUrl && coverUrl.startsWith('blob:')) {
        URL.revokeObjectURL(coverUrl);
      }
    };
  }, [coverUrl]);

  const bitrateKbps = track.bitrate ? Math.round(track.bitrate / 1000) : 0;
  const isHires = bitrateKbps >= 2000;
  const isLossless = bitrateKbps >= 800 && bitrateKbps < 2000;

  return (
    <div 
      ref={rowRef}
      className="group flex items-center gap-4 p-3 md:p-4 hover:bg-white/5 transition-all cursor-pointer border-b border-white/[0.03] last:border-0"
      onClick={() => onPlay(track)}
    >
        <div className="w-6 text-center text-zinc-700 font-mono text-xs group-hover:text-yellow-500">{String(index + 1).padStart(2, '0')}</div>
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-zinc-800 overflow-hidden relative shrink-0 shadow-lg">
          {coverUrl ? (
            <img src={coverUrl} className="w-full h-full object-cover animate-in fade-in duration-500" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="text-white font-black truncate text-sm md:text-base tracking-tight">{convert(track.name)}</div>
            {bitrateKbps > 0 && (
                 <span className={`text-[8px] font-mono px-1 rounded ${isHires ? 'bg-yellow-500/20 text-yellow-500' : isLossless ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}>
                   {bitrateKbps}K
                 </span>
            )}
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onNavigate?.('artistProfile', track.artist); }}
            className="text-zinc-500 text-[9px] md:text-xs font-bold uppercase tracking-widest hover:text-yellow-500 transition-colors"
          >
            {convert(track.artist)}
          </button>
        </div>

        <div className="hidden lg:block text-zinc-500 text-[10px] font-black uppercase tracking-widest max-w-[150px] truncate opacity-50">
          {convert(track.album)}
        </div>
        
        <div className="hidden md:block text-zinc-600 font-mono text-xs w-12 text-right group-hover:text-zinc-400">{formatTime(track.duration || 0)}</div>
        
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(track.id); }}
          className={`p-2 rounded-full transition-all active:scale-75 ${isFavorite ? 'text-red-500' : 'text-zinc-800 hover:text-white'}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        </button>
    </div>
  );
});

const LibraryView: React.FC<LibraryViewProps> = ({ 
  view, tracks, onPlay, favorites, onToggleFavorite, onNavigate, displayConverter, navigationRequest, onNavigationProcessed, isSearching
}) => {
  const [displayLimit, setDisplayLimit] = useState(50);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const convert = (s: string) => displayConverter ? displayConverter(s) : s;

  // 无限滚动检测
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && tracks.length > displayLimit) {
        setDisplayLimit(prev => prev + 50);
      }
    }, { threshold: 0.1 });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [tracks.length, displayLimit]);

  // 当视角切换时重置分页
  useEffect(() => {
    setDisplayLimit(50);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [view, tracks.length]);

  return (
    <div className="flex flex-col h-full bg-zinc-950/20 overflow-hidden animate-in fade-in duration-500">
      <header className="p-4 md:p-8 flex items-baseline justify-between shrink-0">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase italic">
            {view === 'history' ? '最近播放' : '本地曲库'}
          </h2>
          <div className="h-0.5 w-12 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
        </div>
        <span className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em]">{tracks.length} TRACKS</span>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 pb-32 custom-scrollbar">
        <div className="space-y-1">
          {tracks.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
               <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M8 11h6"/></svg>
               <p className="text-xs font-black uppercase tracking-[0.3em]">No tracks found</p>
            </div>
          ) : (
            <>
              {tracks.slice(0, displayLimit).map((track, index) => (
                <TrackRow 
                  key={track.fingerprint + index} 
                  track={track} index={index} isFavorite={favorites.has(track.id)} 
                  onPlay={onPlay} onToggleFavorite={onToggleFavorite}
                  onNavigate={onNavigate} displayConverter={displayConverter}
                />
              ))}
              {/* 无限滚动触发器 */}
              <div ref={loaderRef} className="h-20 flex items-center justify-center">
                {tracks.length > displayLimit && (
                  <div className="w-6 h-6 border-2 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin"></div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LibraryView;
