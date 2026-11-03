// Generator input forms, one per payload type. Each returns
// { element, read(): data, set?(data) } and calls onInput on any change.
import { el } from './dom.js';
import { SECURITY_TYPES } from '../core/types/wifi.js';

// Text fields, text areas and selects get a floating label: it sits inside the
// empty field and moves up on focus or once filled (CSS keys off
// :placeholder-shown, hence the blank placeholder). Checkboxes keep plain labels.
function field(label, control, hint) {
  const floats = control.tagName === 'TEXTAREA' || control.tagName === 'SELECT' ||
    (control.tagName === 'INPUT' && !['checkbox', 'radio', 'file'].includes(control.type));
  if (floats && control.tagName !== 'SELECT') control.placeholder = ' ';
  return el('label', { class: floats ? 'field floating' : 'field' },
    control, el('span', { class: 'label', text: label }), hint ? el('small', { text: hint }) : null);
}

function input(attrs, onInput) {
  return el('input', { type: 'text', autocomplete: 'off', ...attrs, on: { input: onInput } });
}

export const forms = {
  url(onInput) {
    const u = input({ type: 'url', placeholder: 'https://example.com', inputmode: 'url', value: 'https://' }, onInput);
    return { element: el('div', {}, field('URL', u, 'http:// or https:// only')), read: () => ({ url: u.value }) };
  },

  text(onInput) {
    const t = el('textarea', { rows: 6, placeholder: 'Any text', on: { input: onInput } });
    return { element: el('div', {}, field('Text', t)), read: () => ({ text: t.value }) };
  },

  wifi(onInput) {
    const ssid = input({ placeholder: 'Network name' }, onInput);
    const security = el('select', { on: { change: () => { sync(); onInput(); } } },
      SECURITY_TYPES.map((s) => el('option', { value: s, text: s === 'nopass' ? 'None (open)' : s })));
    const password = input({ type: 'password', autocomplete: 'new-password' }, onInput);
    const show = el('input', { type: 'checkbox', on: { change: () => { password.type = show.checked ? 'text' : 'password'; } } });
    const hidden = el('input', { type: 'checkbox', on: { change: onInput } });
    const pwField = field('Password', password);
    const sync = () => { pwField.hidden = security.value === 'nopass'; };
    const element = el('div', {},
      field('Network name (SSID)', ssid),
      field('Security', security),
      pwField,
      el('label', { class: 'check' }, show, ' Show password'),
      el('label', { class: 'check' }, hidden, ' Hidden network'));
    return {
      element,
      read: () => ({ ssid: ssid.value, security: security.value, password: password.value, hidden: hidden.checked }),
      set(d) {
        ssid.value = d.ssid; security.value = d.security; password.value = d.password; hidden.checked = d.hidden;
        sync();
      },
    };
  },

  vcard(onInput) {
    const f = {};
    const mk = (key, label, attrs = {}) => field(label, (f[key] = input(attrs, onInput)));
    const note = (f.note = el('textarea', { rows: 3, on: { input: onInput } }));
    const element = el('div', { class: 'grid-2' },
      mk('given', 'First name'), mk('family', 'Last name'),
      mk('org', 'Organisation'), mk('title', 'Job title'),
      mk('cell', 'Mobile phone', { type: 'tel', inputmode: 'tel' }), mk('work', 'Work phone', { type: 'tel', inputmode: 'tel' }),
      mk('email', 'Email', { type: 'email', inputmode: 'email' }), mk('url', 'Website', { type: 'url', inputmode: 'url' }),
      mk('street', 'Street'), mk('locality', 'City'),
      mk('region', 'State / region'), mk('postalCode', 'Postal code'),
      mk('country', 'Country'), el('span'),
      el('div', { class: 'span-2' }, field('Note', note)));
    const v = (k) => f[k].value.trim();
    return {
      element,
      read: () => ({
        name: { given: v('given'), family: v('family') },
        org: v('org'),
        title: v('title'),
        phones: [{ type: 'CELL', value: v('cell') }, { type: 'WORK', value: v('work') }],
        emails: [{ type: 'INTERNET', value: v('email') }],
        urls: [v('url')],
        addresses: [{ type: 'HOME', street: v('street'), locality: v('locality'), region: v('region'), postalCode: v('postalCode'), country: v('country') }],
        note: f.note.value,
      }),
    };
  },
};
