import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Playlist } from '../types';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  playlists: Playlist[];
  onClose: () => void;
  onSelectPlaylist: (playlistId: string) => void;
  onCreateAndAdd: (playlistName: string) => void;
}

const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  playlists,
  onClose,
  onSelectPlaylist,
  onCreateAndAdd,
}) => {
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setNewPlaylistName('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlaylistName.trim()) {
      onCreateAndAdd(newPlaylistName.trim());
    }
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-[110] animate-in fade-in duration-300 px-4"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-[#222] to-[#111] border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl m-4 animate-in zoom-in-95 duration-500 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-black text-white tracking-tighter mb-5 shrink-0">添加到歌单</h2>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar -mr-4 pr-4 mb-6">
          {playlists.length > 0 ? (
            <div className="space-y-2">
              {playlists.map(p => (
                <button
                  key={p.id}
                  onClick={() => onSelectPlaylist(p.id)}
                  className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-lg bg-zinc-800 shrink-0 overflow-hidden">
                    {p.coverUrl ? <img src={p.coverUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-600">♪</div>}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white truncate">{p.name}</div>
                    <div className="text-xs text-zinc-500">{p.songFingerprints.length}首</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-600 text-xs">暂无歌单</div>
          )}
        </div>

        <form onSubmit={handleCreateAndAdd} className="shrink-0">
           <div className="h-px bg-white/10 my-4" />
           <p className="text-xs text-zinc-400 mb-3 font-bold">或创建新歌单并添加</p>
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-yellow-500/50 outline-none backdrop-blur-md transition-all"
              placeholder="新歌单名称..."
            />
            <button
              type="submit"
              disabled={!newPlaylistName.trim()}
              className="bg-yellow-500 hover:bg-yellow-400 text-black px-5 rounded-xl font-bold transition-colors active:scale-95 shadow-lg shadow-yellow-900/40 disabled:opacity-30"
            >
              创建
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default AddToPlaylistModal;
