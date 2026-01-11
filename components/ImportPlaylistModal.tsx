
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Track } from '../types';
import { parseAndMatchTracks, MatchResult } from '../utils/playlistMatcher';

interface ImportPlaylistModalProps {
  isOpen: boolean;
  allTracks: Track[];
  onClose: () => void;
  onImport: (name: string, tracks: Track[]) => void;
}

const ImportPlaylistModal: React.FC<ImportPlaylistModalProps> = ({ isOpen, allTracks, onClose, onImport }) => {
  const [playlistName, setPlaylistName] = useState('我的导入歌单');
  const [playlistText, setPlaylistText] = useState('');
  const [result, setResult] = useState<MatchResult>({ matched: [], unmatched: [] });
  const [isFuzzy, setIsFuzzy] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      setPlaylistName('我的导入歌单');
      setPlaylistText('');
      setResult({ matched: [], unmatched: [] });
      setIsFuzzy(true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (playlistText.trim() === '') {
      setResult({ matched: [], unmatched: [] });
      return;
    }
    const handler = setTimeout(() => {
      setResult(parseAndMatchTracks(playlistText, allTracks, isFuzzy));
    }, 300);
    return () => clearTimeout(handler);
  }, [playlistText, allTracks, isFuzzy]);
  
  const handleImport = () => {
    if (playlistName.trim() && result.matched.length > 0) {
      onImport(playlistName.trim(), result.matched);
    }
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-[110] animate-in fade-in duration-300 px-4" onClick={onClose}>
      <div className="bg-gradient-to-br from-[#222] to-[#111] border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-2xl shadow-2xl m-4 animate-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-black text-white tracking-tighter mb-5 shrink-0">从文本导入歌单</h2>
        <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
          <div className="flex-1 flex flex-col gap-4">
            <input type="text" value={playlistName} onChange={e => setPlaylistName(e.target.value)} placeholder="歌单名称" className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-blue-500/50 outline-none backdrop-blur-md transition-all shrink-0" />
            <textarea value={playlistText} onChange={e => setPlaylistText(e.target.value)} placeholder="在此处粘贴歌曲列表，每行一首。&#10;推荐格式：歌曲名 - 歌手" className="w-full flex-1 bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-blue-500/50 outline-none backdrop-blur-md transition-all resize-none custom-scrollbar" />
             <div className="flex items-center gap-2 -mt-1">
                <input type="checkbox" id="fuzzy-match-toggle" checked={isFuzzy} onChange={e => setIsFuzzy(e.target.checked)} className="w-4 h-4 rounded bg-white/10 border-white/20 text-yellow-500 focus:ring-yellow-500 cursor-pointer" />
                <label htmlFor="fuzzy-match-toggle" className="text-xs text-zinc-400 font-bold select-none cursor-pointer">开启模糊匹配</label>
            </div>
          </div>
          <div className="flex-1 flex flex-col bg-black/20 p-4 rounded-xl border border-white/5 min-h-0">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 shrink-0">匹配结果 ({result.matched.length})</h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
              {result.matched.length > 0 && (
                <div>
                  <p className="text-emerald-500 text-[10px] font-black uppercase tracking-wider mb-2">✓ 已匹配</p>
                  <div className="space-y-1">
                    {result.matched.map(track => (
                      <div key={track.fingerprint} className="text-xs text-zinc-300 truncate bg-white/5 px-2 py-1 rounded">{track.name} - <span className="text-zinc-500">{track.artist}</span></div>
                    ))}
                  </div>
                </div>
              )}
              {result.unmatched.length > 0 && (
                <div>
                  <p className="text-red-500 text-[10px] font-black uppercase tracking-wider mb-2">✗ 未匹配</p>
                  <div className="space-y-1">
                    {result.unmatched.map((line, i) => (
                      <div key={i} className="text-xs text-zinc-600 truncate bg-white/5 px-2 py-1 rounded">{line}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-6 mt-6 border-t border-white/10 shrink-0">
            <button type="button" onClick={onClose} className="bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-bold transition-colors">取消</button>
            <button type="button" onClick={handleImport} disabled={!playlistName.trim() || result.matched.length === 0} className="bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-900/40 disabled:opacity-30">导入 {result.matched.length > 0 ? `(${result.matched.length})` : ''}</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ImportPlaylistModal;
