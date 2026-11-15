// Draws the app icon from the logo (docs/brand/logo-source.svg, drawn in
// Inkscape: three QR corner squares and the S | M mark in the fourth corner) and
// writes every icon file from it, with no dependencies.
//   node tools/icons.mjs
// To change the logo, edit that SVG and run this again.
// Writes public/icons/*. The same drawing as the full app's icon.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEME_COLOR } from '../public/src/config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = join(root, 'public', 'icons');
const brandDir = join(root, 'docs', 'brand');
const SOURCE = join(brandDir, 'logo-source.svg');

// ---- Reading the source SVG into polygons (one colour: the logo's dark parts). ----
// Supported: <path d> with M L H V C Z (absolute or relative), inside <g transform="translate(x,y)">.
// A path filled white with a stroke is a ring (the stroke only); any other path is filled,
// grown by half its stroke width when it has a stroke. Strokes are drawn by scaling the
// shape about its centre, exact on straight sides, which is all the logo uses.

/** Path data → polygons (curves flattened). */
function parsePath(d, tx, ty) {
  const toks = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g);
  const polys = [];
  let poly = [], x = 0, y = 0, sx = 0, sy = 0, cmd = '', i = 0;
  const n = () => Number(toks[i++]);
  const add = () => poly.push([x + tx, y + ty]);
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case 'M':
        if (poly.length) polys.push(poly);
        poly = [];
        x = (rel ? x : 0) + n(); y = (rel ? y : 0) + n(); sx = x; sy = y; add();
        cmd = rel ? 'l' : 'L'; // further pairs are lines
        break;
      case 'L': x = (rel ? x : 0) + n(); y = (rel ? y : 0) + n(); add(); break;
      case 'H': x = (rel ? x : 0) + n(); add(); break;
      case 'V': y = (rel ? y : 0) + n(); add(); break;
      case 'C': {
        const ox = rel ? x : 0, oy = rel ? y : 0;
        const [ax, ay, bx, by, ex, ey] = [n() + ox, n() + oy, n() + ox, n() + oy, n() + ox, n() + oy];
        const x0 = x, y0 = y;
        for (let k = 1; k <= 24; k++) {
          const t = k / 24, u = 1 - t;
          x = u * u * u * x0 + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * ex;
          y = u * u * u * y0 + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * ey;
          add();
        }
        break;
      }
      case 'Z':
        if (poly.length) polys.push(poly);
        poly = [];
        x = sx; y = sy;
        break;
      default: throw new Error(`logo-source.svg: path command "${cmd}" isn't supported; use straight lines or cubic curves`);
    }
  }
  if (poly.length) polys.push(poly);
  return polys;
}

const bbox = (pts) => pts.reduce(([a, b, c, d], [x, y]) => [Math.min(a, x), Math.min(b, y), Math.max(c, x), Math.max(d, y)], [Infinity, Infinity, -Infinity, -Infinity]);

/** The polygon grown (by > 0) or shrunk (by < 0) by `by` on every side, scaled about its centre. */
function grow(poly, by) {
  const [x0, y0, x1, y1] = bbox(poly);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const kx = (x1 - x0 + 2 * by) / (x1 - x0), ky = (y1 - y0 + 2 * by) / (y1 - y0);
  return poly.map(([x, y]) => [cx + (x - cx) * kx, cy + (y - cy) * ky]);
}

/** Signed area: the sign gives the winding. */
const area = (poly) => poly.reduce((s, [x, y], i) => { const [u, v] = poly[(i + 1) % poly.length]; return s + x * v - u * y; }, 0) / 2;
const wound = (poly, positive) => ((area(poly) > 0) === positive ? poly : [...poly].reverse());

/** The logo as polygons in source units: solid ones wound one way, holes the other (non-zero rule). */
async function readLogo() {
  const src = await readFile(SOURCE, 'utf8');
  const polys = [];
  let tx = 0, ty = 0;
  const re = /<g\b[^>]*>|<\/g>|<path\b[^>]*>/g;
  for (const [tag] of src.matchAll(re)) {
    if (tag === '</g>') { tx = 0; ty = 0; continue; }
    if (tag.startsWith('<g')) {
      const t = /transform="translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)"/.exec(tag);
      if (/transform=/.test(tag) && !t) throw new Error('logo-source.svg: only translate() transforms on groups are supported');
      tx = t ? Number(t[1]) : 0; ty = t ? Number(t[2]) : 0;
      continue;
    }
    const d = /\sd="([^"]+)"/.exec(tag)?.[1];
    if (!d) continue;
    if (/\stransform=/.test(tag)) throw new Error('logo-source.svg: apply path transforms in Inkscape first');
    const style = /\sstyle="([^"]*)"/.exec(tag)?.[1] ?? '';
    const prop = (name) => new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`).exec(style)?.[1].trim();
    const white = /^(#fff(fff)?|white)$/i.test(prop('fill') ?? '');
    const stroked = prop('stroke') && prop('stroke') !== 'none';
    const width = stroked ? Number(prop('stroke-width') ?? 1) : 0;
    for (const poly of parsePath(d, tx, ty)) {
      if (white && stroked) { // a ring: the stroke alone
        polys.push(wound(grow(poly, width / 2), true), wound(grow(poly, -width / 2), false));
      } else if (!white) {
        polys.push(wound(grow(poly, width / 2), true));
      }
    }
  }
  if (!polys.length) throw new Error('logo-source.svg: no paths found');
  return polys;
}

const LOGO = await readLogo();
const [LX0, LY0, LX1, LY1] = bbox(LOGO.flat());
const LOGO_SIZE = Math.max(LX1 - LX0, LY1 - LY0);

/** Polygons placed in the 1024 frame: the logo's bounding box, centred, `720 × scale` across. */
function placed(scale = 1) {
  const k = (720 * scale) / LOGO_SIZE;
  const ox = 512 - ((LX1 - LX0) * k) / 2, oy = 512 - ((LY1 - LY0) * k) / 2;
  return LOGO.map((poly) => poly.map(([x, y]) => [ox + (x - LX0) * k, oy + (y - LY0) * k]));
}

const fmt = (v) => Number(v.toFixed(2));

/**
 * @param {{ fg: string, bg?: string|null, scale?: number, radius?: number }} o
 *   scale: content size as a fraction of 720/1024; radius: background corner radius in 1024 units.
 */
function svg({ fg, bg = null, scale = 1, radius = 0 }) {
  const back = bg ? `<rect width="1024" height="1024" rx="${radius}" fill="${bg}"/>` : '';
  const d = placed(scale).map((poly) => `M${poly.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L')}Z`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${back}<path fill="${fg}" d="${d}"/></svg>\n`;
}

// ---- Rasteriser: fill the polygons with the non-zero rule, 4×4 samples. ----

/** Coverage (0–1) of the logo for each pixel of a size×size image. */
function coverage(size, { scale = 1 }) {
  const unit = size / 1024;
  const edges = [];
  for (const poly of placed(scale)) {
    for (let j = 0; j < poly.length; j++) {
      const [ax, ay] = poly[j].map((v) => v * unit), [bx, by] = poly[(j + 1) % poly.length].map((v) => v * unit);
      if (ay !== by) edges.push([ax, ay, bx, by]);
    }
  }
  const S = 4, cov = new Float32Array(size * size);
  for (let row = 0; row < size * S; row++) {
    const sy = (row + 0.5) / S;
    const hits = [];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) {
        hits.push([ax + ((sy - ay) / (by - ay)) * (bx - ax), by > ay ? 1 : -1]);
      }
    }
    hits.sort((p, q) => p[0] - q[0]);
    let wind = 0;
    for (let h = 0; h < hits.length - 1; h++) {
      wind += hits[h][1];
      if (!wind) continue;
      const from = Math.max(0, Math.ceil(hits[h][0] * S - 0.5)), to = Math.min(size * S - 1, Math.ceil(hits[h + 1][0] * S - 0.5) - 1);
      for (let col = from; col <= to; col++) cov[Math.floor(row / S) * size + Math.floor(col / S)] += 1 / (S * S);
    }
  }
  return cov;
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** RGBA PNG: logo `fg` over `bg`, background corners rounded by `radius` (fraction of size), else square. */
function png(size, { fg, bg, scale = 1, radius = 0 }) {
  const cov = coverage(size, { scale });
  const F = hex(fg), B = hex(bg), r = radius * size;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let alpha = 1;
      if (r) { // background shape, anti-aliased at the rounded corners
        const cx = Math.min(Math.max(x + 0.5, r), size - r), cy = Math.min(Math.max(y + 0.5, r), size - r);
        alpha = Math.min(1, Math.max(0, r + 0.5 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy)));
      }
      const c = cov[y * size + x];
      const px = F.map((f, i) => Math.round(f * c + B[i] * (1 - c)));
      raw.set([...px, Math.round(alpha * 255)], y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---- Output ----

const WHITE = '#ffffff';
const tile = { fg: WHITE, bg: THEME_COLOR };
const MASKABLE_SCALE = 0.78; // everything inside the 80% safe circle

await mkdir(iconsDir, { recursive: true });
await writeFile(join(iconsDir, 'icon-192.png'), png(192, { ...tile, radius: 0.2 }));
await writeFile(join(iconsDir, 'icon-512.png'), png(512, { ...tile, radius: 0.2 }));
await writeFile(join(iconsDir, 'maskable-512.png'), png(512, { ...tile, scale: MASKABLE_SCALE }));
await writeFile(join(iconsDir, 'apple-touch-icon.png'), png(180, tile)); // iOS rounds it itself
await writeFile(join(iconsDir, 'icon.svg'), svg({ ...tile, radius: 205 })); // browser tabs
console.log('Wrote icons to', iconsDir);
