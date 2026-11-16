import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolve } from 'node:path';
import {
  chalkify, CHALK_DEFAULTS, CHALK_RANGES, clampSettings, fitSize, encodeWithBudget,
  inspectMetadata, ChalkCancelled, STORE_BYTES, focusMask, makeNoise,
} from './chalkFilter.js';

const make = (w, h, fn) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y);
      const o = (y * w + x) * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
  }
  return { data, width: w, height: h };
};
const inSquare = (x, y) => x >= 20 && x < 44 && y >= 20 && y < 44;
const whiteSquare = () => make(64, 64, (x, y) => (inSquare(x, y) ? [255, 255, 255] : [0, 0, 0]));
const px = (img, x, y) => { const o = (y * img.width + x) * 4; return [img.data[o], img.data[o + 1], img.data[o + 2]]; };
const maxNeighbourStep = (img) => {
  let m = 0;
  for (let y = 4; y < img.height - 4; y++) {
    for (let x = 4; x < img.width - 5; x++) m = Math.max(m, Math.abs(px(img, x, y)[0] - px(img, x + 1, y)[0]));
  }
  return m;
};

describe('chalkify', () => {
  const noGrain = { ...CHALK_DEFAULTS, grain: 0 };

  it('draws bright outlines on slate for a white square on black', () => {
    const out = chalkify(whiteSquare(), noGrain);
    expect(out.width).toBe(64);
    expect(out.height).toBe(64);
    expect(px(out, 32, 20)[0]).toBeGreaterThan(240);
    expect(px(out, 20, 32)[0]).toBeGreaterThan(240);
    expect(px(out, 4, 4)[0]).toBeLessThan(60);
    expect(px(out, 58, 30)[0]).toBeLessThan(60);
    expect(px(out, 32, 20)[0]).toBeGreaterThan(px(out, 32, 32)[0]);
    for (let i = 3; i < out.data.length; i += 4) expect(out.data[i]).toBe(255);
  });

  it('gives no lines for a flat image', () => {
    const flat = make(64, 64, () => [255, 255, 255]);
    const out = chalkify(flat, noGrain);
    expect(maxNeighbourStep(out)).toBeLessThan(6);
    expect(maxNeighbourStep(chalkify(whiteSquare(), noGrain))).toBeGreaterThan(100);
  });

  it('colour 0 gives cream chalk only', () => {
    const red = make(64, 64, (x, y) => (inSquare(x, y) ? [220, 30, 30] : [20, 20, 120]));
    const cream = chalkify(red, { ...noGrain, colour: 0 });
    const coloured = chalkify(red, noGrain);
    let maxWarm = 0;
    for (let i = 0; i < cream.data.length; i += 4) {
      const [r, g, b] = [cream.data[i], cream.data[i + 1], cream.data[i + 2]];
      expect(r).toBeGreaterThanOrEqual(g);
      expect(g).toBeGreaterThanOrEqual(b);
      maxWarm = Math.max(maxWarm, r - b);
    }
    expect(maxWarm).toBeLessThanOrEqual(245 - 222 + 1);
    const [r, , b] = px(coloured, 32, 32);
    expect(r - b).toBeGreaterThan(40);
  });

  it('grain 0 leaves strokes untouched; grain breaks them up', () => {
    const clean = chalkify(whiteSquare(), noGrain);
    const grainy = chalkify(whiteSquare(), { ...CHALK_DEFAULTS, grain: 100 });
    for (let x = 22; x < 42; x++) expect(px(clean, x, 20)[0]).toBe(255);
    let dimmer = 0;
    for (let x = 22; x < 42; x++) if (px(grainy, x, 20)[0] < 250) dimmer++;
    expect(dimmer).toBeGreaterThan(5);
  });

  it('clamps every setting to its range', () => {
    for (const key of Object.keys(CHALK_RANGES)) {
      const { min, max } = CHALK_RANGES[key];
      expect(clampSettings({ [key]: min - 1000 })[key]).toBe(min);
      expect(clampSettings({ [key]: max + 1000 })[key]).toBe(max);
      expect(clampSettings({ [key]: NaN })[key]).toBe(CHALK_DEFAULTS[key]);
      expect(clampSettings({})[key]).toBe(CHALK_DEFAULTS[key]);
    }
    const lo = Object.fromEntries(Object.entries(CHALK_RANGES).map(([k, r]) => [k, r.min]));
    const hi = Object.fromEntries(Object.entries(CHALK_RANGES).map(([k, r]) => [k, r.max]));
    const img = whiteSquare();
    const below = Object.fromEntries(Object.keys(lo).map((k) => [k, lo[k] - 50]));
    const above = Object.fromEntries(Object.keys(hi).map((k) => [k, hi[k] + 500]));
    expect(Array.from(chalkify(img, below).data)).toEqual(Array.from(chalkify(img, lo).data));
    expect(Array.from(chalkify(img, above).data)).toEqual(Array.from(chalkify(img, hi).data));
  });

  it('is byte-identical for the same input and settings, and leaves the input alone', () => {
    const img = make(48, 40, (x, y) => [(x * 5) & 255, (y * 6) & 255, ((x + y) * 3) & 255]);
    const before = Uint8ClampedArray.from(img.data);
    const a = chalkify(img, CHALK_DEFAULTS);
    const b = chalkify(img, CHALK_DEFAULTS);
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
    expect(Buffer.from(img.data).equals(Buffer.from(before))).toBe(true);
  });

  it('reports rising progress up to 1 and can be cancelled', () => {
    const seen = [];
    chalkify(whiteSquare(), CHALK_DEFAULTS, { onProgress: (f) => seen.push(f) });
    expect(seen.length).toBeGreaterThan(4);
    expect(seen[seen.length - 1]).toBe(1);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    let calls = 0;
    expect(() => chalkify(whiteSquare(), CHALK_DEFAULTS, { isCancelled: () => ++calls > 2 })).toThrow(ChalkCancelled);
  });
});

describe('focus fade', () => {
  const { focus: _f, ...OLD_DEFAULTS } = CHALK_DEFAULTS;
  const noGrain = { ...CHALK_DEFAULTS, grain: 0 };
  const busy = make(64, 48, (x, y) => [(x * 7) & 255, (y * 11) & 255, ((x * y) & 255)]);
  const marked = () => make(80, 80, (x, y) => {
    const centre = x >= 36 && x < 44 && y >= 36 && y < 44;
    const corner = (x < 8 || x >= 72) && (y < 8 || y >= 72);
    return centre || corner ? [255, 255, 255] : [0, 0, 0];
  });
  const slate = (img, x, y) => {
    const { coarse } = makeNoise(img.width, img.height);
    const cx = img.width / 2, cy = img.height / 2;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / Math.sqrt(cx * cx + cy * cy);
    return Uint8ClampedArray.of(26 - 15 * dist + (coarse[y * img.width + x] - 0.5) * 7)[0];
  };

  it('focus 0 is byte-identical to the filter before focus existed', () => {
    expect(CHALK_DEFAULTS.focus).toBe(0);
    const a = chalkify(busy, { ...CHALK_DEFAULTS });
    const b = chalkify(busy, OLD_DEFAULTS);
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
  });

  it('clamps focus to 0-100', () => {
    expect(CHALK_RANGES.focus.min).toBe(0);
    expect(CHALK_RANGES.focus.max).toBe(100);
    expect(clampSettings({ focus: -5 }).focus).toBe(0);
    expect(clampSettings({ focus: 400 }).focus).toBe(100);
    const hi = chalkify(busy, { ...CHALK_DEFAULTS, focus: 100 });
    const over = chalkify(busy, { ...CHALK_DEFAULTS, focus: 9999 });
    expect(Buffer.from(hi.data).equals(Buffer.from(over.data))).toBe(true);
  });

  it('at focus 100 keeps the centre marks and leaves corners and edges as bare slate', () => {
    const img = marked();
    const plain = chalkify(img, { ...noGrain, focus: 0 });
    const out = chalkify(img, { ...noGrain, focus: 100 });
    expect(px(out, 40, 40)[0]).toBe(px(plain, 40, 40)[0]);
    expect(px(out, 40, 40)[0]).toBeGreaterThan(200);
    expect(px(plain, 3, 3)[0]).toBeGreaterThan(100);
    for (const [x, y] of [[0, 0], [3, 3], [79, 0], [76, 3], [0, 79], [3, 76], [79, 79], [76, 76], [40, 0], [0, 40], [79, 40], [40, 79]]) {
      expect(px(out, x, y)[0], `${x},${y}`).toBe(slate(img, x, y));
    }
  });

  it('the kept strength never increases from the centre to a corner', () => {
    let last = 2;
    for (let d = 0; d <= 1.5; d += 0.01) {
      const m = focusMask(d, 100);
      expect(m).toBeLessThanOrEqual(last);
      last = m;
    }
    for (const f of [1, 25, 50, 75, 100]) {
      let prev = 1;
      for (let d = 0; d <= 1.5; d += 0.01) { const m = focusMask(d, f); expect(m).toBeLessThanOrEqual(prev + 1e-12); prev = m; }
      expect(focusMask(0, f)).toBe(1);
    }
    expect(focusMask(1, 100)).toBe(0);
    expect(focusMask(Math.SQRT2, 100)).toBe(0);
    expect(focusMask(0.4, 50)).toBeGreaterThanOrEqual(focusMask(0.4, 75));
  });

  it('the oval follows the picture aspect, and the result is deterministic', () => {
    const wide = make(120, 40, (x, y) => ((x >= 56 && x < 64 && y >= 16 && y < 24) || (x >= 96 && x < 104 && y >= 16 && y < 24) ? [255, 255, 255] : [0, 0, 0]));
    const a = chalkify(wide, { ...noGrain, focus: 100 });
    const b = chalkify(wide, { ...noGrain, focus: 100 });
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
    const plain = chalkify(wide, { ...noGrain, focus: 0 });
    expect(px(a, 60, 20)[0]).toBe(px(plain, 60, 20)[0]);
    expect(px(a, 100, 20)[0]).toBeLessThan(px(plain, 100, 20)[0]);
  });
});

describe('fitSize', () => {
  it('scales the long side to at most 1080 and never enlarges', () => {
    expect(fitSize(4000, 3000)).toEqual({ width: 1080, height: 810 });
    expect(fitSize(3000, 4000)).toEqual({ width: 810, height: 1080 });
    expect(fitSize(500, 400)).toEqual({ width: 500, height: 400 });
  });
});

describe('prototype parity', () => {
  // Runs the prototype's own script (docs/prototypes/chalk-filter-bench.html) in a vm with a
  // stub DOM, feeds it the same pixels, captures what it paints to its "Coloured chalk"
  // canvas, and compares with chalkify.
  const html = readFileSync(resolve(process.cwd(), 'docs/prototypes/chalk-filter-bench.html'), 'utf8');
  const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'))
    .replace('drawSample();\n})();', 'globalThis.__take = take; globalThis.__render = render;\n})();');

  const runPrototype = (image, values) => {
    const painted = {};
    const elements = {};
    const el = (id) => {
      if (elements[id]) return elements[id];
      const e = {
        id, value: values[id.replace('c-', '')] ?? '0', textContent: '', width: 0, height: 0,
        classList: { toggle() {}, add() {}, remove() {} }, addEventListener() {}, click() {},
        getContext: () => ({
          drawImage() {},
          getImageData: () => ({ data: image.data }),
          createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          putImageData(img) { painted[id] = img.data; },
        }),
      };
      elements[id] = e;
      return e;
    };
    let pending = null;
    const sandbox = {
      document: { getElementById: el, addEventListener() {}, createElement: () => el('scratch') },
      requestAnimationFrame: (fn) => { pending = fn; return 1; },
      setTimeout: () => 0, clearTimeout() {}, console, Math, Float32Array, Uint8ClampedArray, Object, Number,
    };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(script, sandbox);
    sandbox.__take({}, image.width, image.height);
    pending();
    return painted['c-col'];
  };

  const photo = make(240, 180, (x, y) => {
    const base = [(x * 255) / 240, (y * 255) / 180, 128 + 80 * Math.sin(x / 9)];
    if ((x - 120) ** 2 + (y - 90) ** 2 < 2000) return [220, 40, 30];
    if (x > 30 && x < 70 && y > 30 && y < 110) return [240, 230, 80];
    return base;
  });
  const sliderValues = (s) => ({ weight: s.weight, detail: s.detail, shade: s.shading, grain: s.grain, colour: s.colour });
  const maxDiff = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };

  it('matches the prototype at the default settings (per-pixel tolerance 1)', () => {
    const proto = runPrototype(photo, sliderValues(CHALK_DEFAULTS));
    const mine = chalkify(photo, CHALK_DEFAULTS).data;
    expect(proto.length).toBe(mine.length);
    expect(maxDiff(proto, mine)).toBeLessThanOrEqual(1);
  });

  it('matches the prototype at other settings too', () => {
    const s = { weight: 3.2, detail: 6, shading: 60, colour: 80, grain: 40 };
    const proto = runPrototype(photo, sliderValues(s));
    expect(maxDiff(proto, chalkify(photo, s).data)).toBeLessThanOrEqual(1);
  });
});

describe('encodeWithBudget', () => {
  it('steps quality down, then shrinks, until the result fits (stub encoder)', async () => {
    const calls = [];
    const encodeAt = async (w, h, q) => { calls.push([w, h, q]); return { size: Math.round(w * h * q * 0.9), type: 'image/webp' }; };
    const r = await encodeWithBudget(encodeAt, 1080, 810);
    expect(r.w).toBe(600);
    expect(r.h).toBe(450);
    expect(r.blob.size).toBeLessThanOrEqual(STORE_BYTES);
    expect(calls[0][2]).toBe(0.82);
    expect(calls.length).toBeGreaterThan(1);
    const big = async (w, h, q) => ({ size: Math.round(w * h * q * 3), type: 'image/webp' });
    const r2 = await encodeWithBudget(big, 1080, 810);
    expect(r2.blob.size).toBeLessThanOrEqual(STORE_BYTES);
    expect(r2.w).toBeLessThan(600);
  });
});

describe('inspectMetadata', () => {
  const u8 = (...parts) => Uint8Array.from(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)));
  const jpegSeg = (marker, body) => [0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 255, ...body];
  it('finds EXIF in a JPEG and reports none in a clean one', () => {
    const exif = u8([0xff, 0xd8], jpegSeg(0xe1, [...'Exif\0\0GPSDATA'].map((c) => c.charCodeAt(0))), [0xff, 0xda, 0, 2], [0xff, 0xd9]);
    const clean = u8([0xff, 0xd8], jpegSeg(0xe0, [...'JFIF\0'].map((c) => c.charCodeAt(0))), [0xff, 0xdb, 0, 2], [0xff, 0xda, 0, 2], [0xff, 0xd9]);
    expect(inspectMetadata(exif)).toContain('exif');
    expect(inspectMetadata(clean)).toEqual([]);
  });
  it('finds EXIF in a WebP and reports none in a clean one', () => {
    const chunk = (tag, n) => [...[...tag].map((c) => c.charCodeAt(0)), n & 255, 0, 0, 0, ...new Array(n + (n & 1)).fill(0)];
    const webp = (...chunks) => u8('RIFF', [0, 0, 0, 0], 'WEBP', ...chunks);
    expect(inspectMetadata(webp(chunk('VP8 ', 10), chunk('EXIF', 8)))).toContain('exif');
    expect(inspectMetadata(webp(chunk('VP8 ', 10)))).toEqual([]);
  });
});

describe('no network, no storage', () => {
  it.each(['chalkFilter.js', 'chalkFilterBrowser.js', 'chalkWorker.js'])('%s makes no network or storage call', (file) => {
    const src = readFileSync(resolve(process.cwd(), 'src/data', file), 'utf8');
    expect(src).not.toMatch(/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|importScripts|localStorage|sessionStorage|indexedDB|console\.\w+)\b/);
    expect(src).not.toMatch(/https?:\/\//);
  });
});
