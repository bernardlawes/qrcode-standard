// The Wallet: codes the user saved to the home page, one per type, kept on this device
// (localStorage). Only the payload text and error-correction level are kept;
// the home page redraws the code from them.
// No DOM: tested in Node with a stand-in storage.

const KEY = 'sqr.home-codes.v1';

/** Home page rows for saved codes, in display order. */
export const SLOTS = [
  { type: 'vcard', label: 'Card' },
  { type: 'wifi', label: 'WiFi' },
  { type: 'text', label: 'Text' },
  { type: 'url', label: 'URL' },
];

const TYPES = new Set(SLOTS.map((s) => s.type));

export const slotLabel = (type) => SLOTS.find((s) => s.type === type)?.label;

function deviceStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // blocked site data
  }
}

/** @returns {Record<string, { payload: string, ecc: string }>} never throws */
export function loadCodes(storage = deviceStorage()) {
  let raw;
  try {
    raw = JSON.parse(storage?.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
  const codes = {};
  for (const type of TYPES) {
    const c = raw?.[type];
    if (typeof c?.payload === 'string' && c.payload && typeof c.ecc === 'string') {
      codes[type] = { payload: c.payload, ecc: c.ecc };
    }
  }
  return codes;
}

/** Save (or replace) the home page code for `type`. Throws if it can't be kept. */
export function saveCode(type, payload, ecc, storage = deviceStorage()) {
  if (!TYPES.has(type)) throw new Error(`A ${type} code can't go on the home page.`);
  if (!storage) throw new Error('This browser is not keeping data for this app.');
  const codes = loadCodes(storage);
  codes[type] = { payload, ecc };
  storage.setItem(KEY, JSON.stringify(codes));
}

/** Remove every saved code. */
export function clearCodes(storage = deviceStorage()) {
  storage?.removeItem(KEY);
}
