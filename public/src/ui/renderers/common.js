// Shared bits for result renderers.
import { el, copyText } from '../dom.js';

export function copyButton(text, label = 'Copy') {
  const b = el('button', { type: 'button', class: 'secondary', text: label });
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
