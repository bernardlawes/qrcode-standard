// Contact card: vCard 3.0 (RFC 2426), raw, no prefix.
import { splitUnescaped, vcardEscape, vcardFold, vcardUnescape, vcardUnfold } from '../escape.js';

const NAME_PARTS = ['family', 'given', 'additional', 'prefix', 'suffix'];
const ADR_PARTS = ['poBox', 'extended', 'street', 'locality', 'region', 'postalCode', 'country'];

const str = (v) => (v == null ? '' : String(v));
const cleanType = (t) => str(t).toUpperCase().replace(/[^A-Z0-9,-]/g, '');

function formatName(n) {
  return [n.prefix, n.given, n.additional, n.family, n.suffix].filter(Boolean).join(' ');
}

/**
 * Fill in defaults so encode input and decode output have the same shape.
 * `formattedName` falls back to the structured name.
 */
export function normalizeVcard(d = {}) {
  const name = Object.fromEntries(NAME_PARTS.map((k) => [k, str(d.name?.[k])]));
  return {
    formattedName: str(d.formattedName) || formatName(name),
    name,
    org: str(d.org),
    title: str(d.title),
    phones: (d.phones ?? []).map((p) => ({ type: cleanType(p.type), value: str(p.value) })).filter((p) => p.value),
    emails: (d.emails ?? []).map((e) => ({ type: cleanType(e.type), value: str(e.value) })).filter((e) => e.value),
    urls: (d.urls ?? []).map(str).filter(Boolean),
    addresses: (d.addresses ?? [])
      .map((a) => ({ type: cleanType(a.type), ...Object.fromEntries(ADR_PARTS.map((k) => [k, str(a[k])])) }))
      .filter((a) => ADR_PARTS.some((k) => a[k])),
    note: str(d.note),
    extras: [],
  };
}

const typeParam = (t) => (t ? `;TYPE=${t}` : '');

export const vcard = {
  id: 'vcard',
  label: 'Card',

  detect(payload) {
    return /^BEGIN:VCARD\r?\n/i.test(payload) || /^BEGIN:VCARD$/i.test(payload);
  },

  encode(data) {
    const d = normalizeVcard(data);
    if (!d.formattedName) throw new Error('A name is required');
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${NAME_PARTS.map((k) => vcardEscape(d.name[k])).join(';')}`,
      `FN:${vcardEscape(d.formattedName)}`,
    ];
    if (d.org) lines.push(`ORG:${vcardEscape(d.org)}`);
    if (d.title) lines.push(`TITLE:${vcardEscape(d.title)}`);
    for (const p of d.phones) lines.push(`TEL${typeParam(p.type)}:${vcardEscape(p.value)}`);
    for (const e of d.emails) lines.push(`EMAIL${typeParam(e.type)}:${vcardEscape(e.value)}`);
    for (const u of d.urls) lines.push(`URL:${vcardEscape(u)}`);
    for (const a of d.addresses) {
      lines.push(`ADR${typeParam(a.type)}:${ADR_PARTS.map((k) => vcardEscape(a[k])).join(';')}`);
    }
    if (d.note) lines.push(`NOTE:${vcardEscape(d.note)}`);
    lines.push('END:VCARD');
    return lines.map((l) => vcardFold(l)).join('\r\n');
  },

  decode(payload) {
    const lines = vcardUnfold(payload).split(/\r\n|\r|\n/);
    if (!/^BEGIN:VCARD$/i.test(lines[0]?.trim() ?? '')) return { ok: false, error: 'Missing BEGIN:VCARD' };
    const d = normalizeVcard();
    d.formattedName = '';
    for (const line of lines.slice(1)) {
      // no trimming: trailing spaces can be part of a value
      if (!line.trim()) continue;
      if (/^END:VCARD\s*$/i.test(line)) break;
      const prop = parseLine(line);
      if (!prop) continue; // tolerate junk lines rather than failing the whole card
      const v = prop.value;
      switch (prop.name) {
        case 'VERSION': break;
        case 'FN': d.formattedName = vcardUnescape(v); break;
        case 'N': {
          const parts = splitUnescaped(v, ';');
          NAME_PARTS.forEach((k, i) => { d.name[k] = vcardUnescape(parts[i] ?? ''); });
          break;
        }
        case 'ORG': d.org = splitUnescaped(v, ';').map(vcardUnescape).filter(Boolean).join(', '); break;
        case 'TITLE': d.title = vcardUnescape(v); break;
        case 'TEL': d.phones.push({ type: prop.type, value: vcardUnescape(v) }); break;
        case 'EMAIL': d.emails.push({ type: prop.type, value: vcardUnescape(v) }); break;
        case 'URL': d.urls.push(vcardUnescape(v)); break;
        case 'ADR': {
          const parts = splitUnescaped(v, ';');
          d.addresses.push({ type: prop.type, ...Object.fromEntries(ADR_PARTS.map((k, i) => [k, vcardUnescape(parts[i] ?? '')])) });
          break;
        }
        case 'NOTE': d.note = vcardUnescape(v); break;
        default: d.extras.push({ name: prop.name, value: vcardUnescape(v) });
      }
    }
    if (!d.formattedName) d.formattedName = formatName(d.name);
    return { ok: true, data: d };
  },
};

/**
 * Parse one unfolded content line: [group.]NAME[;param...]:value.
 * Returns { name, type, value } or null. TYPE params (and bare vCard 2.1
 * style params like ";CELL") are merged into a comma-separated `type`.
 * Quoted-printable values (vCard 2.1) are decoded as UTF-8.
 */
function parseLine(line) {
  let colon = -1;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuotes = !inQuotes;
    else if (line[i] === ':' && !inQuotes) { colon = i; break; }
  }
  if (colon <= 0) return null;
  const [rawName, ...params] = line.slice(0, colon).split(';');
  const name = rawName.replace(/^[^.]*\./, '').toUpperCase();
  if (!/^[A-Z0-9-]+$/.test(name)) return null;
  const types = [];
  let qp = false;
  for (const p of params) {
    const eq = p.indexOf('=');
    const key = eq === -1 ? 'TYPE' : p.slice(0, eq).toUpperCase();
    const val = eq === -1 ? p : p.slice(eq + 1).replace(/"/g, '');
    if (key === 'TYPE') types.push(...val.split(','));
    if (key === 'ENCODING' && val.toUpperCase() === 'QUOTED-PRINTABLE') qp = true;
  }
  let value = line.slice(colon + 1);
  if (qp) value = decodeQuotedPrintable(value);
  return { name, type: cleanType(types.filter(Boolean).join(',')), value };
}

function decodeQuotedPrintable(s) {
  const bytes = [];
  const enc = new TextEncoder();
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /^[0-9A-F]{2}$/i.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(...enc.encode(s[i]));
    }
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
}
