// Guards the "one place" rules: manifest, titles and the SW precache list must
// match public/src/config.js and the files in public/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { stalePaths } from '../tools/sync.mjs';
import { APP_NAME } from '../public/src/config.js';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

test('generated files are in sync with config.js (run npm run sync)', async () => {
  assert.deepEqual(await stalePaths(), []);
});

test('manifest is a standalone PWA on its own origin', async () => {
  const m = JSON.parse(await readFile(join(root, 'public', 'manifest.json'), 'utf8'));
  assert.equal(m.name, APP_NAME);
  assert.equal(m.display, 'standalone');
  assert.equal(m.scope, '/');
  assert.equal(m.start_url, '/');
  assert.ok(m.icons.some((i) => i.sizes === '512x512'));
});

test('nothing private is in the deployed directory or the precache', async () => {
  const sw = await readFile(join(root, 'public', 'sw.js'), 'utf8');
  assert.doesNotMatch(sw, /profile\.json|\/private\/|\/admin\//i);
  const all = await readdir(join(root, 'public'), { recursive: true });
  assert.ok(!all.some((f) => /profile\.json|private/i.test(f)), 'profile data found under public/');
});

test('pages are precached and linked at the clean URLs Cloudflare Pages serves', async () => {
  // Pages 308-redirects /x.html → /x; a cached redirect breaks navigation.
  const sw = await readFile(join(root, 'public', 'sw.js'), 'utf8');
  for (const url of ['/', '/generate', '/scan']) assert.match(sw, new RegExp(`^  '${url}',$`, 'm'));
  assert.doesNotMatch(sw, /^  '[^']*\.html',$/m);
  for (const page of ['index.html', 'generate.html', 'scan.html']) {
    const src = await readFile(join(root, 'public', page), 'utf8');
    assert.doesNotMatch(src, /href="[^"]*\.html/, page);
  }
});

test('no innerHTML-style sinks in app code', async () => {
  const dir = join(root, 'public', 'src');
  for (const f of await readdir(dir, { recursive: true })) {
    if (!f.endsWith('.js')) continue;
    const src = await readFile(join(dir, f), 'utf8');
    assert.doesNotMatch(src, /\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/, f);
  }
});
