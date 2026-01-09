
import React, { useMemo, useState, useEffect } from 'react';
import { Track, ViewType } from '../types';
import { formatTime } from '../utils/audioParser';

interface LibraryViewProps {
  view: ViewType;
  tracks: Track[];
  onPlay: (track: Track) => void;
  favorites: Set<string>;
  onToggleFavorite: (trackId: string) => void;
  navigationRequest?: { type: 'artists' | 'albums' | 'folders', name: string } | null;
  onNavigationProcessed?: () => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ 
  view, tracks, onPlay, favorites, onToggleFavorite,
  navigationRequest, onNavigationProcessed 
}) => {
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  
  useEffect(() => {
    if (navigationRequest && navigationRequest.type === view) {
      setActiveGroup(navigationRequest.name);
      onNavigationProcessed?.();
    }
  }, [navigationRequest, view, onNavigationProcessed]);

  const groups = useMemo(() => {
    const map = new Map<string, Track[]>();
    
    if (view === 'all' || view === 'favorites') return null;

    tracks.forEach(track => {
      let key = '';
      if (view === 'artists') key = track.artist;
      else if (view === 'albums') key = track.album;
      else if (view === 'folders') key = track.folderId || 'Default';
      
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(track);
    });
    
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks, view]);

  const filteredTracks = useMemo(() => {
    if (view === 'favorites') return tracks.filter(t => favorites.has(t.id));
    if (view === 'all') return tracks;
    if (activeGroup && groups) return groups.find(g => g[0] === activeGroup)?.[1] || [];
    return [];
  }, [tracks, view, favorites, activeGroup, groups]);

  // 渲染专辑封套组件 (拟物化 3D 悬浮风格)
  const renderAlbumSleeve = (name: string, groupTracks: Track[]) => {
    const coverUrl = groupTracks[0]?.coverUrl;
    return (
      <div 
        key={name}
        onClick={() => setActiveGroup(name)}
        className="group relative cursor-pointer perspective-1000 z-10 hover:z-20"
      >
        {/* 底层厚度模拟 (层叠感) */}
        <div className="absolute inset-0 bg-black/40 translate-x-1 translate-y-1 rounded-[3px] blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
        <div className="absolute inset-0 bg-[#0a0a0a] translate-x-[2px] translate-y-[2px] rounded-[3px] border border-white/5 opacity-0 group-hover:opacity-100 transition-all duration-500 delay-75"></div>

        {/* 封套主体 */}
        <div className="relative z-10 aspect-square bg-[#1a1a1a] rounded-[3px] shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-2 group-hover:rotate-x-6 group-hover:rotate-y-[-6deg] group-hover:shadow-[20px_25px_50px_rgba(0,0,0,0.8)] overflow-hidden border border-white/10">
          
          {/* 封面图片 */}
          {coverUrl ? (
            <img src={coverUrl} className="w-full h-full object-cover select-none" alt={name} />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600 font-black text-3xl">
              {name[0]?.toUpperCase()}
            </div>
          )}

          {/* 拟物化细节：封套开口阴影 (右侧深邃感) */}
          <div className="absolute top-0 right-0 w-[4px] h-full bg-gradient-to-l from-black/60 to-transparent pointer-events-none"></div>

          {/* 拟物化细节：模拟纸张/纸板纹理 */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.08] bg-[url('https://www.transparenttextures.com/patterns/cardboard-flat.png')] mix-blend-overlay"></div>

          {/* 动态扫光 (Glare Effect) - 模拟塑料保护套反射 */}
          <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700">
            <div className="absolute -inset-[100%] bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-x-[-100%] translate-y-[100%] group-hover:translate-x-[100%] group-hover:translate-y-[-100%] transition-transform duration-1000 ease-in-out"></div>
          </div>

          {/* 经典的环状磨损痕迹 (Ring Wear) */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_40%,rgba(255,255,255,0.015)_50%,transparent_60%)]"></div>

          {/* 左侧书脊高亮线 */}
          <div className="absolute top-0 left-0 w-[1px] h-full bg-white/10 shadow-[1px_0_2px_rgba(255,255,255,0.05)]"></div>
          
          {/* 内部信息遮罩 - 采用更优雅的渐入方式 */}
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500">
             <div className="flex items-center justify-between text-white/80">
                <span className="text-[7px] font-black uppercase tracking-[0.2em]">Collector's Edition</span>
                <span className="text-[8px] font-mono">{groupTracks.length} Pcs</span>
             </div>
          </div>
        </div>

        {/* 标题及歌手信息 */}
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

  // 分组视图 (Level 1)
  if (groups && !activeGroup) {
    const isAlbumView = view === 'albums';
    return (
      <div className="p-4 md:p-8 h-full overflow-y-auto custom-scrollbar bg-zinc-950/20">
        <header className="mb-8 relative">
           <div className="flex items-baseline gap-3">
              <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase">
                {view === 'albums' ? 'Albums' : view === 'artists' ? 'Artists' : 'Library'}
              </h2>
              <span className="text-[10px] text-zinc-600 font-black tracking-[0.4em] uppercase">{groups.length} Items</span>
           </div>
           <div className="h-0.5 w-12 bg-yellow-500 mt-2 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
        </header>

        {/* 更加紧凑且均衡的网格布局 */}
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

  // 歌曲列表视图 (Level 2 or 'all'/'favorites')
  return (
    <div className="flex flex-col h-full bg-[#111111]/30">
      <div className="p-4 md:p-8 pb-4 shrink-0 flex items-center gap-6">
         {activeGroup && (
           <button onClick={() => setActiveGroup(null)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-yellow-500 hover:text-black text-white transition-all active:scale-90 shadow-lg">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
           </button>
         )}
         <div className="min-w-0">
            <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter truncate leading-tight uppercase">{activeGroup || (view === 'favorites' ? 'Favorites' : 'All Tracks')}</h2>
            <p className="text-zinc-500 text-[10px] font-black tracking-[0.3em] uppercase mt-0.5">{filteredTracks.length} Selections</p>
         </div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-8 pb-24">
         <div className="bg-white/[0.02] border border-white/5 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden backdrop-blur-sm shadow-2xl">
            {filteredTracks.map((track, i) => (
              <div 
                key={track.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', track.id)}
                className="group flex items-center gap-4 p-3 md:p-4 hover:bg-white/5 transition-all cursor-pointer border-b border-white/[0.03] last:border-0"
                onClick={() => onPlay(track)}
              >
                 <div className="w-6 text-center text-zinc-700 font-mono text-xs group-hover:text-yellow-500">{String(i + 1).padStart(2, '0')}</div>
                 <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-zinc-800 overflow-hidden relative shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                    {track.coverUrl ? (
                      <img src={track.coverUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg></div>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M5 3l14 9-14 9V3z"/></svg>
                    </div>
                 </div>
                 <div className="flex-1 min-w-0">
                    <div className="text-white font-black truncate text-sm md:text-base tracking-tight">{track.name}</div>
                    <div className="text-zinc-500 text-[9px] md:text-xs font-bold uppercase tracking-widest mt-0.5">{track.artist}</div>
                 </div>
                 <div className="hidden lg:block text-zinc-600 text-[10px] font-black uppercase tracking-widest max-w-[150px] truncate">{track.album}</div>
                 <div className="hidden md:block text-zinc-700 font-mono text-[10px] w-12 text-right">{formatTime(track.duration || 0)}</div>
                 <button 
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(track.id); }}
                    className={`p-2 rounded-full transition-all active:scale-75 ${favorites.has(track.id) ? 'text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'text-zinc-800 hover:text-white group-hover:opacity-100'}`}
                 >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={favorites.has(track.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                 </button>
              </div>
            ))}
            {filteredTracks.length === 0 && (
              <div className="py-20 text-center">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                </div>
                <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em]">No Tracks Found</p>
              </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default LibraryView;
