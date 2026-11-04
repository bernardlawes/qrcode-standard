// WiFi: display only — the reader never joins networks.
import { el } from '../dom.js';
import { copyButton, row } from './common.js';

const SECURITY_LABEL = { nopass: 'None (open network)', WPA: 'WPA/WPA2/WPA3', WEP: 'WEP (insecure)' };

// A connected strip taking the rest of the value's row.
const strip = (...buttons) => el('span', { class: 'chips value-strip' }, ...buttons);

export function render({ ssid, security, password, hidden }) {
  const dl = el('dl', { class: 'details' },
    row('Network', el('span', { class: 'value-row' }, el('strong', { text: ssid }), strip(copyButton(ssid, { class: 'chip', 'aria-label': 'Copy network name' })))),
    row('Security', SECURITY_LABEL[security] ?? security),
    row('Hidden', hidden ? 'Yes' : 'No'));

  if (security !== 'nopass') {
    const masked = '•'.repeat(Math.min(Math.max(password.length, 8), 24));
    const value = el('code', { class: 'secret', text: masked });
    const toggle = el('button', { type: 'button', class: 'chip', text: 'Reveal', 'aria-pressed': 'false' });
    toggle.addEventListener('click', () => {
      const show = toggle.getAttribute('aria-pressed') !== 'true';
      toggle.setAttribute('aria-pressed', String(show));
      toggle.textContent = show ? 'Hide' : 'Reveal';
      value.textContent = show ? password : masked;
    });
    dl.append(row('Password', el('span', { class: 'value-row' }, value, strip(toggle, copyButton(password, { class: 'chip', 'aria-label': 'Copy password' })))));
  }

  return { body: dl, actions: [] };
}
