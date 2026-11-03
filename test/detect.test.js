import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detect, decode } from '../public/src/core/codec.js';

const cases = [
  // full-app codes (Data, compressed Data, encrypted, later versions) → reserved, never garbage
  ['QD1:{"a":1}', 'reserved'],
  ['QD1:not json', 'reserved'],
  ['QC1:ABC', 'reserved'],
  ['QE1:AAAAbase64ciphertext', 'reserved'],
  ['QD2:{"a":1}', 'reserved'],
  ['QE9:xyz', 'reserved'],
  // look-alikes that are just text
  ['qd1:{"a":1}', 'text'],
  ['QA1: meeting notes', 'text'],
  ['QD:{"a":1}', 'text'],
  [' QD1:{"a":1}', 'text'],
  // contacts / wifi
  ['BEGIN:VCARD\r\nFN:x\r\nEND:VCARD', 'vcard'],
  ['begin:vcard\nFN:x\nend:vcard', 'vcard'],
  ['BEGIN:VCARDS are fun', 'text'],
  ['WIFI:T:WPA;S:x;P:y;;', 'wifi'],
  ['wifi: is great', 'text'],
  // URLs: strict
  ['https://example.com', 'url'],
  ['HTTP://EXAMPLE.COM/X', 'url'],
  ['example.com', 'text'],
  ['www.example.com', 'text'],
  ['https://example.com and more', 'text'],
  ['see https://example.com', 'text'],
  ['https://example.com\n', 'text'],
  ['javascript:alert(1)', 'text'],
  ['JaVaScRiPt:alert(1)', 'text'],
  ['ftp://example.com', 'text'],
  ['data:text/html,<script>alert(1)</script>', 'text'],
  ['http:/example.com', 'text'],
  ['https:example.com', 'text'],
  ['mailto:a@b.c', 'text'],
  // JSON-looking text without the prefix stays text
  ['{"a":1}', 'text'],
  ['[1,2,3]', 'text'],
  ['<b>html</b>', 'text'],
  ['', 'text'],
];

for (const [payload, type] of cases) {
  test(`detect ${JSON.stringify(payload).slice(0, 50)} → ${type}`, async () => {
    assert.equal(detect(payload), type);
  });
}

test('QE1 is reported as encrypted, other versions as unknown-version', async () => {
  assert.deepEqual((await decode('QE1:abc')).data, { prefix: 'QE1:', reason: 'encrypted' });
  assert.deepEqual((await decode('QD2:{}')).data, { prefix: 'QD2:', reason: 'data' });
});

test('JSON-looking text decodes as text, unchanged', async () => {
  const r = await decode('{"a":1}');
  assert.deepEqual(r, { type: 'text', ok: true, data: { text: '{"a":1}' }, layers: [] });
});

test('Data and encrypted codes are recognised as full-app codes', async () => {
  for (const [payload, reason] of [['QD1:{"a":1}', 'data'], ['QC1:ABC', 'data'], ['QE1:xyz', 'encrypted']]) {
    const r = await decode(payload);
    assert.equal(r.ok, true, payload);
    assert.equal(r.type, 'reserved', payload);
    assert.equal(r.data.reason, reason, payload);
  }
});
