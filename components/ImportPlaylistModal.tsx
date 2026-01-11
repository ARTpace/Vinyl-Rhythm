import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Track } from '../types';
import { normalizeChinese } from '../utils/chineseConverter';

interface ImportPlaylistModalProps {
  isOpen: boolean;
  allTracks: Track[];
  onClose: () => void;
  onImport: (name: string, tracks: Track[]) => void;
}

const parseAndMatch = (text: string, library: Track[]) => {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const matched: Track[] = [];
  const unmatched: string[] = [];
  const libraryMap = new Map<string, Track[]>();
  
  // 预处理曲库以加速查找，按单个歌手名索引
  library.forEach(track => {
    const normalizedArtists = track.artist.split(' / ').map(a => normalizeChinese(a.trim()));
    normalizedArtists.forEach(artistKey => {
      if (!libraryMap.has(artistKey)) {
        libraryMap.set(artistKey, []);
      }
      libraryMap.get(artistKey)!.push(track);
    });
  });

  lines.forEach(line => {
    const separator = ' - ';
    const lastSeparatorIndex = line.lastIndexOf(separator);
    
    let foundTrack: Track | undefined;

    if (lastSeparatorIndex === -1) {
      // Case 1: 仅提供歌曲名称
      const normalizedTrackName = normalizeChinese(line);
      const potentialMatches = library.filter(t => normalizeChinese(t.name) === normalizedTrackName);

      if (potentialMatches.length > 0) {
        // 如果有多首同名歌曲，按比特率排序，选择音质最好的版本
        potentialMatches.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        foundTrack = potentialMatches[0];
      }
    } else {
      // Case 2: 提供歌曲名和歌手
      const trackName = line.substring(0, lastSeparatorIndex).trim();
      const artistName = line.substring(lastSeparatorIndex + separator.length).trim();
      
      const normalizedTrackName = normalizeChinese(trackName);
      const inputArtists = artistName.split(' / ').map(a => normalizeChinese(a.trim()));

      const candidateTrackSet = new Set<Track>();
      inputArtists.forEach(artist => {
        libraryMap.get(artist)?.forEach(t => candidateTrackSet.add(t));
      });
      
      let bestMatch: Track | undefined;
      for (const candidate of candidateTrackSet) {
        if (normalizeChinese(candidate.name) === normalizedTrackName) {
          const candidateArtists = candidate.artist.split(' / ').map(a => normalizeChinese(a.trim()));
          if (inputArtists.every(inputArtist => candidateArtists.includes(inputArtist))) {
            if (!bestMatch || (candidate.bitrate || 0) > (bestMatch.bitrate || 0)) {
              bestMatch = candidate; // 找到匹配项，检查是否是更高音质的版本
            }
          }
        }
      }
      foundTrack = bestMatch;
    }

    if (foundTrack && !matched.some(m => m.fingerprint === foundTrack!.fingerprint)) {
      matched.push(foundTrack);
    } else {
      unmatched.push(line);
    }
  });

  return { matched, unmatched };
};


const ImportPlaylistModal: React.FC<ImportPlaylistModalProps> = ({ isOpen, allTracks, onClose, onImport }) => {
  const [playlistName, setPlaylistName] = useState('我的导入歌单');
  const [playlistText, setPlaylistText] = useState('');
  const [result, setResult] = useState<{ matched: Track[]; unmatched: string[] }>({ matched: [], unmatched: [] });

  useEffect(() => {
    if (!isOpen) {
      // 重置状态
      setPlaylistName('我的导入歌单');
      setPlaylistText('');
      setResult({ matched: [], unmatched: [] });
    }
  }, [isOpen]);

  // 使用 debounce 来避免过于频繁的解析
  useEffect(() => {
    if (playlistText.trim() === '') {
      setResult({ matched: [], unmatched: [] });
      return;
    }
    const handler = setTimeout(() => {
      setResult(parseAndMatch(playlistText, allTracks));
    }, 300);

    return () => clearTimeout(handler);
  }, [playlistText, allTracks]);
  
  const handleImport = () => {
    if (playlistName.trim() && result.matched.length > 0) {
      onImport(playlistName.trim(), result.matched);
    }
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-[110] animate-in fade-in duration-300 px-4"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-[#222] to-[#111] border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-2xl shadow-2xl m-4 animate-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-black text-white tracking-tighter mb-5 shrink-0">从文本导入歌单</h2>
        
        <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
          {/* Left: Input */}
          <div className="flex-1 flex flex-col gap-4">
            <input
              type="text"
              value={playlistName}
              onChange={e => setPlaylistName(e.target.value)}
              placeholder="歌单名称"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-blue-500/50 outline-none backdrop-blur-md transition-all shrink-0"
            />
            <textarea
              value={playlistText}
              onChange={e => setPlaylistText(e.target.value)}
              placeholder="在此处粘贴歌曲列表，每行一首。&#10;推荐格式：歌曲名 - 歌手&#10;也支持只输入歌曲名进行匹配。"
              className="w-full flex-1 bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-blue-500/50 outline-none backdrop-blur-md transition-all resize-none custom-scrollbar"
            />
          </div>

          {/* Right: Results */}
          <div className="flex-1 flex flex-col bg-black/20 p-4 rounded-xl border border-white/5 min-h-0">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 shrink-0">
              匹配结果 ({result.matched.length} / {result.matched.length + result.unmatched.length})
            </h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
              {result.matched.length > 0 && (
                <div>
                  <p className="text-emerald-500 text-[10px] font-black uppercase tracking-wider mb-2">✓ 已匹配</p>
                  <div className="space-y-1">
                    {result.matched.map(track => (
                      <div key={track.fingerprint} className="text-xs text-zinc-300 truncate bg-white/5 px-2 py-1 rounded">
                        {track.name} - <span className="text-zinc-500">{track.artist}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.unmatched.length > 0 && (
                <div>
                  <p className="text-red-500 text-[10px] font-black uppercase tracking-wider mb-2">✗ 未匹配</p>
                  <div className="space-y-1">
                    {result.unmatched.map((line, i) => (
                      <div key={i} className="text-xs text-zinc-600 truncate bg-white/5 px-2 py-1 rounded">
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {playlistText.trim() === '' && (
                <div className="text-center text-zinc-700 text-xs pt-16">粘贴内容后将在此处显示预览</div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-6 mt-6 border-t border-white/10 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-bold transition-colors active:scale-95"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!playlistName.trim() || result.matched.length === 0}
              className="bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-colors active:scale-95 shadow-lg shadow-blue-900/40 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              导入 {result.matched.length > 0 ? `(${result.matched.length})` : ''}
            </button>
          </div>
      </div>
    </div>,
    document.body
  );
};

export default ImportPlaylistModal;