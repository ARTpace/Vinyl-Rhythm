
import { Track, ViewType } from '../types';
import { formatTime } from '../utils/audioParser';
import { scrapeNeteaseMusic } from '../services/metadataService';
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';

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
  displayConverter?: (str: string) => string; 
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
  displayConverter?: (str: string) => string;
}>(({ track, index, isFavorite, onPlay, onToggleFavorite, onScrape, isScraping, onNavigate, displayConverter }) => {
  const convert = (s: string) => displayConverter ? displayConverter(s) : s;
  
  return (
    <div 
      className="group flex items-center gap-4 p-3 md:p-4 hover:bg-white/5 transition-all cursor-pointer border-b border-white/[0.03] last:border-0"
      onClick={() => onPlay(track)}
    >
        <div className="w-6 text-center text-zinc-700 font-mono text-xs group-hover:text-yellow-500">{String(index + 1).padStart(2, '0')}</div>
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-zinc-800 overflow-hidden relative shrink-0 shadow-lg group-hover:scale-110 transition-transform">
          {track.coverUrl ? (
            <img key={track.coverUrl} src={track.coverUrl} className="w-full h-full object-cover animate-in fade-in duration-700" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
          )}
          {isScraping && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-black truncate text-sm md:text-base tracking-tight">{convert(track.name)}</div>
          <button 
            onClick={(e) => { e.stopPropagation(); onNavigate?.('artistProfile', track.artist); }}
            className="text-zinc-500 text-[9px] md:text-xs font-bold uppercase tracking-widest mt-0.5 hover:text-yellow-500 transition-colors"
          >
            {convert(track.artist)}
          </button>
        </div>
        
        <button 
          onClick={(e) => { e.stopPropagation(); onScrape(track); }}
          className="hidden md:flex p-2 rounded-full transition-all hover:bg-white/10 text-zinc-700 hover:text-red-500 opacity-0 group-hover:opacity-100"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><path d="M16 10l4 4 4-4"/><path d="M20 4v10"/></svg>
        </button>

        <button 
          onClick={(e) => { e.stopPropagation(); onNavigate?.('albums', track.album); }}
          className="hidden lg:block text-zinc-600 text-[10px] font-black uppercase tracking-widest max-w-[150px] truncate hover:text-yellow-500 transition-colors"
        >
          {convert(track.album)}
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
  navigationRequest, onNavigationProcessed, isSearching = false, displayConverter
}) => {
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [activeAlbum, setActiveAlbum] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [scrapingId, setScrapingId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'all' | 'fav' | 'folders'>('all');
  
  const [sortKey, setSortKey] = useState<'name' | 'artist' | 'album' | 'lastModified'>('lastModified');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const scrollRef = useRef<HTMLDivElement>(null);
  const convert = (s: string) => displayConverter ? displayConverter(s) : s;

  useEffect(() => {
    if (navigationRequest) {
      if (navigationRequest.type === 'folders') {
         setSubTab('folders');
         setActiveGroup(navigationRequest.name);
         setActiveAlbum(null);
         onNavigationProcessed?.();
      } else if (navigationRequest.type === 'albums') {
         setSubTab('all');
         setActiveAlbum(navigationRequest.name);
         setActiveGroup(null);
         onNavigationProcessed?.();
      }
    }
  }, [navigationRequest, onNavigationProcessed]);

  useEffect(() => {
    if (view === 'all') {
      if (!navigationRequest) {
        setActiveGroup(null);
        setActiveAlbum(null);
        setSubTab('all');
      }
    }
  }, [view, navigationRequest]);

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
          coverUrl: newData.coverUrl || track.coverUrl
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setScrapingId(null);
    }
  };

  useEffect(() => {
    setDisplayLimit(100);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [view, activeGroup, activeAlbum, isSearching, sortKey, sortOrder, subTab]);

  const groups = useMemo(() => {
    if (view !== 'all' || subTab !== 'folders' || activeGroup || activeAlbum || isSearching) return null;

    const map = new Map<string, Track[]>();
    tracks.forEach(track => {
      let key = track.folderId || '默认导入';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(track);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks, view, subTab, activeGroup, activeAlbum, isSearching]);

  const filteredAndSortedTracks = useMemo(() => {
    let list = [...tracks];
    
    if (subTab === 'fav' && !isSearching) {
      list = list.filter(t => favorites.has(t.id));
    }
    
    if (activeGroup) {
      list = list.filter(t => (t.folderId || '默认导入') === activeGroup);
    }

    if (activeAlbum) {
      list = list.filter(t => t.album === activeAlbum);
    }
    
    list.sort((a, b) => {
      let valA: any = (a as any)[sortKey] || '';
      let valB: any = (b as any)[sortKey] || '';
      if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [tracks, favorites, subTab, activeGroup, activeAlbum, sortKey, sortOrder, isSearching]);

  const pageTitle = useMemo(() => {
    if (activeGroup) return activeGroup;
    if (activeAlbum) return activeAlbum;
    if (view === 'history') return '最近播放';
    return '本地曲库';
  }, [activeGroup, activeAlbum, view]);

  return (
    <div className="flex flex-col h-full bg-zinc-950/20 overflow-hidden animate-in fade-in duration-500">
      <header className="p-4 md:p-8 flex flex-col md:flex-row md:items-end justify-between gap-6 shrink-0">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase italic">
            {convert(pageTitle)}
          </h2>
          <div className="h-0.5 w-12 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
        </div>

        {!activeGroup && !activeAlbum && view !== 'history' && !isSearching && (
          <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
            {[
              { id: 'all', label: '全部' },
              { id: 'fav', label: '收藏' },
              { id: 'folders', label: '文件夹' }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setSubTab(tab.id as any)}
                className={`px-4 md:px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all ${subTab === tab.id ? 'bg-zinc-800 text-yellow-500 shadow-xl border border-white/5' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                {convert(tab.label)}
              </button>
            ))}
          </div>
        )}
        
        {(activeGroup || activeAlbum) && (
          <button 
            onClick={() => { setActiveGroup(null); setActiveAlbum(null); }}
            className="flex items-center gap-2 text-zinc-500 hover:text-yellow-500 transition-colors uppercase font-black text-[10px] tracking-widest"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg>
            BACK TO LIST
          </button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 pb-32 custom-scrollbar">
        {groups && !activeGroup && !activeAlbum ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {groups.map(([name, groupTracks]) => (
              <div 
                key={name} 
                onClick={() => setActiveGroup(name)}
                className="group cursor-pointer bg-white/5 border border-white/5 rounded-3xl p-4 hover:bg-white/10 transition-all"
              >
                <div className="aspect-square rounded-2xl bg-zinc-900 overflow-hidden mb-4 shadow-xl">
                  {groupTracks[0]?.coverUrl ? (
                    <img src={groupTracks[0].coverUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700 text-4xl font-black">{name[0]}</div>
                  )}
                </div>
                <h3 className="text-white font-bold text-sm truncate uppercase tracking-tight">{convert(name === 'undefined' ? '未知' : name)}</h3>
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">{groupTracks.length} TRACKS</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredAndSortedTracks.length === 0 ? (
              <div className="py-20 text-center text-zinc-700 font-black uppercase tracking-[0.3em] opacity-30">
                 No tracks found
              </div>
            ) : (
              <>
                {filteredAndSortedTracks.slice(0, displayLimit).map((track, index) => (
                  <TrackRow 
                    key={track.id} track={track} index={index} isFavorite={favorites.has(track.id)} 
                    onPlay={onPlay} onToggleFavorite={onToggleFavorite} onScrape={handleScrape}
                    isScraping={scrapingId === track.id} onNavigate={onNavigate} displayConverter={displayConverter}
                  />
                ))}
                {filteredAndSortedTracks.length > displayLimit && (
                  <button 
                    onClick={() => setDisplayLimit(prev => prev + 100)}
                    className="w-full py-8 text-zinc-600 hover:text-yellow-500 font-black uppercase text-[10px] tracking-[0.3em] transition-colors"
                  >
                    Load More ({filteredAndSortedTracks.length - displayLimit})
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryView;
