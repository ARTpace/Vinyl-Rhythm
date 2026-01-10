
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Track } from '../types';

interface CollectionViewProps {
  tracks: Track[];
  onNavigate: (type: 'artistProfile' | 'albums', name: string) => void;
  onPlayAlbum?: (albumName: string) => void;
  displayConverter?: (str: string) => string;
  initialTab?: 'artists' | 'albums';
}

const PAGE_SIZE = 40; // 初始加载数量

// 提取独立的卡片组件，使用 memo 避免不必要的重绘
const CollectionCard = React.memo<{
    id: string;
    name: string;
    type: 'artist' | 'album';
    trackCount: number;
    coverUrl?: string;
    onClick: () => void;
    onPlay?: () => void;
    convert: (s: string) => string;
}>(({ name, type, trackCount, coverUrl, onClick, onPlay, convert }) => {
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
                
                {/* 悬停操作 */}
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
            <p className="text-[8px] text-zinc-700 font-black tracking-widest mt-1 uppercase">{trackCount} TRACKS</p>
        </div>
    );
});

const CollectionView: React.FC<CollectionViewProps> = ({ tracks, onNavigate, onPlayAlbum, displayConverter, initialTab = 'artists' }) => {
  const [tab, setTab] = useState<'artists' | 'albums'>(initialTab);
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  const convert = useCallback((s: string) => displayConverter ? displayConverter(s) : s, [displayConverter]);

  // 计算分组数据
  const artistGroups = useMemo(() => {
    const map = new Map<string, { tracks: Track[], cover?: string }>();
    tracks.forEach(t => {
      const key = t.artist || '未知歌手';
      if (!map.has(key)) map.set(key, { tracks: [] });
      const entry = map.get(key)!;
      entry.tracks.push(t);
      if (!entry.cover && t.coverUrl) entry.cover = t.coverUrl;
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks]);

  const albumGroups = useMemo(() => {
    const map = new Map<string, { tracks: Track[], cover?: string }>();
    tracks.forEach(t => {
      const key = t.album || '未知专辑';
      if (!map.has(key)) map.set(key, { tracks: [] });
      const entry = map.get(key)!;
      entry.tracks.push(t);
      if (!entry.cover && t.coverUrl) entry.cover = t.coverUrl;
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks]);

  // 当页签切换时，重置加载限制
  useEffect(() => {
    setDisplayLimit(PAGE_SIZE);
  }, [tab]);

  // 实现无限滚动检测
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setDisplayLimit(prev => prev + PAGE_SIZE);
      }
    }, { threshold: 0.1 });

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [tab]);

  const currentGroups = tab === 'artists' ? artistGroups : albumGroups;
  const displayedGroups = useMemo(() => currentGroups.slice(0, displayLimit), [currentGroups, displayLimit]);

  return (
    <div className="flex flex-col h-full bg-zinc-950/20 overflow-hidden animate-in fade-in duration-500">
      <header className="p-4 md:p-8 flex flex-col md:flex-row md:items-end justify-between gap-6 shrink-0">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase italic">
            馆藏预览
          </h2>
          <div className="h-0.5 w-12 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
        </div>

        <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
          <button 
            onClick={() => setTab('artists')}
            className={`px-8 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all ${tab === 'artists' ? 'bg-zinc-800 text-yellow-500 shadow-xl border border-white/5' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            {convert('歌手')}
          </button>
          <button 
            onClick={() => setTab('albums')}
            className={`px-8 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all ${tab === 'albums' ? 'bg-zinc-800 text-yellow-500 shadow-xl border border-white/5' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            {convert('专辑')}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-32 custom-scrollbar">
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
                coverUrl={data.cover}
                convert={convert}
                onClick={() => onNavigate(tab === 'artists' ? 'artistProfile' : 'albums', name)}
                onPlay={tab === 'albums' ? () => onPlayAlbum?.(name) : undefined}
              />
            ))}
          </div>
        )}

        {/* 无限滚动哨兵 */}
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
