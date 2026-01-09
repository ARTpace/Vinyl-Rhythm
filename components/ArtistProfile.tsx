
import React, { useMemo } from 'react';
import { Track } from '../types';
import { formatTime } from '../utils/audioParser';

interface ArtistProfileProps {
  artistName: string;
  allTracks: Track[];
  onBack: () => void;
  onPlayTrack: (track: Track) => void;
  onNavigateToAlbum: (albumName: string) => void;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
}

const ArtistProfile: React.FC<ArtistProfileProps> = ({
  artistName,
  allTracks,
  onBack,
  onPlayTrack,
  onNavigateToAlbum,
  favorites,
  onToggleFavorite
}) => {
  // 1. 数据聚合
  const artistTracks = useMemo(() => 
    allTracks.filter(t => t.artist === artistName),
    [allTracks, artistName]
  );

  const albums = useMemo(() => {
    const map = new Map<string, Track[]>();
    artistTracks.forEach(t => {
      if (!map.has(t.album)) map.set(t.album, []);
      map.get(t.album)!.push(t);
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

  // 获取一张代表性的封面作为背景
  const heroCover = artistTracks.find(t => t.coverUrl)?.coverUrl;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* 沉浸式 Hero Section */}
      <div className="relative h-[40vh] md:h-[50vh] flex-shrink-0 flex items-end p-6 md:p-12 overflow-hidden">
        {/* 背景大图 - 封面模糊处理 */}
        <div className="absolute inset-0 z-0">
          {heroCover ? (
            <>
              <img src={heroCover} className="w-full h-full object-cover scale-110 blur-3xl opacity-40" alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-black/20" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-[#0a0a0a]" />
          )}
        </div>

        {/* 返回按钮 */}
        <button 
          onClick={onBack}
          className="absolute top-6 left-6 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-yellow-500 hover:text-black transition-all z-20 active:scale-90"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>

        {/* 歌手信息展示 */}
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-10 w-full">
          {/* 封面堆叠艺术 */}
          <div className="relative w-40 h-40 md:w-56 md:h-56 shrink-0 group">
             {albums.slice(0, 3).map(([name, tracks], i) => (
               <div 
                key={name}
                className="absolute inset-0 rounded-2xl shadow-2xl border border-white/10 overflow-hidden transition-all duration-500"
                style={{ 
                  transform: `translate(${i * 12}px, -${i * 12}px) rotate(${i * 2}deg)`,
                  zIndex: 10 - i,
                  opacity: 1 - (i * 0.2)
                }}
               >
                 {tracks[0].coverUrl ? (
                   <img src={tracks[0].coverUrl} className="w-full h-full object-cover" alt="" />
                 ) : (
                   <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-600 font-black text-4xl">{artistName[0]}</div>
                 )}
               </div>
             ))}
          </div>

          <div className="flex-1 text-center md:text-left pb-2">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
               <span className="px-2 py-0.5 rounded bg-yellow-500 text-black text-[10px] font-black uppercase tracking-tighter shadow-lg shadow-yellow-500/20">Verified Artist</span>
               <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Local Library</span>
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white tracking-tighter leading-none mb-4 drop-shadow-2xl">
              {artistName}
            </h1>
            <div className="flex items-center justify-center md:justify-start gap-4 text-zinc-400 font-bold text-xs md:text-sm">
               <span className="flex items-center gap-1.5"><span className="text-white">{stats.albumCount}</span> 张专辑</span>
               <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
               <span className="flex items-center gap-1.5"><span className="text-white">{stats.count}</span> 首曲目</span>
               <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
               <span className="flex items-center gap-1.5"><span className="text-white">{stats.duration}</span> 分钟时长</span>
            </div>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="px-6 md:px-12 py-10 space-y-16">
        
        {/* 数据生成的简介板块 */}
        <section className="max-w-4xl">
           <h2 className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.4em] mb-4">关于歌手</h2>
           <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 md:p-10 backdrop-blur-sm shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 blur-3xl rounded-full" />
              <p className="text-zinc-300 text-lg md:text-xl leading-relaxed italic font-medium">
                "{artistName} 是您音乐库中极具分量的收藏。您目前保存了其涵盖 <span className="text-yellow-500 font-black">{stats.albumCount}</span> 张不同专辑的 
                <span className="text-yellow-500 font-black"> {stats.count} </span> 
                首经典作品。从曲库分析来看，这些作品为您提供了约 <span className="text-yellow-500 font-black">{stats.duration}</span> 分钟的高品质听觉享受。
                每一段旋律都记录着独特的本地存储时光。"
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                 {Array.from(new Set(artistTracks.map(t => t.file.name.split('.').pop()?.toUpperCase()))).map(ext => (
                   <span key={ext} className="px-3 py-1 rounded-full bg-zinc-900 border border-white/5 text-[9px] font-black text-zinc-500 uppercase tracking-widest">{ext} Format</span>
                 ))}
                 <span className="px-3 py-1 rounded-full bg-zinc-900 border border-white/5 text-[9px] font-black text-zinc-500 uppercase tracking-widest">Hi-Fi Collection</span>
              </div>
           </div>
        </section>

        {/* 专辑展示 */}
        <section>
          <div className="flex items-baseline gap-4 mb-6">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">全部专辑</h2>
            <span className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">{albums.length} Albums Found</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-8">
            {albums.map(([name, tracks]) => (
              <div 
                key={name}
                onClick={() => onNavigateToAlbum(name)}
                className="group cursor-pointer"
              >
                <div className="aspect-square rounded-2xl bg-zinc-900 border border-white/5 overflow-hidden shadow-lg group-hover:scale-105 group-hover:shadow-2xl transition-all duration-500 relative">
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

        {/* 曲目列表 */}
        <section className="pb-32">
           <div className="flex items-baseline gap-4 mb-6">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">库中曲目</h2>
            <span className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">{artistTracks.length} Songs Total</span>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] overflow-hidden">
            {artistTracks.map((track, i) => (
              <div 
                key={track.id}
                onClick={() => onPlayTrack(track)}
                className="group flex items-center gap-4 p-4 hover:bg-white/5 border-b border-white/[0.03] last:border-0 cursor-pointer transition-all"
              >
                <div className="w-6 text-center text-zinc-700 font-mono text-xs group-hover:text-yellow-500">{String(i+1).padStart(2, '0')}</div>
                <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                  {track.coverUrl ? (
                    <img src={track.coverUrl} className="w-full h-full object-cover opacity-80" alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold truncate text-sm uppercase tracking-tight">{track.name}</div>
                  <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">{track.album}</div>
                </div>
                <div className="hidden md:block text-zinc-700 font-mono text-xs">{formatTime(track.duration || 0)}</div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(track.id); }}
                  className={`p-2 transition-all active:scale-75 ${favorites.has(track.id) ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]' : 'text-zinc-800 hover:text-white'}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={favorites.has(track.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                </button>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
};

export default ArtistProfile;
