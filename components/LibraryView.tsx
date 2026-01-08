
import React, { useMemo, useState, useEffect } from 'react';
import { Track, ViewType } from '../types';

interface LibraryViewProps {
  view: ViewType;
  tracks: Track[];
  onPlay: (track: Track) => void;
  favorites: Set<string>;
  onToggleFavorite: (trackId: string) => void;
  navigationRequest?: { type: 'artists' | 'albums', name: string } | null;
  onNavigationProcessed?: () => void;
}

type NavigationLevel = 'groups' | 'detail' | 'tracks';

interface NavigationState {
  level: NavigationLevel;
  groupName?: string;
  groupCoverUrl?: string;
  tracks?: Track[];
}

const LibraryView: React.FC<LibraryViewProps> = ({ 
  view, 
  tracks, 
  onPlay, 
  favorites, 
  onToggleFavorite, 
  navigationRequest,
  onNavigationProcessed
}) => {
  const [navState, setNavState] = useState<NavigationState>({ level: 'groups' });

  // 根据当前视图过滤/分组曲目
  const groups = useMemo(() => {
    if (view === 'all' || view === 'favorites') return [];

    const property = view === 'artists' ? 'artist' : 'album';
    const map = new Map<string, Track[]>();

    tracks.forEach(track => {
      let key = (track[property as keyof Track] as string) || (view === 'artists' ? "未知歌手" : "未知专辑");

      if (["unknown", "undefined", "null", "various artists"].includes(key.toLowerCase())) {
        key = view === 'artists' ? "未知歌手" : "未知专辑";
      }

      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(track);
    });

    return Array.from(map.entries())
      .map(([name, groupTracks]) => {
        const trackWithCover = groupTracks.find(t => t.coverUrl);
        return {
          name,
          tracks: groupTracks,
          coverUrl: trackWithCover?.coverUrl,
          artist: view === 'artists' ? name : groupTracks[0]?.artist,
          album: view === 'albums' ? name : undefined,
        };
      })
      .sort((a, b) => {
        if (a.name.includes("未知")) return 1;
        if (b.name.includes("未知")) return -1;
        return a.name.localeCompare(b.name, 'zh-CN');
      });
  }, [view, tracks]);

  // 处理外部导航请求
  useEffect(() => {
    if (navigationRequest && navigationRequest.type === view && groups.length > 0) {
      const targetGroup = groups.find(g => g.name === navigationRequest.name);
      if (targetGroup) {
        setNavState({
          level: 'detail',
          groupName: targetGroup.name,
          groupCoverUrl: targetGroup.coverUrl,
          tracks: targetGroup.tracks
        });
      }
      onNavigationProcessed?.();
    }
  }, [navigationRequest, view, groups, onNavigationProcessed]);

  useEffect(() => {
    if (!navigationRequest) {
      setNavState({ level: 'groups' });
    }
  }, [view]);

  const displayTracks = useMemo(() => {
    if (view === 'all') return tracks;
    if (view === 'favorites') return tracks.filter(t => favorites.has(t.id));
    return [];
  }, [view, tracks, favorites]);

  const getPageTitle = () => {
    if (view === 'all') return '全部歌曲';
    if (view === 'favorites') return '我的收藏';
    switch (navState.level) {
      case 'groups': return view === 'artists' ? '歌手预览' : '专辑浏览';
      case 'detail': return navState.groupName || (view === 'artists' ? '歌手详情' : '专辑详情');
      default: return '';
    }
  };

  // 添加 getSubTitle 函数定义以修复编译错误
  const getSubTitle = () => {
    if (view === 'all') return '探索您的本地曲库';
    if (view === 'favorites') return '您最喜爱的音乐';
    if (navState.level === 'groups') {
      return view === 'artists' ? '发现更多创作者' : '浏览您的珍藏专辑';
    }
    return view === 'artists' ? '艺人个人资料' : '专辑内容预览';
  };

  const handleGroupClick = (group: typeof groups[0]) => {
    setNavState({
      level: 'detail',
      groupName: group.name,
      groupCoverUrl: group.coverUrl,
      tracks: group.tracks
    });
  };

  const renderContent = () => {
    if (tracks.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 animate-in fade-in zoom-in-95 duration-700">
          <div className="text-7xl mb-6 opacity-20">📦</div>
          <p className="text-xl font-black">尚未导入音乐</p>
        </div>
      );
    }

    // 统一处理列表入场
    const renderTrackList = (targetTracks: Track[]) => (
      <div className="grid grid-cols-1 gap-1 pb-10">
        {targetTracks.map((track, i) => (
          <div 
            key={track.id} 
            className="animate-in fade-in slide-in-from-right-8 duration-500 fill-mode-both"
            style={{ animationDelay: `${Math.min(i * 40, 600)}ms` }}
          >
            <TrackItem
              track={track}
              index={i}
              onPlay={onPlay}
              view={view}
              isFavorite={favorites.has(track.id)}
              onToggleFavorite={() => onToggleFavorite(track.id)}
            />
          </div>
        ))}
      </div>
    );

    if (view === 'all' || view === 'favorites') {
      return (
        <div className="flex-1 overflow-y-auto p-8 pt-0 custom-scrollbar">
          {view === 'favorites' && displayTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-40 animate-in zoom-in-95 duration-500">
              <div className="text-6xl mb-4">❤️</div>
              <p className="font-bold">收藏夹空空如也</p>
            </div>
          ) : renderTrackList(displayTracks)}
        </div>
      );
    }

    if (navState.level === 'groups') {
      return (
        <div className="flex-1 overflow-y-auto p-8 pt-0 custom-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
            {groups.map((group, idx) => (
              <div
                key={group.name}
                onClick={() => handleGroupClick(group)}
                className="group cursor-pointer animate-in fade-in zoom-in-90 duration-500 fill-mode-both"
                style={{ animationDelay: `${Math.min(idx * 30, 450)}ms` }}
              >
                <div className={`
                  aspect-square mb-4 bg-zinc-800 flex items-center justify-center overflow-hidden shadow-2xl
                  transition-all duration-500 group-hover:scale-105 group-hover:rotate-1
                  ${view === 'artists' ? 'rounded-full border-4 border-zinc-800 group-hover:border-yellow-500' : 'rounded-2xl border border-zinc-700/50'}
                `}>
                  {group.coverUrl ? (
                    <img src={group.coverUrl} alt={group.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-5xl opacity-10 select-none">{view === 'artists' ? '👤' : '💿'}</div>
                  )}
                </div>
                <h3 className="text-zinc-100 font-bold text-center truncate group-hover:text-yellow-500 transition-colors">{group.name}</h3>
                <p className="text-zinc-500 text-xs text-center mt-1 font-bold opacity-60 uppercase">{group.tracks.length} Tracks</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (navState.level === 'detail' && navState.tracks) {
      return (
        <div 
          key={navState.groupName} 
          className="flex-1 overflow-y-auto p-8 pt-0 custom-scrollbar"
        >
          <div className="animate-in fade-in slide-in-from-top-4 duration-700 ease-out fill-mode-both">
            <div className="flex items-center gap-8 mb-10 p-8 bg-gradient-to-br from-white/5 to-transparent rounded-[2rem] border border-white/5 backdrop-blur-sm">
                <div className={`
                w-40 h-40 flex-shrink-0 shadow-2xl overflow-hidden transition-all duration-700
                ${view === 'artists' ? 'rounded-full ring-4 ring-zinc-800' : 'rounded-3xl'}
                group-hover:scale-105
                `}>
                {navState.groupCoverUrl ? (
                    <img src={navState.groupCoverUrl} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-5xl opacity-20">
                    {view === 'artists' ? '👤' : '💿'}
                    </div>
                )}
                </div>
                <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-yellow-500 text-black text-[9px] font-black rounded uppercase tracking-tighter">Verified</span>
                    <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{view === 'artists' ? 'Official Artist' : 'Local Album'}</span>
                </div>
                <h3 className="text-4xl font-black text-white mb-2 tracking-tighter">{navState.groupName}</h3>
                <p className="text-zinc-400 font-medium text-sm max-w-md opacity-70">
                    此内容来自您的本地媒体库，共包含 {navState.tracks.length} 首高质量音频曲目。
                </p>
                </div>
            </div>
          </div>
          {renderTrackList(navState.tracks)}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="p-8 pb-6 shrink-0 z-10">
        <div className="flex items-end justify-between">
          <div className="animate-in fade-in slide-in-from-left-6 duration-700 cubic-bezier(0.16, 1, 0.3, 1)">
            <h2 className="text-5xl font-black text-white tracking-tighter">
              {getPageTitle()}
            </h2>
            <div className="flex items-center gap-3 mt-2">
                <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse"></div>
                <p className="text-zinc-500 font-bold text-xs tracking-widest uppercase opacity-60">
                    {getSubTitle()}
                </p>
            </div>
          </div>
          {(navState.level !== 'groups' && view !== 'all' && view !== 'favorites') && (
            <button
              onClick={() => setNavState({ level: 'groups' })}
              className="group flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all text-sm font-black border border-white/5 shadow-2xl active:scale-95 animate-in fade-in slide-in-from-right-6 duration-700"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:-translate-x-1">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              BACK TO EXPLORE
            </button>
          )}
        </div>
      </div>
      {renderContent()}
    </div>
  );
};

interface TrackItemProps {
  track: Track;
  index: number;
  onPlay: (t: Track) => void;
  view: ViewType;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

const TrackItem: React.FC<TrackItemProps> = ({ track, index, onPlay, view, isFavorite, onToggleFavorite }) => {
  const [isPulsing, setIsPulsing] = useState(false);

  const formattedDuration = track.duration
    ? `${Math.floor(track.duration / 60)}:${Math.floor(track.duration % 60).toString().padStart(2, '0')}`
    : "--:--";

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPulsing(true);
    onToggleFavorite();
    setTimeout(() => setIsPulsing(false), 400);
  };

  return (
    <div
      onClick={() => onPlay(track)}
      className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all cursor-pointer group border border-transparent hover:border-white/5 active:scale-[0.985] duration-200"
    >
      <div className="w-8 text-zinc-700 font-black text-[10px] text-center group-hover:text-yellow-500 transition-colors tracking-tighter">
        {(index + 1).toString().padStart(2, '0')}
      </div>
      <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center overflow-hidden shadow-lg flex-shrink-0 group-hover:scale-110 transition-transform duration-500 border border-white/5">
        {track.coverUrl ? (
          <img src={track.coverUrl} className="w-full h-full object-cover" alt="" />
        ) : (
          <span className="opacity-20 text-xl">🎵</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-white font-black truncate group-hover:text-yellow-500 transition-colors text-base tracking-tight">
          {track.name}
        </div>
        <div className="text-zinc-500 text-[10px] truncate mt-0.5 font-black uppercase tracking-widest opacity-60">
          {track.artist}
          {view !== 'artists' && track.album && <span className="mx-2 text-zinc-800">/</span>}
          {view !== 'artists' && track.album && <span>{track.album}</span>}
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-[10px] text-zinc-600 font-black italic tabular-nums opacity-40 group-hover:opacity-100 transition-opacity">
          {formattedDuration}
        </div>
        <div className="flex items-center gap-1">
            <button
            onClick={handleFavoriteClick}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 ${
                isPulsing ? 'scale-125' : 'hover:scale-110'
            } ${
                isFavorite
                ? 'text-red-500 opacity-100'
                : 'text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-400'
            }`}
            >
            <svg 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill={isFavorite ? 'currentColor' : 'none'} 
              stroke="currentColor" 
              strokeWidth="3" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className={`transition-all duration-300 ${isPulsing ? 'drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]' : ''}`}
            >
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
            </button>
            <button
            onClick={(e) => {
                e.stopPropagation();
                onPlay(track);
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-yellow-500 text-black opacity-0 group-hover:opacity-100 transition-all hover:scale-110 hover:bg-yellow-400 shadow-xl shadow-yellow-500/20 active:scale-90"
            >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            </button>
        </div>
      </div>
    </div>
  );
};

export default LibraryView;
