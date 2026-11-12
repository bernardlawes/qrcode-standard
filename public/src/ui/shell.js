// Shared page chrome: fills the app name from config, highlights the nav,
// and registers the service worker.
import { APP_NAME, SHORT_NAME } from '../config.js';
import { registerServiceWorker } from './update-banner.js';

for (const node of document.querySelectorAll('[data-app-name]')) node.textContent = APP_NAME;
for (const node of document.querySelectorAll('[data-app-short]')) node.textContent = SHORT_NAME;

const here = location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
for (const a of document.querySelectorAll('nav a')) {
  if (new URL(a.href).pathname === here) a.setAttribute('aria-current', 'page');
}

// The local admin page (served from /admin/) must never be cached for offline use.
if (!location.pathname.startsWith('/admin')) registerServiceWorker();
