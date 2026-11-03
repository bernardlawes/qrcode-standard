// Contact card: formatted for reading. Links inside the card stay plain text.
import { el } from '../dom.js';
import { row } from './common.js';

const typeLabel = (t) => (t ? t.toLowerCase().split(',').filter((x) => x !== 'pref' && x !== 'internet' && x !== 'voice').join(', ') : '');

function list(items, format) {
  if (items.length === 0) return null;
  return el('ul', { class: 'plain' }, items.map((it) => el('li', {}, format(it))));
}

function withType(value, type) {
  const t = typeLabel(type);
  return [value, t ? el('span', { class: 'muted small', text: ` (${t})` }) : null];
}

export function render(c) {
  const subtitle = [c.title, c.org].filter(Boolean).join(' · ');
  const address = (a) => [
    a.poBox, a.extended, a.street,
    [a.locality, a.region, a.postalCode].filter(Boolean).join(' '),
    a.country,
  ].filter(Boolean).join('\n');

  return el('article', { class: 'contact-card' },
    el('h2', { text: c.formattedName || '(no name)' }),
    subtitle ? el('p', { class: 'muted', text: subtitle }) : null,
    el('dl', { class: 'details' },
      row('Phone', list(c.phones, (p) => withType(p.value, p.type))),
      row('Email', list(c.emails, (e) => withType(e.value, e.type))),
      row('Web', list(c.urls, (u) => u)),
      row('Address', list(c.addresses, (a) => [el('span', { class: 'pre-line', text: address(a) }), withType('', a.type)])),
      row('Note', c.note ? el('span', { class: 'pre-line', text: c.note }) : null),
      row('Other', list(c.extras, (x) => `${x.name}: ${x.value}`))),
    el('p', { class: 'muted small', text: "To save this contact, scan the code with your phone's camera app." }));
}
