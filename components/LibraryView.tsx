
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Track, ViewType } from '../types';
import { formatTime } from '../utils/audioParser';

interface LibraryViewProps {
  view: ViewType;
  tracks: Track[];
  onPlay: (track: Track) => void;
  favorites: Set<string>;
  onToggleFavorite: (trackId: string) => void;
  onNavigate?: (type: 'artists' | 'albums' | 'folders', name: string) => void;
  navigationRequest?: { type: 'artists' | 'albums' | 'folders', name: string } | null;
  onNavigationProcessed?: () => void;
  isSearching?: boolean;
}

// 使用 React.memo 优化单行曲目的渲染性能
const TrackRow = React.memo<{
  track: Track;
  index: number;
  isFavorite: boolean;
  onPlay: (track: Track) => void;
  onToggleFavorite: (id: string) => void;
  onNavigate?: (type: 'artists' | 'albums' | 'folders', name: string) => void;
}>(({ track, index, isFavorite, onPlay, onToggleFavorite, onNavigate }) => {
  return (
    <div 
      className="group flex items-center gap-4 p-3 md:p-4 hover:bg-white/5 transition-all cursor-pointer border-b border-white/[0.03] last:border-0"
      onClick={() => onPlay(track)}
    >
        <div className="w-6 text-center text-zinc-700 font-mono text-xs group-hover:text-yellow-500">{String(index + 1).padStart(2, '0')}</div>
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-zinc-800 overflow-hidden relative shrink-0 shadow-lg group-hover:scale-110 transition-transform">
          {track.coverUrl ? (
            <img src={track.coverUrl} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg></div>
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M5 3l14 9-14 9V3z"/></svg>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-black truncate text-sm md:text-base tracking-tight">{track.name}</div>
          <button 
            onClick={(e) => { e.stopPropagation(); onNavigate?.('artists', track.artist); }}
            className="text-zinc-500 text-[9px] md:text-xs font-bold uppercase tracking-widest mt-0.5 hover:text-yellow-500 transition-colors"
          >
            {track.artist}
          </button>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onNavigate?.('albums', track.album); }}
          className="hidden lg:block text-zinc-600 text-[10px] font-black uppercase tracking-widest max-w-[150px] truncate hover:text-yellow-500 transition-colors"
        >
          {track.album}
        </button>
        <div className="hidden md:block text-zinc-700 font-mono text-[10px] w-12 text-right">{formatTime(track.duration || 0)}</div>
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(track.id); }}
          className={`p-2 rounded-full transition-all active:scale-75 ${isFavorite ? 'text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'text-zinc-800 hover:text-white group-hover:opacity-100'}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        </button>
    </div>
  );
});

const LibraryView: React.FC<LibraryViewProps> = ({ 
  view, tracks, onPlay, favorites, onToggleFavorite, onNavigate,
  navigationRequest, onNavigationProcessed, isSearching = false
}) => {
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(100);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // 视图切换时重置加载上限
  useEffect(() => {
    setDisplayLimit(100);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [view, activeGroup, isSearching]);

  useEffect(() => {
    if (navigationRequest && navigationRequest.type === view) {
      setActiveGroup(navigationRequest.name);
      onNavigationProcessed?.();
    }
  }, [navigationRequest, view, onNavigationProcessed]);

  const groups = useMemo(() => {
    const map = new Map<string, Track[]>();
    if (view === 'all' || view === 'favorites' || isSearching) return null;

    tracks.forEach(track => {
      let key = '';
      if (view === 'artists') key = track.artist;
      else if (view === 'albums') key = track.album;
      else if (view === 'folders') key = track.folderId || 'Default';
      
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(track);
    });
    
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks, view, isSearching]);

  const filteredTracks = useMemo(() => {
    if (isSearching) return tracks;
    if (view === 'favorites') return tracks.filter(t => favorites.has(t.id));
    if (view === 'all') return tracks;
    if (activeGroup && groups) return groups.find(g => g[0] === activeGroup)?.[1] || [];
    return [];
  }, [tracks, view, favorites, activeGroup, groups, isSearching]);

  // 渲染的分片，用于优化长列表性能
  const visibleTracks = useMemo(() => {
    return filteredTracks.slice(0, displayLimit);
  }, [filteredTracks, displayLimit]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    // 如果滚动到底部 100px 范围内，加载更多
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
      if (displayLimit < filteredTracks.length) {
        setDisplayLimit(prev => Math.min(prev + 100, filteredTracks.length));
      }
    }
  }, [displayLimit, filteredTracks.length]);

  const renderAlbumSleeve = (name: string, groupTracks: Track[]) => {
    const coverUrl = groupTracks[0]?.coverUrl;
    return (
      <div 
        key={name}
        onClick={() => setActiveGroup(name)}
        className="group relative cursor-pointer perspective-1000 z-10 hover:z-20"
      >
        <div className="absolute inset-0 bg-black/40 translate-x-1 translate-y-1 rounded-[3px] blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
        <div className="absolute inset-0 bg-[#0a0a0a] translate-x-[2px] translate-y-[2px] rounded-[3px] border border-white/5 opacity-0 group-hover:opacity-100 transition-all duration-500 delay-75"></div>

        <div className="relative z-10 aspect-square bg-[#1a1a1a] rounded-[3px] shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-2 group-hover:rotate-x-6 group-hover:rotate-y-[-6deg] group-hover:shadow-[20px_25px_50px_rgba(0,0,0,0.8)] overflow-hidden border border-white/10">
          {coverUrl ? (
            <img src={coverUrl} className="w-full h-full object-cover select-none" alt={name} loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600 font-black text-3xl">
              {name[0]?.toUpperCase()}
            </div>
          )}
          <div className="absolute top-0 right-0 w-[4px] h-full bg-gradient-to-l from-black/60 to-transparent pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500">
             <div className="flex items-center justify-between text-white/80">
                <span className="text-[7px] font-black uppercase tracking-[0.2em]">Collector's Edition</span>
                <span className="text-[8px] font-mono">{groupTracks.length} Pcs</span>
             </div>
          </div>
        </div>

        <div className="mt-3 px-0.5 relative z-20">
          <h3 className="text-zinc-200 font-bold text-[11px] leading-tight truncate group-hover:text-yellow-500 transition-colors">
            {name === 'undefined' ? '未知专辑' : name}
          </h3>
          <p className="text-zinc-600 text-[9px] font-black uppercase tracking-tight mt-1 truncate">
            {groupTracks[0]?.artist}
          </p>
        </div>
      </div>
    );
  };

  if (groups && !activeGroup) {
    const isAlbumView = view === 'albums';
    return (
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="p-4 md:p-8 h-full overflow-y-auto custom-scrollbar bg-zinc-950/20"
      >
        <header className="mb-8 relative">
           <div className="flex items-baseline gap-3">
              <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase">
                {view === 'albums' ? 'Albums' : view === 'artists' ? 'Artists' : 'Library'}
              </h2>
              <span className="text-[10px] text-zinc-600 font-black tracking-[0.4em] uppercase">{groups.length} Items</span>
           </div>
           <div className="h-0.5 w-12 bg-yellow-500 mt-2 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
        </header>

        <div className={`grid gap-x-6 gap-y-10 ${isAlbumView 
          ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-9' 
          : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9'}`}>
          {groups.map(([name, groupTracks]) => (
            isAlbumView ? renderAlbumSleeve(name, groupTracks) : (
              <div 
                key={name}
                onClick={() => setActiveGroup(name)}
                className="group flex flex-col items-center gap-3 cursor-pointer"
              >
                <div className="relative w-full aspect-square">
                   <div className="absolute inset-0 rounded-full bg-zinc-900 border border-zinc-800 shadow-xl overflow-hidden group-hover:scale-110 group-hover:border-yellow-500/50 group-hover:shadow-[0_0_30px_rgba(234,179,8,0.15)] transition-all duration-500">
                      {groupTracks[0]?.coverUrl ? (
                        <img src={groupTracks[0].coverUrl} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700 text-2xl font-black">{name[0]?.toUpperCase()}</div>
                      )}
                   </div>
                   <div className="absolute bottom-0 right-0 w-6 h-6 bg-black rounded-full flex items-center justify-center text-[8px] font-bold text-yellow-500 border border-white/10 shadow-xl z-10">{groupTracks.length}</div>
                </div>
                <h3 className="text-zinc-400 font-bold text-[10px] text-center truncate w-full group-hover:text-yellow-500 transition-colors uppercase tracking-wider">{name === 'undefined' ? '未知' : name}</h3>
              </div>
            )
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#111111]/30">
      <div className="p-4 md:p-8 pb-4 shrink-0 flex items-center gap-6">
         {activeGroup && (
           <button onClick={() => setActiveGroup(null)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-yellow-500 hover:text-black text-white transition-all active:scale-90 shadow-lg">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
           </button>
         )}
         <div className="min-w-0">
            <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter truncate leading-tight uppercase">
                {isSearching ? 'Search Results' : (activeGroup || (view === 'favorites' ? 'Favorites' : 'All Tracks'))}
            </h2>
            <p className="text-zinc-500 text-[10px] font-black tracking-[0.3em] uppercase mt-0.5">
                Showing {visibleTracks.length} of {filteredTracks.length} Found
            </p>
         </div>
      </div>
      
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-8 pb-24"
      >
         <div className="bg-white/[0.02] border border-white/5 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden backdrop-blur-sm shadow-2xl">
            {visibleTracks.map((track, i) => (
              <TrackRow 
                key={track.id} 
                track={track} 
                index={i} 
                isFavorite={favorites.has(track.id)} 
                onPlay={onPlay} 
                onToggleFavorite={onToggleFavorite} 
                onNavigate={onNavigate} 
              />
            ))}
            
            {visibleTracks.length < filteredTracks.length && (
              <div className="p-8 text-center text-zinc-600 font-black text-[10px] uppercase tracking-[0.5em] animate-pulse">
                Loading more tracks...
              </div>
            )}

            {filteredTracks.length === 0 && (
              <div className="py-32 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" className="opacity-40"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-black font-black text-xs shadow-lg">?</div>
                </div>
                <h3 className="text-white font-black text-lg uppercase tracking-widest mb-2">No Matches Found</h3>
              </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default LibraryView;
