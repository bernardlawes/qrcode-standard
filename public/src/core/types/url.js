// URL: the raw URL, no prefix. Only http and https are accepted.

/**
 * Strict check: the whole payload must be one absolute http(s) URL with a
 * host, no whitespace or control characters. Bare domains ("example.com")
 * and other schemes (javascript:, ftp:, data:) are not URLs here.
 * Returns the parsed URL or null.
 */
export function parseStrictUrl(s) {
  if (typeof s !== 'string' || s.length === 0 || s.length > 4096) return null;
  if (/[\s\u0000-\u001f\u007f]/.test(s)) return null;
  if (!/^https?:\/\/[^/]/i.test(s)) return null;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!u.hostname) return null;
  return u;
}

export const url = {
  id: 'url',
  label: 'URL',

  detect(payload) {
    return parseStrictUrl(payload) !== null;
  },

  /** @param {{ url: string }} data */
  encode({ url }) {
    const s = String(url ?? '').trim();
    if (!parseStrictUrl(s)) throw new Error('Enter a full http:// or https:// URL');
    return s;
  },

  decode(payload) {
    const u = parseStrictUrl(payload);
    if (!u) return { ok: false, error: 'Not a valid http(s) URL' };
    return { ok: true, data: { url: payload } };
  },
};
