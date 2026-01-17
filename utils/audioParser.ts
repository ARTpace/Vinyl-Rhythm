import { Track } from '../types';
import * as mm from 'music-metadata-browser';

const COVER_FILENAMES = [
  'cover',
  'folder',
  'album',
  'art',
  'artwork',
  'thumbnail',
  '.cover'
];

const COVER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

export async function findFolderCoverFromHandle(folderHandle: FileSystemDirectoryHandle): Promise<Blob | null> {
  try {
    for (const filename of COVER_FILENAMES) {
      for (const ext of COVER_EXTENSIONS) {
        const coverName = `${filename}${ext}`;
        try {
          const coverHandle = await folderHandle.getFileHandle(coverName);
          const file = await coverHandle.getFile();
          if (file.size > 0) {
            console.log('[AudioParser] Found folder cover:', coverName);
            return file;
          }
        } catch {
          continue;
        }

        const coverNameUpper = `${filename.toUpperCase()}${ext}`;
        try {
          const coverHandle = await folderHandle.getFileHandle(coverNameUpper);
          const file = await coverHandle.getFile();
          if (file.size > 0) {
            console.log('[AudioParser] Found folder cover:', coverNameUpper);
            return file;
          }
        } catch {
          continue;
        }
      }
    }

    for (const entry of await (folderHandle as any).values()) {
      if (entry.kind === 'file') {
        const ext = entry.name.toLowerCase().slice(entry.name.lastIndexOf('.'));
        if (COVER_EXTENSIONS.includes(ext) && /^(cover|folder|album|art)/i.test(entry.name)) {
          try {
            const file = await entry.getFile();
            if (file.size > 0) {
              console.log('[AudioParser] Found folder cover:', entry.name);
              return file;
            }
          } catch {
            continue;
          }
        }
      }
    }

    console.log('[AudioParser] No folder cover found');
    return null;
  } catch (error) {
    console.error('[AudioParser] Error finding folder cover:', error);
    return null;
  }
}

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

/**
 * 清理并标准化歌手名称，处理多人合作的情况
 */
const cleanArtistName = (artist: string): string => {
  if (!artist) return "未知歌手";

  // 1. 标准化常见分隔符
  const standardDelimiters = /\s*[\/&、,;]\s*|\s+feat\.?\s+|\s+ft\.?\s+/i;
  let artists = artist.split(standardDelimiters)
                      .map(a => a.trim())
                      .filter(a => a.length > 0);

  // 2. 针对纯 CJK (中日韩) 姓名中的空格进行拆分
  const cjkRegex = /^[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af\s]+$/;
  const containsLatin = /[a-zA-Z]/;
  const finalArtists: string[] = [];

  artists.forEach(art => {
    // 检查是否是纯 CJK + 空格，并且不包含任何英文字母，且确实有空格
    if (cjkRegex.test(art) && !containsLatin.test(art) && art.includes(' ')) {
      finalArtists.push(...art.split(/\s+/).filter(Boolean));
    } else {
      finalArtists.push(art);
    }
  });

  // 3. 去重并用标准分隔符连接
  return [...new Set(finalArtists)].join(' / ');
};


export const parseFileToTrack = async (file: File, directoryCoverBlob: Blob | null = null): Promise<Track> => {
  const fileInfo = cleanFileNameData(file.name);
  try {
    const metadata = await mm.parseBlob(file);
    const { common, format } = metadata;
    let coverUrl: string | undefined = undefined;
    let coverBlob: Blob | undefined = undefined;
    if (common.picture && common.picture.length > 0) {
      try {
        const picture = common.picture[0];
        let pictureData: Uint8Array;
        const rawData = (picture as any).data as unknown;
        if (rawData instanceof Uint8Array) {
          pictureData = rawData;
        } else if (rawData instanceof ArrayBuffer) {
          pictureData = new Uint8Array(rawData);
        } else if (ArrayBuffer.isView(rawData)) {
          pictureData = new Uint8Array(rawData.buffer);
        } else {
          pictureData = new Uint8Array(rawData as any);
        }
        coverBlob = new Blob([pictureData.buffer as ArrayBuffer], { type: picture.format });
        coverUrl = URL.createObjectURL(coverBlob);
      } catch (e) { console.warn("无法生成封面预览", e); }
    } else if (directoryCoverBlob) {
      try {
        coverBlob = directoryCoverBlob;
        coverUrl = URL.createObjectURL(directoryCoverBlob);
      } catch(e) {
        console.warn("无法使用文件夹封面", e);
      }
    }
    const artistRaw = common.artist || common.albumartist || (common.artists && common.artists.join(' / ')) || fileInfo.artist;
    const artist = cleanArtistName(artistRaw);
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
    let coverUrl: string | undefined = undefined;
    let coverBlob: Blob | undefined = undefined;
    if (directoryCoverBlob) {
        try {
            coverBlob = directoryCoverBlob;
            coverUrl = URL.createObjectURL(directoryCoverBlob);
        } catch(e) { /* ignore */ }
    }
    return {
      id: Math.random().toString(36).substring(2, 9),
      name: fileInfo.title,
      artist: cleanArtistName(fileInfo.artist),
      album: "未知专辑",
      url: URL.createObjectURL(file),
      coverUrl,
      coverBlob,
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
