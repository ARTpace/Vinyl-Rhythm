
import { Track } from '../types';
import * as mm from 'music-metadata-browser';

const cleanFileNameData = (fileName: string) => {
  let cleanName = fileName.replace(/\.[^/.]+$/, ""); 
  const ads = ["【无损音乐网 www.wusuns.com】", " - 更多精彩尽在www.it688.cn", "_无损下载", "[80s下载网]", " (高清版)", " - 副本", "-(www.music.com)", "(Live)", "（Live）", "[FLAC]", "(Official Video)", "- 单曲"];
  ads.forEach(ad => cleanName = cleanName.split(ad).join(""));
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
  try {
    const metadata = await mm.parseBlob(file);
    const { common, format } = metadata;
    let coverUrl: string | undefined = undefined;
    let coverBlob: Blob | undefined = undefined;
    if (common.picture && common.picture.length > 0) {
      try {
        const picture = common.picture[0];
        coverBlob = new Blob([picture.data], { type: picture.format });
        coverUrl = URL.createObjectURL(coverBlob);
      } catch (e) { console.warn("无法生成封面预览", e); }
    }
    const artist = common.artist || common.albumartist || (common.artists && common.artists.join(' / ')) || fileInfo.artist;
    const album = common.album || "未知专辑";
    const title = common.title || fileInfo.title;

    return {
      id: Math.random().toString(36).substring(2, 9),
      name: title,
      artist: artist,
      album: album,
      url: URL.createObjectURL(file),
      coverUrl,
      coverBlob,
      file,
      duration: format.duration,
      bitrate: format.bitrate,
      fingerprint: `${file.name}-${file.size}`,
      year: common.year,
      genre: common.genre ? common.genre[0] : undefined,
      lastModified: file.lastModified,
      dateAdded: Date.now() // 记录入库时间
    };
  } catch (error) {
    return {
      id: Math.random().toString(36).substring(2, 9),
      name: fileInfo.title,
      artist: fileInfo.artist,
      album: "未知专辑",
      url: URL.createObjectURL(file),
      file,
      fingerprint: `${file.name}-${file.size}`,
      lastModified: file.lastModified,
      dateAdded: Date.now()
    };
  }
};

export const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
