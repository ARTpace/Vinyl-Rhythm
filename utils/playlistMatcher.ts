
import { Track } from '../types';
import { normalizeChinese } from './chineseConverter';

export interface MatchResult {
  matched: Track[];
  unmatched: string[];
}

/**
 * 将文本解析并与库中歌曲进行匹配
 */
export const parseAndMatchTracks = (text: string, library: Track[], isFuzzy: boolean): MatchResult => {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const matched: Track[] = [];
  const unmatched: string[] = [];
  
  // 建立歌手索引以提高性能
  const libraryMap = new Map<string, Track[]>();
  library.forEach(track => {
    const normalizedArtists = track.artist.split(' / ').map(a => normalizeChinese(a.trim()));
    normalizedArtists.forEach(artistKey => {
      if (!libraryMap.has(artistKey)) libraryMap.set(artistKey, []);
      libraryMap.get(artistKey)!.push(track);
    });
  });

  lines.forEach(line => {
    const separator = ' - ';
    const lastSeparatorIndex = line.lastIndexOf(separator);
    let foundTrack: Track | undefined;

    if (lastSeparatorIndex === -1) {
      // 仅有歌曲名模式
      const normalizedTrackName = normalizeChinese(line);
      let potentialMatches;

      if (isFuzzy) {
        potentialMatches = library
          .map(t => {
            const libraryName = normalizeChinese(t.name);
            let score = 0;
            if (libraryName.includes(normalizedTrackName)) {
              score = 1;
              if (libraryName.startsWith(normalizedTrackName)) score = 2;
              if (libraryName === normalizedTrackName) score = 3;
            }
            return { track: t, score };
          })
          .filter(m => m.score > 0);
      } else {
        potentialMatches = library
          .filter(t => normalizeChinese(t.name) === normalizedTrackName)
          .map(t => ({ track: t, score: 3 }));
      }
      
      if (potentialMatches.length > 0) {
        potentialMatches.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return (b.track.bitrate || 0) - (a.track.bitrate || 0);
        });
        foundTrack = potentialMatches[0].track;
      }
    } else {
      // 标准 "歌曲 - 歌手" 模式
      const trackName = line.substring(0, lastSeparatorIndex).trim();
      const artistName = line.substring(lastSeparatorIndex + separator.length).trim();
      const normalizedTrackName = normalizeChinese(trackName);
      const inputArtists = artistName.split(' / ').map(a => normalizeChinese(a.trim()));
      
      const candidateTrackSet = new Set<Track>();
      inputArtists.forEach(artist => libraryMap.get(artist)?.forEach(t => candidateTrackSet.add(t)));
      
      let bestMatch: { track: Track; score: number } | undefined;
      for (const candidate of candidateTrackSet) {
        const libraryName = normalizeChinese(candidate.name);
        let score = 0;

        if (isFuzzy) {
            if (libraryName.includes(normalizedTrackName)) {
                score = 1;
                if (libraryName.startsWith(normalizedTrackName)) score = 2;
                if (libraryName === normalizedTrackName) score = 3;
            }
        } else {
            if (libraryName === normalizedTrackName) score = 3;
        }
        
        if (score > 0) {
          const candidateArtists = candidate.artist.split(' / ').map(a => normalizeChinese(a.trim()));
          if (inputArtists.every(inputArtist => candidateArtists.includes(inputArtist))) {
            const currentMatch = { track: candidate, score };
            if (!bestMatch || currentMatch.score > bestMatch.score || (currentMatch.score === bestMatch.score && (currentMatch.track.bitrate || 0) > (bestMatch.track.bitrate || 0))) {
              bestMatch = currentMatch;
            }
          }
        }
      }
      foundTrack = bestMatch?.track;
    }

    if (foundTrack) {
      if (!matched.some(m => m.fingerprint === foundTrack!.fingerprint)) {
        matched.push(foundTrack);
      }
    } else {
      unmatched.push(line);
    }
  });

  return { matched, unmatched };
};
