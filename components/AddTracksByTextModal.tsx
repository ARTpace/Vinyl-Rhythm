
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Track, Playlist } from '../types';
import { parseAndMatchTracks, MatchResult } from '../utils/playlistMatcher';

interface AddTracksByTextModalProps {
  isOpen: boolean;
  playlist: Playlist;
  allTracks: Track[];
  onClose: () => void;
  onAdd: (tracks: Track[]) => void;
}

const AddTracksByTextModal: React.FC<AddTracksByTextModalProps> = ({ isOpen, playlist, allTracks, onClose, onAdd }) => {
  const [text, setText] = useState('');
  const [isFuzzy, setIsFuzzy] = useState(true);
  const [result, setResult] = useState<MatchResult>({ matched: [], unmatched: [] });

  useEffect(() => {
    if (!isOpen) {
      setText('');
      setResult({ matched: [], unmatched: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    if (text.trim() === '') {
      setResult({ matched: [], unmatched: [] });
      return;
    }
    const handler = setTimeout(() => {
      setResult(parseAndMatchTracks(text, allTracks, isFuzzy));
    }, 300);
    return () => clearTimeout(handler);
  }, [text, allTracks, isFuzzy]);

  const handleConfirm = () => {
    if (result.matched.length > 0) {
      onAdd(result.matched);
    }
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-[110] animate-in fade-in duration-300 px-4" onClick={onClose}>
      <div className="bg-gradient-to-br from-[#222] to-[#111] border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-2xl shadow-2xl m-4 animate-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="mb-5 shrink-0">
            <h2 className="text-lg font-black text-white tracking-tighter">追加歌曲到歌单</h2>
            <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest mt-1 opacity-70">Target: {playlist.name}</p>
        </div>
        
        <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
          <div className="flex-1 flex flex-col gap-4">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="在此粘贴歌曲列表（每行一首）...&#10;格式：歌曲名 - 歌手"
              className="w-full flex-1 bg-white/5 border border-white/10 rounded-xl py-4 px-4 text-sm text-white focus:border-yellow-500/50 outline-none backdrop-blur-md transition-all resize-none custom-scrollbar"
            />
            <div className="flex items-center gap-2">
                <input type="checkbox" id="fuzzy-toggle-add" checked={isFuzzy} onChange={e => setIsFuzzy(e.target.checked)} className="w-4 h-4 rounded bg-white/10 border-white/20 text-yellow-500 focus:ring-yellow-500 cursor-pointer" />
                <label htmlFor="fuzzy-toggle-add" className="text-xs text-zinc-400 font-bold cursor-pointer">开启模糊匹配</label>
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-black/20 p-4 rounded-xl border border-white/5 min-h-0">
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 shrink-0">匹配预览 ({result.matched.length})</h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
              {result.matched.length > 0 && (
                <div className="space-y-1">
                  {result.matched.map(t => (
                    <div key={t.fingerprint} className="text-[11px] text-zinc-300 truncate bg-white/5 px-2 py-1.5 rounded border border-white/[0.03]">
                      {t.name} <span className="text-zinc-500 opacity-60">/ {t.artist}</span>
                    </div>
                  ))}
                </div>
              )}
              {result.unmatched.length > 0 && (
                <div className="pt-2 border-t border-white/5 mt-2">
                  <p className="text-[9px] text-red-500/50 font-black uppercase mb-1">未找到 ({result.unmatched.length})</p>
                  {result.unmatched.slice(0, 10).map((l, i) => (
                    <div key={i} className="text-[10px] text-zinc-600 truncate italic">{l}</div>
                  ))}
                </div>
              )}
              {text.trim() === '' && <div className="text-center text-zinc-700 text-xs pt-16">等待输入内容</div>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-6 mt-6 border-t border-white/10 shrink-0">
            <button type="button" onClick={onClose} className="bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-bold transition-colors">取消</button>
            <button type="button" onClick={handleConfirm} disabled={result.matched.length === 0} className="bg-yellow-500 hover:bg-yellow-400 text-black py-3 rounded-xl font-bold transition-all shadow-lg shadow-yellow-900/20 disabled:opacity-20">
              确认追加 {result.matched.length > 0 ? `(${result.matched.length})` : ''}
            </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AddTracksByTextModal;
