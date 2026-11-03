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

/** Copy text to the clipboard, with a short-lived "Copied" label on the button. */
export async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    if (button) flash(button, 'Copied');
  } catch {
    if (button) flash(button, 'Copy failed');
  }
}

function flash(button, label) {
  const original = button.textContent;
  button.textContent = label;
  button.disabled = true;
  setTimeout(() => { button.textContent = original; button.disabled = false; }, 1200);
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
