// QR decoding via zxing-wasm (reader build). The .wasm is self-hosted:
// zxing-wasm defaults to a CDN, which would break offline use and our CSP.
import { prepareZXingModule, readBarcodes } from '../../vendor/zxing-wasm/reader/index.js';

const WASM_URL = new URL('../../vendor/zxing-wasm/reader/zxing_reader.wasm', import.meta.url).href;

prepareZXingModule({
  overrides: {
    locateFile: (path, prefix) => (path.endsWith('.wasm') ? WASM_URL : prefix + path),
  },
});

const OPTIONS = { formats: ['QRCode'], maxNumberOfSymbols: 1, tryHarder: true };

/**
 * Decode the first QR code in an image.
 * @param {Blob | ImageData} input an image file or a camera frame
 * @returns {Promise<string | null>} the payload text, or null if none found
 */
export async function decodeImage(input) {
  const results = await readBarcodes(input, OPTIONS);
  const hit = results.find((r) => r.isValid !== false && typeof r.text === 'string' && r.text.length > 0);
  return hit ? hit.text : null;
}
