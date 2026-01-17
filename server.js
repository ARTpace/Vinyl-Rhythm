import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import * as mm from 'music-metadata';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const MUSIC_PATH = '/music'; // Docker 内部挂载音乐的固定路径

// 静态文件服务
app.use(express.static(path.join(__dirname, 'dist')));

// API: 获取 NAS 挂载状态
app.get('/api/status', (req, res) => {
  const exists = fsSync.existsSync(MUSIC_PATH);
  res.json({ nasMode: true, musicPath: MUSIC_PATH, exists });
});

// API: 递归扫描音乐文件
app.get('/api/scan', async (req, res) => {
  const formats = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];
  const tracks = [];
  const STAT_BATCH = 32; // 稍微调小一点，因为要解析元数据

  async function walk(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const subDirs = [];
      const audioFiles = [];

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          subDirs.push(fullPath);
          continue;
        }
        const lower = entry.name.toLowerCase();
        if (formats.some(ext => lower.endsWith(ext))) {
          audioFiles.push({ name: entry.name, fullPath });
        }
      }

      for (let i = 0; i < audioFiles.length; i += STAT_BATCH) {
        const batch = audioFiles.slice(i, i + STAT_BATCH);
        const results = await Promise.all(
          batch.map(async (f) => {
            try {
              const stats = await fs.stat(f.fullPath);
              // 解析元数据
              let metadata = null;
              try {
                metadata = await mm.parseFile(f.fullPath);
              } catch (e) {
                console.warn(`Failed to parse metadata for ${f.name}:`, e.message);
              }

              return { 
                ok: true, 
                f, 
                stats,
                metadata: metadata ? {
                  title: metadata.common.title,
                  artist: metadata.common.artist || metadata.common.albumartist,
                  album: metadata.common.album,
                  duration: metadata.format.duration,
                  bitrate: metadata.format.bitrate
                } : null
              };
            } catch (e) {
              return { ok: false, f, stats: null, metadata: null };
            }
          })
        );

        for (const item of results) {
          if (!item.ok) continue;
          const baseName = item.f.name.replace(/\.[^/.]+$/, "");
          tracks.push({
            name: baseName,
            fileName: item.f.name,
            title: item.metadata?.title || null,
            artist: item.metadata?.artist || null,
            album: item.metadata?.album || null,
            duration: item.metadata?.duration,
            bitrate: item.metadata?.bitrate,
            path: path.relative(MUSIC_PATH, item.f.fullPath),
            size: item.stats.size,
            lastModified: item.stats.mtimeMs
          });
        }
      }

      for (const sub of subDirs) {
        await walk(sub);
      }
    } catch (e) {
      console.error('Scan error:', e);
    }
  }

  if (fsSync.existsSync(MUSIC_PATH)) {
    await walk(MUSIC_PATH);
  }
  res.json(tracks);
});

// API: 获取音频流
app.get('/api/stream', (req, res) => {
  const relativePath = req.query.path;
  if (!relativePath) return res.status(400).send('Path required');
  
  const safeRelativePath = String(relativePath).replace(/^[/\\]+/, '');
  const fullPath = path.join(MUSIC_PATH, safeRelativePath);
  if (!fsSync.existsSync(fullPath)) return res.status(404).send('File not found');

  const stat = fsSync.statSync(fullPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fsSync.createReadStream(fullPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'audio/mpeg', // 浏览器通常能处理大部分格式
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'audio/mpeg',
    };
    res.writeHead(200, head);
    fsSync.createReadStream(fullPath).pipe(res);
  }
});

// 所有其他路由指向前端入口
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Vinyl Rhythm Server running on port ${PORT}`);
  console.log(`Music directory: ${MUSIC_PATH}`);
});
