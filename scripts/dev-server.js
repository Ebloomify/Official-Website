// 本地开发静态服务器:预览 site/ 目录(拆包后的官网)
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'site');
const PORT = process.env.PORT || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
};

const ADMIN_PORT = 3000; // 本地 admin 服务(模拟线上 ALB 把 /admin、/api 转给后台)

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // 代理 /admin 和 /api 到后台服务
  if (urlPath.startsWith('/admin') || urlPath.startsWith('/api/')) {
    const proxy = http.request({
      host: '127.0.0.1', port: ADMIN_PORT, path: req.url,
      method: req.method, headers: req.headers,
    }, pres => {
      res.writeHead(pres.statusCode, pres.headers);
      pres.pipe(res);
    });
    proxy.on('error', () => { res.writeHead(502); res.end('admin server not running'); });
    req.pipe(proxy);
    return;
  }

  if (urlPath === '/') urlPath = '/index.html';
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found: ' + urlPath); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log('dev server on http://localhost:' + PORT));
