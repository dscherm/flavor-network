// The automatic cut-out (PICTURE-8). Loaded only by a dynamic import from chalkFilterBrowser.js when
// someone taps "Remove background", so neither this file nor the model runtime is in the page before.
//
// What leaves the device: one GET for the model file from this site's own /models/ folder, the first
// time only (the browser caches it). The photo, its pixels and the subject map are never sent
// anywhere: they go into the model running in this browser and nowhere else.
import { ChalkCancelled } from './chalkFilter.js';
import { CUTOUT_NET, resizeRGBA, modelInput, maskFromOutput, judgeMask } from './chalkCutoutMask.js';

export const MODEL_URL = '/models/u2netp.onnx';
export const WASM_PATH = '/wasm/';

/** code: 'no-wasm' (browser cannot run it), 'load' (model or runtime would not start), 'run' (it failed
 *  while working, for example out of memory), 'nothing' (no clear subject was found). */
export class CutoutError extends Error {
  constructor(code, detail) {
    super(detail || code);
    this.name = 'CutoutError';
    this.code = code;
  }
}

let loaded = null; // Promise<{ ort, session }>, kept so the model is fetched and started once

/** Forget the loaded model (tests). */
export function resetCutoutSession() { loaded = null; }

async function startSession({ importOrt, fetchFn }) {
  if (typeof WebAssembly === 'undefined') throw new CutoutError('no-wasm');
  let bytes;
  let ort;
  try {
    ort = await importOrt();
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = true; // the runtime's own worker, so the page stays responsive while it works
    ort.env.wasm.wasmPaths = WASM_PATH;
    const res = await fetchFn(MODEL_URL);
    if (!res.ok) throw new Error(`model file answered ${res.status}`);
    bytes = new Uint8Array(await res.arrayBuffer());
    const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
    return { ort, session };
  } catch (err) {
    throw new CutoutError('load', err && err.message);
  }
}

/**
 * Find the main subject of `image` ({ data: RGBA, width, height }, not modified).
 * @param {object} [opts]
 * @param {(stage: 'loading' | 'finding') => void} [opts.onStage]  'loading' only the first time
 * @param {() => boolean} [opts.isCancelled]  checked between steps; true throws ChalkCancelled
 * @param {() => Promise<object>} [opts.importOrt]  the runtime import (tests)
 * @param {typeof fetch} [opts.fetchFn]  tests
 * @returns {Promise<Float32Array>} one 0..1 value per pixel, 1 = subject
 * @throws {CutoutError | ChalkCancelled}
 */
export async function findSubjectMask(image, opts = {}) {
  const {
    onStage, isCancelled,
    importOrt = () => import('onnxruntime-web'),
    fetchFn = (url) => fetch(url),
  } = opts;
  const check = () => { if (isCancelled && isCancelled()) throw new ChalkCancelled(); };
  const { width: w, height: h } = image;

  if (!loaded) onStage?.('loading');
  if (!loaded) {
    loaded = startSession({ importOrt, fetchFn });
    loaded.catch(() => { loaded = null; });
  }
  const { ort, session } = await loaded;
  check();

  onStage?.('finding');
  await new Promise((r) => setTimeout(r, 30)); // let the message paint before the heavy step
  check();

  let out;
  try {
    const input = modelInput(resizeRGBA(image.data, w, h, CUTOUT_NET), CUTOUT_NET);
    const res = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, CUTOUT_NET, CUTOUT_NET]) });
    out = res[session.outputNames[0]].data;
  } catch (err) {
    throw new CutoutError('run', err && err.message);
  }
  check();

  const mask = maskFromOutput(out, w, h, CUTOUT_NET);
  if (judgeMask(mask) === 'nothing') throw new CutoutError('nothing');
  return mask;
}
