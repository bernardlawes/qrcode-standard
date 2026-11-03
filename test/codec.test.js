import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, detect, byteLength } from '../public/src/core/codec.js';
import { normalizeWifi } from '../public/src/core/types/wifi.js';
import { normalizeVcard } from '../public/src/core/types/vcard.js';

/** generate → decode → detect → identical data */
async function roundTrip(type, data, expected = data) {
  const payload = encode(type, data);
  assert.equal(detect(payload), type, `detected type for ${JSON.stringify(payload)}`);
  const r = await decode(payload);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.type, type);
  assert.deepEqual(r.data, expected);
  return payload;
}

// ------------------------------------------------------------- text/url ---

test('text round-trip, including unicode and emoji', async () => {
  for (const text of ['hello', 'Grüße 👋🏽 世界', 'multi\nline\ttext', ' leading space']) {
    await roundTrip('text', { text });
  }
});

test('text: empty is rejected', async () => {
  assert.throws(() => encode('text', { text: '' }));
});

test('url round-trip keeps the URL exactly as given', async () => {
  for (const url of [
    'https://example.com',
    'http://example.com/path?q=1&r=a%20b#frag',
    'https://bücher.example/ünïcode?emoji=😀',
    'https://user@example.com:8443/x',
  ]) await roundTrip('url', { url });
});

test('url: only http/https are accepted', async () => {
  for (const url of ['javascript:alert(1)', 'ftp://example.com', 'data:text/html,hi', 'example.com', 'https://', 'mailto:a@b.c']) {
    assert.throws(() => encode('url', { url }), undefined, url);
  }
});

// ----------------------------------------------------------------- wifi ---

test('wifi round-trip for each security type', async () => {
  await roundTrip('wifi', normalizeWifi({ ssid: 'Home', security: 'WPA', password: 'hunter22', hidden: false }));
  await roundTrip('wifi', normalizeWifi({ ssid: 'Old', security: 'WEP', password: 'abcde', hidden: true }));
  await roundTrip('wifi', normalizeWifi({ ssid: 'Cafe', security: 'nopass' }));
});

test('wifi produces the standard format', async () => {
  assert.equal(
    encode('wifi', { ssid: 'Home', security: 'WPA', password: 'pw', hidden: false }),
    'WIFI:T:WPA;S:Home;P:pw;H:false;;');
  assert.equal(encode('wifi', { ssid: 'Cafe', security: 'nopass' }), 'WIFI:T:nopass;S:Cafe;H:false;;');
});

test('wifi escaping edge cases round-trip', async () => {
  const nasty = ['semi;colon', 'com,ma', 'co:lon', 'quo"te', 'back\\slash', '\\;,:"', ';;', 'ends\\', '"quoted"'];
  for (const s of nasty) {
    await roundTrip('wifi', normalizeWifi({ ssid: s, security: 'WPA', password: s + '!pw' }));
  }
});

test('wifi unicode and emoji SSIDs', async () => {
  await roundTrip('wifi', normalizeWifi({ ssid: 'Café ☕ 5G', security: 'WPA', password: 'пароль🔑' }));
});

test('wifi validation', async () => {
  assert.throws(() => encode('wifi', { ssid: '', password: 'x' }), /SSID/);
  assert.throws(() => encode('wifi', { ssid: 'a', security: 'WPA' }), /Password/);
  assert.throws(() => encode('wifi', { ssid: 'a', security: 'WPA3', password: 'x' }), /Security/);
});

test('wifi decode tolerates other generators', async () => {
  const r = await decode('WIFI:S:Net;T:WPA2;P:secret;;');
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, { ssid: 'Net', security: 'WPA2', password: 'secret', hidden: false });
  const open = await decode('WIFI:S:Open;;');
  assert.equal(open.data.security, 'nopass');
});

test('malformed wifi fails gracefully', async () => {
  for (const p of ['WIFI:', 'WIFI:garbage', 'WIFI:T:WPA;P:x;;']) {
    const r = await decode(p);
    assert.equal(r.type, 'wifi');
    assert.equal(r.ok, false);
    assert.equal(typeof r.error, 'string');
  }
});

// ---------------------------------------------------------------- vcard ---

const fullContact = {
  name: { family: 'Lawes', given: 'Bernard', additional: '', prefix: 'Dr.', suffix: '' },
  formattedName: 'Dr. Bernard Lawes',
  org: 'Acme, Inc; R&D',
  title: 'Engineer',
  phones: [{ type: 'CELL', value: '+1 555 0100' }, { type: 'WORK,VOICE', value: '+1 555 0101' }],
  emails: [{ type: 'INTERNET', value: 'me@example.com' }],
  urls: ['https://example.com/a,b;c'],
  addresses: [{ type: 'HOME', street: '1 Main St; Apt 2', locality: 'Springfield', region: 'IL', postalCode: '62701', country: 'USA' }],
  note: 'Line one\nLine two, with comma; and semicolon \\ backslash',
};

test('vcard round-trip of every field', async () => {
  const payload = await roundTrip('vcard', normalizeVcard(fullContact));
  assert.match(payload, /^BEGIN:VCARD\r\nVERSION:3\.0\r\n/);
  assert.match(payload, /\r\nEND:VCARD$/);
});

test('vcard: minimal contact derives FN from N', async () => {
  const payload = encode('vcard', { name: { given: 'Ann', family: 'Lee' } });
  assert.match(payload, /\r\nFN:Ann Lee\r\n/);
  assert.match(payload, /\r\nN:Lee;Ann;;;\r\n/);
  await roundTrip('vcard', { name: { given: 'Ann', family: 'Lee' } }, normalizeVcard({ name: { given: 'Ann', family: 'Lee' } }));
});

test('vcard: unicode, emoji and long folded lines', async () => {
  const c = normalizeVcard({
    formattedName: 'José Müller 😀',
    name: { given: 'José', family: 'Müller' },
    note: '日本語のメモ 🎉 '.repeat(20),
  });
  const payload = await roundTrip('vcard', c);
  for (const line of payload.split('\r\n')) assert.ok(byteLength(line) <= 75);
});

test('vcard: name required', async () => {
  assert.throws(() => encode('vcard', {}), /name/i);
});

test('vcard decode: 2.1 style params, groups, quoted-printable, LF endings, extras', async () => {
  const card = [
    'BEGIN:VCARD', 'VERSION:2.1', 'N:Doe;Jane', 'FN:Jane Doe',
    'TEL;CELL:+1 555', 'item1.EMAIL;type=INTERNET;type=pref:j@x.org',
    'NOTE;ENCODING=QUOTED-PRINTABLE;CHARSET=UTF-8:Caf=C3=A9',
    'X-SOCIAL:@jane', 'END:VCARD',
  ].join('\n');
  const r = await decode(card);
  assert.equal(r.type, 'vcard');
  assert.equal(r.ok, true);
  assert.equal(r.data.formattedName, 'Jane Doe');
  assert.deepEqual(r.data.phones, [{ type: 'CELL', value: '+1 555' }]);
  assert.deepEqual(r.data.emails, [{ type: 'INTERNET,PREF', value: 'j@x.org' }]);
  assert.equal(r.data.note, 'Café');
  assert.deepEqual(r.data.extras, [{ name: 'X-SOCIAL', value: '@jane' }]);
});

test('vcard decode tolerates junk lines and missing END', async () => {
  const r = await decode('BEGIN:VCARD\r\nFN:Max\r\nthis is not a property\r\n<script>');
  assert.equal(r.ok, true);
  assert.equal(r.data.formattedName, 'Max');
});

// -------------------------------------------------------------- generic ---

test('decode never throws on odd input', async () => {
  for (const p of ['', ' ', '\u0000', undefined, null, 42, '\uD800']) {
    const r = await decode(p);
    assert.equal(typeof r.type, 'string');
  }
});

test('encode with unknown type throws', async () => {
  assert.throws(() => encode('nope', {}), /Unknown payload type/);
});
