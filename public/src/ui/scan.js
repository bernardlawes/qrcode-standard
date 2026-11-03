// Reader page: camera or image file → decode → detect type → display only.
import './shell.js';
import { el, $, replace } from './dom.js';
import { decode } from '../core/codec.js';
import { decodeImage } from '../qr/scan.js';
import { startCamera, CameraUnavailableError } from './camera.js';
import { RENDERERS, TYPE_TITLES } from './renderers/index.js';

const startBtn = $('#start-camera');
const stopBtn = $('#stop-camera');
const pasteBtn = $('#paste-image');
const video = $('#video');
const viewport = $('#viewport');
const fileInput = $('#file');
const dropZone = $('#drop-zone');
const status = $('#scan-status');
const result = $('#result');

let camera = null;

function setStatus(message, kind = '') {
  status.textContent = message;
  status.className = kind;
  status.hidden = !message;
}

async function showResult(payload) {
  const r = await decode(payload);
  const title = TYPE_TITLES[r.type] ?? r.type;
  const body = r.ok
    ? RENDERERS[r.type](r.data)
    : el('div', {},
      el('p', { class: 'error', text: r.error }),
      el('details', {}, el('summary', { text: 'Show raw content' }), el('pre', { class: 'raw', text: payload })));
  replace(result,
    el('div', { class: 'result-head' },
      el('span', { class: 'badge', text: title }),
      el('button', { type: 'button', class: 'secondary small', text: 'Scan another', on: { click: reset } })),
    body);
  result.hidden = false;
  result.focus();
}

function reset() {
  replace(result);
  result.hidden = true;
  setStatus('');
}

async function start() {
  reset();
  startBtn.disabled = true;
  setStatus('Starting camera…');
  try {
    camera = await startCamera(video, (text) => {
      stopUi();
      showResult(text);
    });
    viewport.hidden = false;
    stopBtn.hidden = false;
    startBtn.hidden = true;
    setStatus('Point the camera at a QR code.');
  } catch (e) {
    startBtn.disabled = false;
    setStatus(e instanceof CameraUnavailableError ? e.message : `Camera error: ${e.message}`, 'error');
  }
}

function stopUi() {
  camera?.stop();
  camera = null;
  viewport.hidden = true;
  stopBtn.hidden = true;
  startBtn.hidden = false;
  startBtn.disabled = false;
  setStatus('');
}

async function scanFile(file) {
  if (!file) return;
  stopUi();
  reset();
  if (!file.type.startsWith('image/')) {
    setStatus('That file is not an image.', 'error');
    return;
  }
  setStatus('Reading image…');
  try {
    const text = await decodeImage(file);
    if (text === null) {
      setStatus('No QR code found in that image. Try a sharper or closer photo.', 'error');
      return;
    }
    setStatus('');
    await showResult(text);
  } catch (e) {
    setStatus(`Could not read the image: ${e.message}`, 'error');
  }
}

startBtn.addEventListener('click', start);
stopBtn.addEventListener('click', stopUi);
fileInput.addEventListener('change', () => { scanFile(fileInput.files[0]); fileInput.value = ''; });
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('over');
  scanFile(e.dataTransfer.files[0]);
});
document.addEventListener('paste', (e) => {
  const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
  if (file) scanFile(file);
});

// Phones have no Ctrl+V and only offer "Paste" on text fields, so read the
// clipboard on request. The browser asks permission (or shows its own Paste
// bubble on iOS). Hidden where the async clipboard API is unavailable.
async function pasteFromClipboard() {
  let items;
  try {
    items = await navigator.clipboard.read();
  } catch {
    setStatus('Could not read the clipboard. Allow clipboard access, or choose the image instead.', 'error');
    return;
  }
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'));
    if (type) {
      const blob = await item.getType(type);
      await scanFile(new File([blob], 'pasted-image', { type }));
      return;
    }
  }
  setStatus('There is no image on the clipboard. Copy a QR code image first.', 'error');
}
if (navigator.clipboard?.read) {
  pasteBtn.hidden = false;
  pasteBtn.addEventListener('click', pasteFromClipboard);
}
document.addEventListener('visibilitychange', () => { if (document.hidden && camera) stopUi(); });
