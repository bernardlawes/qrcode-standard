// Registers the service worker and offers a reload when a new version is waiting.
import { el } from './dom.js';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let reloading = false;
  // On first install clients.claim() also fires controllerchange; only an
  // update (an old controller being replaced) should reload the page.
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    reloading = true;
    location.reload();
  });

  window.addEventListener('load', async () => {
    let reg;
    try {
      reg = await navigator.serviceWorker.register(swScriptUrl(), { scope: '/' });
    } catch {
      return; // offline support unavailable (e.g. private mode); the app still works online
    }
    // Only prompt when replacing an existing version, not on first install.
    const offer = (worker) => { if (worker && navigator.serviceWorker.controller) showBanner(worker); };
    offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => { if (worker.state === 'installed') offer(worker); });
    });
    // Check for updates when the app comes back to the foreground.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  });
}

// Trusted Types treats register()'s URL as a script sink. This is the only
// policy the CSP allows ("trusted-types sw-url"), and it accepts one URL.
function swScriptUrl() {
  if (!window.trustedTypes) return '/sw.js';
  const policy = window.trustedTypes.createPolicy('sw-url', {
    createScriptURL: (url) => {
      if (url !== '/sw.js') throw new TypeError(`Blocked script URL: ${url}`);
      return url;
    },
  });
  return policy.createScriptURL('/sw.js');
}

function showBanner(worker) {
  if (document.querySelector('.update-banner')) return;
  const reload = el('button', { type: 'button', text: 'Reload' });
  const later = el('button', { type: 'button', class: 'secondary', text: 'Later' });
  const banner = el('div', { class: 'update-banner', role: 'status' },
    el('span', { text: 'A new version is ready.' }), reload, later);
  reload.addEventListener('click', () => { reload.disabled = true; worker.postMessage('SKIP_WAITING'); });
  later.addEventListener('click', () => banner.remove());
  document.body.append(banner);
}
