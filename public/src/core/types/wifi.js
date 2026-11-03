// WiFi: WIFI:T:<WPA|WEP|nopass>;S:<ssid>;P:<pass>;H:<true|false>;;
import { wifiEscape, wifiParseFields } from '../escape.js';

export const SECURITY_TYPES = ['WPA', 'WEP', 'nopass'];

/** Fill in defaults so encode input and decode output have the same shape. */
export function normalizeWifi(d = {}) {
  const security = d.security ?? 'WPA';
  return {
    ssid: String(d.ssid ?? ''),
    security,
    password: security === 'nopass' ? '' : String(d.password ?? ''),
    hidden: Boolean(d.hidden),
  };
}

export const wifi = {
  id: 'wifi',
  label: 'WiFi',

  detect(payload) {
    return payload.startsWith('WIFI:');
  },

  /** @param {{ ssid: string, security?: 'WPA'|'WEP'|'nopass', password?: string, hidden?: boolean }} data */
  encode(data) {
    const d = normalizeWifi(data);
    if (!d.ssid) throw new Error('Network name (SSID) is required');
    if (!SECURITY_TYPES.includes(d.security)) throw new Error(`Security must be one of ${SECURITY_TYPES.join(', ')}`);
    if (d.security !== 'nopass' && !d.password) throw new Error('Password is required for WPA/WEP');
    let s = `WIFI:T:${d.security};S:${wifiEscape(d.ssid)};`;
    if (d.security !== 'nopass') s += `P:${wifiEscape(d.password)};`;
    s += `H:${d.hidden};;`;
    return s;
  },

  decode(payload) {
    let fields;
    try {
      fields = wifiParseFields(payload.slice('WIFI:'.length));
    } catch (e) {
      return { ok: false, error: e.message };
    }
    if (!fields.has('S') || fields.get('S') === '') return { ok: false, error: 'WiFi code has no network name' };
    // Readers in the wild emit other T values (WPA2, SAE, …); keep them as-is for display.
    const security = fields.get('T') || 'nopass';
    return {
      ok: true,
      data: {
        ssid: fields.get('S'),
        security,
        password: security === 'nopass' ? '' : (fields.get('P') ?? ''),
        hidden: (fields.get('H') ?? '').toLowerCase() === 'true',
      },
    };
  },
};
