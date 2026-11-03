# qrcode-standard — project conventions

Free, public, offline QR generator & reader PWA for the standard types (URL, text, WiFi, vCard). It is the public counterpart of the private, commercial `qrcode-offline` repo, which adds Data (key/value), compression and encryption. **Never add those features here**, and never copy code or history from `qrcode-offline` into this repo.

## Stack
- Plain HTML/CSS/JS, ES modules, no framework, **no build step**. Node ≥ 20 for tooling/tests (developed on 24).
- Libraries are **vendored** into `public/vendor/` by `npm run vendor` (pinned exact versions in `package.json`; committed). Never load from a CDN.
  - `lean-qr` — QR generation (`generate`, `correction`, `mode`; `extras/svg` for SVG).
  - `zxing-wasm` reader build — QR decoding. The `.wasm` is self-hosted via `prepareZXingModule({ overrides: { locateFile } })` (its default is jsDelivr — must stay overridden).
- Upgrading a library: bump the exact version, `npm i`, `npm run vendor`, check its docs/typings for API changes, run tests.

## Commands
- `npm test` — Node built-in test runner (`node --test`), no browser.
- `npm run dev` — local static server (repo root; `/` → `public/`, `/admin/` → `tools/admin/`). localhost is a secure context, so the camera works.
- `npm run sync` — regenerate `public/manifest.json`, page `<title>`s and the SW precache list from `public/src/config.js`. Tests fail if these drift.
- `npm run codes` — `private/profile.json` → `out/codes/*.svg|png`.
- `node tools/icons.mjs` — regenerate placeholder icons from `THEME_COLOR`.

## Look
- One dark theme: frosted-glass panels (`.panel`: translucent navy, `backdrop-filter: blur`) over a fixed photo background (`public/img/bg-warehouse.webp`, set in `body::before`; to change it, replace the file or that one `url()`), teal accent. Tokens are on `:root` in `public/css/app.css`.
- Text inputs, text areas and selects use floating labels: `field()` in `ui/forms.js` puts the control before its `.label` inside `label.field.floating` and sets `placeholder=" "`; CSS floats the label on `:focus` / `:not(:placeholder-shown)`. Checkboxes keep plain labels.
- QR codes always render black on white (`.qr-frame`), whatever the theme, so they scan.
- Releasing: bump `APP_VERSION` in config.js → `npm run sync` → deploy `public/` (Cloudflare Pages, no build command).

## Layout rules
- `public/` is the **only** deployed directory (Cloudflare Pages output dir). Nothing else may be served from the production origin.
- `public/src/core/` must have **no DOM or browser-only APIs** (TextEncoder/URL are fine). It is meant to be portable to a native iOS app and is tested in Node.
- Link pages by clean URL (`/generate`, `/scan`, `/`), never `*.html`: Cloudflare Pages 308-redirects `.html`, and a cached redirect breaks service-worker navigation. The dev server mimics this, and `sync` precaches clean URLs.
- App name/version live only in `public/src/config.js`. Renaming = edit that file + icons, then `npm run sync`.

## Type registry pattern
- Each payload type is a module in `public/src/core/types/` exporting
  `{ id, label, detect(text), encode(data), decode(text) }`.
  `decode` never throws (it may be async): it returns `{ ok: true, data }` or `{ ok: false, error }`, and a wrapper type may return `{ ok: true, unwrap: innerText }` (the pipeline re-decodes the inner text). `codec.decode()` is async.
- Detection order is the array order in `public/src/core/registry.js`:
  `reserved (QC/QD/QE codes from the full app)` → `vcard` → `wifi` → `url` → `text`.
- `reserved` recognises full-app codes (`QD1:` Data, `QC1:` compressed Data, `QE1:` encrypted, and later versions). The reader says to open them in the full app; it never decodes or shows their contents.
- UI rendering lives separately in `public/src/ui/renderers/<id>.js` keyed by the same `id`.
- Adding a type: core module + register in `registry.js` + renderer + generator form + round-trip tests.
- Standard types (URL, text, WiFi, vCard 3.0) are encoded raw with **no prefix** so native phone cameras can read them. This app has no custom types.

## Security rules
- All decoded content is untrusted. Build DOM with `textContent`/`el()` from `public/src/ui/dom.js` only; **never** `innerHTML`, `insertAdjacentHTML`, `document.write`. The CSP enforces Trusted Types, so violations fail loudly.
- The reader never auto-opens URLs; open only after explicit confirmation, with `noopener,noreferrer`, http/https only.
- The reader displays only; it never joins WiFi or saves contacts.
- `private/` (profile with WiFi password and personal details) is gitignored and outside the web root. Never copy it into `public/`, never commit it, never add it to the SW precache. Only generated QR images may be published.
- Keep the CSP in `public/_headers` strict (`script-src 'self' 'wasm-unsafe-eval'`, no inline scripts/styles). The only Trusted Types policy is `sw-url` in `ui/update-banner.js`, which accepts exactly `/sw.js`; don't add policies that pass arbitrary strings through.
- The service worker only prompts for updates (no automatic `skipWaiting`); the page sends `SKIP_WAITING` when the user clicks Reload.

## Workflow
- Build in working slices; commit after each slice with tests passing.
- This repo is **public**. Stage files explicitly (never `git add -A`) and check `git status` first: personal data belongs only in gitignored `private/`.
