
/**
 * 网易云音乐刮削服务 (增强版)
 */

export interface ScrapedData {
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
}

/**
 * 格式化图片地址：强制 HTTPS 并请求高清尺寸
 */
const formatNeteaseImgUrl = (url: string): string => {
  if (!url) return "";
  // 1. 强制 HTTPS
  let secureUrl = url.replace("http://", "https://");
  // 2. 如果是网易云图片服务器，请求 500x500 的封面
  if (secureUrl.includes("music.126.net")) {
    // 移除已有的参数
    secureUrl = secureUrl.split("?")[0];
    secureUrl += "?param=500z500";
  }
  return secureUrl;
};

/**
 * 通过网易云音乐搜索歌曲信息
 */
export const scrapeNeteaseMusic = async (title: string, artist: string): Promise<ScrapedData | null> => {
  try {
    // 构造查询关键词
    const query = `${artist} ${title}`.trim();
    // 使用更稳定的搜索接口类型
    const targetUrl = `https://music.163.com/api/search/get?s=${encodeURIComponent(query)}&type=1&limit=5`;
    
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Network response was not ok');

    const data = await response.json();
    const songs = data.result?.songs;

    if (!songs || songs.length === 0) return null;

    // 寻找最匹配的结果（如果有多个，可以增加简单的过滤逻辑，这里默认取第一个）
    const song = songs[0];

    // 多级封面提取逻辑
    let cover = "";
    if (song.album?.picUrl) {
      cover = song.album.picUrl;
    } else if (song.artists?.[0]?.img1v1Url && !song.artists[0].img1v1Url.includes("default_avatar")) {
      // 如果没有专辑图，尝试用歌手头像作为回退
      cover = song.artists[0].img1v1Url;
    }

    return {
      title: song.name,
      artist: song.artists?.map((a: any) => a.name).join(' / ') || artist,
      album: song.album?.name || "未知专辑",
      coverUrl: formatNeteaseImgUrl(cover)
    };
  } catch (error) {
    console.error("[Netease Scraper Error]", error);
    return null;
  }
};
