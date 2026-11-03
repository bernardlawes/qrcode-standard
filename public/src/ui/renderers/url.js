// URL: full URL with the real host emphasised. Never opened without confirmation.
import { el } from '../dom.js';
import { parseStrictUrl } from '../../core/types/url.js';
import { copyButton, confirmDialog } from './common.js';

export function render({ url }) {
  const u = parseStrictUrl(url);
  // u.hostname is what the browser will actually contact (punycode for IDN).
  const parts = [el('p', { class: 'url-host' }, el('span', { class: 'muted', text: 'Goes to ' }), el('strong', { text: u.hostname }))];
  if (u.username || u.password) {
    parts.push(el('p', { class: 'warning', text: `Careful: the text before "@" is not the site. This link goes to ${u.hostname}.` }));
  }
  if (u.hostname.split('.').some((l) => l.startsWith('xn--'))) {
    parts.push(el('p', { class: 'warning', text: `This domain uses international characters. Its real address is ${u.hostname}.` }));
  }
  if (u.protocol === 'http:') parts.push(el('p', { class: 'muted small', text: 'Not encrypted (http).' }));

  const open = el('button', {
    type: 'button', text: 'Open link…',
    on: {
      click: async () => {
        const ok = await confirmDialog({
          title: 'Open this link?',
          body: [el('p', {}, 'You are about to open a page on ', el('strong', { text: u.hostname }), '.'),
            el('p', { class: 'url-full', text: url })],
          confirm: 'Open',
        });
        if (ok) window.open(u.href, '_blank', 'noopener,noreferrer');
      },
    },
  });

  return el('div', {},
    ...parts,
    el('p', { class: 'url-full' }, highlightHost(url)),
    el('div', { class: 'actions' }, open, copyButton(url, 'Copy URL')));
}

/**
 * The URL text with its host part in <strong>, all as text nodes. The host is
 * located structurally (after any "user@" and before any ":port"), so a
 * look-alike earlier in the string is never the one emphasised.
 */
function highlightHost(url) {
  const start = url.indexOf('//') + 2;
  const endMatch = /[/?#]/.exec(url.slice(start));
  const end = endMatch ? start + endMatch.index : url.length;
  const authority = url.slice(start, end);
  const hostStart = start + authority.lastIndexOf('@') + 1;
  let hostEnd = end;
  if (url[hostStart] === '[') hostEnd = url.indexOf(']', hostStart) + 1;
  else {
    const colon = url.slice(hostStart, end).indexOf(':');
    if (colon >= 0) hostEnd = hostStart + colon;
  }
  return [url.slice(0, hostStart), el('strong', { text: url.slice(hostStart, hostEnd) }), url.slice(hostEnd)];
}
