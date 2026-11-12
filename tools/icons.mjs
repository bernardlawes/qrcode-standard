// Draws the app icon (QR corner squares around the S | M mark) and writes every
// icon file from that one definition, with no dependencies.
//   node tools/icons.mjs
// Writes public/icons/*. The same drawing as the full app's icon.
import { writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEME_COLOR } from '../public/src/config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = join(root, 'public', 'icons');

// ---- Geometry: a 720-unit content box (20 modules of 36), centred in 1024. ----

/** Rounded rectangle, clockwise, corner radii [top-left, top-right, bottom-right, bottom-left]. */
const rr = (x, y, w, h, [tl, tr, br, bl]) =>
  `M${x + tl},${y}H${x + w - tr}` + (tr ? `A${tr},${tr} 0 0 1 ${x + w},${y + tr}` : '') +
  `V${y + h - br}` + (br ? `A${br},${br} 0 0 1 ${x + w - br},${y + h}` : '') +
  `H${x + bl}` + (bl ? `A${bl},${bl} 0 0 1 ${x},${y + h - bl}` : '') +
  `V${y + tl}` + (tl ? `A${tl},${tl} 0 0 1 ${x + tl},${y}` : '') + 'Z';

/** Rounded rectangle, counter-clockwise: a hole under the non-zero rule. */
const hole = (x, y, w, h, r) =>
  `M${x + r},${y}A${r},${r} 0 0 0 ${x},${y + r}V${y + h - r}A${r},${r} 0 0 0 ${x + r},${y + h}` +
  `H${x + w - r}A${r},${r} 0 0 0 ${x + w},${y + h - r}V${y + r}A${r},${r} 0 0 0 ${x + w - r},${y}Z`;

// Corner squares: kept small and thin so they frame the mark instead of crowding it.
const F = 196, RING = 21, GAP = 26, CORE = F - 2 * RING - 2 * GAP;
const finder = (x, y) => [
  rr(x, y, F, F, [25, 25, 25, 25]) + hole(x + RING, y + RING, F - 2 * RING, F - 2 * RING, 14),
  rr(x + RING + GAP, y + RING + GAP, CORE, CORE, [17, 17, 17, 17]),
];

/** The logo's paths in content units. `bold` thickens the mark for small sizes. */
function logoPaths(bold = 0) {
  const b = bold;
  const p = [...finder(0, 0), ...finder(720 - F, 0), ...finder(0, 720 - F)];
  // S: three bars, alternate corners rounded with radius = bar height.
  const sh = 36 + b, sx = 180, sw = 146;
  const sy = [286, 339, 392].map((y) => y - b / 2);
  p.push(rr(sx, sy[0], sw, sh, [sh, 0, sh, 0]), rr(sx, sy[1], sw, sh, [0, sh, 0, sh]), rr(sx, sy[2], sw, sh, [sh, 0, sh, 0]));
  // Blade: the top ends in a point at the right, the bottom in a point at the left.
  const x0 = 344 - b / 2, x1 = 388 + b / 2, yt = 200, yb = 580, c = 78;
  p.push(`M${x1},${yt}V${yb - c}C${x1},${yb - c * 0.35} ${x1 - (x1 - x0) * 0.55},${yb - 6} ${x0},${yb}` +
    `V${yt + c}C${x0},${yt + c * 0.35} ${x0 + (x1 - x0) * 0.55},${yt + 6} ${x1},${yt}Z`);
  // M: four bars; the left pair round top-left and bottom-right, the right pair mirrored.
  const mw = 32 + b, gap = 14 - b / 3;
  const mx = [0, 1, 2, 3].map((i) => 408 + i * (mw + gap));
  const outer = [290, 428], inner = [272, 376];
  p.push(rr(mx[0], outer[0], mw, outer[1] - outer[0], [mw, 0, mw, 0]));
  p.push(rr(mx[1], inner[0], mw, inner[1] - inner[0], [mw, 0, mw, 0]));
  p.push(rr(mx[2], inner[0], mw, inner[1] - inner[0], [0, mw, 0, mw]));
  p.push(rr(mx[3], outer[0], mw, outer[1] - outer[0], [0, mw, 0, mw]));
  // QR-like blocks, K thick, their outer edges on the content edge.
  const K = 28, blk = (x, y, w, h) => rr(x, y, w, h, [8, 8, 8, 8]);
  p.push(blk(720 - 3 * K, 300, 3 * K, K), blk(720 - K, 300, K, 2 * K + 6));            // ¬ on the right
  p.push(blk(304, 720 - 2 * K - 6, K, 2 * K + 6), blk(304, 720 - K, 2.8 * K, K));      // L at the bottom
  p.push(blk(520, 720 - 2 * K, 1.9 * K, 2 * K), blk(516 + 1.9 * K, 720 - 3.6 * K, 1.9 * K, 1.8 * K)); // steps
  return p;
}

/**
 * @param {{ fg: string, bg?: string|null, scale?: number, radius?: number, bold?: number }} o
 *   scale: content size as a fraction of 720/1024; radius: background corner radius in 1024 units.
 */
function svg({ fg, bg = null, scale = 1, radius = 0, bold = 0 }) {
  const off = (1024 - 720 * scale) / 2;
  const back = bg ? `<rect width="1024" height="1024" rx="${radius}" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${back}` +
    `<g transform="translate(${off} ${off}) scale(${scale})" fill="${fg}">` +
    logoPaths(bold).map((d) => `<path d="${d}"/>`).join('') + '</g></svg>\n';
}

// ---- Rasteriser: flatten the paths to polygons, fill with the non-zero rule, 4×4 samples. ----

/** Parse the path commands used above (M H V A C Z, absolute) into closed polygons. */
function flatten(d, map) {
  const polys = [];
  let poly = [], x = 0, y = 0;
  const tokens = d.match(/[MHVACZ]|-?[\d.]+/g);
  let i = 0;
  const num = () => Number(tokens[i++]);
  const add = (px, py) => { x = px; y = py; poly.push(map(px, py)); };
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'M') { if (poly.length) polys.push(poly); poly = []; add(num(), num()); }
    else if (cmd === 'H') add(num(), y);
    else if (cmd === 'V') add(x, num());
    else if (cmd === 'Z') { polys.push(poly); poly = []; }
    else if (cmd === 'C') {
      const [ax, ay, bx, by, ex, ey] = [num(), num(), num(), num(), num(), num()];
      const sx = x, sy = y;
      for (let k = 1; k <= 24; k++) {
        const t = k / 24, u = 1 - t;
        add(u * u * u * sx + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * ex,
          u * u * u * sy + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * ey);
      }
    } else if (cmd === 'A') {
      const r = num(); num(); num(); const large = num(), sweep = num(); const ex = num(), ey = num();
      // Centre of a circular arc (SVG implementation notes F.6.5, no rotation).
      const hx = (x - ex) / 2, hy = (y - ey) / 2, dd = hx * hx + hy * hy;
      const k = Math.sqrt(Math.max(0, r * r - dd) / dd) * (large !== sweep ? 1 : -1);
      const cx = k * hy + (x + ex) / 2, cy = -k * hx + (y + ey) / 2;
      let a0 = Math.atan2(y - cy, x - cx), a1 = Math.atan2(ey - cy, ex - cx);
      if (sweep && a1 < a0) a1 += 2 * Math.PI;
      if (!sweep && a1 > a0) a1 -= 2 * Math.PI;
      for (let s = 1; s <= 16; s++) {
        const a = a0 + ((a1 - a0) * s) / 16;
        add(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      add(ex, ey);
    } else throw new Error(`Unsupported path command ${cmd}`);
  }
  if (poly.length) polys.push(poly);
  return polys;
}

/** Coverage (0–1) of the logo for each pixel of a size×size image. */
function coverage(size, { scale = 1, bold = 0 }) {
  const unit = size / 1024, off = (1024 - 720 * scale) / 2;
  const map = (px, py) => [(off + px * scale) * unit, (off + py * scale) * unit];
  const edges = [];
  for (const d of logoPaths(bold)) {
    for (const poly of flatten(d, map)) {
      for (let j = 0; j < poly.length; j++) {
        const [ax, ay] = poly[j], [bx, by] = poly[(j + 1) % poly.length];
        if (ay !== by) edges.push([ax, ay, bx, by]);
      }
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
function png(size, { fg, bg, scale = 1, bold = 0, radius = 0 }) {
  const cov = coverage(size, { scale, bold });
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
const SMALL_BOLD = 10;       // extra mark thickness for icons shown at 64 px or less

await mkdir(iconsDir, { recursive: true });
await writeFile(join(iconsDir, 'icon-192.png'), png(192, { ...tile, radius: 0.2 }));
await writeFile(join(iconsDir, 'icon-512.png'), png(512, { ...tile, radius: 0.2 }));
await writeFile(join(iconsDir, 'maskable-512.png'), png(512, { ...tile, scale: MASKABLE_SCALE }));
await writeFile(join(iconsDir, 'apple-touch-icon.png'), png(180, tile)); // iOS rounds it itself
await writeFile(join(iconsDir, 'icon.svg'), svg({ ...tile, radius: 205, bold: SMALL_BOLD })); // browser tabs
console.log('Wrote icons to', iconsDir);
