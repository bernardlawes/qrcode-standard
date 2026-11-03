// Local-only admin page: profile.json (picked from disk) → contact + WiFi codes.
import '/src/ui/shell.js';
import { el, $, replace } from '/src/ui/dom.js';
import { createQrPreview } from '/src/ui/qr-preview.js';
import { fromFile } from '/src/data/profile-source.js';
import { encode } from '/src/core/codec.js';
import { ECC_LEVELS, DEFAULT_ECC } from '/src/qr/render.js';

const fileInput = $('#profile-file');
const eccSelect = $('#ecc');
const errorBox = $('#profile-error');
const codesRoot = $('#codes');

for (const lvl of ECC_LEVELS) eccSelect.append(el('option', { value: lvl, text: lvl, selected: lvl === DEFAULT_ECC }));

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'network';
let profile = null;

async function load() {
  const file = fileInput.files[0];
  if (!file) return;
  errorBox.hidden = true;
  try {
    profile = await fromFile(file).load();
  } catch (e) {
    profile = null;
    errorBox.textContent = e.message;
    errorBox.hidden = false;
    replace(codesRoot);
    return;
  }
  render();
}

function render() {
  if (!profile) return;
  const items = [];
  if (profile.contact) items.push({ title: `Contact — ${profile.contact.formattedName}`, type: 'vcard', data: profile.contact, name: 'contact' });
  for (const w of profile.wifi) items.push({ title: `WiFi — ${w.ssid}`, type: 'wifi', data: w, name: `wifi-${slug(w.ssid)}` });
  replace(codesRoot);
  for (const item of items) {
    const box = el('section', { class: 'panel' });
    codesRoot.append(box);
    const preview = createQrPreview(box, { title: item.title });
    try {
      preview.update(encode(item.type, item.data), { ecc: eccSelect.value, name: item.name });
    } catch (e) {
      preview.update(null, { ecc: eccSelect.value, name: item.name, message: e.message });
    }
  }
}

fileInput.addEventListener('change', load);
eccSelect.addEventListener('change', render);
