// Home page: the user's saved codes (My Card, My WiFi, My Text, My URL) and
// This App, as collapsed rows. Opening one closes the others; Clear removes
// the saved codes from this device.
import './shell.js';
import { el, $, replace } from './dom.js';
import { makeQr } from '../qr/render.js';
import { SLOTS, loadCodes, clearCodes } from '../data/home-codes.js';
import { confirmDialog } from './renderers/common.js';
import { PROMO_URL } from '../config.js';

const list = $('#home-codes');
const clearBtn = $('#clear-codes');
let openRow = null;

function qrFrame(payload, ecc, label) {
  try {
    const canvas = el('canvas', { class: 'qr-canvas', role: 'img', 'aria-label': `${label} QR code` });
    makeQr(payload, ecc).code.toCanvas(canvas, { pad: 4 });
    return el('div', { class: 'qr-frame' }, canvas);
  } catch {
    return el('p', { class: 'error', text: 'This code can’t be shown. Build it again.' });
  }
}

function setOpen(row, on) {
  row.classList.toggle('open', on);
  row.querySelector('.code-toggle').setAttribute('aria-expanded', String(on));
  row.querySelector('.code-body').inert = !on;
  if (on) openRow = row;
  else if (openRow === row) openRow = null;
}

/** A collapsed row; `fill` draws its content the first time it opens. */
function codeRow(id, label, fill) {
  const bodyId = `code-${id}`;
  const inner = el('div', { class: 'code-inner' });
  const body = el('div', { class: 'code-body', id: bodyId, role: 'region', 'aria-label': label, inert: true }, inner);
  const toggle = el('button', { type: 'button', class: 'code-toggle', 'aria-expanded': 'false', 'aria-controls': bodyId, text: label });
  const row = el('section', { class: 'code-row' }, toggle, body);
  let filled = false;
  toggle.addEventListener('click', () => {
    const opening = !row.classList.contains('open');
    if (openRow && openRow !== row) setOpen(openRow, false);
    if (opening && !filled) { replace(inner, fill()); filled = true; }
    setOpen(row, opening);
  });
  return row;
}

function render() {
  const codes = loadCodes();
  clearBtn.disabled = Object.keys(codes).length === 0;
  openRow = null;
  replace(list,
    SLOTS.map(({ type, label }) => codeRow(type, label, () => (codes[type]
      ? qrFrame(codes[type].payload, codes[type].ecc, label)
      : el('p', { class: 'code-note' }, 'Not set yet. ', el('a', { href: `/generate?type=${type}`, text: 'Build one' }))))),
    codeRow('app', 'This App', () => [
      qrFrame(PROMO_URL, 'M', 'This App'),
      el('p', { class: 'code-note', text: new URL(PROMO_URL).host }),
    ]));
}

clearBtn.addEventListener('click', async () => {
  if (!await confirmDialog({
    title: 'Clear saved codes?',
    body: [el('p', { text: 'This removes My Card, My WiFi, My Text and My URL from this device. This App stays.' })],
    confirm: 'Clear',
  })) return;
  clearCodes();
  render();
});

render();
