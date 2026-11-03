// Escaping helpers for the WiFi and vCard text formats. No DOM dependencies.

const encoder = new TextEncoder();

/** UTF-8 length of a string in bytes. */
export function utf8Length(s) {
  return encoder.encode(s).length;
}

// ---------------------------------------------------------------- WiFi ----

/** Escape a WiFi field value: \ ; , : " are backslash-escaped. */
export function wifiEscape(value) {
  return String(value).replace(/[\\;,:"]/g, (c) => '\\' + c);
}

/**
 * Parse the body of a `WIFI:` payload (everything after the prefix) into
 * fields. Field names are upper-cased. Escapes are resolved; an unescaped `;`
 * ends a value, and an empty field (`;;`) ends the payload.
 * Returns a Map so that field names can never touch object prototypes.
 */
export function wifiParseFields(body) {
  const fields = new Map();
  let i = 0;
  while (i < body.length) {
    if (body[i] === ';') break; // terminating ";;" (first ";" consumed by the previous field)
    const colon = body.indexOf(':', i);
    if (colon === -1) throw new Error('WiFi field without a ":" separator');
    const key = body.slice(i, colon).toUpperCase();
    if (!/^[A-Z]+$/.test(key)) throw new Error(`Invalid WiFi field name "${key}"`);
    let value = '';
    let j = colon + 1;
    for (; j < body.length; j++) {
      const c = body[j];
      if (c === '\\' && j + 1 < body.length) { value += body[++j]; continue; }
      if (c === ';') break;
      value += c;
    }
    if (!fields.has(key)) fields.set(key, value);
    i = j + 1;
  }
  return fields;
}

// --------------------------------------------------------------- vCard ----

/** Escape a vCard 3.0 TEXT value (RFC 2426 §4): \ , ; and newlines. */
export function vcardEscape(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/** Reverse of vcardEscape. Unknown escapes resolve to the escaped character. */
export function vcardUnescape(value) {
  return value.replace(/\\(.)/gs, (_, c) => (c === 'n' || c === 'N' ? '\n' : c));
}

/** Split on a separator that is not backslash-escaped; parts stay escaped. */
export function splitUnescaped(value, sep) {
  const parts = [];
  let cur = '';
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '\\' && i + 1 < value.length) { cur += c + value[++i]; continue; }
    if (c === sep) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

/**
 * Fold a content line to at most 75 octets per physical line (RFC 2425 §5.8.1),
 * never splitting a UTF-8 multi-byte sequence or a surrogate pair.
 * Continuation lines start with a single space, which counts toward the 75.
 */
export function vcardFold(line, limit = 75) {
  if (utf8Length(line) <= limit) return line;
  const out = [];
  let cur = '';
  let curBytes = 0;
  for (const ch of line) { // iterates by code point
    const b = utf8Length(ch);
    const max = out.length === 0 ? limit : limit - 1;
    if (curBytes + b > max) { out.push(cur); cur = ''; curBytes = 0; }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/** Undo line folding: a line break followed by a space or tab is removed. */
export function vcardUnfold(text) {
  return text.replace(/\r\n[ \t]|\n[ \t]|\r[ \t]/g, '');
}
