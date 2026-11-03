// QR imaging: capacity limits, and a full image-level round trip
// (lean-qr matrix → pixels → zxing-wasm decode → codec) — all in Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeQr, toSvg, CapacityError, ECC_LEVELS, MAX_PAYLOAD_BYTES } from '../public/src/qr/render.js';
import { encode, decode, byteLength } from '../public/src/core/codec.js';
import { prepareZXingModule, readBarcodes } from '../public/vendor/zxing-wasm/reader/index.js';

const wasmBinary = await readFile(new URL('../public/vendor/zxing-wasm/reader/zxing_reader.wasm', import.meta.url));
await prepareZXingModule({ overrides: { wasmBinary }, fireImmediately: true });

// QR byte-mode capacity of version 40 per level (ISO/IEC 18004).
const MAX_BYTES = { L: 2953, M: 2331, Q: 1663, H: 1273 };

/** Render a matrix into an RGBA ImageData-like at `scale` px per module. */
function toImageData(code, scale = 4, pad = 4) {
  const w = (code.size + pad * 2) * scale;
  const data = new Uint8ClampedArray(w * w * 4).fill(255);
  for (let y = 0; y < code.size; y++) {
    for (let x = 0; x < code.size; x++) {
      if (!code.get(x, y)) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + pad) * scale + dy) * w + (x + pad) * scale + dx) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width: w, height: w, colorSpace: 'srgb' };
}

async function scan(payload, ecc = 'M') {
  const { code } = makeQr(payload, ecc);
  const [result] = await readBarcodes(toImageData(code), { formats: ['QRCode'], maxNumberOfSymbols: 1 });
  assert.ok(result, 'zxing found a QR code');
  return result.text;
}

test('ASCII payloads near capacity fit; one byte more fails with CapacityError', async () => {
  for (const ecc of ECC_LEVELS) {
    const max = MAX_BYTES[ecc];
    // lowercase ASCII forces byte mode, so capacity == byte count
    const fits = 'a'.repeat(max);
    const { version } = makeQr(fits, ecc);
    assert.equal(version, 40, `${ecc} at max should be version 40`);
    assert.throws(() => makeQr('a'.repeat(max + 1), ecc), CapacityError);
  }
});

test('UTF-8 payload capacity accounts for multi-byte characters', async () => {
  // ECI header costs a few bits, so leave a little slack
  const emoji = '😀'.repeat(Math.floor((MAX_BYTES.L - 4) / 4));
  assert.ok(byteLength(emoji) <= MAX_BYTES.L);
  assert.doesNotThrow(() => makeQr(emoji, 'L'));
  assert.throws(() => makeQr('😀'.repeat(MAX_BYTES.L / 4 + 1), 'L'), CapacityError);
});

test('ECC level: requested level is a minimum, actual is reported', async () => {
  const r = makeQr('hi', 'L');
  assert.ok(ECC_LEVELS.indexOf(r.ecc) >= ECC_LEVELS.indexOf('L'));
  assert.equal(makeQr('a'.repeat(MAX_BYTES.H), 'H').ecc, 'H');
  assert.throws(() => makeQr('x', 'Z'));
});

test('SVG export is a standalone document', async () => {
  const svg = toSvg(makeQr('https://example.com').code);
  assert.match(svg, /^<\?xml/);
  assert.match(svg, /<svg[^>]+viewBox/);
});

const samples = {
  url: { url: 'https://example.com/päth?q=😀' },
  text: { text: 'Grüße 👋🏽 世界\nline 2' },
  wifi: { ssid: 'Café;Net', security: 'WPA', password: 'p\\a:s,s"', hidden: true },
  vcard: { name: { given: 'José', family: 'Müller' }, phones: [{ type: 'CELL', value: '+1 555' }], note: 'Hi, there; 😀' },
};

for (const [type, data] of Object.entries(samples)) {
  test(`image round-trip: ${type} survives QR encode → zxing decode`, async () => {
    const payload = encode(type, data);
    const scanned = await scan(payload);
    assert.equal(scanned, payload);
    assert.deepEqual(await decode(scanned), await decode(payload));
    assert.equal((await decode(scanned)).type, type);
  });
}

test('image round-trip near capacity (text, level M)', async () => {
  const filler = 'x'.repeat(MAX_BYTES.M - 40);
  const payload = encode('text', { text: filler });
  assert.ok(byteLength(payload) <= MAX_BYTES.M);
  assert.equal(await scan(payload, 'M'), payload);
});

test('MAX_PAYLOAD_BYTES is the real upper limit of a QR code', async () => {
  assert.equal(MAX_PAYLOAD_BYTES, MAX_BYTES.L);
  assert.equal(makeQr('a'.repeat(MAX_PAYLOAD_BYTES), 'L').version, 40);
  assert.throws(() => makeQr('a'.repeat(MAX_PAYLOAD_BYTES + 1), 'L'), CapacityError);
});
