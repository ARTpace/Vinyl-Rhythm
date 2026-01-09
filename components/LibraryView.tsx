
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Track, ViewType } from '../types';
import { formatTime } from '../utils/audioParser';
import { scrapeNeteaseMusic } from '../services/metadataService';

interface LibraryViewProps {
  view: ViewType;
  tracks: Track[];
  onPlay: (track: Track) => void;
  favorites: Set<string>;
  onToggleFavorite: (trackId: string) => void;
  onUpdateTrack?: (trackId: string, updates: Partial<Track>) => void;
  onNavigate?: (type: 'artists' | 'albums' | 'folders' | 'artistProfile', name: string) => void;
  onBack?: () => void;
  navigationRequest?: { type: 'artists' | 'albums' | 'folders', name: string } | null;
  onNavigationProcessed?: () => void;
  isSearching?: boolean;
}

const TrackRow = React.memo<{
  track: Track;
  index: number;
  isFavorite: boolean;
  onPlay: (track: Track) => void;
  onToggleFavorite: (id: string) => void;
  onScrape: (track: Track) => void;
  isScraping: boolean;
  onNavigate?: (type: 'artists' | 'albums' | 'folders' | 'artistProfile', name: string) => void;
}>(({ track, index, isFavorite, onPlay, onToggleFavorite, onScrape, isScraping, onNavigate }) => {
  return (
    <div 
      className="group flex items-center gap-4 p-3 md:p-4 hover:bg-white/5 transition-all cursor-pointer border-b border-white/[0.03] last:border-0"
      onClick={() => onPlay(track)}
    >
        <div className="w-6 text-center text-zinc-700 font-mono text-xs group-hover:text-yellow-500">{String(index + 1).padStart(2, '0')}</div>
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-zinc-800 overflow-hidden relative shrink-0 shadow-lg group-hover:scale-110 transition-transform">
          {track.coverUrl ? (
            <img src={track.coverUrl} className="w-full h-full object-cover animate-in fade-in duration-500" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-black truncate text-sm md:text-base tracking-tight flex items-center gap-2">
            {track.name}
            {track.duration === 0 && <span className="text-[8px] bg-red-500/20 text-red-500 px-1 rounded uppercase">损坏</span>}
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onNavigate?.('artistProfile', track.artist); }}
            className="text-zinc-500 text-[9px] md:text-xs font-bold uppercase tracking-widest mt-0.5 hover:text-yellow-500 transition-colors"
          >
            {track.artist}
          </button>
        </div>
        
        {/* 刮削按钮 - 使用网易云风格的搜索补全图标 */}
        <button 
          onClick={(e) => { e.stopPropagation(); onScrape(track); }}
          title="从网易云匹配信息"
          className={`hidden md:flex p-2 rounded-full transition-all hover:bg-white/10 ${isScraping ? 'animate-spin text-red-500' : 'text-zinc-700 hover:text-red-500 opacity-0 group-hover:opacity-100'}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/><path d="M16 10l4 4 4-4"/><path d="M20 4v10"/>
          </svg>
        </button>

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
  view, tracks, onPlay, favorites, onToggleFavorite, onUpdateTrack, onNavigate, onBack,
  navigationRequest, onNavigationProcessed, isSearching = false
}) => {
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [scrapingId, setScrapingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const handleScrape = async (track: Track) => {
    if (scrapingId) return;
    setScrapingId(track.id);
    try {
      const newData = await scrapeNeteaseMusic(track.name, track.artist);
      if (newData && onUpdateTrack) {
        onUpdateTrack(track.id, {
          name: newData.title,
          artist: newData.artist,
          album: newData.album,
          coverUrl: newData.coverUrl // 更新封面
        });
      } else {
        alert('未在网易云音乐中找到精准匹配的结果。');
      }
    } catch (err) {
      alert('刮削失败，请检查网络连接。');
    } finally {
      setScrapingId(null);
    }
  };

  useEffect(() => {
    setDisplayLimit(100);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [view, activeGroup, isSearching]);

  const groups = useMemo(() => {
    const map = new Map<string, Track[]>();
    if (view === 'all' || view === 'favorites' || isSearching) return null;
    tracks.forEach(track => {
      let key = '';
      if (view === 'artists') key = track.artist;
      else if (view === 'albums') key = track.album;
      else if (view === 'folders') key = track.folderId || '默认';
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

  const visibleTracks = useMemo(() => filteredTracks.slice(0, displayLimit), [filteredTracks, displayLimit]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
      if (displayLimit < filteredTracks.length) {
        setDisplayLimit(prev => Math.min(prev + 100, filteredTracks.length));
      }
    }
  }, [displayLimit, filteredTracks.length]);

  if (groups && !activeGroup) {
    const isAlbumView = view === 'albums';
    return (
      <div ref={scrollRef} onScroll={handleScroll} className="p-4 md:p-8 h-full overflow-y-auto custom-scrollbar bg-zinc-950/20">
        <header className="mb-8 relative">
           <div className="flex items-baseline gap-3">
              <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase">{view === 'albums' ? '专辑' : view === 'artists' ? '歌手' : '音乐库'}</h2>
              <span className="text-[10px] text-zinc-600 font-black tracking-[0.4em] uppercase">{groups.length} 个项目</span>
           </div>
           <div className="h-0.5 w-12 bg-yellow-500 mt-2 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
        </header>
        <div className={`grid gap-x-6 gap-y-10 ${isAlbumView ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-9' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9'}`}>
          {groups.map(([name, groupTracks]) => (
            <div key={name} onClick={() => isAlbumView ? setActiveGroup(name) : (view === 'artists' ? onNavigate?.('artistProfile', name) : setActiveGroup(name))} className="group cursor-pointer">
              <div className="relative aspect-square bg-zinc-900 rounded-2xl overflow-hidden border border-white/5 transition-all group-hover:scale-105">
                {groupTracks[0]?.coverUrl ? <img src={groupTracks[0].coverUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-700 text-3xl font-black">{name[0]}</div>}
              </div>
              <h3 className="mt-3 text-white font-bold text-[11px] truncate text-center group-hover:text-yellow-500 transition-colors uppercase">{name === 'undefined' ? '未知' : name}</h3>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#111111]/30">
      <div className="p-4 md:p-8 pb-4 flex items-center gap-6">
         {activeGroup && <button onClick={() => { setActiveGroup(null); onBack?.(); }} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-yellow-500 text-white transition-all"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>}
         <div><h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase">{isSearching ? '搜索结果' : (activeGroup || '音乐库')}</h2></div>
      </div>
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 md:px-8 pb-24">
         <div className="bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden">
            {visibleTracks.map((track, i) => (
              <TrackRow key={track.id} track={track} index={i} isFavorite={favorites.has(track.id)} onPlay={onPlay} onToggleFavorite={onToggleFavorite} onScrape={handleScrape} isScraping={scrapingId === track.id} onNavigate={onNavigate} />
            ))}
         </div>
      </div>
    </div>
  );
};

export default LibraryView;
