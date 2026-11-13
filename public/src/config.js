// Single source of truth for the app's identity. Renaming the app = edit this
// file (and the icons), then run `npm run sync` to update manifest.json,
// page titles and the service-worker cache list.

export const APP_NAME = 'Sovereign QR Lite';
export const SHORT_NAME = 'SQR Lite';
export const APP_DESCRIPTION = 'Make and read QR codes for links, text, WiFi and contacts, offline.';

// Bump on every deploy: it names the service-worker cache, which drives the
// "new version ready" prompt.
export const APP_VERSION = '1.0.25';

// Production origin (Cloudflare Pages custom domain).
export const ORIGIN = 'https://lite.sovereignqr.com';

// The home page's "App" code: fixed in Lite (it's how free users share
// the app). Switch to https://sovereignqr.com once the landing page is live.
export const PROMO_URL = 'https://lite.sovereignqr.com';

export const THEME_COLOR = '#1f4e79';
export const BACKGROUND_COLOR = '#ffffff';

// Payloads above this many bytes get a "may be hard to scan when printed" warning.
export const DENSE_WARN_BYTES = 800;
