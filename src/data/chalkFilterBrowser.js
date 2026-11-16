// Browser side of the chalk filter: decoding a photo, running the filter in a Web Worker,
// and encoding the result. Everything happens on this device; nothing here touches the network,
// and the original photo is only ever read into a canvas and dropped.
import { fitSize, MAX_WORK, STORE_SIDE, STORE_BYTES, encodeWithBudget, ChalkCancelled, chalkify } from './chalkFilter.js';

/** Decode a photo file (EXIF rotation applied) into RGBA pixels at the working size. */
export async function loadPhoto(file, max = MAX_WORK) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { bmp = await createImageBitmap(file); }
  try {
    const { width, height } = fitSize(bmp.width, bmp.height, max);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    return { data, width, height, sourceWidth: bmp.width, sourceHeight: bmp.height };
  } finally {
    if (bmp.close) bmp.close();
  }
}

let nextId = 1;

/**
 * Start a conversion in a Web Worker so the page stays responsive (a worker never blocks
 * input, unlike slicing, which would still pause it between yields). The caller's pixel
 * array is copied, so it stays usable for the next slider change.
 * `mask` (optional, one 0..1 value per pixel) is the subject map from findSubject; it is copied too.
 * Returns { promise, cancel }. cancel() terminates the worker; the promise then rejects
 * with ChalkCancelled. Where Workers are unavailable the filter runs on the main thread.
 */
export function runChalk(image, settings, { onProgress, mask } = {}) {
  const { width, height } = image;
  const copy = { data: new Uint8ClampedArray(image.data), width, height };
  const maskCopy = mask ? new Float32Array(mask) : undefined;
  if (typeof Worker === 'undefined') {
    let cancelled = false;
    const promise = new Promise((resolve, reject) => {
      setTimeout(() => {
        if (cancelled) { reject(new ChalkCancelled()); return; }
        try { resolve(chalkify(copy, settings, { onProgress, isCancelled: () => cancelled, mask: maskCopy })); } catch (e) { reject(e); }
      }, 0);
    });
    return { promise, cancel: () => { cancelled = true; } };
  }
  const worker = new Worker(new URL('./chalkWorker.js', import.meta.url), { type: 'module' });
  const id = nextId++;
  let settle;
  const promise = new Promise((resolve, reject) => {
    settle = { resolve, reject };
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.id !== id) return;
      if (m.progress !== undefined) { if (onProgress) onProgress(m.progress); return; }
      worker.terminate();
      if (m.error) reject(new Error(m.error)); else resolve(m.result);
    };
    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message || 'chalk worker failed')); };
  });
  worker.postMessage({ id, image: copy, settings, mask: maskCopy }, maskCopy ? [copy.data.buffer, maskCopy.buffer] : [copy.data.buffer]);
  return {
    promise,
    cancel: () => { worker.terminate(); settle.reject(new ChalkCancelled()); },
  };
}

/**
 * Find the main subject of a photo, on this device, for the chalk filter's mask. The cut-out module
 * (and with it the model runtime) is loaded with a dynamic import only when this is called, so none
 * of it is in the page until someone taps "Remove background". `onStage('loading' | 'finding')` says
 * where it is. Returns { promise, cancel }; the promise resolves to a Float32Array (one 0..1 value
 * per pixel of `image`) or rejects with a CutoutError (see chalkCutout.js) or ChalkCancelled.
 */
export function findSubject(image, { onStage } = {}) {
  let cancelled = false;
  let stop;
  const gone = new Promise((_, reject) => { stop = () => reject(new ChalkCancelled()); });
  const work = import('./chalkCutout.js').then((m) => m.findSubjectMask(image, { onStage, isCancelled: () => cancelled }));
  work.catch(() => {});
  return {
    promise: Promise.race([work, gone]),
    cancel: () => { cancelled = true; stop(); },
  };
}

/** Put chalk pixels on a canvas (for display and for encodeChalk). */
export function toCanvas({ data, width, height }) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
  return canvas;
}

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Re-encode a chalk canvas at 600 px on the long side as JPEG, stepping quality down until it is
 * under 150 KB. JPEG, not WebP, because the share-card function draws the picture with resvg, which
 * does not decode WebP (PICTURE-4); every browser encodes JPEG. The picture is redrawn from
 * pixels, so no metadata from the original photo file can be carried into it.
 * @returns {Promise<{blob: Blob, mime: string, w: number, h: number, bytes: number}>}
 */
export async function encodeChalk(canvas, { maxBytes = STORE_BYTES, side = STORE_SIDE } = {}) {
  const type = 'image/jpeg';
  const encodeAt = (w, h, q) => {
    const small = document.createElement('canvas');
    small.width = w; small.height = h;
    const ctx = small.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, w, h);
    return toBlob(small, type, q);
  };
  const best = await encodeWithBudget(encodeAt, canvas.width, canvas.height, { maxBytes, side });
  return { blob: best.blob, mime: best.blob.type || type, w: best.w, h: best.h, bytes: best.blob.size };
}
