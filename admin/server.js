// eBloomify 管理后台 — 零依赖 Node.js 服务
// 功能:登录 · 产品管理 · 首页内容 · 留言收件箱 · 静态页生成
// 路由:
//   GET  /admin                → 管理界面(未登录时显示登录页)
//   POST /admin/api/login      → 登录
//   POST /admin/api/logout     → 退出
//   GET  /admin/api/state      → 全部数据(产品+内容+留言)
//   POST /admin/api/content    → 保存首页内容并重建站点
//   POST /admin/api/products   → 保存产品列表并重建站点
//   POST /admin/api/upload     → 上传图片(JSON base64)
//   POST /admin/api/messages/delete → 删除留言
//   POST /api/contact          → (公开)官网联系表单提交
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── 配置 ──
const CONFIG_PATH = path.join(__dirname, 'config.json');
const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8').replace(/^﻿/, ''));
const PORT = cfg.port || 3000;
const SITE_DIR = path.resolve(__dirname, cfg.siteDir);        // 生成页面输出目录(服务器上是 C:\wwwroot)
const DATA_DIR = path.resolve(__dirname, cfg.dataDir);        // JSON 数据目录
const TPL_DIR = path.resolve(__dirname, cfg.templatesDir);    // 模板目录
const UPLOADS_DIR = path.join(SITE_DIR, 'uploads');

const { buildSite } = require(path.join(__dirname, '..', 'lib', 'build.js'));

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

// ── 小工具 ──
function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function readJson(f, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8').replace(/^﻿/, '')); }
  catch { return fallback; }
}
function writeJson(f, data) {
  const p = path.join(DATA_DIR, f);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, p);
}
function send(res, code, body, headers) {
  const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers };
  res.writeHead(code, h);
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJsonBody(req, limit) {
  const buf = await readBody(req, limit);
  return JSON.parse(buf.toString('utf8'));
}
function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  return (xf ? String(xf).split(',')[0].trim() : req.socket.remoteAddress) || '?';
}

// ── 会话 ──
const sessions = new Map(); // token -> expires
const SESSION_TTL = 12 * 3600 * 1000;
function newSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL);
  return token;
}
function checkSession(req) {
  const m = /(?:^|;\s*)ebadmin=([a-f0-9]{64})/.exec(req.headers.cookie || '');
  if (!m) return false;
  const exp = sessions.get(m[1]);
  if (!exp || exp < Date.now()) { sessions.delete(m[1]); return false; }
  sessions.set(m[1], Date.now() + SESSION_TTL); // 滑动续期
  return m[1];
}

// ── 登录限速 ──
const loginAttempts = new Map(); // ip -> {count, resetAt}
function loginAllowed(ip) {
  const now = Date.now();
  const a = loginAttempts.get(ip);
  if (!a || a.resetAt < now) { loginAttempts.set(ip, { count: 0, resetAt: now + 15 * 60 * 1000 }); return true; }
  return a.count < 10;
}
function loginFailed(ip) {
  const a = loginAttempts.get(ip);
  if (a) a.count++;
}

// ── 联系表单限速 ──
const contactHits = new Map(); // ip -> {count, resetAt}
function contactAllowed(ip) {
  const now = Date.now();
  const a = contactHits.get(ip);
  if (!a || a.resetAt < now) { contactHits.set(ip, { count: 1, resetAt: now + 3600 * 1000 }); return true; }
  a.count++;
  return a.count <= 20;
}

// ── 站点重建 ──
function rebuild() {
  return buildSite({ dataDir: DATA_DIR, templatesDir: TPL_DIR, outDir: SITE_DIR });
}

// ── 请求处理 ──
const ADMIN_HTML = path.join(__dirname, 'public', 'admin.html');

const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  try {
    // — 公开接口:联系表单 —
    if (url === '/api/contact' && req.method === 'POST') {
      if (!contactAllowed(clientIp(req))) return send(res, 429, { error: 'too many requests' });
      let b;
      try { b = await readJsonBody(req, 64 * 1024); } catch { return send(res, 400, { error: 'bad request' }); }
      const name = String(b.name || '').trim().slice(0, 80);
      const email = String(b.email || '').trim().slice(0, 120);
      const message = String(b.message || '').trim().slice(0, 3000);
      if (!name || !email || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return send(res, 400, { error: 'invalid input' });
      }
      const messages = readJson('messages.json', []);
      messages.unshift({
        id: crypto.randomBytes(8).toString('hex'),
        name, email, message,
        time: new Date().toISOString(),
        ip: clientIp(req),
      });
      if (messages.length > 5000) messages.length = 5000;
      writeJson('messages.json', messages);
      return send(res, 200, { ok: true });
    }

    // — 管理界面 —
    if (url === '/admin' || url === '/admin/') {
      const html = fs.readFileSync(ADMIN_HTML);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(html);
    }

    // — 登录 —
    if (url === '/admin/api/login' && req.method === 'POST') {
      const ip = clientIp(req);
      if (!loginAllowed(ip)) return send(res, 429, { error: '尝试次数过多,请15分钟后再试' });
      let b;
      try { b = await readJsonBody(req, 4096); } catch { return send(res, 400, { error: 'bad request' }); }
      const userOk = !cfg.adminUser || String(b.username || '').trim() === cfg.adminUser;
      if (!userOk || sha256(String(b.password || '')) !== cfg.passwordHash) {
        loginFailed(ip);
        return send(res, 401, { error: '账号或密码错误' });
      }
      const token = newSession();
      return send(res, 200, { ok: true }, {
        'Set-Cookie': `ebadmin=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}`,
      });
    }

    // — 以下都需要登录 —
    if (url.startsWith('/admin/api/')) {
      const token = checkSession(req);
      if (!token) return send(res, 401, { error: '未登录' });

      if (url === '/admin/api/logout' && req.method === 'POST') {
        sessions.delete(token);
        return send(res, 200, { ok: true }, { 'Set-Cookie': 'ebadmin=; Path=/; Max-Age=0' });
      }

      if (url === '/admin/api/state' && req.method === 'GET') {
        return send(res, 200, {
          content: readJson('content.json', {}),
          products: readJson('products.json', []),
          messages: readJson('messages.json', []),
        });
      }

      if (url === '/admin/api/content' && req.method === 'POST') {
        const b = await readJsonBody(req, 1024 * 1024);
        writeJson('content.json', b);
        rebuild();
        return send(res, 200, { ok: true });
      }

      if (url === '/admin/api/products' && req.method === 'POST') {
        const b = await readJsonBody(req, 8 * 1024 * 1024);
        if (!Array.isArray(b)) return send(res, 400, { error: 'expected array' });
        for (const p of b) {
          if (!p.slug || !/^[a-z0-9-]+$/.test(p.slug)) return send(res, 400, { error: `产品「${p.name || '?'}」的网址标识(slug)只能是小写字母、数字、连字符` });
          if (!p.name) return send(res, 400, { error: '产品名称不能为空' });
        }
        const slugs = b.map(p => p.slug);
        if (new Set(slugs).size !== slugs.length) return send(res, 400, { error: '有重复的网址标识(slug)' });
        writeJson('products.json', b);
        rebuild();
        return send(res, 200, { ok: true });
      }

      if (url === '/admin/api/upload' && req.method === 'POST') {
        const b = await readJsonBody(req, 64 * 1024 * 1024);
        const name = String(b.name || 'file');
        const ext = (name.match(/\.(png|jpe?g|gif|webp|svg|mp4|webm)$/i) || [])[0];
        if (!ext) return send(res, 400, { error: '只支持 png/jpg/gif/webp/svg 图片或 mp4/webm 视频' });
        const data = Buffer.from(String(b.data || ''), 'base64');
        if (!data.length) return send(res, 400, { error: '空文件' });
        const base = name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'img';
        const fname = `${base}-${Date.now().toString(36)}${ext.toLowerCase()}`;
        fs.writeFileSync(path.join(UPLOADS_DIR, fname), data);
        return send(res, 200, { ok: true, url: '/uploads/' + fname });
      }

      if (url === '/admin/api/messages/delete' && req.method === 'POST') {
        const b = await readJsonBody(req, 64 * 1024);
        const ids = new Set(b.ids || []);
        let messages = readJson('messages.json', []);
        messages = messages.filter(m => !ids.has(m.id));
        writeJson('messages.json', messages);
        return send(res, 200, { ok: true });
      }

      if (url === '/admin/api/rebuild' && req.method === 'POST') {
        const written = rebuild();
        return send(res, 200, { ok: true, files: written.length });
      }

      return send(res, 404, { error: 'not found' });
    }

    send(res, 404, { error: 'not found' });
  } catch (err) {
    console.error(new Date().toISOString(), err);
    send(res, 500, { error: '服务器内部错误' });
  }
});

server.listen(PORT, () => {
  console.log(`eBloomify admin listening on http://localhost:${PORT}/admin`);
  console.log('SITE_DIR:', SITE_DIR);
  console.log('DATA_DIR:', DATA_DIR);
});
