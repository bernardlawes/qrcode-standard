// The pluggable type registry. Array order IS the detection order.
import { reserved } from './types/reserved.js';
import { vcard } from './types/vcard.js';
import { wifi } from './types/wifi.js';
import { url } from './types/url.js';
import { text } from './types/text.js';

export const TYPES = Object.freeze([reserved, vcard, wifi, url, text]);

const byId = new Map(TYPES.map((t) => [t.id, t]));

export function getType(id) {
  const t = byId.get(id);
  if (!t) throw new Error(`Unknown payload type "${id}"`);
  return t;
}
