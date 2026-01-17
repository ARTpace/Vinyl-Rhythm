import path from 'path';
import fs from 'fs';

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

export function findFolderCover(audioFilePath) {
  const audioDir = path.dirname(audioFilePath);

  for (const filename of COVER_FILENAMES) {
    for (const ext of COVER_EXTENSIONS) {
      const coverPath = path.join(audioDir, `${filename}${ext}`);
      if (fs.existsSync(coverPath)) {
        return coverPath;
      }
      const coverPathUpper = path.join(audioDir, `${filename.toUpperCase()}${ext}`);
      if (fs.existsSync(coverPathUpper)) {
        return coverPathUpper;
      }
    }
  }

  for (const ext of COVER_EXTENSIONS) {
    const coverPath = path.join(audioDir, `cover${ext}`);
    if (fs.existsSync(coverPath)) {
      return coverPath;
    }
  }

  const files = fs.readdirSync(audioDir);
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (COVER_EXTENSIONS.includes(ext) && /^(cover|folder|album|art)/i.test(file)) {
      return path.join(audioDir, file);
    }
  }

  return null;
}

export function readCoverAsUint8Array(coverPath) {
  try {
    const buffer = fs.readFileSync(coverPath);
    const format = path.extname(coverPath).toLowerCase().slice(1);
    return {
      data: new Uint8Array(buffer),
      format: format === 'jpg' ? 'jpeg' : format
    };
  } catch (error) {
    console.error('[CoverUtil] Failed to read cover file:', error);
    return null;
  }
}
