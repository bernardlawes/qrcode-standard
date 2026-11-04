// Shared bits for result renderers.
import { el, copyText } from '../dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Two overlapping rounded sheets. Drawn in the text colour, so it follows the theme. */
function copyIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const shape = (name, attrs) => {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    svg.append(node);
  };
  shape('rect', { x: 9, y: 3, width: 12, height: 15, rx: 3 });
  shape('path', { d: 'M5 7v11a4 4 0 0 0 4 4h8' });
  return svg;
}

/** A strip segment. The label is for screen readers and the hover tooltip. */
export function copyButton(text, label = 'Copy') {
  const b = el('button', { type: 'button', class: 'chip', 'aria-label': label, title: label }, copyIcon());
  b.addEventListener('click', () => copyText(text, b));
  return b;
}

/** Definition-list row; skipped when value is empty. */
export function row(label, value) {
  if (value == null || value === '') return null;
  return el('div', { class: 'kv' }, el('dt', { text: label }), el('dd', {}, value));
}

/**
 * Modal confirmation using <dialog>. Resolves true only on explicit confirm.
 * @param {{ title: string, body: Node[], confirm: string }} opts
 */
export function confirmDialog({ title, body, confirm }) {
  return new Promise((resolve) => {
    const cancelBtn = el('button', { type: 'button', class: 'secondary', text: 'Cancel' });
    const okBtn = el('button', { type: 'button', text: confirm });
    const dialog = el('dialog', { class: 'confirm' },
      el('h2', { text: title }), ...body, el('div', { class: 'actions' }, cancelBtn, okBtn));
    const done = (result) => { dialog.close(); dialog.remove(); resolve(result); };
    cancelBtn.addEventListener('click', () => done(false));
    okBtn.addEventListener('click', () => done(true));
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); done(false); });
    document.body.append(dialog);
    dialog.showModal();
    cancelBtn.focus();
  });
}
