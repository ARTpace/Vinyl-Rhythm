
import React, { useMemo, useState, useEffect } from 'react';
import { Track, ViewType } from '../types';

interface LibraryViewProps {
  view: ViewType;
  tracks: Track[];
  onPlay: (track: Track) => void;
  favorites: Set<string>;
  onToggleFavorite: (trackId: string) => void;
  navigationRequest?: { type: 'artists' | 'albums' | 'folders', name: string } | null;
  onNavigationProcessed?: () => void;
}

type NavigationLevel = 'groups' | 'detail';

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
    
    if (view === 'all') return null;
    if (view === 'favorites') return null;

    tracks.forEach(track => {
      let key = '';
      if (view === 'artists') key = track.artist;
      else if (view === 'albums') key = track.album;
      else if (view === 'folders') {
         // 这里我们假设 folderId 存在，如果没有，可以用一个默认值
         const folderName = track.folderId || '未分类';
         // 实际上我们需要根据folderId找到folderName，或者在tracks里存folderName
         // 为了简化，这里我们暂时不显示文件夹名，或者需要App传递Folder信息。
         // 鉴VPApp.tsx逻辑，我们暂用track.folderId做key，显示逻辑另处理
         // 更好的做法是track包含folderName，或者通过Context获取
         // 这里简化处理：直接按track.folderId分组，如果UI要显示名字需要额外逻辑
         // 由于types没改，我们先按artist/album逻辑处理，foldersview稍微特殊一点
         // 如果是folders视图，我们其实已经在import时存了结构，但tracks是扁平的。
         // 我们可以尝试解析路径或者利用App传下来的folder map。
         // 暂时回退到简单分组:
         key = track.folderId || 'Default';
      }
      
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(track);
    });
    
    // Folders View 特殊处理：我们需要显示文件夹名而不是ID
    // 由于这里没法直接拿ID名，这是一个缺陷。但我们可以简单展示ID或者"目录 X"
    // 在真实应用中，应该传入 folders map。
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks, view]);

  const filteredTracks = useMemo(() => {
    if (view === 'favorites') {
      return tracks.filter(t => favorites.has(t.id));
    }
    if (view === 'all') {
      return tracks;
    }
    if (activeGroup && groups) {
      return groups.find(g => g[0] === activeGroup)?.[1] || [];
    }
    return [];
  }, [tracks, view, favorites, activeGroup, groups]);

  const handleDragStart = (e: React.DragEvent, trackId: string) => {
    e.dataTransfer.setData('text/plain', trackId);
    e.dataTransfer.effectAllowed = 'copyMove'; // 允许复制或移动
  };

  // 渲染分组列表 (Level 1)
  if (groups && !activeGroup) {
    return (
      <div className="p-8 h-full overflow-y-auto custom-scrollbar">
        <h2 className="text-4xl font-black text-white mb-8 tracking-tighter uppercase">{view}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {groups.map(([name, groupTracks]) => (
            <div 
              key={name}
              onClick={() => setActiveGroup(name)}
              className="group bg-white/5 hover:bg-white/10 rounded-[2rem] p-6 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-2xl border border-white/5 flex flex-col items-center text-center gap-4 aspect-square justify-center"
            >
              <div className="relative w-24 h-24">
                 <div className="absolute inset-0 rounded-full bg-zinc-800 shadow-inner flex items-center justify-center overflow-hidden border-2 border-zinc-700 group-hover:border-yellow-500 transition-colors">
                    {groupTracks[0]?.coverUrl ? (
                      <img src={groupTracks[0].coverUrl} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <span className="text-2xl font-black text-zinc-600">{name[0]?.toUpperCase()}</span>
                    )}
                 </div>
                 <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-zinc-900 rounded-full flex items-center justify-center text-xs font-bold text-yellow-500 border border-zinc-700 shadow-lg">
                    {groupTracks.length}
                 </div>
              </div>
              <div>
                 <h3 className="text-white font-bold truncate max-w-[140px]">{name === 'undefined' ? '未知' : name}</h3>
                 <p className="text-zinc-500 text-xs uppercase tracking-widest mt-1">Group</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 渲染歌曲列表 (Level 2 or 'all'/'favorites')
  return (
    <div className="flex flex-col h-full">
      <div className="p-8 pb-4 shrink-0 flex items-center gap-4">
         {activeGroup && (
           <button onClick={() => setActiveGroup(null)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
           </button>
         )}
         <div>
            <h2 className="text-3xl font-black text-white tracking-tighter">{activeGroup || (view === 'favorites' ? '我的收藏' : '全部歌曲')}</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">{filteredTracks.length} TRACKS</p>
         </div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-24">
         <div className="space-y-1">
            {filteredTracks.map((track, i) => (
              <div 
                key={track.id}
                draggable
                onDragStart={(e) => handleDragStart(e, track.id)}
                className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5"
                onClick={() => onPlay(track)}
              >
                 <div className="w-8 text-center text-zinc-600 font-black text-xs group-hover:text-yellow-500">{i + 1}</div>
                 <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden relative shrink-0">
                    {track.coverUrl ? (
                      <img src={track.coverUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M5 3l14 9-14 9V3z"/></svg>
                    </div>
                 </div>
                 <div className="flex-1 min-w-0">
                    <div className="text-white font-bold truncate text-sm">{track.name}</div>
                    <div className="text-zinc-500 text-xs truncate">{track.artist}</div>
                 </div>
                 <div className="hidden md:block text-zinc-600 text-xs font-mono">{track.album}</div>
                 <button 
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(track.id); }}
                    className={`p-2 rounded-full transition-colors ${favorites.has(track.id) ? 'text-red-500' : 'text-zinc-700 hover:text-white opacity-0 group-hover:opacity-100'}`}
                 >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={favorites.has(track.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                 </button>
              </div>
            ))}
            {filteredTracks.length === 0 && (
              <div className="py-20 text-center text-zinc-600">
                <p className="text-sm font-bold uppercase tracking-widest">Nothing Here</p>
              </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default LibraryView;
