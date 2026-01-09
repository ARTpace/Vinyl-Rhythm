
/**
 * MusicBrainz 刮削服务
 * 文档: https://musicbrainz.org/doc/MusicBrainz_API
 */

export interface ScrapedData {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
}

/**
 * 通过 MusicBrainz 搜索歌曲信息
 */
export const scrapeMusicBrainz = async (title: string, artist: string): Promise<ScrapedData | null> => {
  try {
    // 构造查询语句: title:xxx AND artist:xxx
    const query = encodeURIComponent(`recording:"${title}" AND artist:"${artist}"`);
    const url = `https://musicbrainz.org/ws/2/recording?query=${query}&fmt=json&limit=1`;

    // MusicBrainz 要求必须提供 User-Agent
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VinylRhythm/1.0.0 (https://github.com/user/repo)'
      }
    });

    if (!response.ok) throw new Error('Network response was not ok');

    const data = await response.json();
    const recording = data.recordings?.[0];

    if (!recording) return null;

    // 提取信息
    const bestRelease = recording.releases?.[0];
    
    return {
      title: recording.title || title,
      artist: recording['artist-credit']?.[0]?.name || artist,
      album: bestRelease?.title || "未知专辑",
      year: bestRelease?.date?.substring(0, 4) || "",
      genre: recording.tags?.[0]?.name || ""
    };
  } catch (error) {
    console.error("[MusicBrainz Scraper Error]", error);
    return null;
  }
};
