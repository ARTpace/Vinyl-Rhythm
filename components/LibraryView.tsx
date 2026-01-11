
import { Track, ViewType, LibraryFolder } from '../types';
import { formatTime } from '../utils/audioParser';
import { scrapeNeteaseMusic } from '../services/metadataService';
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';

interface LibraryViewProps {
  view: ViewType;
  tracks: Track[];
  folders?: LibraryFolder[]; 
  onPlay: (track: Track) => void;
  onAddToPlaylist?: (track: Track) => void;
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

const PAGE_SIZE = 50; 

const FilterDropdown: React.FC<{
  value: string;
  options: { id: string; label: string }[];
  onChange: (val: any) => void;
  icon?: React.ReactNode;
}> = ({ value, options, onChange, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeLabel = options.find(o => o.id === value)?.label || '全部';

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/5 border transition-all hover:bg-white/10 ${value !== 'all' ? 'border-yellow-500/40 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.15)]' : 'border-white/5 text-zinc-400'}`}
      >
        <span className="shrink-0">{icon}</span>
        <span className="text-[11px] font-black uppercase tracking-widest truncate max-w-[100px]">{activeLabel}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {options.map(opt => (
              <button
                key={opt.id}
                onClick={() => { onChange(opt.id); setIsOpen(false); }}
                className={`w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${value === opt.id ? 'bg-yellow-500 text-black' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const TrackRow = React.memo<{
  track: Track;
  index: number;
  isFavorite: boolean;
  onPlay: (track: Track) => void;
  onAddToPlaylist?: (track: Track) => void;
  onToggleFavorite: (id: string) => void;
  onScrape: (track: Track) => void;
  isScraping: boolean;
  onNavigate?: (type: 'artists' | 'albums' | 'folders' | 'artistProfile', name: string) => void;
  displayConverter?: (str: string) => string;
}>(({ track, index, isFavorite, onPlay, onAddToPlaylist, onToggleFavorite, onScrape, isScraping, onNavigate, displayConverter }) => {
  const [isAdded, setIsAdded] = useState(false);
  const [flyEffect, setFlyEffect] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const convert = (s: string) => displayConverter ? displayConverter(s) : s;
  
  const bitrateKbps = track.bitrate ? Math.round(track.bitrate / 1000) : 0;
  const isHires = bitrateKbps >= 2000;
  const isLossless = bitrateKbps >= 800 && bitrateKbps < 2000;
  
  const isGhostTrack = !track.coverUrl && !track.coverBlob && track.folderId;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAdded) return;
    const target = document.getElementById('queue-target');
    if (btnRef.current && target) {
        const startRect = btnRef.current.getBoundingClientRect();
        const endRect = target.getBoundingClientRect();
        setFlyEffect({
            startX: startRect.left,
            startY: startRect.top,
            endX: endRect.left - startRect.left + (endRect.width / 2) - 20, 
            endY: endRect.top - startRect.top + (endRect.height / 2) - 20
        });
        setTimeout(() => setFlyEffect(null), 800);
    }
    setIsAdded(true);
    onAddToPlaylist?.(track);
    setTimeout(() => setIsAdded(false), 1500);
  };

  return (
    <div 
      className={`group flex items-center gap-4 p-3 md:p-4 hover:bg-white/5 transition-all cursor-pointer border-b border-white/[0.03] last:border-0 ${isGhostTrack ? 'opacity-60' : ''}`}
      onClick={() => onPlay(track)}
    >
        <div className="w-6 text-center text-zinc-700 font-mono text-xs group-hover:text-yellow-500 shrink-0">{String(index + 1).padStart(2, '0')}</div>
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-zinc-800 overflow-hidden relative shrink-0 shadow-lg group-hover:scale-110 transition-transform">
          {track.coverUrl ? (
            <img key={track.coverUrl} src={track.coverUrl} className="w-full h-full object-cover animate-in fade-in duration-700" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                {isGhostTrack ? (
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-pulse"><path d="M12 2v4M4.93 4.93l2.83 2.83M2 12h4M4.93 19.07l2.83-2.83M12 18v4M16.24 16.24l2.83 2.83M18 12h4M16.24 7.76l2.83-2.83"/></svg>
                ) : (
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                )}
            </div>
          )}
          {isScraping && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="text-white font-black truncate text-sm md:text-base tracking-tight">{convert(track.name)}</div>
            {isGhostTrack && <span className="text-[8px] bg-white/10 text-zinc-500 px-1.5 py-0.5 rounded uppercase font-black">Restored</span>}
            <div className="flex items-center gap-1.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
               {bitrateKbps > 0 && (
                 <span className={`text-[8px] font-mono px-1 rounded ${isHires ? 'bg-yellow-500/20 text-yellow-500' : isLossless ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}>
                   {bitrateKbps}K
                 </span>
               )}
               {track.duplicateCount && track.duplicateCount > 1 && (
                 <span className="text-[7px] bg-white/10 text-zinc-400 px-1 rounded flex items-center gap-0.5 group-hover:bg-yellow-500/20 group-hover:text-yellow-500 transition-colors">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    {track.duplicateCount} VERSIONS
                 </span>
               )}
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onNavigate?.('artistProfile', track.artist); }} className="text-zinc-500 text-[9px] md:text-xs font-bold uppercase tracking-widest hover:text-yellow-500 transition-colors">
            {convert(track.artist)}
          </button>
        </div>
        <div className="flex items-center gap-1 w-16 md:w-20 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
          <button ref={btnRef} onClick={handleAdd} className={`p-2 rounded-full transition-all duration-300 active:scale-90 ${isAdded ? 'bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'hover:bg-yellow-500 hover:text-black text-yellow-500/80'}`}>
            {isAdded ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="animate-in zoom-in"><path d="M20 6L9 17l-5-5"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onScrape(track); }} className="hidden md:flex p-2 rounded-full transition-all hover:bg-white/10 text-zinc-700 hover:text-red-500">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><path d="M16 10l4 4 4-4"/><path d="M20 4v10"/></svg>
          </button>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onNavigate?.('albums', track.album); }} className="hidden lg:block text-zinc-500 text-sm font-black uppercase tracking-widest w-32 md:w-40 shrink-0 truncate text-left hover:text-yellow-500 transition-colors">
          {convert(track.album)}
        </button>
        <div className="hidden md:block text-zinc-600 font-mono text-sm w-16 shrink-0 text-right group-hover:text-zinc-400 transition-colors">{formatTime(track.duration || 0)}</div>
        <div className="w-10 flex justify-end shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(track.id); }} className={`p-2 rounded-full transition-all active:scale-75 ${isFavorite ? 'text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'text-zinc-800 hover:text-white group-hover:opacity-100'}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          </button>
        </div>
        {flyEffect && ReactDOM.createPortal(
            <div className="fixed pointer-events-none z-[999] animate-fly" style={{ left: flyEffect.startX, top: flyEffect.startY, '--fly-x-end': `${flyEffect.endX}px`, '--fly-y-end': `${flyEffect.endY}px`, '--fly-x-mid': `${flyEffect.endX * 0.4}px`, '--fly-y-mid': `${-200}px` } as any}>
                <div className="w-10 h-10 rounded-full bg-zinc-900 border-2 border-yellow-500 overflow-hidden shadow-2xl">
                    {track.coverUrl ? <img src={track.coverUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-yellow-500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg></div>}
                </div>
            </div>, document.body
        )}
    </div>
  );
});

const LibraryView: React.FC<LibraryViewProps> = ({ 
  view, tracks, folders = [], onPlay, onAddToPlaylist, favorites, onToggleFavorite, onUpdateTrack, onNavigate, onBack,
  navigationRequest, onNavigationProcessed, isSearching = false, displayConverter
}) => {
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [activeAlbum, setActiveAlbum] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);
  const [scrapingId, setScrapingId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'all' | 'fav' | 'folders'>('all');
  
  const [sortKey, setSortKey] = useState<'name' | 'artist' | 'album' | 'lastModified'>('lastModified');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [filterQuality, setFilterQuality] = useState<'all' | 'hires' | 'lossless' | 'hq' | 'sd'>('all');
  const [filterDecade, setFilterDecade] = useState<'all' | '2020s' | '2010s' | '2000s' | '90s' | '80s' | '70s' | 'pre70s'>('all');
  const [filterDuration, setFilterDuration] = useState<'all' | 'short' | 'medium' | 'long'>('all');

  const scrollRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const lastViewRef = useRef(view);

  const folderIdToName = useMemo(() => {
    const map = new Map<string, string>();
    folders.forEach(f => map.set(f.id, f.name));
    return map;
  }, [folders]);

  const filteredAndSortedTracks = useMemo(() => {
    let list = [...tracks];
    if (subTab === 'fav' && !isSearching) list = list.filter(t => favorites.has(t.id));
    if (activeGroup) list = list.filter(t => (t.folderId || '默认导入') === activeGroup);
    
    // 如果处于“专辑详情”页面或全局列表，增加音质去重逻辑
    if (activeAlbum || view === 'all') {
      if (activeAlbum) list = list.filter(t => t.album === activeAlbum);
      
      const bestVersionsMap = new Map<string, Track>();
      const countMap = new Map<string, number>();

      list.forEach(t => {
        // 使用歌曲名+艺人作为唯一键
        const key = `${t.name.trim().toLowerCase()}-${t.artist.trim().toLowerCase()}`;
        
        // 计数重复版本
        countMap.set(key, (countMap.get(key) || 0) + 1);

        const existing = bestVersionsMap.get(key);
        // 如果不存在或者当前轨道比特率更高，则保留当前的
        if (!existing || (t.bitrate || 0) > (existing.bitrate || 0)) {
          bestVersionsMap.set(key, t);
        }
      });

      // 重新构造列表并注入重复计数
      list = Array.from(bestVersionsMap.values()).map(t => {
          const key = `${t.name.trim().toLowerCase()}-${t.artist.trim().toLowerCase()}`;
          return { ...t, duplicateCount: countMap.get(key) || 1 };
      });
    }

    if (filterQuality !== 'all') {
      list = list.filter(t => {
        const kbps = t.bitrate ? t.bitrate / 1000 : 0;
        if (filterQuality === 'hires') return kbps >= 2000;
        if (filterQuality === 'lossless') return kbps >= 800 && kbps < 2000;
        if (filterQuality === 'hq') return kbps >= 320 && kbps < 800;
        if (filterQuality === 'sd') return kbps > 0 && kbps < 320;
        return true;
      });
    }

    if (filterDecade !== 'all') {
      list = list.filter(t => {
        const year = t.year;
        if (!year) return false;
        if (filterDecade === '2020s') return year >= 2020;
        if (filterDecade === '2010s') return year >= 2010 && year < 2020;
        if (filterDecade === '2000s') return year >= 2000 && year < 2010;
        if (filterDecade === '90s') return year >= 1990 && year < 2000;
        if (filterDecade === '80s') return year >= 1980 && year < 1990;
        if (filterDecade === '70s') return year >= 1970 && year < 1980;
        if (filterDecade === 'pre70s') return year < 1970;
        return true;
      });
    }

    if (filterDuration !== 'all') {
      list = list.filter(t => {
        const d = t.duration || 0;
        if (filterDuration === 'short') return d < 180;
        if (filterDuration === 'medium') return d >= 180 && d <= 300;
        if (filterDuration === 'long') return d > 300;
        return true;
      });
    }
    
    list.sort((a, b) => {
      let valA: any = (a as any)[sortKey] ?? '';
      let valB: any = (b as any)[sortKey] ?? '';
      if (typeof valA === 'string' && typeof valB === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [tracks, favorites, subTab, activeGroup, activeAlbum, sortKey, sortOrder, isSearching, filterQuality, filterDecade, filterDuration, view]);

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

  const albumYear = useMemo(() => {
    if (!activeAlbum) return null;
    // 从当前过滤后的轨道中寻找发行年份
    return filteredAndSortedTracks.find(t => t.year)?.year;
  }, [activeAlbum, filteredAndSortedTracks]);

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
    if (view === 'all' && lastViewRef.current !== 'all' && !navigationRequest) {
      setActiveGroup(null);
      setActiveAlbum(null);
      setSubTab('all');
    }
    lastViewRef.current = view;
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
    } catch (err) { console.error(err); } finally { setScrapingId(null); }
  };

  useEffect(() => {
    setDisplayLimit(PAGE_SIZE);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [view, activeGroup, activeAlbum, isSearching, sortKey, sortOrder, subTab, filterQuality, filterDecade, filterDuration]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setDisplayLimit(prev => prev + PAGE_SIZE);
      }
    }, { threshold: 0.1 });
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [filteredAndSortedTracks, activeGroup, activeAlbum]);

  const pageTitle = useMemo(() => {
    if (activeGroup) return folderIdToName.get(activeGroup) || activeGroup;
    if (activeAlbum) return activeAlbum;
    if (view === 'history') return '最近播放';
    return '本地曲库';
  }, [activeGroup, activeAlbum, view, folderIdToName]);

  const sortOptions = [{ key: 'lastModified', label: '最近添加' }, { key: 'name', label: '名称' }, { key: 'artist', label: '艺人' }, { key: 'album', label: '专辑' }] as const;
  const resetFilters = () => { setFilterQuality('all'); setFilterDecade('all'); setFilterDuration('all'); };
  const hasActiveFilters = filterQuality !== 'all' || filterDecade !== 'all' || filterDuration !== 'all';
  const subTabs = [
    { id: 'all', label: '全部曲目', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12h18M3 6h18M3 18h18"/></svg> },
    { id: 'fav', label: '收藏曲目', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg> },
    { id: 'folders', label: '本地文件夹', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93l-2.73-2.73A2 2 0 0 0 8.07 2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z"/></svg> }
  ] as const;

  return (
    <div className="flex flex-col h-full bg-zinc-950/20 overflow-hidden animate-in fade-in duration-500">
      <header className="p-4 md:p-8 flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase italic">{convert(pageTitle)}</h2>
          {activeAlbum && albumYear && (
             <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mt-1 italic animate-in fade-in slide-in-from-left-2">Release Year • {albumYear}</p>
          )}
          <div className="h-0.5 w-12 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)] mt-1"></div>
        </div>
        {(activeGroup || activeAlbum) && (
          <button onClick={() => { setActiveGroup(null); setActiveAlbum(null); }} className="flex items-center gap-2 text-zinc-500 hover:text-yellow-500 transition-colors uppercase font-black text-[10px] tracking-widest">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg>
            BACK TO LIST
          </button>
        )}
      </header>

      {!activeGroup && !activeAlbum && view !== 'history' && !isSearching && (
        <div className="px-4 md:px-8 space-y-6 shrink-0 animate-in slide-in-from-top-2 duration-500 mb-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="flex bg-black/60 p-1.5 rounded-[1.5rem] border border-white/5 backdrop-blur-xl w-full lg:w-auto gap-1">
              {subTabs.map(tab => (
                <button key={tab.id} onClick={() => setSubTab(tab.id as any)} className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-6 md:px-8 py-3 text-xs font-black uppercase tracking-widest rounded-2xl transition-all duration-300 ${subTab === tab.id ? 'bg-zinc-800 text-yellow-500 shadow-[0_10px_20px_rgba(0,0,0,0.4)] border border-white/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}>
                  <span className={`transition-transform duration-500 ${subTab === tab.id ? 'scale-110 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]' : ''}`}>{tab.icon}</span>
                  <span className="hidden sm:inline">{convert(tab.label)}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/5 w-full lg:w-auto overflow-x-auto custom-scrollbar no-scrollbar">
              <span className="hidden xl:block text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-3 pr-2 opacity-50">Sort</span>
              {sortOptions.map(opt => (
                <button key={opt.key} onClick={() => { if (sortKey === opt.key) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); else { setSortKey(opt.key); setSortOrder(opt.key === 'lastModified' ? 'desc' : 'asc'); } }} className={`px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-1.5 ${sortKey === opt.key ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/10' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  {convert(opt.label)}
                  {sortKey === opt.key && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className={`transition-transform duration-300 ${sortOrder === 'desc' ? 'rotate-180' : ''}`}><path d="m18 15-6-6-6 6"/></svg>}
                </button>
              ))}
            </div>
          </div>
          {subTab !== 'folders' && (
            <div className="flex flex-wrap items-center gap-3">
              <FilterDropdown value={filterQuality} options={[{ id: 'all', label: '全部音质' }, { id: 'hires', label: 'Hi-Res (≥2k)' }, { id: 'lossless', label: '无损 (FLAC/WAV)' }, { id: 'hq', label: '高品质 (HQ)' }, { id: 'sd', label: '标准 (SD)' }]} onChange={setFilterQuality} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M6 12h12"/></svg>} />
              {hasActiveFilters && <button onClick={resetFilters} className="px-4 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-all border border-red-500/20 flex items-center gap-2"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>Reset</button>}
            </div>
          )}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 pb-32 custom-scrollbar">
        {groups && !activeGroup && !activeAlbum ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {groups.map(([id, groupTracks]) => {
              const displayName = folderIdToName.get(id) || (id === 'undefined' ? '未知' : id);
              const isGroupEmpty = groupTracks.every(t => !t.coverUrl && !t.coverBlob);
              
              return (
                <div key={id} onClick={() => setActiveGroup(id)} className="group cursor-pointer bg-white/5 border border-white/5 rounded-3xl p-4 hover:bg-white/10 transition-all">
                  <div className="aspect-square rounded-2xl bg-zinc-900 overflow-hidden mb-4 shadow-xl">
                    {groupTracks.find(t => t.coverUrl)?.coverUrl ? (
                       <img src={groupTracks.find(t => t.coverUrl)!.coverUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                    ) : (
                       <div className="w-full h-full flex items-center justify-center text-zinc-700 text-4xl font-black relative">
                          {displayName[0]}
                          {isGroupEmpty && (
                            <div className="absolute top-2 right-2">
                               <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                            </div>
                          )}
                       </div>
                    )}
                  </div>
                  <h3 className="text-white font-bold text-sm truncate uppercase tracking-tight">{convert(displayName)}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">{groupTracks.length} TRACKS</p>
                    {isGroupEmpty && <span className="text-[8px] text-yellow-500/50 font-black uppercase">Pending Sync</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredAndSortedTracks.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center gap-4">
                 <div className="text-zinc-800"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M8 11h6"/></svg></div>
                 <p className="text-zinc-700 font-black uppercase tracking-[0.3em]">No matching tracks</p>
              </div>
            ) : (
              <>
                {filteredAndSortedTracks.slice(0, displayLimit).map((track, index) => (
                  <TrackRow key={track.id} track={track} index={index} isFavorite={favorites.has(track.id)} onPlay={onPlay} onAddToPlaylist={onAddToPlaylist} onToggleFavorite={onToggleFavorite} onScrape={handleScrape} isScraping={scrapingId === track.id} onNavigate={onNavigate} displayConverter={displayConverter} />
                ))}
              </>
            )}
            
            {displayLimit < filteredAndSortedTracks.length && (
              <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
                 <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/30 animate-pulse" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryView;
