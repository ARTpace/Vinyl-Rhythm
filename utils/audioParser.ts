
import { Track } from '../types';
import * as mm from 'music-metadata-browser';

/**
 * 智能清理文件名
 * 针对中文下载站点的常见命名习惯进行优化
 */
const cleanFileNameData = (fileName: string) => {
  let cleanName = fileName.replace(/\.[^/.]+$/, ""); // 移除扩展名
  
  // 1. 移除常见的网站广告后缀和特殊字符
  const ads = [
    "【无损音乐网 www.wusuns.com】", 
    " - 更多精彩尽在www.it688.cn", 
    "_无损下载", 
    "[80s下载网]", 
    " (高清版)",
    " - 副本",
    "-(www.music.com)",
    "(Live)",
    "（Live）",
    "[FLAC]",
    "(Official Video)",
    "- 单曲"
  ];
  ads.forEach(ad => cleanName = cleanName.split(ad).join(""));

  // 2. 移除括号内的杂质内容 (通常是 [FLAC] 或 (www.xxx.com) 等)
  cleanName = cleanName.replace(/[\[\(].*?[\]\)]/g, "").trim();
  
  // 3. 移除开头的数字序号（如 01. 歌曲名）
  const prefixRegex = /^([a-zA-Z0-9]{1,3}[\.\-\s_)]+\s*)/;
  cleanName = cleanName.replace(prefixRegex, "");

  // 4. 处理 分隔符
  const separators = [" - ", " – ", " — ", " ~ ", " _ "];
  let artist = "未知歌手";
  let title = cleanName;

  for (const sep of separators) {
    if (cleanName.includes(sep)) {
      const parts = cleanName.split(sep);
      artist = parts[0].trim();
      title = parts.slice(1).join(sep).trim();
      break;
    }
  }

  // 二次清理歌手名中的数字
  artist = artist.replace(prefixRegex, "");
  
  return { artist, title };
};

export const parseFileToTrack = async (file: File): Promise<Track> => {
  const fileInfo = cleanFileNameData(file.name);
  
  if (typeof window !== 'undefined' && !(window as any).Buffer) {
    console.warn("[AudioParser] Buffer polyfill 尚未就绪");
  }

  try {
    const metadata = await mm.parseBlob(file);
    const { common, format } = metadata;
    
    let coverUrl: string | undefined = undefined;
    if (common.picture && common.picture.length > 0) {
      try {
        const picture = common.picture[0];
        const blob = new Blob([picture.data], { type: picture.format });
        coverUrl = URL.createObjectURL(blob);
      } catch (e) {
        console.warn("无法生成封面预览", e);
      }
    }

    const artist = common.artist || 
                   common.albumartist || 
                   (common.artists && common.artists.join(' / ')) || 
                   fileInfo.artist;
                   
    const album = common.album || "未知专辑";
    const title = common.title || fileInfo.title;

    return {
      id: Math.random().toString(36).substring(2, 9),
      name: title,
      artist: artist,
      album: album,
      url: URL.createObjectURL(file),
      coverUrl,
      file,
      duration: format.duration,
      bitrate: format.bitrate,
      fingerprint: `${file.name}-${file.size}`
    };
  } catch (error) {
    return {
      id: Math.random().toString(36).substring(2, 9),
      name: fileInfo.title,
      artist: fileInfo.artist,
      album: "未知专辑",
      url: URL.createObjectURL(file),
      file,
      fingerprint: `${file.name}-${file.size}`
    };
  }
};

export const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
