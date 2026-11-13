# Sovereign QR Lite

A free, offline QR code generator and reader, built as an installable web app (PWA). Everything runs on your device: nothing is uploaded, and it works without a network once loaded.

It makes and reads the standard QR types that any phone camera understands, encoded raw with no app-specific prefix:

- **Links** (http/https). The reader shows where a link goes and never opens it without asking.
- **Text**
- **WiFi** (`WIFI:…;;`). The password is hidden until you choose to reveal it.
- **Contact cards** (vCard 3.0)

Any code you build can be saved to the Wallet on the home page (one each for card, WiFi, text and link), where it opens with a tap. Saved codes stay in this browser on this device, WiFi password included; Clear removes them. The fifth row, App, links to the app itself and can't be changed.

Codes made by the full app, Sovereign QR (structured Data and encrypted codes), are recognised when scanned, and the reader says to open them in the full app.

© Bernard Lawes. All rights reserved. The bundled libraries in `public/vendor/` keep their own licences.

## Quick start

```bash
npm install
```

```bash
npm test
```

```bash
npm run dev
```

The dev server runs at http://localhost:8787. It serves `public/` exactly as it will be deployed, with the production security headers from `public/_headers`.

## Your contact and WiFi codes

The profile holds your WiFi password and personal details. It lives in `private/`, which is gitignored and outside the web root, and it is **never deployed**.

1. Copy `examples/profile.example.json` to `private/profile.json` and edit it.
2. Generate the images, using either:
   - **CLI:** `npm run codes` writes `out/codes/contact.{png,svg}` and `wifi-<ssid>.{png,svg}`.
   - **Local admin page:** run `npm run dev`, open http://localhost:8787/admin/ and pick the file. It is read in the browser tab only. The admin page is served by the dev server only and is not part of `public/`.
3. Publish or print only the generated images.

To update a code, edit the file and regenerate. Data access goes through the `ProfileSource` interface (`public/src/data/profile-source.js`), so a database can replace the file later.

## Renaming the app

1. Edit `public/src/config.js` (name, short name, description, colour).
2. Replace the icons in `public/icons/`, or run `node tools/icons.mjs` to redraw them in `THEME_COLOR`.
3. Run `npm run sync`. This rewrites `manifest.json`, the page titles and the service-worker precache list. The tests fail if you forget.

## Deploying (Cloudflare Pages)

Live at **https://lite.sovereignqr.com** (`ORIGIN` in `config.js`), from the Cloudflare Pages project `sovereignqr-lite`.

1. Create a Pages project connected to this repo, or deploy from the CLI with `npx wrangler pages deploy public --project-name sovereignqr-lite --branch main`. New projects: `npx wrangler pages project create <name> --production-branch main --force` (without `--force`, current wrangler makes a Workers project instead).
   - **Build command:** none.
   - **Build output directory:** `public`.
2. Add a custom domain in the Pages project (Custom domains → Set up). `sovereignqr.com` is on Cloudflare DNS, so Cloudflare adds the record itself; with DNS hosted elsewhere, add a CNAME pointing to `<project>.pages.dev`. Cloudflare provisions HTTPS, which the camera requires.
3. `public/_headers` sets the CSP (with Trusted Types), the Permissions-Policy (camera only), `no-referrer`, HSTS, and `no-cache` for HTML and `sw.js`.
4. On each release:
   1. Bump `APP_VERSION` in `config.js`.
   2. Run `npm run sync`.
   3. Commit and deploy.

   Installed copies show a "new version is ready — Reload" prompt.

## Layout

| Path | What |
|---|---|
| `public/` | The deployed web root (HTML, CSS, `src/`, vendored libraries, `sw.js`, `manifest.json`, `_headers`) |
| `public/src/core/` | Codec and type registry. No DOM, so it can be reused in a native iOS app |
| `public/src/qr/` | QR imaging (lean-qr) and decoding (zxing-wasm) |
| `public/src/ui/` | Pages, forms and result renderers |
| `tools/` | Vendoring, sync, icons, codes CLI, dev server, local admin page |
| `test/` | `node --test` suites |

See `CLAUDE.md` for conventions: the type-registry pattern, security rules and how to upgrade libraries.
