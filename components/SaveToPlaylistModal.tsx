import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Playlist, Track } from '../types';

interface SaveToPlaylistModalProps {
  isOpen: boolean;
  playlists: Playlist[];
  allTracks: Track[];
  onCreateNew: () => void;
  onAddToExisting: (playlistId: string) => void;
  onCancel: () => void;
}

const SaveToPlaylistModal: React.FC<SaveToPlaylistModalProps> = ({
  isOpen,
  playlists = [],
  allTracks = [],
  onCreateNew,
  onAddToExisting,
  onCancel
}) => {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');

  const trackMap = useMemo(() => new Map(allTracks.map(t => [t.fingerprint, t])), [allTracks]);

  const getPlaylistCoverUrl = (playlist: Playlist): string | undefined => {
    if (playlist.coverBlob) {
      return URL.createObjectURL(playlist.coverBlob);
    }
    return playlist.coverUrl;
  };

  const getPlaylistTrackCount = (playlist: Playlist): number => {
    return playlist.songFingerprints.filter(fp => trackMap.has(fp)).length;
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedPlaylistId('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-[110] animate-in fade-in duration-300"
      onClick={onCancel}
    >
      <div
        className="bg-gradient-to-br from-[#222] to-[#111] border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl m-4 animate-in zoom-in-95 duration-500"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-black text-white tracking-tighter mb-5">保存到歌单</h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">已有歌单</label>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {playlists.length === 0 ? (
                <div className="text-sm text-zinc-500 py-4 text-center">暂无歌单</div>
              ) : (
                playlists.map((playlist) => {
                  const coverUrl = getPlaylistCoverUrl(playlist);
                  const trackCount = getPlaylistTrackCount(playlist);
                  return (
                    <button
                      key={playlist.id}
                      onClick={() => onAddToExisting(playlist.id)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 ${
                        selectedPlaylistId === playlist.id
                          ? 'bg-yellow-500/20 border border-yellow-500/30'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#333] to-[#222] flex-shrink-0 overflow-hidden shadow-lg">
                        {coverUrl ? (
                          <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-500">
                              <path d="M9 18V5l12-2v13"/>
                              <circle cx="6" cy="18" r="3"/>
                              <circle cx="18" cy="16" r="3"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">{playlist.name}</div>
                        <div className="text-xs text-zinc-500 mt-1">{trackCount} 首歌曲</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <button
              onClick={onCreateNew}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-3 rounded-xl font-bold transition-colors active:scale-95 shadow-lg shadow-yellow-900/40 flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              创建新歌单
            </button>
          </div>

          <button
            onClick={onCancel}
            className="w-full bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-bold transition-colors active:scale-95"
          >
            取消
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SaveToPlaylistModal;
