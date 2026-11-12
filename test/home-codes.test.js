// Home page saved codes: one per type, on this device.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLOTS, slotLabel, loadCodes, saveCode, clearCodes } from '../public/src/data/home-codes.js';
import { PROMO_URL } from '../public/src/config.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

test('slots are the four standard types, in order', () => {
  assert.deepEqual(SLOTS.map((s) => s.label), ['My Card', 'My WiFi', 'My Text', 'My URL']);
  assert.equal(slotLabel('wifi'), 'My WiFi');
});

test('save, replace and load codes', () => {
  const s = memory();
  assert.deepEqual(loadCodes(s), {});
  saveCode('url', 'https://example.com', 'M', s);
  saveCode('wifi', 'WIFI:S:Home;T:WPA;P:pw;;', 'Q', s);
  saveCode('url', 'https://example.org', 'H', s);
  assert.deepEqual(loadCodes(s), {
    url: { payload: 'https://example.org', ecc: 'H' },
    wifi: { payload: 'WIFI:S:Home;T:WPA;P:pw;;', ecc: 'Q' },
  });
});

test('clear removes every saved code', () => {
  const s = memory();
  saveCode('text', 'hello', 'M', s);
  clearCodes(s);
  assert.deepEqual(loadCodes(s), {});
});

test('bad or foreign data loads as nothing, never throws', () => {
  const s = memory();
  s.setItem('sqr.home-codes.v1', '{not json');
  assert.deepEqual(loadCodes(s), {});
  s.setItem('sqr.home-codes.v1', JSON.stringify({ url: { payload: 5 }, dict: { payload: 'x', ecc: 'M' }, text: { payload: 'ok', ecc: 'L' } }));
  assert.deepEqual(loadCodes(s), { text: { payload: 'ok', ecc: 'L' } });
  assert.deepEqual(loadCodes(null), {});
});

test('only the four types can be saved, and only with storage', () => {
  assert.throws(() => saveCode('reserved', 'QD1:x', 'M', memory()));
  assert.throws(() => saveCode('url', 'https://example.com', 'M', null));
});

test('the This App code points to an https address', () => {
  assert.equal(new URL(PROMO_URL).protocol, 'https:');
});
