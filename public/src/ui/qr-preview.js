// QR preview panel: canvas, size/version info, density warning, PNG/SVG export,
// and optionally a Save button. Shared by the generator page and the local admin page.
import { el, replace, download, flash } from './dom.js';
import { makeQr, toSvg, toPngBlob, CapacityError } from '../qr/render.js';
import { byteLength } from '../core/codec.js';
import { DENSE_WARN_BYTES } from '../config.js';

/**
 * @param {{ title?: string, save?: { label: string, onSave: (payload: string, ecc: string) => Promise<boolean> } }} opts
 *   save: adds a button to the strip; onSave resolves true once saved, false if the user backed out.
 */
export function createQrPreview(root, { title, save } = {}) {
  const canvas = el('canvas', { class: 'qr-canvas', 'aria-label': 'QR code preview', role: 'img' });
  const info = el('p', { class: 'qr-info' });
  const warn = el('p', { class: 'warning', hidden: true });
  const error = el('p', { class: 'error', role: 'alert', hidden: true });
  const pngBtn = el('button', { type: 'button', class: 'chip', text: 'Download PNG' });
  const svgBtn = el('button', { type: 'button', class: 'chip', text: 'Download SVG' });
  const payloadText = el('pre', { class: 'payload' });
  const payloadBox = el('details', { class: 'payload-box' }, el('summary', { text: 'Show encoded payload' }), payloadText);

  const saveBtn = save ? el('button', { type: 'button', class: 'chip', text: save.label }) : null;

  let current = null; // { code, name, payload, ecc }

  pngBtn.addEventListener('click', async () => {
    if (current) download(await toPngBlob(current.code), `${current.name}.png`);
  });
  svgBtn.addEventListener('click', () => {
    if (current) download(new Blob([toSvg(current.code)], { type: 'image/svg+xml' }), `${current.name}.svg`);
  });

  saveBtn?.addEventListener('click', async () => {
    if (!current) return;
    try {
      if (await save.onSave(current.payload, current.ecc)) flash(saveBtn, 'Saved');
    } catch {
      flash(saveBtn, 'Not saved');
    }
  });

  replace(root,
    title ? el('h3', { text: title }) : null,
    el('div', { class: 'qr-frame' }, canvas),
    info, warn, error,
    el('div', { class: 'chips result-strip preview-strip', role: 'group', 'aria-label': 'Download' }, pngBtn, svgBtn, saveBtn),
    payloadBox);

  function setEnabled(on) {
    pngBtn.disabled = !on;
    svgBtn.disabled = !on;
    if (saveBtn) saveBtn.disabled = !on;
    canvas.classList.toggle('stale', !on);
  }

  return {
    /**
     * Render a payload, or show a message instead (payload null).
     * @param {string|null} payload
     * @param {{ ecc: string, name: string, message?: string, note?: string }} opts
     *   note: extra detail appended to the size line.
     */
    update(payload, { ecc, name, message, note }) {
      warn.hidden = true;
      error.hidden = true;
      if (payload == null) {
        current = null;
        setEnabled(false);
        info.textContent = '';
        payloadText.textContent = '';
        if (message) { error.textContent = message; error.hidden = false; }
        return;
      }
      const bytes = byteLength(payload);
      payloadText.textContent = payload;
      try {
        const qr = makeQr(payload, ecc);
        qr.code.toCanvas(canvas, { pad: 4 });
        current = { code: qr.code, name, payload, ecc };
        setEnabled(true);
        info.textContent = `${bytes} bytes${note ? ` (${note})` : ''} · version ${qr.version} (${qr.size}×${qr.size} modules) · error correction ${qr.ecc}`;
        if (bytes > DENSE_WARN_BYTES) {
          warn.textContent = `This code is dense (${bytes} bytes, over ${DENSE_WARN_BYTES}). It may not scan reliably when printed — print it large, shorten the content, or use a lower error-correction level.`;
          warn.hidden = false;
        }
      } catch (e) {
        current = null;
        setEnabled(false);
        info.textContent = `${bytes} bytes${note ? ` (${note})` : ''}`;
        error.textContent = e instanceof CapacityError ? e.message : `Could not create the code: ${e.message}`;
        error.hidden = false;
      }
    },
  };
}
