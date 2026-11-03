// Result renderers keyed by core type id. Each returns a DOM node built with
// textContent only: decoded data is untrusted.
import { el } from '../dom.js';
import { copyButton } from './common.js';
import { render as url } from './url.js';
import { render as wifi } from './wifi.js';
import { render as vcard } from './vcard.js';

const text = ({ text }) => el('div', {},
  el('pre', { class: 'raw', text }),
  el('div', { class: 'actions' }, copyButton(text)));

// Data and encrypted codes come from the full version of this app.
const reserved = ({ reason }) => el('div', { class: 'notice' },
  el('strong', { text: reason === 'encrypted' ? 'Encrypted code' : 'Data code' }),
  el('p', {
    text: reason === 'encrypted'
      ? 'This code holds encrypted data made with the full version of this app. Open it there to read it.'
      : 'This code holds structured data made with the full version of this app. Open it there to read it.',
  }));

export const RENDERERS = { url, text, wifi, vcard, reserved };

export const TYPE_TITLES = {
  url: 'Link', text: 'Text', wifi: 'WiFi network', vcard: 'Contact', reserved: 'Full-app code',
};
