# Conventions

How this codebase is put together, and the rules it keeps.

Sovereign QR Lite makes and reads the standard QR types (URL, text, WiFi, vCard). Structured Data, compression and encryption belong to the full app, Sovereign QR, and are not part of Lite.

## Stack
- Plain HTML/CSS/JS, ES modules, no framework, **no build step**. Node ≥ 20 for tooling and tests (developed on 24).
- Libraries are **vendored** into `public/vendor/` by `npm run vendor` (exact versions pinned in `package.json`, committed). Nothing loads from a CDN.
  - `lean-qr`: QR generation (`generate`, `correction`, `mode`; `extras/svg` for SVG).
  - `zxing-wasm` reader build: QR decoding. The `.wasm` is self-hosted via `prepareZXingModule({ overrides: { locateFile } })`; its default is jsDelivr, so the override must stay.
- Upgrading a library: bump the exact version, `npm i`, `npm run vendor`, check its docs and typings for API changes, run the tests.

## Commands
- `npm test`: Node's built-in test runner (`node --test`), no browser.
- `npm run dev`: local static server (repo root; `/` → `public/`, `/admin/` → `tools/admin/`). localhost is a secure context, so the camera works.
- `npm run sync`: regenerates `public/manifest.json`, page `<title>`s and the service-worker precache list from `public/src/config.js`. Tests fail if these drift.
- `npm run codes`: `private/profile.json` → `out/codes/*.svg|png`.
- `node tools/icons.mjs`: draws the icons from `docs/brand/logo-source.svg` (three QR corners and the S | M mark), white on `THEME_COLOR`. To change the logo, edit that SVG and run it again.

## Look
- One dark theme: frosted-glass panels (`.panel`: translucent navy, `backdrop-filter: blur`) over a fixed photo background (`public/img/bg-warehouse.webp`, set in `body::before`), teal accent. Tokens are on `:root` in `public/css/app.css`.
- Text inputs, text areas and selects use floating labels: `field()` in `ui/forms.js` puts the control before its `.label` inside `label.field.floating` and sets `placeholder=" "`; CSS floats the label on `:focus` / `:not(:placeholder-shown)`. Checkboxes keep plain labels.
- QR codes always render black on white (`.qr-frame`), whatever the theme, so they scan.
- Releasing: bump `APP_VERSION` in `config.js` → `npm run sync` → deploy `public/` (Cloudflare Pages, no build command).

## Layout
- `public/` is the **only** deployed directory. Nothing else is served from the production origin.
- `public/src/core/` has **no DOM or browser-only APIs** (TextEncoder and URL are fine), so it can move to a native iOS app and is tested in Node.
- Pages are linked by clean URL (`/generate`, `/scan`, `/`), never `*.html`: Cloudflare Pages 308-redirects `.html`, and a cached redirect breaks service-worker navigation. The dev server mimics this, and `sync` precaches clean URLs.
- The app name and version live only in `public/src/config.js`. Renaming = edit that file and the icons, then `npm run sync`.

## Type registry
- Each payload type is a module in `public/src/core/types/` exporting
  `{ id, label, detect(text), encode(data), decode(text) }`.
  `decode` never throws (it may be async): it returns `{ ok: true, data }` or `{ ok: false, error }`, and a wrapper type may return `{ ok: true, unwrap: innerText }` (the pipeline re-decodes the inner text). `codec.decode()` is async.
- Detection order is the array order in `public/src/core/registry.js`:
  `reserved` (QC/QD/QE codes from the full app) → `vcard` → `wifi` → `url` → `text`.
- `reserved` recognises full-app codes (`QD1:` Data, `QC1:` compressed Data, `QE1:` encrypted, and later versions). The reader says to open them in the full app; it never decodes or shows their contents.
- UI rendering lives in `public/src/ui/renderers/<id>.js`, keyed by the same `id`. Renderers return `{ body, actions }`; the Scan page puts `actions` in its connected button strip.
- Adding a type: core module + register in `registry.js` + renderer + generator form + round-trip tests.
- Standard types are encoded raw with **no prefix** so native phone cameras can read them.

## Security
- All decoded content is untrusted. DOM is built with `textContent` / `el()` from `public/src/ui/dom.js` only; **never** `innerHTML`, `insertAdjacentHTML` or `document.write`. The CSP enforces Trusted Types, so violations fail loudly.
- The reader never auto-opens URLs: it opens only after explicit confirmation, with `noopener,noreferrer`, http/https only.
- The reader only displays; it never joins WiFi or saves contacts.
- `private/` (the profile with WiFi password and personal details) is gitignored and outside the web root. It is never copied into `public/`, committed, or precached. Only generated QR images may be published.
- The CSP in `public/_headers` stays strict (`script-src 'self' 'wasm-unsafe-eval'`, no inline scripts or styles). The only Trusted Types policy is `sw-url` in `ui/update-banner.js`, which accepts exactly `/sw.js`.
- The service worker only prompts for updates (no automatic `skipWaiting`); the page sends `SKIP_WAITING` when the user clicks Reload.
