// WiFi: display only — the reader never joins networks.
import { el } from '../dom.js';
import { copyButton, row } from './common.js';

const SECURITY_LABEL = { nopass: 'None (open network)', WPA: 'WPA/WPA2/WPA3', WEP: 'WEP (insecure)' };

export function render({ ssid, security, password, hidden }) {
  const dl = el('dl', { class: 'details' },
    row('Network', el('strong', { text: ssid })),
    row('Security', SECURITY_LABEL[security] ?? security),
    row('Hidden', hidden ? 'Yes' : 'No'));

  if (security !== 'nopass') {
    const masked = '•'.repeat(Math.min(Math.max(password.length, 8), 24));
    const value = el('code', { class: 'secret', text: masked });
    const toggle = el('button', { type: 'button', class: 'secondary small', text: 'Reveal', 'aria-pressed': 'false' });
    toggle.addEventListener('click', () => {
      const show = toggle.getAttribute('aria-pressed') !== 'true';
      toggle.setAttribute('aria-pressed', String(show));
      toggle.textContent = show ? 'Hide' : 'Reveal';
      value.textContent = show ? password : masked;
    });
    dl.append(row('Password', el('span', { class: 'secret-row' }, value, toggle)));
  }

  return el('div', {}, dl,
    el('div', { class: 'actions' },
      copyButton(ssid, 'Copy network name'),
      security !== 'nopass' ? copyButton(password, 'Copy password') : null));
}
