
import React, { useMemo } from 'react';
import { Playlist, Track } from '../types';
import { formatTime } from '../utils/audioParser';

interface PlaylistDetailViewProps {
  playlist: Playlist;
  allTracks: Track[];
  onBack: () => void;
  onPlayTrack: (track: Track) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onDeletePlaylist: (id: string) => void;
  onOpenAddByText: () => void; // 新增：打开文本追加弹窗
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  displayConverter: (s: string) => string;
}

const PlaylistDetailView: React.FC<PlaylistDetailViewProps> = ({
  playlist,
  allTracks,
  onBack,
  onPlayTrack,
  onPlayPlaylist,
  onDeletePlaylist,
  onOpenAddByText,
  favorites,
  onToggleFavorite,
  displayConverter,
}) => {
  const playlistTracks = useMemo(() => {
    const trackMap = new Map(allTracks.map(t => [t.fingerprint, t]));
    return playlist.songFingerprints
      .map(fingerprint => trackMap.get(fingerprint))
      .filter(Boolean) as Track[];
  }, [playlist, allTracks]);

  const totalDuration = useMemo(() => {
    const seconds = playlistTracks.reduce((acc, track) => acc + (track.duration || 0), 0);
    return Math.round(seconds / 60);
  }, [playlistTracks]);

  const handleDelete = () => {
    if (window.confirm(`确定要删除歌单 "${playlist.name}" 吗？此操作无法撤销。`)) {
      onDeletePlaylist(playlist.id);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="relative min-h-[40vh] md:min-h-[50vh] flex-shrink-0 flex items-end p-6 md:p-12 pb-10 md:pb-16 overflow-hidden">
        <div className="absolute inset-0 z-0">
          {playlist.coverUrl ? (
            <>
              <img src={playlist.coverUrl} className="w-full h-full object-cover scale-125 blur-[100px] opacity-30" alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-black/30" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-[#0a0a0a]" />
          )}
        </div>

        <button onClick={onBack} className="absolute top-6 left-6 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-yellow-500 hover:text-black transition-all z-20 active:scale-90">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12 w-full max-w-7xl mx-auto">
          <div className="relative w-48 h-48 md:w-56 md:h-56 shrink-0 mt-8 md:mt-0 shadow-2xl rounded-3xl border border-white/10 overflow-hidden">
             {playlist.coverUrl ? (
                <img src={playlist.coverUrl} className="w-full h-full object-cover" alt={playlist.name} />
             ) : (
                <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-600 font-black text-5xl">♪</div>
             )}
          </div>

          <div className="flex-1 text-center md:text-left pt-2 md:pt-4">
            <p className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.3em] mb-3">Playlist</p>
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none mb-6 drop-shadow-2xl">{displayConverter(playlist.name)}</h1>
            <div className="flex items-center justify-center md:justify-start gap-4 text-zinc-400 text-xs font-bold uppercase tracking-wider mb-8">
                <span>{playlistTracks.length} 首歌曲</span>
                <span>•</span>
                <span>{totalDuration} 分钟</span>
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                <button onClick={() => onPlayPlaylist(playlist)} className="bg-yellow-500 hover:bg-yellow-400 text-black px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-[0_10px_30px_rgba(234,179,8,0.3)]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>播放全部
                </button>
                <button onClick={onOpenAddByText} className="bg-white/5 border border-white/10 text-white px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-white/10 active:scale-95">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>文字追加
                </button>
                <button onClick={handleDelete} className="w-11 h-11 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:bg-red-500/20 hover:text-red-500 transition-all flex items-center justify-center active:scale-90" title="删除歌单">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 md:px-12 py-10 max-w-7xl mx-auto w-full pb-32">
        <div className="bg-white/[0.01] border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm shadow-2xl">
            {playlistTracks.length === 0 ? (
                <div className="py-20 text-center text-zinc-600 uppercase font-black text-xs tracking-widest">歌单中暂无歌曲</div>
            ) : (
                playlistTracks.map((track, i) => {
                  const isFav = favorites.has(track.id);
                  return (
                    <div key={track.id} onClick={() => onPlayTrack(track)} className="group flex items-center gap-4 p-4 md:px-6 hover:bg-white/5 border-b border-white/[0.03] last:border-0 cursor-pointer transition-all">
                      <div className="w-6 text-center text-zinc-700 font-mono text-xs group-hover:text-yellow-500 shrink-0">{String(i+1).padStart(2, '0')}</div>
                      <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                        {track.coverUrl ? <img src={track.coverUrl} className="w-full h-full object-cover opacity-80" alt="" /> : <div className="w-full h-full flex items-center justify-center text-zinc-600"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-bold truncate text-sm group-hover:text-yellow-500 transition-colors">{displayConverter(track.name)}</div>
                        <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-0.5 truncate">{displayConverter(track.artist)}</div>
                      </div>
                      <div className="hidden md:block text-zinc-600 font-mono text-xs w-16 shrink-0 text-right">{formatTime(track.duration || 0)}</div>
                      <div className="w-10 flex justify-end shrink-0"><button onClick={(e) => { e.stopPropagation(); onToggleFavorite(track.id); }} className={`p-2 transition-all active:scale-75 ${isFav ? 'text-red-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]' : 'text-zinc-800 hover:text-white group-hover:opacity-100'}`}><svg width="16" height="16" viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></button></div>
                    </div>
                  );
                })
            )}
        </div>
      </div>
    </div>
  );
};

export default PlaylistDetailView;
