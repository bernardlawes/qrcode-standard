// Camera scanning loop: rear camera → downscaled frames → decoder.
import { decodeImage } from '../qr/scan.js';

const MAX_FRAME = 1024; // px on the long side; plenty for QR, keeps WASM fast

export class CameraUnavailableError extends Error {}

/**
 * Start scanning into a <video>. Resolves once the camera is running.
 * `onResult(text)` is called once, after which the camera is stopped.
 * @returns {Promise<{ stop(): void }>}
 */
export async function startCamera(video, onResult) {
  if (!window.isSecureContext) throw new CameraUnavailableError('The camera needs a secure (HTTPS) connection.');
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraUnavailableError('This browser has no camera access.');

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
  } catch (e) {
    const denied = e.name === 'NotAllowedError' || e.name === 'SecurityError';
    throw new CameraUnavailableError(denied
      ? 'Camera permission was denied. Allow it in your browser settings, or pick an image instead.'
      : `Could not start the camera (${e.name}).`);
  }

  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  video.muted = true;
  await video.play();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let running = true;
  let timer;

  const stop = () => {
    running = false;
    clearTimeout(timer);
    for (const track of stream.getTracks()) track.stop();
    video.srcObject = null;
  };

  const tick = async () => {
    if (!running) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w && h) {
      const scale = Math.min(1, MAX_FRAME / Math.max(w, h));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        const text = await decodeImage(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (text !== null && running) {
          stop();
          onResult(text);
          return;
        }
      } catch {
        // a bad frame is not fatal; keep scanning
      }
    }
    if (running) timer = setTimeout(tick, 120);
  };
  tick();

  return { stop };
}
