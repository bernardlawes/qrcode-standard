// Generates placeholder app icons (PNG + SVG) with no dependencies.
// Replace public/icons/* with real artwork once the app name is final.
//   node tools/icons.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEME_COLOR } from '../public/src/config.js';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// A 5×5 mosaic of tiles ("tesserae"), QR-finder-ish in the corners.
const PATTERN = [
  '11011',
  '10001',
  '00100',
  '10101',
  '11011',
];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BG = hex(THEME_COLOR);
const FG = [255, 255, 255];

/** Pixel colour at (x, y) in an icon of `size`, with the mosaic inside `safe` fraction. */
function pixel(x, y, size, { safe, rounded }) {
  const r = size * 0.18;
  if (rounded) {
    const cx = Math.min(Math.max(x, r), size - r);
    const cy = Math.min(Math.max(y, r), size - r);
    if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) return [0, 0, 0, 0];
  }
  const inner = size * safe;
  const origin = (size - inner) / 2;
  const cell = inner / 5;
  const gx = Math.floor((x - origin) / cell);
  const gy = Math.floor((y - origin) / cell);
  if (gx >= 0 && gx < 5 && gy >= 0 && gy < 5 && PATTERN[gy][gx] === '1') {
    const gap = cell * 0.12;
    const lx = x - origin - gx * cell;
    const ly = y - origin - gy * cell;
    if (lx > gap && lx < cell - gap && ly > gap && ly < cell - gap) return [...FG, 255];
  }
  return [...BG, 255];
}

function png(size, opts) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const p = pixel(x + 0.5, y + 0.5, size, opts);
      raw.set(p, y * (size * 4 + 1) + 1 + x * 4);
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

function svg() {
  const cells = [];
  PATTERN.forEach((rowBits, y) => [...rowBits].forEach((b, x) => {
    if (b === '1') cells.push(`<rect x="${18 + x * 12.8 + 1.5}" y="${18 + y * 12.8 + 1.5}" width="9.8" height="9.8" rx="1"/>`);
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="${THEME_COLOR}"/><g fill="#fff">${cells.join('')}</g></svg>\n`;
}

await mkdir(out, { recursive: true });
await writeFile(join(out, 'icon-192.png'), png(192, { safe: 0.64, rounded: true }));
await writeFile(join(out, 'icon-512.png'), png(512, { safe: 0.64, rounded: true }));
await writeFile(join(out, 'maskable-512.png'), png(512, { safe: 0.5, rounded: false })); // content within the 80% safe zone
await writeFile(join(out, 'apple-touch-icon.png'), png(180, { safe: 0.64, rounded: false })); // iOS rounds it itself
await writeFile(join(out, 'icon.svg'), svg());
console.log('Wrote icons to', out);
