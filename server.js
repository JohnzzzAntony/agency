const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'site-content.json');
const PORT = Number(process.env.PORT || 3000);
const ADMIN_TOKEN = process.env.CMS_ADMIN_TOKEN;
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.webp':'image/webp', '.xml':'application/xml' };

function readContent() { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
function writeContent(value) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temp = DATA_FILE + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(temp, DATA_FILE);
}
function send(res, status, body, type='application/json; charset=utf-8') { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(type.startsWith('application/json') ? JSON.stringify(body) : body); }
function body(req) { return new Promise((resolve, reject) => { let raw=''; req.on('data', c => { raw += c; if (raw.length > 2e6) req.destroy(); }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } }); req.on('error', reject); }); }
function safeFile(url) {
  const clean = decodeURIComponent(url.split('?')[0]).replace(/^[/\\]+/, '');
  const target = path.resolve(ROOT, clean || 'index.html');
  return target.startsWith(path.resolve(ROOT)) ? target : null;
}
function staticFile(req, res) {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
  if (url === '/admin') url = '/admin/index.html';
  const target = safeFile(url);
  if (!target) return send(res, 403, { error: 'Forbidden' });
  fs.stat(target, (err, stat) => {
    if (!err && stat.isDirectory()) return staticFile({ ...req, url: url.replace(/\/$/, '') + '/index.html' }, res);
    if (err) return send(res, 404, { error: 'Not found' });
    fs.readFile(target, (readErr, file) => readErr ? send(res, 500, { error: readErr.message }) : send(res, 200, file, MIME[path.extname(target).toLowerCase()] || 'application/octet-stream'));
  });
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/api/content' && req.method === 'GET') return send(res, 200, readContent());
    const writeAllowed = ADMIN_TOKEN && req.headers['x-admin-token'] === ADMIN_TOKEN;
    if (url.pathname === '/api/content' && req.method === 'PUT') { if (!writeAllowed) return send(res, 401, { error: 'Valid CMS_ADMIN_TOKEN required' }); const next = await body(req); if (!next || typeof next !== 'object' || !next.pages || !next.site) return send(res, 400, { error: 'site and pages are required' }); writeContent(next); return send(res, 200, next); }
    const pageMatch = url.pathname.match(/^\/api\/pages\/([^/]+)$/);
    if (pageMatch && req.method === 'PUT') { if (!writeAllowed) return send(res, 401, { error: 'Valid CMS_ADMIN_TOKEN required' }); const key = pageMatch[1]; const next = await body(req); const data = readContent(); data.pages[key] = { ...(data.pages[key] || {}), ...next }; writeContent(data); return send(res, 200, data.pages[key]); }
    if (pageMatch && req.method === 'DELETE') { if (!writeAllowed) return send(res, 401, { error: 'Valid CMS_ADMIN_TOKEN required' }); const data = readContent(); delete data.pages[pageMatch[1]]; writeContent(data); return send(res, 200, data); }
    if (url.pathname === '/api/health') return send(res, 200, { ok: true, service: 'duoonex-cms' });
    staticFile(req, res);
  } catch (error) { send(res, 400, { error: error.message }); }
});
server.listen(PORT, () => console.log(`DuooNex CMS running at http://localhost:${PORT}`));
