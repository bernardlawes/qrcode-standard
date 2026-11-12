// Dependency-free local static server.
//   /        → public/   (exactly what gets deployed)
//   /admin/  → tools/admin/  (local-only admin page; NEVER deployed)
// private/ is never served. Sends the same security headers as production
// (parsed from public/_headers) so CSP problems show up locally.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(root, 'public');
const ADMIN = join(root, 'tools', 'admin');
const port = Number(process.env.PORT) || 8787;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json', '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
};

async function headerRules() {
  try {
    const text = await readFile(join(PUBLIC, '_headers'), 'utf8');
    const rules = [];
    let cur = null;
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      if (!/^\s/.test(line)) { cur = { pattern: line.trim(), headers: [] }; rules.push(cur); continue; }
      const i = line.indexOf(':');
      if (cur && i > 0) cur.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
    }
    return rules;
  } catch {
    return [];
  }
}

const matches = (pattern, path) =>
  new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(path);

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const [base, rel] = path === '/admin' || path.startsWith('/admin/')
    ? [ADMIN, path.slice('/admin'.length) || '/']
    : [PUBLIC, path];
  // Mirror Cloudflare Pages' clean URLs so redirect bugs show up locally:
  // /x.html → 308 /x, /index.html → 308 /, and /x serves x.html.
  if (base === PUBLIC && path.endsWith('.html')) {
    res.writeHead(308, { Location: path.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '') }).end();
    return;
  }
  let file = normalize(join(base, rel));
  if (!file.startsWith(base + sep) && file !== base) { res.writeHead(403).end(); return; }
  try {
    if (base === PUBLIC && !extname(file) && !(await stat(file).catch(() => null))) file += '.html';
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    const headers = { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' };
    for (const rule of await headerRules()) {
      if (matches(rule.pattern, path)) for (const [k, v] of rule.headers) headers[k] = v;
    }
    res.writeHead(200, headers).end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving public/ at http://localhost:${port}/  (admin: http://localhost:${port}/admin/)`);
});
