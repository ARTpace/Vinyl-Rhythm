import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Track } from '../types';
import { normalizeChinese } from '../utils/chineseConverter';

interface CollectionViewProps {
  tracks: Track[];
  onNavigate: (type: 'artistProfile' | 'albums', name: string) => void;
  onPlayAlbum?: (albumName: string) => void;
  displayConverter?: (str: string) => string;
  searchQuery?: string;
  initialTab?: 'artists' | 'albums';
  onTabChange?: (tab: 'artists' | 'albums') => void;
  artistMetadata: Map<string, string>;
  followedArtists?: Set<string>;
}

const PAGE_SIZE = 40; 

const CollectionCard = React.memo<{
    id: string;
    name: string;
    type: 'artist' | 'album';
    trackCount: number;
    year?: number;
    coverUrl?: string;
    onClick: () => void;
    onPlay?: () => void;
    convert: (s: string) => string;
}>(({ name, type, trackCount, year, coverUrl, onClick, onPlay, convert }) => {
    return (
        <div 
            onClick={onClick}
            className="group cursor-pointer text-center animate-in fade-in zoom-in-95 duration-500"
        >
            <div className={`relative aspect-square bg-zinc-900 border border-white/5 transition-all group-hover:scale-105 group-hover:shadow-[0_0_30px_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden shadow-2xl mb-3 ${type === 'artist' ? 'rounded-full' : 'rounded-3xl'}`}>
                {coverUrl ? (
                    <img src={coverUrl} className="w-full h-full object-cover transition-opacity duration-700" loading="lazy" />
                ) : (
                    <div className="text-zinc-700 text-4xl font-black">{name[0]}</div>
                )}
                
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                    {onPlay && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onPlay(); }}
                            className="w-14 h-14 rounded-full bg-yellow-500 text-black flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:scale-110 active:scale-95 transition-transform"
                        >
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><path d="M5 3l14 9-14 9V3z"/></svg>
                        </button>
                    )}
                </div>
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 pointer-events-none transition-colors" />
            </div>
            <h3 className="text-white font-bold text-[11px] truncate px-1 group-hover:text-yellow-500 transition-colors uppercase tracking-tight">
                {convert(name)}
            </h3>
            <p className="text-[8px] text-zinc-700 font-black tracking-widest mt-1 uppercase">
                {trackCount} TRACKS {year ? `• ${year}` : ''}
            </p>
        </div>
    );
});

const CollectionView: React.FC<CollectionViewProps> = ({ 
  tracks, 
  onNavigate, 
  onPlayAlbum, 
  displayConverter, 
  searchQuery = '', 
  initialTab = 'artists',
  onTabChange,
  artistMetadata,
  followedArtists
}) => {
  const [tab, setTab] = useState<'artists' | 'albums'>(initialTab);
  const [showFollowedOnly, setShowFollowedOnly] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  const convert = useCallback((s: string) => displayConverter ? displayConverter(s) : s, [displayConverter]);

  const handleTabSwitch = (newTab: 'artists' | 'albums') => {
    setTab(newTab);
    onTabChange?.(newTab);
  };

  const deduplicateTracks = (list: Track[]) => {
    const bestMap = new Map<string, Track>();
    list.forEach(t => {
      const key = `${t.name.trim().toLowerCase()}-${t.artist.trim().toLowerCase()}`;
      const existing = bestMap.get(key);
      if (!existing || (t.bitrate || 0) > (existing.bitrate || 0)) {
        bestMap.set(key, t);
      }
    });
    return Array.from(bestMap.values());
  };

  const artistGroups = useMemo(() => {
    let sourceTracks = tracks;
    if (searchQuery.trim()) {
      const q = normalizeChinese(searchQuery);
      sourceTracks = tracks.filter(t => normalizeChinese(t.artist).includes(q));
    }

    const map = new Map<string, { tracks: Track[] }>();
    sourceTracks.forEach(t => {
      const artists = (t.artist || '未知歌手').split(' / ').map(name => name.trim()).filter(Boolean);
      artists.forEach(artistName => {
        if (!map.has(artistName)) map.set(artistName, { tracks: [] });
        map.get(artistName)!.tracks.push(t);
      });
    });

    let result: [string, { tracks: Track[], cover?: string, year?: number }][] = [];
    map.forEach((data, name) => {
      if (showFollowedOnly && followedArtists && !followedArtists.has(name)) {
        return;
      }
      
      if (searchQuery.trim()) {
        const q = normalizeChinese(searchQuery);
        if (!normalizeChinese(name).includes(q)) {
          return;
        }
      }
      
      const uniqueTracks = deduplicateTracks(data.tracks);
      const artistCover = artistMetadata.get(name) || uniqueTracks.find(t => t.coverUrl)?.coverUrl;
      result.push([name, { 
        tracks: uniqueTracks, 
        cover: artistCover
      }]);
    });

    return result.sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks, searchQuery, artistMetadata, showFollowedOnly, followedArtists]);

  const albumGroups = useMemo(() => {
    let sourceTracks = tracks;
    if (searchQuery.trim()) {
      const q = normalizeChinese(searchQuery);
      sourceTracks = tracks.filter(t => normalizeChinese(t.album).includes(q));
    }

    const map = new Map<string, { tracks: Track[], cover?: string }>();
    sourceTracks.forEach(t => {
      const key = t.album || '未知专辑';
      if (!map.has(key)) map.set(key, { tracks: [] });
      map.get(key)!.tracks.push(t);
    });

    const result: [string, { tracks: Track[], cover?: string, year?: number }][] = [];
    map.forEach((data, name) => {
      if (searchQuery.trim()) {
        const q = normalizeChinese(searchQuery);
        if (!normalizeChinese(name).includes(q)) {
          return;
        }
      }
      
      const uniqueTracks = deduplicateTracks(data.tracks);
      const albumYear = uniqueTracks.find(t => t.year)?.year;
      
      result.push([name, { 
        tracks: uniqueTracks, 
        cover: uniqueTracks.find(t => t.coverUrl)?.coverUrl,
        year: albumYear
      }]);
    });

    return result.sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks, searchQuery]);

  useEffect(() => {
    setDisplayLimit(PAGE_SIZE);
  }, [tab, searchQuery, showFollowedOnly]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setDisplayLimit(prev => prev + PAGE_SIZE);
      }
    }, { threshold: 0.1 });
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [tab, searchQuery, showFollowedOnly]);

  const currentGroups = tab === 'artists' ? artistGroups : albumGroups;
  const displayedGroups = useMemo(() => currentGroups.slice(0, displayLimit), [currentGroups, displayLimit]);

  return (
    <div className="flex flex-col h-full bg-zinc-950/20 overflow-hidden animate-in fade-in duration-500">
      <header className="p-4 md:p-8 flex flex-col md:flex-row md:items-end justify-between gap-6 shrink-0 pointer-events-none">
        <div className="space-y-1 pointer-events-auto">
          <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase italic">
            馆藏预览
          </h2>
          <div className="h-0.5 w-12 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
        </div>

        <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md pointer-events-auto">
          <button 
            onClick={() => handleTabSwitch('artists')}
            className={`px-8 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all ${tab === 'artists' ? 'bg-zinc-800 text-yellow-500 shadow-xl border border-white/5' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            {convert('歌手')}
          </button>
          <button 
            onClick={() => handleTabSwitch('albums')}
            className={`px-8 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all ${tab === 'albums' ? 'bg-zinc-800 text-yellow-500 shadow-xl border border-white/5' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            {convert('专辑')}
          </button>
          {tab === 'artists' && (
            <div className="w-px bg-white/10 mx-1.5" />
          )}
          {tab === 'artists' && (
            <button 
              onClick={() => setShowFollowedOnly(!showFollowedOnly)}
              className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl transition-all flex items-center gap-2 ${showFollowedOnly ? 'bg-yellow-500 text-black shadow-xl' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={showFollowedOnly ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              {convert('已关注')}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-8 pb-32 custom-scrollbar">
        {currentGroups.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-zinc-800 gap-4">
             <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><circle cx="12" cy="12" r="3"/><path d="M16 8.5V11"/></svg>
             <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Media Found</p>
          </div>
        ) : (
          <div className={`grid gap-x-6 gap-y-10 ${tab === 'artists' 
            ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9' 
            : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-9'}`}>
            
            {displayedGroups.map(([name, data]) => (
              <CollectionCard 
                key={name}
                id={name}
                name={name}
                type={tab === 'artists' ? 'artist' : 'album'}
                trackCount={data.tracks.length}
                year={data.year}
                coverUrl={data.cover}
                convert={convert}
                onClick={() => onNavigate(tab === 'artists' ? 'artistProfile' : 'albums', name)}
                onPlay={tab === 'albums' ? () => onPlayAlbum?.(name) : undefined}
              />
            ))}
          </div>
        )}

        {displayLimit < currentGroups.length && (
          <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
             <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/40 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionView;