// Generator page: pick a type, fill in the form, live QR preview, export.
import './shell.js';
import { el, $, replace, debounce } from './dom.js';
import { forms } from './forms.js';
import { createQrPreview } from './qr-preview.js';
import { encode, getType } from '../core/codec.js';
import { ECC_LEVELS, DEFAULT_ECC } from '../qr/render.js';
import { loadCodes, saveCode, slotLabel } from '../data/home-codes.js';
import { confirmDialog } from './renderers/common.js';

const GENERATABLE = ['url', 'text', 'wifi', 'vcard'];

const typePicker = $('#type-picker');
const formRoot = $('#form');
const eccSelect = $('#ecc');
const preview = createQrPreview($('#preview'), { save: { label: 'Save to Home', onSave: saveToHome } });

// One saved code per type on the home page; replacing a different one asks first.
async function saveToHome(payload, ecc) {
  const label = slotLabel(typeId);
  const existing = loadCodes()[typeId];
  if (existing && existing.payload !== payload && !await confirmDialog({
    title: `Replace ${label}?`,
    body: [el('p', { text: `The home page already has a ${label} code. Replace it with this one?` })],
    confirm: 'Replace',
  })) return false;
  saveCode(typeId, payload, ecc);
  return true;
}

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
