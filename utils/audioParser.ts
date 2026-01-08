
import { Track } from '../types';
import * as mm from 'music-metadata-browser';

/**
 * 智能清理文件名
 */
const cleanFileNameData = (fileName: string) => {
  let cleanName = fileName.replace(/\.[^/.]+$/, "");
  cleanName = cleanName.replace(/[\[\(].*?[\]\)]/g, "").trim();
  const prefixRegex = /^([a-zA-Z0-9]{1,3}[\.\-\s_)]+\s*)/;
  cleanName = cleanName.replace(prefixRegex, "");

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

  artist = artist.replace(prefixRegex, "");
  return { artist, title };
};

export const parseFileToTrack = async (file: File): Promise<Track> => {
  const fileInfo = cleanFileNameData(file.name);
  
  // 检查 Buffer 环境
  if (typeof window !== 'undefined' && !(window as any).Buffer) {
    console.warn("[AudioParser] Buffer polyfill 尚未就绪，解析可能受限");
  }

  try {
    // 解析内置标签
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

    // Fix: Add fingerprint property required by Track interface (line 63 fix)
    return {
      id: Math.random().toString(36).substring(2, 9),
      name: title,
      artist: artist,
      album: album,
      url: URL.createObjectURL(file),
      coverUrl,
      file,
      duration: format.duration,
      fingerprint: `${file.name}-${file.size}`
    };
  } catch (error) {
    console.warn(`[Metadata] 内置标签解析失败 (${file.name}):`, (error as Error).message);
    
    // Fix: Add fingerprint property required by Track interface (line 76 fix)
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
