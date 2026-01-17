import React, { useMemo } from 'react';
import { Track } from '../types';
import { normalizeChinese } from '../utils/chineseConverter';

interface SearchDropdownProps {
  isOpen: boolean;
  searchQuery: string;
  tracks: Track[];
  onPlayTrack: (track: Track) => void;
  onClose: () => void;
}

const SearchDropdown: React.FC<SearchDropdownProps> = ({ isOpen, searchQuery, tracks, onPlayTrack, onClose }) => {
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { byName: [], byArtist: [], byAlbum: [] };

    const q = normalizeChinese(searchQuery);
    const byName: Track[] = [];
    const byArtist: Track[] = [];
    const byAlbum: Track[] = [];
    const seenFingerprints = new Set<string>();
    const seenArtists = new Set<string>();

    const artistExactMatch = (artist: string, query: string): boolean => {
      const normalizedArtist = normalizeChinese(artist);
      const normalizedQuery = normalizeChinese(query);
      return normalizedArtist === normalizedQuery;
    };

    const trackMapByName = new Map<string, Track>();

    tracks.forEach(track => {
      if (seenFingerprints.has(track.fingerprint)) return;

      const nameMatch = normalizeChinese(track.name).includes(q);
      const artistMatch = artistExactMatch(track.artist, searchQuery);
      const albumMatch = normalizeChinese(track.album).includes(q);

      if (artistMatch) {
        if (!seenArtists.has(track.artist)) {
          byArtist.push(track);
          seenArtists.add(track.artist);
        }
        seenFingerprints.add(track.fingerprint);
      } else if (nameMatch) {
        const existingTrack = trackMapByName.get(track.name);
        if (!existingTrack || (track.bitrate || 0) > (existingTrack.bitrate || 0)) {
          trackMapByName.set(track.name, track);
        }
        seenFingerprints.add(track.fingerprint);
      } else if (albumMatch) {
        byAlbum.push(track);
        seenFingerprints.add(track.fingerprint);
      }
    });

    byName.push(...Array.from(trackMapByName.values()));

    return { byName: byName.slice(0, 5), byArtist: byArtist.slice(0, 5), byAlbum: byAlbum.slice(0, 5) };
  }, [searchQuery, tracks]);

  const getQualityLabel = (bitrate?: number): string => {
    if (!bitrate) return '';
    const br = bitrate / 1000;
    if (br >= 2000) return 'Hi-Res';
    if (br >= 800) return 'Lossless';
    if (br >= 320) return 'HQ';
    return 'SD';
  };

  const getQualityColor = (bitrate?: number): string => {
    if (!bitrate) return 'text-zinc-600';
    const br = bitrate / 1000;
    if (br >= 2000) return 'text-yellow-400';
    if (br >= 800) return 'text-sky-400';
    if (br >= 320) return 'text-emerald-400';
    return 'text-zinc-500';
  };

  if (!isOpen || !searchQuery.trim()) return null;

  const hasResults = searchResults.byName.length > 0 || searchResults.byArtist.length > 0 || searchResults.byAlbum.length > 0;

  return (
    <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-[60vh] overflow-y-auto custom-scrollbar">
      {!hasResults ? (
        <div className="p-8 text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-zinc-700 mb-4">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          <p className="text-zinc-600 text-xs font-black uppercase tracking-widest">No Results Found</p>
        </div>
      ) : (
        <div className="p-3 space-y-2">
          {searchResults.byName.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-black uppercase tracking-widest text-yellow-500">
                歌曲
              </div>
              {searchResults.byName.map(track => (
                <div
                  key={track.fingerprint}
                  onClick={() => { onPlayTrack(track); onClose(); }}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/5 cursor-pointer transition-all group"
                >
                  <div className="w-14 h-14 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                    {track.coverUrl ? (
                      <img src={track.coverUrl} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700 text-2xl">♪</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-white text-sm font-bold truncate group-hover:text-yellow-500 transition-colors">
                        {track.name}
                      </div>
                      {track.bitrate && (
                        <div className="flex items-center gap-2 px-4 py-1 rounded-full bg-white/5 border border-white/5 backdrop-blur-sm">
                          <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${getQualityLabel(track.bitrate) === 'Hi-Res' ? 'text-yellow-400' : getQualityColor(track.bitrate)}`}>
                            {getQualityLabel(track.bitrate)}
                          </span>
                          <span className="text-[10px] text-zinc-600 font-mono tracking-tighter">
                            {Math.round(track.bitrate / 1000)} kbps
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-zinc-500 text-xs truncate">
                      {track.artist}
                    </div>
                  </div>
                  <div className="text-zinc-600 text-xs font-black uppercase tracking-wider">
                    {track.album}
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchResults.byArtist.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-black uppercase tracking-widest text-yellow-500">
                歌手
              </div>
              {searchResults.byArtist.map(track => (
                <div
                  key={track.fingerprint}
                  onClick={() => { onPlayTrack(track); onClose(); }}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/5 cursor-pointer transition-all group"
                >
                  <div className="w-14 h-14 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0">
                    {track.coverUrl ? (
                      <img src={track.coverUrl} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700 text-2xl">{track.artist[0]}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-bold truncate group-hover:text-yellow-500 transition-colors">
                      {track.artist}
                    </div>
                    <div className="text-zinc-500 text-xs truncate">
                      {track.name}
                    </div>
                  </div>
                  <div className="text-zinc-600 text-xs font-black uppercase tracking-wider">
                    {track.album}
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchResults.byAlbum.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-black uppercase tracking-widest text-yellow-500">
                专辑
              </div>
              {searchResults.byAlbum.map(track => (
                <div
                  key={track.fingerprint}
                  onClick={() => { onPlayTrack(track); onClose(); }}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/5 cursor-pointer transition-all group"
                >
                  <div className="w-14 h-14 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                    {track.coverUrl ? (
                      <img src={track.coverUrl} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700 text-2xl">♪</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-bold truncate group-hover:text-yellow-500 transition-colors">
                      {track.album}
                    </div>
                    <div className="text-zinc-500 text-xs truncate">
                      {track.artist} · {track.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchDropdown;
