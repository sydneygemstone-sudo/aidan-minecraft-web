import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');

const PORT = 5173;

// Find true physical LAN IP (strictly ignore Tailscale and virtual adapters)
function getTrueLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    // Exclude Tailscale, loopback, virtual interfaces
    if (name.startsWith('utun') || name.startsWith('lo') || name.startsWith('bridge') || name.includes('tailscale')) {
      continue;
    }
    for (const net of interfaces[name]) {
      // Must be IPv4, not internal, and strictly NOT in Tailscale 100.64.0.0/10 range
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('100.')) {
        return { ip: net.address, iface: name };
      }
    }
  }
  return { ip: '192.168.1.100', iface: 'en0' };
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  // Extract client IP
  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .replace('::ffff:', '')
    .replace('::1', '127.0.0.1');

  // CORS headers for LAN clients
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let safePath = req.url.split('?')[0];
  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  }

  const filePath = path.join(DIST_DIR, safePath);

  // Security check to prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 访问被拒绝');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routing
      const indexPath = path.join(DIST_DIR, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 未找到文件，请先运行 npm run build 生成网页');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Log connection
    if (ext === '.html' || safePath === '/index.html') {
      const nowTime = new Date().toLocaleTimeString();
      console.log(`[${nowTime}] 🎮 局域网玩家接入: 来自 ${clientIp} (${req.method} ${req.url})`);
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const lan = getTrueLanIp();
  console.log('====================================================');
  console.log('   ⛏️  MINECRAFT WEB - 局域网服务已开放             ');
  console.log('====================================================');
  console.log(`💻 本机电脑访问:    http://localhost:${PORT}/`);
  console.log(`📱 局域网主机/iPad: http://${lan.ip}:${PORT}/`);
  console.log(`🛡️  网络接口:        ${lan.iface} (已彻底排除 Tailscale 虚拟网卡)`);
  console.log('====================================================');
  console.log('正在监听局域网内所有设备的连接请求...\n');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n服务已停止。');
  server.close();
  process.exit(0);
});
