import React from 'react';
import { Playlist } from '../types';

interface PlaylistsViewProps {
  playlists: Playlist[];
  onSelectPlaylist: (playlist: Playlist) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onCreatePlaylist: () => void;
  onImportPlaylist: () => void;
  displayConverter: (s: string) => string;
}

const PlaylistsView: React.FC<PlaylistsViewProps> = ({ playlists, onSelectPlaylist, onPlayPlaylist, onCreatePlaylist, onImportPlaylist, displayConverter }) => {
  return (
    <div className="flex flex-col h-full bg-zinc-950/20 overflow-hidden animate-in fade-in duration-500">
      <header className="p-4 md:p-8 shrink-0">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase italic">
            我的歌单
          </h2>
          <div className="h-0.5 w-12 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-32 custom-scrollbar">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-9 gap-x-6 gap-y-10">
          <div className="group text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="relative aspect-square bg-zinc-900 border-2 border-dashed border-white/10 rounded-3xl transition-all group-hover:scale-105 flex flex-col overflow-hidden shadow-lg mb-3">
              <button
                onClick={onCreatePlaylist}
                title="创建新歌单"
                className="flex-1 w-full flex items-center justify-center hover:bg-yellow-500/10 group/create transition-colors"
              >
                <svg className="w-12 h-12 text-zinc-700 group-hover/create:text-yellow-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
              <div className="h-px w-4/5 mx-auto bg-white/10 shrink-0" />
              <button
                onClick={onImportPlaylist}
                title="从文本导入"
                className="flex-1 w-full flex items-center justify-center hover:bg-blue-500/10 group/import transition-colors"
              >
                <svg className="w-11 h-11 text-zinc-700 group-hover/import:text-blue-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/><path d="M9 12h3"/><path d="M9 15h6"/>
                </svg>
              </button>
            </div>
            <h3 className="text-white font-bold text-[11px] truncate px-1 group-hover:text-yellow-500 transition-colors uppercase tracking-tight">
                {displayConverter("新歌单")}
            </h3>
            <p className="text-[8px] text-zinc-700 font-black tracking-widest mt-1 uppercase">
                创建 / 导入
            </p>
          </div>

          {playlists.map(playlist => (
            <div 
              key={playlist.id} 
              className="group cursor-pointer text-center animate-in fade-in zoom-in-95 duration-500"
              onClick={() => onSelectPlaylist(playlist)}
            >
              <div className="relative aspect-square bg-zinc-900 border border-white/5 rounded-3xl transition-all group-hover:scale-105 group-hover:shadow-[0_0_30px_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden shadow-2xl mb-3">
                {playlist.coverUrl ? (
                  <img src={playlist.coverUrl} className="w-full h-full object-cover transition-opacity duration-700" loading="lazy" />
                ) : (
                  <div className="text-zinc-700 text-4xl font-black">♪</div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                  <button 
                      onClick={(e) => { e.stopPropagation(); onPlayPlaylist(playlist); }}
                      className="w-14 h-14 rounded-full bg-yellow-500 text-black flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:scale-110 active:scale-95 transition-transform"
                  >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><path d="M5 3l14 9-14 9V3z"/></svg>
                  </button>
                </div>
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 pointer-events-none transition-colors" />
              </div>
              <h3 className="text-white font-bold text-[11px] truncate px-1 group-hover:text-yellow-500 transition-colors uppercase tracking-tight">
                {displayConverter(playlist.name)}
              </h3>
              <p className="text-[8px] text-zinc-700 font-black tracking-widest mt-1 uppercase">
                {playlist.songFingerprints.length} TRACKS
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlaylistsView;