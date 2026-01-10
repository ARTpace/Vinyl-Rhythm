
import React, { useMemo, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Track } from '../types';
import { formatTime } from '../utils/audioParser';

interface ArtistProfileProps {
  artistName: string;
  allTracks: Track[];
  onBack: () => void;
  onPlayTrack: (track: Track) => void;
  onAddToPlaylist?: (track: Track) => void;
  onNavigateToAlbum: (albumName: string) => void;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
}

const ArtistProfile: React.FC<ArtistProfileProps> = ({
  artistName,
  allTracks,
  onBack,
  onPlayTrack,
  onAddToPlaylist,
  onNavigateToAlbum,
  favorites,
  onToggleFavorite
}) => {
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [flyEffect, setFlyEffect] = useState<{ startX: number, startY: number, endX: number, endY: number, track: Track } | null>(null);

  const artistTracks = useMemo(() => 
    allTracks.filter(t => t.artist === artistName),
    [allTracks, artistName]
  );

  const albums = useMemo(() => {
    const map = new Map<string, Track[]>();
    artistTracks.forEach(t => {
      const albumKey = t.album || '未知专辑';
      if (!map.has(albumKey)) map.set(albumKey, []);
      map.get(albumKey)!.push(t);
    });
    return Array.from(map.entries());
  }, [artistTracks]);

  const stats = useMemo(() => {
    const totalSeconds = artistTracks.reduce((acc, t) => acc + (t.duration || 0), 0);
    return {
      count: artistTracks.length,
      albumCount: albums.length,
      duration: Math.round(totalSeconds / 60)
    };
  }, [artistTracks, albums]);

  const heroCover = artistTracks.find(t => t.coverUrl)?.coverUrl;

  const handleAdd = (e: React.MouseEvent, track: Track, btnElement: HTMLElement) => {
    e.stopPropagation();
    if (addedIds.has(track.id)) return;

    const target = document.getElementById('queue-target');
    if (btnElement && target) {
        const startRect = btnElement.getBoundingClientRect();
        const endRect = target.getBoundingClientRect();

        setFlyEffect({
            startX: startRect.left,
            startY: startRect.top,
            endX: endRect.left - startRect.left + (endRect.width / 2) - 20,
            endY: endRect.top - startRect.top + (endRect.height / 2) - 20,
            track
        });

        setTimeout(() => setFlyEffect(null), 800);
    }

    onAddToPlaylist?.(track);
    setAddedIds(prev => new Set(prev).add(track.id));
    setTimeout(() => {
      setAddedIds(prev => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="relative min-h-[50vh] md:min-h-[60vh] flex-shrink-0 flex items-end p-6 md:p-12 pb-10 md:pb-16 overflow-hidden">
        <div className="absolute inset-0 z-0">
          {heroCover ? (
            <>
              <img src={heroCover} className="w-full h-full object-cover scale-125 blur-[100px] opacity-30" alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-black/20" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-[#0a0a0a]" />
          )}
        </div>

        <button 
          onClick={onBack}
          className="absolute top-6 left-6 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-yellow-500 hover:text-black transition-all z-20 active:scale-90"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12 w-full max-w-7xl mx-auto">
          <div className="relative w-48 h-48 md:w-64 md:h-64 shrink-0 mt-8 md:mt-0">
             {albums.slice(0, 3).map(([name, tracks], i) => (
               <div 
                key={name}
                className="absolute inset-0 rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden transition-all duration-700"
                style={{ 
                  transform: `translate(${i * 16}px, -${i * 16}px) rotate(${i * 3}deg)`,
                  zIndex: 10 - i,
                  opacity: 1 - (i * 0.25)
                }}
               >
                 {tracks[0].coverUrl ? (
                   <img src={tracks[0].coverUrl} className="w-full h-full object-cover" alt="" />
                 ) : (
                   <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-600 font-black text-5xl">{artistName[0]}</div>
                 )}
               </div>
             ))}
          </div>

          <div className="flex-1 text-center md:text-left pt-2 md:pt-4">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
               <span className="px-2 py-0.5 rounded bg-yellow-500 text-black text-[9px] font-black uppercase tracking-tighter shadow-lg shadow-yellow-500/20">Verified Collector</span>
               <span className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.3em]">HIFI Library</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white tracking-tighter leading-none mb-6 drop-shadow-2xl">
              {artistName}
            </h1>

            <div className="max-w-2xl">
              <p className="text-zinc-400 text-sm md:text-base leading-relaxed font-medium mb-8 opacity-80 italic">
                在您的本地音乐库中，这位艺术家贡献了 <span className="text-white font-bold">{stats.count}</span> 首曲目，
                分布在 <span className="text-white font-bold">{stats.albumCount}</span> 张不同的专辑中。
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-6">
                 <div className="flex flex-col">
                    <span className="text-white font-black text-xl leading-none">{stats.albumCount}</span>
                    <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest mt-1">Albums</span>
                 </div>
                 <div className="w-px h-6 bg-zinc-800" />
                 <div className="flex flex-col">
                    <span className="text-white font-black text-xl leading-none">{stats.count}</span>
                    <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest mt-1">Tracks</span>
                 </div>
                 <div className="w-px h-6 bg-zinc-800" />
                 <div className="flex flex-col">
                    <span className="text-white font-black text-xl leading-none">{stats.duration}</span>
                    <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest mt-1">Mins</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 md:px-12 py-12 space-y-20 max-w-7xl mx-auto w-full">
        
        <section>
          <div className="flex items-baseline gap-4 mb-8">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter text-nowrap">全部专辑</h2>
            <div className="h-px flex-1 bg-zinc-900" />
            <span className="text-[10px] text-zinc-600 font-black uppercase tracking-widest text-nowrap">{albums.length} Albums</span>
          </div>
          <div className="flex overflow-x-auto gap-6 md:gap-8 pb-8 custom-scrollbar scroll-smooth">
            {albums.map(([name, tracks]) => (
              <div 
                key={name}
                onClick={() => onNavigateToAlbum(name)}
                className="group cursor-pointer flex-shrink-0 w-40 sm:w-48"
              >
                <div className="aspect-square rounded-[2rem] bg-zinc-900 border border-white/5 overflow-hidden shadow-lg group-hover:scale-105 group-hover:shadow-2xl transition-all duration-500 relative">
                  {tracks[0].coverUrl ? (
                    <img src={tracks[0].coverUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt={name} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700 text-3xl font-black">{name[0]}</div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                     <div className="w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center text-black shadow-xl translate-y-4 group-hover:translate-y-0 transition-transform">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>
                     </div>
                  </div>
                </div>
                <h3 className="mt-4 text-white font-bold text-sm truncate group-hover:text-yellow-500 transition-colors uppercase tracking-tight">{name === 'undefined' ? '未知专辑' : name}</h3>
                <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest mt-0.5">{tracks.length} Tracks</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-32">
           <div className="flex items-baseline gap-4 mb-8">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">精选曲目</h2>
            <div className="h-px flex-1 bg-zinc-900" />
            <span className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">{artistTracks.length} Items</span>
          </div>
          <div className="bg-white/[0.01] border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-sm">
            {artistTracks.map((track, i) => {
              const isFav = favorites.has(track.id);
              const isAdded = addedIds.has(track.id);
              return (
                <div 
                  key={track.id}
                  onClick={() => onPlayTrack(track)}
                  className="group flex items-center gap-4 p-4 md:px-6 hover:bg-white/5 border-b border-white/[0.03] last:border-0 cursor-pointer transition-all"
                >
                  <div className="w-6 text-center text-zinc-700 font-mono text-xs group-hover:text-yellow-500 shrink-0">{String(i+1).padStart(2, '0')}</div>
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 overflow-hidden shrink-0">
                    {track.coverUrl ? (
                      <img src={track.coverUrl} className="w-full h-full object-cover opacity-80" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-bold truncate text-sm uppercase tracking-tight group-hover:text-yellow-500 transition-colors">{track.name}</div>
                    <div className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest mt-0.5 truncate">{track.album === '未知专辑' ? 'Single' : track.album}</div>
                  </div>

                  {/* 对齐的操作列 */}
                  <div className="flex items-center gap-1 w-12 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                    <button 
                      onClick={(e) => handleAdd(e, track, e.currentTarget)}
                      className={`p-2 rounded-full transition-all active:scale-90 ${isAdded ? 'bg-green-500 text-black shadow-lg' : 'hover:bg-yellow-500 hover:text-black text-yellow-500/80'}`}
                    >
                      {isAdded ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5"/></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
                      )}
                    </button>
                  </div>

                  <div className="hidden md:block text-zinc-700 font-mono text-xs w-16 shrink-0 text-right">{formatTime(track.duration || 0)}</div>
                  
                  <div className="w-10 flex justify-end shrink-0">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(track.id); }}
                      className={`p-2 transition-all active:scale-75 ${isFav ? 'text-red-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]' : 'text-zinc-800 hover:text-white group-hover:opacity-100'}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>

      {flyEffect && ReactDOM.createPortal(
          <div 
              className="fixed pointer-events-none z-[999] animate-fly"
              style={{ 
                  left: flyEffect.startX, 
                  top: flyEffect.startY,
                  '--fly-x-end': `${flyEffect.endX}px`,
                  '--fly-y-end': `${flyEffect.endY}px`,
                  '--fly-x-mid': `${flyEffect.endX * 0.4}px`,
                  '--fly-y-mid': `${-200}px` 
              } as any}
          >
              <div className="w-10 h-10 rounded-full bg-zinc-900 border-2 border-yellow-500 overflow-hidden shadow-2xl">
                  {flyEffect.track.coverUrl ? (
                      <img src={flyEffect.track.coverUrl} className="w-full h-full object-cover" />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-yellow-500">
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                      </div>
                  )}
              </div>
          </div>,
          document.body
      )}
    </div>
  );
};

export default ArtistProfile;
