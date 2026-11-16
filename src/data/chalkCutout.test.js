import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chalkify, CHALK_DEFAULTS, featherMask, ChalkCancelled } from './chalkFilter.js';
import {
  CUTOUT_NET, resizeRGBA, modelInput, maskFromOutput, keptShare, judgeMask,
} from './chalkCutoutMask.js';
import { findSubjectMask, resetCutoutSession, CutoutError, MODEL_URL } from './chalkCutout.js';

// A coloured subject (left) and a busy distractor (right) on a plain ground.
const scene = (w, h) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      let c = [20, 20, 20];
      if (x > w * 0.12 && x < w * 0.4 && y > h * 0.25 && y < h * 0.75) c = [230, 50, 40];
      else if (x > w * 0.6 && x < w * 0.9 && y > h * 0.2 && y < h * 0.8 && (Math.floor(x / 4) + Math.floor(y / 4)) % 2) c = [40, 80, 230];
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
    }
  }
  return { data, width: w, height: h };
};
const leftHalf = (w, h) => {
  const m = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = x < w / 2 ? 1 : 0;
  return m;
};
const settings = { ...CHALK_DEFAULTS, grain: 0 };
const brightness = (img, x0, x1, y0, y1) => {
  let sum = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sum += img.data[(y * img.width + x) * 4]; n++; }
  return sum / n;
};

describe('chalkify with a subject mask', () => {
  const W = 240, H = 240;
  const img = scene(W, H);

  it('draws chalk only inside the mask; outside is bare slate', () => {
    const plain = chalkify(img, settings);
    const cut = chalkify(img, settings, { mask: leftHalf(W, H) });
    // the right half held bright chalk before and is slate now
    expect(brightness(plain, 150, 220, 50, 190)).toBeGreaterThan(brightness(chalkify(img, settings, { mask: leftHalf(W, H) }), 150, 220, 50, 190) + 15);
    expect(brightness(cut, 150, 220, 50, 190)).toBeLessThan(45);
    // inside the mask nothing changed away from the edge
    for (const [x, y] of [[40, 100], [60, 70], [95, 120]]) {
      const o = (y * W + x) * 4;
      expect(cut.data[o]).toBe(plain.data[o]);
      expect(cut.data[o + 1]).toBe(plain.data[o + 1]);
    }
  });

  it('feathers the edge: strength falls through intermediate values, never a step', () => {
    const soft = featherMask(leftHalf(W, H), W, H);
    const row = (x) => soft[100 * W + x];
    expect(row(60)).toBe(1);
    expect(row(190)).toBe(0);
    let mids = 0, last = 1;
    for (let x = 100; x < 140; x++) {
      expect(row(x)).toBeLessThanOrEqual(last + 1e-6);
      last = row(x);
      if (row(x) > 0.02 && row(x) < 0.98) mids++;
    }
    expect(mids).toBeGreaterThanOrEqual(2);
  });

  it('with no mask, or one of the wrong length, the output is identical to before', () => {
    const base = chalkify(img, CHALK_DEFAULTS);
    expect(Buffer.from(chalkify(img, CHALK_DEFAULTS, { mask: undefined }).data).equals(Buffer.from(base.data))).toBe(true);
    expect(Buffer.from(chalkify(img, CHALK_DEFAULTS, { mask: new Float32Array(10) }).data).equals(Buffer.from(base.data))).toBe(true);
    expect(Buffer.from(chalkify(img, CHALK_DEFAULTS, {}).data).equals(Buffer.from(base.data))).toBe(true);
  });

  it('an all-ones mask leaves the picture as it was, and the mask array is not modified', () => {
    const ones = new Float32Array(W * H).fill(1);
    const before = ones.slice();
    const base = chalkify(img, CHALK_DEFAULTS);
    const out = chalkify(img, CHALK_DEFAULTS, { mask: ones });
    expect(Buffer.from(out.data).equals(Buffer.from(base.data))).toBe(true);
    expect(Buffer.from(ones.buffer).equals(Buffer.from(before.buffer))).toBe(true);
  });

  it('works together with Focus (both multiply)', () => {
    const both = chalkify(img, { ...settings, focus: 100 }, { mask: leftHalf(W, H) });
    const focusOnly = chalkify(img, { ...settings, focus: 100 });
    expect(brightness(both, 150, 220, 50, 190)).toBeLessThan(45);
    expect(brightness(both, 0, 30, 0, 30)).toBeCloseTo(brightness(focusOnly, 0, 30, 0, 30), 0);
  });
});

describe('cut-out model arithmetic', () => {
  it('shrinks by averaging and normalises channel-first', () => {
    const w = 640, h = 480;
    const data = new Uint8ClampedArray(w * h * 4).fill(255);
    const small = resizeRGBA(data, w, h);
    expect(small.length).toBe(CUTOUT_NET * CUTOUT_NET * 4);
    expect(small[0]).toBe(255);
    const input = modelInput(small);
    expect(input.length).toBe(3 * CUTOUT_NET * CUTOUT_NET);
    expect(input[0]).toBeCloseTo((1 - 0.485) / 0.229, 5);
    expect(input[CUTOUT_NET * CUTOUT_NET]).toBeCloseTo((1 - 0.456) / 0.224, 5);
  });

  it('turns the model answer into a subject map at the photo size', () => {
    const net = CUTOUT_NET;
    const out = new Float32Array(net * net);
    for (let y = 0; y < net; y++) for (let x = 0; x < net; x++) out[y * net + x] = x < net / 2 ? 6 : -6;
    const mask = maskFromOutput(out, 200, 100);
    expect(mask.length).toBe(200 * 100);
    expect(mask[50 * 200 + 10]).toBeCloseTo(1, 2);
    expect(mask[50 * 200 + 190]).toBeCloseTo(0, 2);
    expect(keptShare(mask)).toBeGreaterThan(0.45);
    expect(keptShare(mask)).toBeLessThan(0.55);
    expect(judgeMask(mask)).toBe('ok');
  });

  it('judges almost nothing and almost everything as no clear subject', () => {
    expect(judgeMask(new Float32Array(1000))).toBe('nothing');
    expect(judgeMask(new Float32Array(1000).fill(1))).toBe('nothing');
    const few = new Float32Array(1000); few.fill(1, 0, 20);
    expect(judgeMask(few)).toBe('nothing');
  });
});

function stubOrt({ output, createFails, runFails } = {}) {
  const net = CUTOUT_NET;
  const data = output || (() => { const o = new Float32Array(net * net); for (let i = 0; i < o.length; i++) o[i] = (i % net) < net / 2 ? 5 : -5; return o; })();
  const run = vi.fn(async (feeds) => {
    if (runFails) throw new Error('out of memory');
    return { out: { data, feeds } };
  });
  return {
    env: { wasm: {} },
    Tensor: class { constructor(type, d, dims) { this.type = type; this.data = d; this.dims = dims; } },
    InferenceSession: {
      create: vi.fn(async () => {
        if (createFails) throw new Error('no backend');
        return { inputNames: ['in'], outputNames: ['out'], run };
      }),
    },
    run,
  };
}
const okFetch = () => vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) }));

describe('findSubjectMask (model stubbed)', () => {
  const image = scene(90, 60);
  beforeEach(() => resetCutoutSession());
  afterEach(() => vi.unstubAllGlobals());

  it('requests only the model, from this site, once; nothing carries pixels', async () => {
    const ort = stubOrt();
    const fetchFn = okFetch();
    const stages = [];
    expect(fetchFn).not.toHaveBeenCalled();
    const mask = await findSubjectMask(image, { importOrt: async () => ort, fetchFn, onStage: (s) => stages.push(s) });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]).toEqual([MODEL_URL]);
    expect(MODEL_URL).toBe('/models/u2netp.onnx');
    expect(ort.env.wasm.wasmPaths).toBe('/wasm/');
    expect(stages).toEqual(['loading', 'finding']);
    expect(mask.length).toBe(90 * 60);
    expect(mask[30 * 90 + 5]).toBeGreaterThan(0.9);
    expect(mask[30 * 90 + 85]).toBeLessThan(0.1);
    // the second picture does not fetch or start the model again
    const stages2 = [];
    await findSubjectMask(image, { importOrt: async () => ort, fetchFn, onStage: (s) => stages2.push(s) });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(ort.InferenceSession.create).toHaveBeenCalledTimes(1);
    expect(stages2).toEqual(['finding']);
  });

  const code = async (opts) => {
    try { await findSubjectMask(image, opts); } catch (e) { return e; }
    return null;
  };

  it('no WebAssembly: code no-wasm, and nothing was fetched', async () => {
    vi.stubGlobal('WebAssembly', undefined);
    const fetchFn = okFetch();
    const err = await code({ importOrt: async () => stubOrt(), fetchFn });
    expect(err).toBeInstanceOf(CutoutError);
    expect(err.code).toBe('no-wasm');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('model file missing (the host answered something else): code load', async () => {
    const err = await code({ importOrt: async () => stubOrt(), fetchFn: vi.fn(async () => ({ ok: false, status: 404 })) });
    expect(err.code).toBe('load');
  });

  it('runtime would not start: code load; and a later try may start again', async () => {
    const e1 = await code({ importOrt: async () => stubOrt({ createFails: true }), fetchFn: okFetch() });
    expect(e1.code).toBe('load');
    const ok = await findSubjectMask(image, { importOrt: async () => stubOrt(), fetchFn: okFetch() });
    expect(ok.length).toBe(90 * 60);
  });

  it('runtime import fails (offline, chunk missing): code load', async () => {
    const err = await code({ importOrt: async () => { throw new Error('Failed to fetch dynamically imported module'); }, fetchFn: okFetch() });
    expect(err.code).toBe('load');
  });

  it('running out of memory: code run', async () => {
    const err = await code({ importOrt: async () => stubOrt({ runFails: true }), fetchFn: okFetch() });
    expect(err.code).toBe('run');
  });

  it('nothing found, or nearly everything: code nothing', async () => {
    const flat = new Float32Array(CUTOUT_NET * CUTOUT_NET).fill(1);
    const e1 = await code({ importOrt: async () => stubOrt({ output: flat }), fetchFn: okFetch() });
    expect(e1.code).toBe('nothing');
    const almost = new Float32Array(CUTOUT_NET * CUTOUT_NET).fill(9); almost[0] = -9;
    const e2 = await code({ importOrt: async () => stubOrt({ output: almost }), fetchFn: okFetch() });
    expect(e2.code).toBe('nothing');
  });

  it('cancel: stops with ChalkCancelled before running the model', async () => {
    const ort = stubOrt();
    let cancelled = false;
    const p = findSubjectMask(image, { importOrt: async () => ort, fetchFn: okFetch(), isCancelled: () => cancelled, onStage: (s) => { if (s === 'finding') cancelled = true; } });
    await expect(p).rejects.toBeInstanceOf(ChalkCancelled);
    expect(ort.run).not.toHaveBeenCalled();
  });
});

describe('where the network may be touched', () => {
  const read = (f) => readFileSync(resolve(process.cwd(), 'src/data', f), 'utf8');
  it('the arithmetic module makes no network, storage or console call', () => {
    expect(read('chalkCutoutMask.js')).not.toMatch(/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|importScripts|localStorage|sessionStorage|indexedDB|console\.\w+)\b|https?:\/\//);
  });
  it('the cut-out module has one fetch, of the model path, and no other way out', () => {
    const src = read('chalkCutout.js');
    expect(src).not.toMatch(/\b(XMLHttpRequest|sendBeacon|WebSocket|EventSource|importScripts|localStorage|sessionStorage|indexedDB|console\.\w+)\b|https?:\/\//);
    expect(src.match(/\bfetch\b/g).length).toBe(2); // the default fetchFn and its parameter name
    expect(src.match(/fetchFn\(/g).length).toBe(1);
    expect(src).toContain("fetchFn(MODEL_URL)");
  });
  it('the cut-out module is reached only through a dynamic import', () => {
    const browser = read('chalkFilterBrowser.js');
    expect(browser).toMatch(/import\('\.\/chalkCutout\.js'\)/);
    expect(browser).not.toMatch(/^import .*chalkCutout/m);
    expect(read('chalkCutout.js')).toMatch(/import\('onnxruntime-web'\)/);
  });
});
