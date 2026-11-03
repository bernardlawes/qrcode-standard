// Profile data access. The generator only talks to a ProfileSource, so the
// flat JSON file can later be swapped for a database-backed source.
//
// Profile shape (see examples/profile.example.json):
//   {
//     "contact": { …vCard fields, see core/types/vcard.js normalizeVcard… },
//     "wifi": [ { "ssid", "security": "WPA"|"WEP"|"nopass", "password", "hidden" }, … ]
//   }
// No DOM dependencies: also used by tools/codes.mjs in Node.
import { normalizeVcard } from '../core/types/vcard.js';
import { normalizeWifi } from '../core/types/wifi.js';

/**
 * @interface ProfileSource
 * async load(): Promise<{ contact: object | null, wifi: object[] }>
 */
export class ProfileSource {
  async load() {
    throw new Error('ProfileSource.load() not implemented');
  }
}

/** Validate and normalise raw profile data (already parsed from JSON). */
export function parseProfile(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Profile must be a JSON object with "contact" and/or "wifi" sections');
  }
  const contact = raw.contact ? normalizeVcard(raw.contact) : null;
  const wifiList = raw.wifi == null ? [] : Array.isArray(raw.wifi) ? raw.wifi : [raw.wifi];
  const wifi = wifiList.map((w, i) => {
    if (!w || typeof w !== 'object') throw new Error(`wifi[${i}] must be an object`);
    return normalizeWifi(w);
  });
  if (!contact && wifi.length === 0) throw new Error('Profile has no "contact" or "wifi" section');
  return { contact, wifi };
}

/** Parse profile JSON text with a readable error. */
export function parseProfileText(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`profile.json is not valid JSON: ${e.message}`);
  }
  return parseProfile(raw);
}

/** A ProfileSource backed by JSON text from anywhere (file, fetch, string). */
export class JsonTextProfileSource extends ProfileSource {
  /** @param {() => Promise<string>} readText */
  constructor(readText) {
    super();
    this.readText = readText;
  }

  async load() {
    return parseProfileText(await this.readText());
  }
}

/** Browser: a profile.json picked by the user (never uploaded anywhere). */
export const fromFile = (file) => new JsonTextProfileSource(() => file.text());
