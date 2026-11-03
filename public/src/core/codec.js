// Core codec: payload string <-> typed data. No UI, no DOM, no QR imaging.
import { TYPES, getType } from './registry.js';
import { utf8Length } from './escape.js';

export { TYPES, getType, utf8Length as byteLength };

/** Max wrapper layers (e.g. encrypted → payload) unwrapped by decode(). */
const MAX_UNWRAP = 4;

/** Encode typed data into the payload string. Throws Error with a user-facing message. */
export function encode(typeId, data) {
  return getType(typeId).encode(data);
}

/** The id of the first registered type whose detect() matches. */
export function detect(payload) {
  return TYPES.find((t) => t.detect(payload)).id; // `text` always matches
}

/**
 * Decode any payload. Never throws (the promise never rejects). Async so that
 * a type may use async platform APIs.
 * @returns {Promise<{ type: string, ok: true, data: any, layers: string[] }
 *         | { type: string, ok: false, error: string, layers: string[] }>}
 * `layers` lists wrapper types that were unwrapped on the way (a type may
 * return { ok: true, unwrap: innerText } to have the inner text decoded).
 */
export async function decode(payload) {
  const layers = [];
  let current = typeof payload === 'string' ? payload : '';
  for (;;) {
    const type = detect(current);
    let result;
    try {
      result = await getType(type).decode(current);
    } catch (e) {
      result = { ok: false, error: `Could not read ${type} payload: ${e.message}` };
    }
    if (result.ok && typeof result.unwrap === 'string') {
      layers.push(type);
      if (layers.length > MAX_UNWRAP) return { type, ok: false, error: 'Too many nested layers', layers };
      current = result.unwrap;
      continue;
    }
    return result.ok
      ? { type, ok: true, data: result.data, layers }
      : { type, ok: false, error: result.error, layers };
  }
}
