// Tiny DOM helpers. Everything goes through textContent / setAttribute —
// never innerHTML — so decoded (untrusted) content can't become markup.

/**
 * el('div', { class: 'card', on: { click: fn } }, 'text', childNode, …)
 * Attribute names starting with "on" and the "style"/"srcdoc" attributes are
 * refused: handlers go in `on`, styles in CSS classes.
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'on') {
      for (const [evt, fn] of Object.entries(v)) node.addEventListener(evt, fn);
    } else if (k === 'class') {
      node.className = v;
    } else if (k === 'text') {
      node.textContent = v;
    } else if (/^on/i.test(k) || k === 'style' || k === 'srcdoc') {
      throw new Error(`el(): refusing attribute "${k}"`);
    } else if (k in node && typeof v !== 'string') {
      node[k] = v; // properties like checked, value, disabled
    } else {
      node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Replace all children of `node`. */
export function replace(node, ...children) {
  node.replaceChildren();
  append(node, children);
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);

/** Copy text to the clipboard, with short-lived feedback on the button: words, or a tick or cross on an icon button. */
export async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    if (button) flash(button, button.querySelector('svg') ? '\u2713' : 'Copied', 'Copied');
  } catch {
    if (button) flash(button, button.querySelector('svg') ? '\u2715' : 'Copy failed', 'Copy failed');
  }
}

/** Show `content` on a button for a moment (it's disabled meanwhile), then restore it. */
export function flash(button, content, label = content) {
  const original = [...button.childNodes]; // may be an icon, not just text
  const originalLabel = button.getAttribute('aria-label');
  button.textContent = content;
  button.setAttribute('aria-label', label);
  button.disabled = true;
  setTimeout(() => {
    button.replaceChildren(...original);
    if (originalLabel === null) button.removeAttribute('aria-label');
    else button.setAttribute('aria-label', originalLabel);
    button.disabled = false;
  }, 1200);
}

/** Trigger a download of a Blob without leaving a dangling object URL. */
export function download(blob, filename) {
  const href = URL.createObjectURL(blob);
  const a = el('a', { href, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
