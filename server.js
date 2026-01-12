
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
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

  async function walk(dir) {
    try {
      const files = await fs.readdir(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          await walk(fullPath);
        } else if (formats.some(ext => file.name.toLowerCase().endsWith(ext))) {
          const stats = await fs.stat(fullPath);
          tracks.push({
            name: file.name,
            path: fullPath.replace(MUSIC_PATH, ''), // 存储相对路径
            size: stats.size,
            lastModified: stats.mtimeMs
          });
        }
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
  
  const fullPath = path.join(MUSIC_PATH, relativePath);
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
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Vinyl Rhythm Server running on port ${PORT}`);
  console.log(`Music directory: ${MUSIC_PATH}`);
});
