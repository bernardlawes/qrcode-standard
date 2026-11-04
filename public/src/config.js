// Single source of truth for the app's identity. Renaming the app = edit this
// file (and the icons), then run `npm run sync` to update manifest.json,
// page titles and the service-worker cache list.

export const APP_NAME = 'Tesserae QR';
export const SHORT_NAME = 'Tesserae';
export const APP_DESCRIPTION = 'Make and read QR codes for links, text, WiFi and contacts, offline.';

// Bump on every deploy: it names the service-worker cache, which drives the
// "new version ready" prompt.
export const APP_VERSION = '1.0.8';

// Production origin (Cloudflare Pages custom domain).
export const ORIGIN = 'https://qrcode.bernardlawes.com';

export const THEME_COLOR = '#1f4e79';
export const BACKGROUND_COLOR = '#ffffff';

// Payloads above this many bytes get a "may be hard to scan when printed" warning.
export const DENSE_WARN_BYTES = 800;
