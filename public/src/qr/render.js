// QR imaging via lean-qr. Works in browsers and in Node (no DOM needed except
// for toPngBlob). Kept separate from core/ so the codec stays library-free.
import { generate, correction, mode } from '../../vendor/lean-qr/index.mjs';
import { toSvgSource } from '../../vendor/lean-qr/extras/svg.mjs';

export const ECC_LEVELS = ['L', 'M', 'Q', 'H'];
export const DEFAULT_ECC = 'M';

// ASCII stays in plain byte mode (no ECI) for maximum reader compatibility;
// anything else is UTF-8 with ECI 26. ISO-8859-1 is deliberately excluded:
// its ECI 3 is handled poorly by some phone cameras.
const MODES = [mode.numeric, mode.alphaNumeric, mode.ascii, mode.utf8];

/** Largest payload any QR code can hold: version 40, level L, byte mode. */
export const MAX_PAYLOAD_BYTES = 2953;

export class CapacityError extends Error {}

/**
 * Build the QR matrix for a payload.
 * The chosen level is the minimum: lean-qr may raise it for free when the
 * symbol has spare room, and `ecc` in the result reports the actual level.
 * @returns {{ code, version: number, size: number, ecc: string }}
 */
export function makeQr(payload, ecc = DEFAULT_ECC) {
  if (!ECC_LEVELS.includes(ecc)) throw new Error(`Unknown error-correction level "${ecc}"`);
  let code;
  try {
    code = generate(payload, { minCorrectionLevel: correction[ecc], modes: MODES });
  } catch (e) {
    throw new CapacityError(
      `Too much data for a QR code at error-correction level ${ecc}. Shorten the content or choose a lower level.`,
      { cause: e });
  }
  return { code, size: code.size, version: (code.size - 17) / 4, ecc: actualEcc(payload, ecc, code.size) };
}

// lean-qr doesn't expose the level it picked; find the highest level that
// still fits in the same version.
function actualEcc(payload, minEcc, size) {
  let best = minEcc;
  const version = (size - 17) / 4;
  for (const lvl of ECC_LEVELS.slice(ECC_LEVELS.indexOf(minEcc) + 1)) {
    try {
      const c = generate(payload, {
        minCorrectionLevel: correction[lvl], maxCorrectionLevel: correction[lvl],
        minVersion: version, maxVersion: version, modes: MODES,
      });
      if (c.size === size) best = lvl;
    } catch {
      break;
    }
  }
  return best;
}

/** Standalone SVG document. */
export function toSvg(code, { scale = 8, pad = 4 } = {}) {
  return toSvgSource(code, { on: '#000', off: '#fff', pad, scale, xmlDeclaration: true });
}

/** PNG blob (browser only). */
export function toPngBlob(code, { scale = 10, pad = 4 } = {}) {
  const small = document.createElement('canvas');
  code.toCanvas(small, { pad, on: [0, 0, 0, 255], off: [255, 255, 255, 255] });
  const big = document.createElement('canvas');
  big.width = small.width * scale;
  big.height = small.height * scale;
  const ctx = big.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, big.width, big.height);
  return new Promise((resolve, reject) =>
    big.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'));
}
