
import React, { useMemo, useState } from 'react';
import { Track } from '../types';

interface CollectionViewProps {
  tracks: Track[];
  onNavigate: (type: 'artistProfile' | 'albums', name: string) => void;
  displayConverter?: (str: string) => string;
  initialTab?: 'artists' | 'albums';
}

const CollectionView: React.FC<CollectionViewProps> = ({ tracks, onNavigate, displayConverter, initialTab = 'artists' }) => {
  const [tab, setTab] = useState<'artists' | 'albums'>(initialTab);
  const convert = (s: string) => displayConverter ? displayConverter(s) : s;

  const artistGroups = useMemo(() => {
    const map = new Map<string, Track[]>();
    tracks.forEach(t => {
      const key = t.artist || '未知歌手';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks]);

  const albumGroups = useMemo(() => {
    const map = new Map<string, Track[]>();
    tracks.forEach(t => {
      const key = t.album || '未知专辑';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks]);

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
        {tab === 'artists' ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 gap-x-6 gap-y-10">
            {artistGroups.map(([name, groupTracks]) => (
              <div 
                key={name} 
                onClick={() => onNavigate('artistProfile', name)}
                className="group cursor-pointer text-center"
              >
                <div className="relative aspect-square rounded-full bg-zinc-900 border border-white/5 transition-all group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden shadow-2xl mb-3">
                  {groupTracks.find(t => t.coverUrl)?.coverUrl ? (
                    <img src={groupTracks.find(t => t.coverUrl)!.coverUrl} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-zinc-700 text-4xl font-black">{name[0]}</div>
                  )}
                  <div className="absolute inset-0 bg-yellow-500/0 group-hover:bg-yellow-500/10 transition-colors" />
                </div>
                <h3 className="text-white font-bold text-[11px] truncate px-1 group-hover:text-yellow-500 transition-colors uppercase tracking-tight">
                  {convert(name)}
                </h3>
                <p className="text-[8px] text-zinc-700 font-black tracking-widest mt-1 uppercase">{groupTracks.length} TRACKS</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-9 gap-x-6 gap-y-10">
            {albumGroups.map(([name, groupTracks]) => (
              <div 
                key={name} 
                onClick={() => onNavigate('albums', name)}
                className="group cursor-pointer text-center"
              >
                <div className="relative aspect-square rounded-3xl bg-zinc-900 border border-white/5 transition-all group-hover:scale-105 group-hover:shadow-[0_0_30px_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden shadow-2xl mb-3">
                  {groupTracks[0]?.coverUrl ? (
                    <img src={groupTracks[0].coverUrl} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-zinc-700 text-4xl font-black">{name[0]}</div>
                  )}
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
                </div>
                <h3 className="text-white font-bold text-[11px] truncate px-1 group-hover:text-yellow-500 transition-colors uppercase tracking-tight">
                  {convert(name)}
                </h3>
                <p className="text-[8px] text-zinc-700 font-black tracking-widest mt-1 uppercase">{groupTracks.length} TRACKS</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionView;
