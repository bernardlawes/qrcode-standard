import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  utf8Length, wifiEscape, wifiParseFields, vcardEscape, vcardUnescape,
  splitUnescaped, vcardFold, vcardUnfold,
} from '../public/src/core/escape.js';

test('wifiEscape escapes \\ ; , : "', () => {
  assert.equal(wifiEscape('a\\b;c,d:e"f'), 'a\\\\b\\;c\\,d\\:e\\"f');
  assert.equal(wifiEscape('plain'), 'plain');
});

test('wifiParseFields resolves escapes and stops at ;;', () => {
  const f = wifiParseFields('T:WPA;S:my\\;net\\:1;P:p\\\\w\\,d;H:true;;IGNORED:x;');
  assert.equal(f.get('T'), 'WPA');
  assert.equal(f.get('S'), 'my;net:1');
  assert.equal(f.get('P'), 'p\\w,d');
  assert.equal(f.get('H'), 'true');
  assert.equal(f.has('IGNORED'), false);
});

test('wifiParseFields: field order does not matter and missing ;; is tolerated', () => {
  const f = wifiParseFields('S:home;T:WEP;P:abc');
  assert.deepEqual([...f], [['S', 'home'], ['T', 'WEP'], ['P', 'abc']]);
});

test('wifiParseFields rejects junk instead of guessing', () => {
  assert.throws(() => wifiParseFields('nonsense'));
  assert.throws(() => wifiParseFields('__proto__:x;;'));
});

test('vcardEscape / vcardUnescape round-trip', () => {
  const s = 'a,b;c\\d\nline2\r\nline3';
  const esc = vcardEscape(s);
  assert.equal(esc, 'a\\,b\\;c\\\\d\\nline2\\nline3');
  assert.equal(vcardUnescape(esc), 'a,b;c\\d\nline2\nline3');
});

test('splitUnescaped keeps escaped separators', () => {
  assert.deepEqual(splitUnescaped('a;b\\;c;;d', ';'), ['a', 'b\\;c', '', 'd']);
});

test('vcardFold limits every physical line to 75 octets', () => {
  const line = 'NOTE:' + 'x'.repeat(200);
  const folded = vcardFold(line);
  for (const l of folded.split('\r\n')) assert.ok(utf8Length(l) <= 75, `line is ${utf8Length(l)} bytes`);
  assert.equal(vcardUnfold(folded), line);
});

test('vcardFold never splits multi-byte characters or emoji', () => {
  const line = 'NOTE:' + 'é😀日本'.repeat(40);
  const folded = vcardFold(line);
  for (const l of folded.split('\r\n')) {
    assert.ok(utf8Length(l) <= 75);
    assert.ok(!/[\uD800-\uDBFF]$/.test(l), 'ends in a lone high surrogate');
    assert.ok(!/^ ?[\uDC00-\uDFFF]/.test(l), 'starts with a lone low surrogate');
  }
  assert.equal(vcardUnfold(folded), line);
});

test('short lines are not folded', () => {
  assert.equal(vcardFold('FN:Ann'), 'FN:Ann');
});
