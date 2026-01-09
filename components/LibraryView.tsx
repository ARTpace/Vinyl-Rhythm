
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

  // 渲染专辑封套组件 (拟物化黑胶封套)
  const renderAlbumSleeve = (name: string, groupTracks: Track[]) => {
    const coverUrl = groupTracks[0]?.coverUrl;
    return (
      <div 
        key={name}
        onClick={() => setActiveGroup(name)}
        className="group relative cursor-pointer perspective-1000 z-10 hover:z-20 transition-[z-index] duration-0"
      >
        {/* 背景黑胶盘片 (Hover滑出) - 缩小了滑出距离以适应更紧凑的网格 */}
        <div className="absolute top-[8%] right-2 w-[85%] h-[85%] bg-[#0a0a0a] rounded-full shadow-2xl transition-all duration-500 ease-out group-hover:translate-x-8 group-hover:rotate-45 vinyl-texture flex items-center justify-center border border-white/5 overflow-hidden">
           <div className="w-1/3 h-1/3 rounded-full border-[6px] border-zinc-900 bg-zinc-800 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
           </div>
           <div className="absolute inset-0 rounded-full vinyl-reflection opacity-20"></div>
        </div>

        {/* 封套主体 */}
        <div className="relative z-10 aspect-square bg-[#1a1a1a] rounded-[3px] shadow-[0_6px_20px_rgba(0,0,0,0.4)] transition-all duration-500 group-hover:-translate-y-1.5 group-hover:shadow-[0_15px_40px_rgba(0,0,0,0.7)] overflow-hidden border border-white/5">
          {coverUrl ? (
            <img src={coverUrl} className="w-full h-full object-cover" alt={name} />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600 font-black text-3xl">
              {name[0]?.toUpperCase()}
            </div>
          )}

          {/* 拟物化细节：封套压痕 */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_45%,rgba(255,255,255,0.02)_55%,transparent_65%)] opacity-50"></div>
          
          {/* 模拟纸张纹理 */}
          <div className="absolute inset-0 pointer-events-none opacity-5 bg-[url('https://www.transparenttextures.com/patterns/cardboard-flat.png')] mix-blend-overlay"></div>

          {/* 左侧书脊光影线 */}
          <div className="absolute top-0 left-0 w-[1.5px] h-full bg-white/5 shadow-[1px_0_3px_rgba(0,0,0,0.3)]"></div>
          
          {/* 底部信息遮罩 */}
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black via-black/60 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-500">
             <div className="flex items-center justify-between text-white">
                <span className="text-[8px] font-black uppercase tracking-widest">Album</span>
                <span className="text-[8px] font-mono opacity-60">{groupTracks.length} Pcs</span>
             </div>
          </div>
        </div>

        {/* 标题 - 增加上间距，确保不被封套阴影压平 */}
        <div className="mt-3 px-0.5">
          <h3 className="text-zinc-200 font-bold text-xs truncate group-hover:text-yellow-500 transition-colors leading-tight">
            {name === 'undefined' ? '未知专辑' : name}
          </h3>
          <p className="text-zinc-500 text-[9px] font-black uppercase tracking-tight mt-1 truncate">
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
        <header className="mb-8">
           <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase mb-2">
             {view === 'albums' ? 'Albums' : view === 'artists' ? 'Artists' : 'Library'}
           </h2>
           <div className="h-1 w-12 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
        </header>

        {/* 调整网格列数：手机端3列，平板5列，桌面端7列，超宽屏8列 */}
        <div className={`grid gap-x-4 gap-y-8 ${isAlbumView 
          ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8' 
          : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8'}`}>
          {groups.map(([name, groupTracks]) => (
            isAlbumView ? renderAlbumSleeve(name, groupTracks) : (
              <div 
                key={name}
                onClick={() => setActiveGroup(name)}
                className="group flex flex-col items-center gap-3 cursor-pointer"
              >
                <div className="relative w-full aspect-square">
                   <div className="absolute inset-0 rounded-full bg-zinc-900 border border-zinc-800 shadow-xl overflow-hidden group-hover:scale-105 group-hover:border-yellow-500/50 transition-all duration-500">
                      {groupTracks[0]?.coverUrl ? (
                        <img src={groupTracks[0].coverUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700 text-2xl font-black">{name[0]?.toUpperCase()}</div>
                      )}
                   </div>
                   <div className="absolute bottom-0 right-0 w-6 h-6 bg-black rounded-full flex items-center justify-center text-[8px] font-bold text-yellow-500 border border-white/5 shadow-xl">{groupTracks.length}</div>
                </div>
                <h3 className="text-zinc-300 font-bold text-[11px] text-center truncate w-full group-hover:text-yellow-500 transition-colors">{name === 'undefined' ? '未知' : name}</h3>
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
           <button onClick={() => setActiveGroup(null)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-yellow-500 hover:text-black text-white transition-all active:scale-90">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
           </button>
         )}
         <div className="min-w-0">
            <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter truncate leading-tight uppercase">{activeGroup || (view === 'favorites' ? 'Favorites' : 'All Tracks')}</h2>
            <p className="text-zinc-500 text-[10px] font-black tracking-[0.3em] uppercase mt-0.5">{filteredTracks.length} Selections</p>
         </div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-8 pb-24">
         <div className="bg-white/[0.02] border border-white/5 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden">
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
