
/**
 * 网易云音乐刮削服务
 * 使用网易云公开搜索接口 + 跨域代理
 */

export interface ScrapedData {
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
}

/**
 * 通过网易云音乐搜索歌曲信息
 */
export const scrapeNeteaseMusic = async (title: string, artist: string): Promise<ScrapedData | null> => {
  try {
    // 构造查询关键词
    const query = `${artist} ${title}`.trim();
    const targetUrl = `https://music.163.com/api/search/get?s=${encodeURIComponent(query)}&type=1&limit=1`;
    
    // 使用 allorigins 代理解决浏览器跨域问题
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Network response was not ok');

    const data = await response.json();
    
    // 网易云 API 结构解析: result.songs[0]
    const song = data.result?.songs?.[0];

    if (!song) return null;

    return {
      title: song.name,
      artist: song.artists?.map((a: any) => a.name).join(' / ') || artist,
      album: song.album?.name || "未知专辑",
      coverUrl: song.album?.picUrl || "" // 这是一个非常重要的补充
    };
  } catch (error) {
    console.error("[Netease Scraper Error]", error);
    return null;
  }
};
