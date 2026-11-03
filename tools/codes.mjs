// CLI: generate contact + WiFi QR images from the private profile.
//   npm run codes [-- --profile private/profile.json --out out/codes --ecc M]
// Only the images in out/ are meant to be published — never the profile.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { toPngBuffer } from 'lean-qr/extras/node_export';
import { JsonTextProfileSource } from '../public/src/data/profile-source.js';
import { encode, byteLength } from '../public/src/core/codec.js';
import { makeQr, toSvg } from '../public/src/qr/render.js';
import { DENSE_WARN_BYTES } from '../public/src/config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { values: args } = parseArgs({
  options: {
    profile: { type: 'string', default: join(root, 'private', 'profile.json') },
    out: { type: 'string', default: join(root, 'out', 'codes') },
    ecc: { type: 'string', default: 'M' },
  },
});

const profilePath = resolve(args.profile);
const outDir = resolve(args.out);
if (outDir.startsWith(join(root, 'public'))) {
  console.error('Refusing to write into public/: review generated images before publishing them.');
  process.exit(1);
}

let profile;
try {
  profile = await new JsonTextProfileSource(() => readFile(profilePath, 'utf8')).load();
} catch (e) {
  console.error(e.code === 'ENOENT'
    ? `No profile at ${profilePath}. Copy examples/profile.example.json to private/profile.json and edit it.`
    : e.message);
  process.exit(1);
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'network';
const jobs = [];
if (profile.contact) jobs.push(['contact', 'vcard', profile.contact]);
for (const w of profile.wifi) jobs.push([`wifi-${slug(w.ssid)}`, 'wifi', w]);

await mkdir(outDir, { recursive: true });
for (const [name, type, data] of jobs) {
  const payload = encode(type, data);
  const qr = makeQr(payload, args.ecc);
  await writeFile(join(outDir, `${name}.svg`), toSvg(qr.code));
  await writeFile(join(outDir, `${name}.png`), toPngBuffer(qr.code, { scale: 10, pad: 4 }));
  const bytes = byteLength(payload);
  const warn = bytes > DENSE_WARN_BYTES ? '  ⚠ dense: may not scan reliably when printed' : '';
  console.log(`${name}: ${bytes} bytes, version ${qr.version}, ECC ${qr.ecc}${warn}`);
}
console.log(`Wrote ${jobs.length * 2} files to ${outDir}`);
