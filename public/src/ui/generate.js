// Generator page: pick a type, fill in the form, live QR preview, export.
import './shell.js';
import { el, $, replace, debounce } from './dom.js';
import { forms } from './forms.js';
import { createQrPreview } from './qr-preview.js';
import { encode, getType } from '../core/codec.js';
import { ECC_LEVELS, DEFAULT_ECC } from '../qr/render.js';

const GENERATABLE = ['url', 'text', 'wifi', 'vcard'];

const typePicker = $('#type-picker');
const formRoot = $('#form');
const eccSelect = $('#ecc');
const preview = createQrPreview($('#preview'));

for (const lvl of ECC_LEVELS) {
  eccSelect.append(el('option', { value: lvl, text: { L: 'L — 7%', M: 'M — 15%', Q: 'Q — 25%', H: 'H — 30%' }[lvl], selected: lvl === DEFAULT_ECC }));
}

let typeId = new URLSearchParams(location.search).get('type');
if (!GENERATABLE.includes(typeId)) typeId = 'url';
let form;

let generation = 0; // drops results of an older refresh that finishes late

const refresh = debounce(async () => {
  const run = ++generation;
  const ecc = eccSelect.value;
  let payload = null;
  let message;
  try {
    payload = encode(typeId, form.read());
  } catch (e) {
    payload = null;
    message = e.message;
  }
  if (run !== generation) return;
  preview.update(payload, { ecc, name: `qr-${typeId}`, message });
}, 120);

function selectType(id) {
  typeId = id;
  for (const b of typePicker.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.type === id));
  form = forms[id](refresh);
  replace(formRoot, form.element);
  history.replaceState(null, '', `?type=${id}`);
  refresh();
}

for (const id of GENERATABLE) {
  typePicker.append(el('button', {
    type: 'button', class: 'chip', 'data-type': id, text: getType(id).label,
    on: { click: () => selectType(id) },
  }));
}
eccSelect.addEventListener('change', refresh);
selectType(typeId);
