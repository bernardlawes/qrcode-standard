// Result renderers keyed by core type id. Each returns { body, actions }: a DOM
// node built with textContent only (decoded data is untrusted) and the buttons
// for the Scan page's action strip.
import { el } from '../dom.js';
import { copyButton } from './common.js';
import { render as url } from './url.js';
import { render as wifi } from './wifi.js';
import { render as renderCard } from './vcard.js';

const text = ({ text }) => ({ body: el('pre', { class: 'raw', text }), actions: [copyButton(text)] });

const vcard = (card) => ({ body: renderCard(card), actions: [] });

// Data and encrypted codes come from the full app, Sovereign QR.
const reserved = ({ reason }) => ({ actions: [], body: el('div', { class: 'notice' },
  el('strong', { text: reason === 'encrypted' ? 'Encrypted code' : 'Data code' }),
  el('p', {
    text: reason === 'encrypted'
      ? 'This code holds encrypted data made with Sovereign QR. Open it there to read it.'
      : 'This code holds structured data made with Sovereign QR. Open it there to read it.',
  })) });

export const RENDERERS = { url, text, wifi, vcard, reserved };

export const TYPE_TITLES = {
  url: 'Link', text: 'Text', wifi: 'WiFi network', vcard: 'Contact', reserved: 'Full-app code',
};
