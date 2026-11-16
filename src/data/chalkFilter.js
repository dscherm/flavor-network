// The chalk filter: turns a photo's pixels into a coloured chalk drawing on slate.
// Pure functions over pixel arrays — no DOM, no canvas, no network. Ported from
// docs/prototypes/chalk-filter-bench.html (the "Coloured chalk" look); the arithmetic is
// kept identical so output matches the prototype the owner approved.

export const CHALK_DEFAULTS = Object.freeze({ weight: 5, detail: 13, shading: 110, colour: 200, grain: 5, focus: 0 });

export const CHALK_RANGES = Object.freeze({
  weight: Object.freeze({ min: 0.6, max: 10, step: 0.1 }),
  detail: Object.freeze({ min: 0, max: 16, step: 1 }),
  shading: Object.freeze({ min: 0, max: 200, step: 1 }),
  colour: Object.freeze({ min: 0, max: 300, step: 1 }),
  grain: Object.freeze({ min: 0, max: 100, step: 1 }),
  focus: Object.freeze({ min: 0, max: 100, step: 1 }),
});

export const MAX_WORK = 1080; // working size, long side
export const STORE_SIDE = 600; // stored size, long side
export const STORE_BYTES = 150 * 1024;

export class ChalkCancelled extends Error {
  constructor() { super('chalk conversion cancelled'); this.name = 'ChalkCancelled'; }
}

/** Clamp every setting to its range; missing or non-numeric values take the default. */
export function clampSettings(settings = {}) {
  const out = {};
  for (const key of Object.keys(CHALK_DEFAULTS)) {
    const { min, max } = CHALK_RANGES[key];
    const raw = Number(settings?.[key]);
    const v = Number.isFinite(raw) ? raw : CHALK_DEFAULTS[key];
    out[key] = Math.min(max, Math.max(min, v));
  }
  return out;
}

/** Size after scaling so the long side is at most `max` (never enlarges; at least 8 px). */
export function fitSize(sw, sh, max = MAX_WORK) {
  const k = Math.min(1, max / Math.max(sw, sh));
  return { width: Math.max(8, Math.round(sw * k)), height: Math.max(8, Math.round(sh * k)) };
}

export function luminance(data, width, height) {
  const lum = new Float32Array(width * height);
  for (let i = 0; i < lum.length; i++) {
    lum[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
  }
  return lum;
}

/** Stretch the 2%–98% range to 0..1 so dim photos still give lines. Returns a new array. */
export function stretchContrast(lum) {
  const sorted = Float32Array.from(lum).sort();
  const lo = sorted[Math.floor(sorted.length * 0.02)];
  const hi = sorted[Math.floor(sorted.length * 0.98)];
  const span = Math.max(0.08, hi - lo);
  const out = new Float32Array(lum.length);
  for (let i = 0; i < out.length; i++) out[i] = Math.min(1, Math.max(0, (lum[i] - lo) / span));
  return out;
}

function boxBlur(a, w, h, r) {
  if (r < 1) return a;
  const out = new Float32Array(a.length);
  const tmp = new Float32Array(a.length);
  const pass = (from, to, len, stride, lines, lineStride) => {
    for (let l = 0; l < lines; l++) {
      const base = l * lineStride;
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += from[base + Math.min(len - 1, Math.max(0, i)) * stride];
      for (let i = 0; i < len; i++) {
        to[base + i * stride] = sum / (2 * r + 1);
        const add = Math.min(len - 1, i + r + 1);
        const sub = Math.max(0, i - r);
        sum += from[base + add * stride] - from[base + sub * stride];
      }
    }
  };
  pass(a, tmp, w, 1, h, w);
  pass(tmp, out, h, w, w, 1);
  return out;
}
const blur = (a, w, h, r) => (r < 1 ? a : boxBlur(boxBlur(a, w, h, r), w, h, r));

function sobel(g, w, h) {
  const m = new Float32Array(g.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = g[i - w - 1], t = g[i - w], tr = g[i - w + 1];
      const l = g[i - 1], r = g[i + 1];
      const bl = g[i + w - 1], b = g[i + w], br = g[i + w + 1];
      const gx = tr + 2 * r + br - tl - 2 * l - bl;
      const gy = bl + 2 * b + br - tl - 2 * t - tr;
      m[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return m;
}

/**
 * Focus fade: how much chalk survives at normalised elliptical distance d from the centre
 * (d = 0 at the centre, 1 at the middle of each edge, sqrt(2) at the corners; the ellipse
 * follows the picture's aspect). With t = focus / 100:
 *   inner = 1.5 - 1.15 t   (everything inside is kept at full strength)
 *   outer = inner + 0.6    (everything outside is bare slate)
 *   mask  = 1 - smoothstep(inner, outer, d)
 * Fully-kept oval as a fraction of the picture's width and height: 1.21 at focus 25, 0.93 at 50,
 * 0.64 at 75, 0.35 at 100; the fade ends at 1.81, 1.53, 1.24, 0.95. focus 0 is no mask.
 */
export function focusMask(d, focus) {
  if (!(focus > 0)) return 1;
  const t = Math.min(100, focus) / 100;
  const inner = 1.5 - 1.15 * t;
  const u = (d - inner) / 0.6;
  if (u <= 0) return 1;
  if (u >= 1) return 0;
  return 1 - u * u * (3 - 2 * u);
}

/** Fixed-seed grain, so the same size always gives the same noise. */
export function makeNoise(w, h) {
  const n = w * h;
  const fine = new Float32Array(n);
  const raw = new Float32Array(n);
  let s = 1234567;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < n; i++) { fine[i] = rnd(); raw[i] = rnd(); }
  const coarse = blur(raw, w, h, 6);
  let lo = 1, hi = 0;
  for (let i = 0; i < n; i++) { if (coarse[i] < lo) lo = coarse[i]; if (coarse[i] > hi) hi = coarse[i]; }
  for (let i = 0; i < n; i++) coarse[i] = (coarse[i] - lo) / (hi - lo || 1);
  return { w, h, fine, coarse };
}

/**
 * Coloured chalk drawing of an RGBA image.
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image  RGBA, already
 *   scaled to the working size (see fitSize). Not modified.
 * @param {object} settings  weight, detail, shading, colour, grain, focus (clamped to CHALK_RANGES).
 * @param {{onProgress?: (fraction: number) => void, isCancelled?: () => boolean}} [opts]
 * @returns {{data: Uint8ClampedArray, width: number, height: number}}
 */
export function chalkify(image, settings, opts = {}) {
  const { width: w, height: h, data: rgba } = image;
  const { onProgress, isCancelled } = opts;
  const step = (f) => {
    if (isCancelled && isCancelled()) throw new ChalkCancelled();
    if (onProgress) onProgress(f);
  };
  const s = clampSettings(settings);
  const weight = s.weight;
  const detail = s.detail;
  const shade = s.shading / 100;
  const grain = s.grain / 100;
  const colour = s.colour / 100;
  const focus = s.focus;

  step(0);
  const lum = stretchContrast(luminance(rgba, w, h));
  const noise = makeNoise(w, h);
  step(0.1);

  const scale = Math.max(w, h) / 720;
  const pre = Math.round(Math.max(0, 10 - detail) * 0.5 * scale);
  let g = blur(lum, w, h, pre);
  if (detail > 10) {
    const soften = blur(lum, w, h, Math.max(1, Math.round(2 * scale)));
    const k = (detail - 10) * 0.6;
    g = new Float32Array(lum.length);
    for (let i = 0; i < g.length; i++) { const v = lum[i] + (lum[i] - soften[i]) * k; g[i] = v < 0 ? 0 : v > 1 ? 1 : v; }
  }
  const haloR = Math.max(2, Math.round((detail > 10 ? 4 : 7) * scale));
  step(0.3);

  const mag = sobel(g, w, h);
  const line = new Float32Array(w * h);
  for (let i = 0; i < line.length; i++) {
    const v = mag[i] * weight * 1.1 - 0.12;
    line[i] = v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v);
  }
  step(0.4);

  const inv = new Float32Array(w * h);
  for (let i = 0; i < inv.length; i++) inv[i] = 1 - g[i];
  const halo = blur(inv, w, h, haloR);
  step(0.6);

  const fill = new Float32Array(w * h);
  if (colour > 1) {
    const amt = (colour - 1) * 0.55;
    for (let i = 0; i < fill.length; i++) {
      const o = i * 4;
      const mx = Math.max(rgba[o], rgba[o + 1], rgba[o + 2]);
      const mn = Math.min(rgba[o], rgba[o + 1], rgba[o + 2]);
      fill[i] = mx ? ((mx - mn) / mx) * (0.35 + 0.65 * mx / 255) * amt : 0;
    }
  }
  const intensity = new Float32Array(w * h);
  for (let i = 0; i < intensity.length; i++) {
    const dodge = Math.min(1, g[i] / Math.max(0.04, 1 - halo[i]));
    const edge = Math.pow(1 - dodge, 0.8) * weight * 0.9;
    const tone = g[i] * g[i] * shade * 0.75;
    const soft = Math.min(1, Math.max(edge, line[i] * 0.85) + tone);
    intensity[i] = Math.min(1, soft + fill[i]);
  }
  step(0.7);

  const tint = Math.min(1, colour);
  const sat = 1.7 + Math.max(0, colour - 1) * 1.4;
  const wash = colour > 1 ? Math.max(20, 70 - (colour - 1) * 35) : 70;
  const keep = 1 - wash / 255;
  const out = new Uint8ClampedArray(w * h * 4);
  const cx = w / 2, cy = h / 2, far = Math.sqrt(cx * cx + cy * cy);
  for (let y = 0; y < h; y++) {
    if ((y & 31) === 0) step(0.7 + 0.3 * (y / h));
    for (let x = 0; x < w; x++) {
      const i = y * w + x, o = i * 4;
      const dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / far;
      const board = 26 - 15 * dist + (noise.coarse[i] - 0.5) * 7;
      let a = intensity[i];
      if (focus > 0) {
        const fx = (x + 0.5 - cx) / cx, fy = (y + 0.5 - cy) / cy;
        a *= focusMask(Math.sqrt(fx * fx + fy * fy), focus);
      }
      const dust = 1 - grain * 0.55 * noise.fine[i];
      const gap = noise.fine[i] < grain * 0.22 ? 0.35 : 1;
      a *= dust * gap * (1 - grain * 0.3 * (1 - noise.coarse[i]));
      let r = 245, gg = 239, b = 222;
      if (tint) {
        const pr = rgba[o], pg = rgba[o + 1], pb = rgba[o + 2];
        const grey = (pr + pg + pb) / 3;
        const cr = Math.min(255, Math.max(0, grey + (pr - grey) * sat)) * keep + wash;
        const cg = Math.min(255, Math.max(0, grey + (pg - grey) * sat)) * keep + wash;
        const cb = Math.min(255, Math.max(0, grey + (pb - grey) * sat)) * keep + wash;
        r += (Math.min(255, cr) - r) * tint;
        gg += (Math.min(255, cg) - gg) * tint;
        b += (Math.min(255, cb) - b) * tint;
      }
      out[o] = board + (r - board) * a;
      out[o + 1] = board + (gg - board) * a;
      out[o + 2] = (board - 1) + (b - board + 1) * a;
      out[o + 3] = 255;
    }
  }
  step(1);
  return { data: out, width: w, height: h };
}

/**
 * Pick the encoding that fits the byte budget. `encodeAt(w, h, quality)` returns
 * Promise<{ size, type, ... }> (a Blob, or a stub in tests). Steps quality down at the
 * stored size, then shrinks the picture, until the result is within `maxBytes`.
 */
export async function encodeWithBudget(encodeAt, srcW, srcH, opts = {}) {
  const { maxBytes = STORE_BYTES, side = STORE_SIDE } = opts;
  const qualities = [0.82, 0.72, 0.62, 0.52, 0.42, 0.32];
  let k = Math.min(1, side / Math.max(srcW, srcH));
  let last = null;
  for (let shrink = 0; shrink < 8; shrink++) {
    const w = Math.max(8, Math.round(srcW * k)), h = Math.max(8, Math.round(srcH * k));
    for (const q of qualities) {
      const blob = await encodeAt(w, h, q);
      last = { blob, w, h, quality: q };
      if (blob && blob.size <= maxBytes) return last;
    }
    k *= 0.85;
  }
  return last;
}

/**
 * Look for metadata (EXIF, XMP, ICC, comments, GPS) inside encoded JPEG / WebP / PNG
 * bytes. Returns a list of what was found; an empty list means none.
 */
export function inspectMetadata(bytes) {
  const found = [];
  const ascii = (a, b) => String.fromCharCode(...bytes.subarray(a, b));
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let p = 2;
    while (p + 4 <= bytes.length && bytes[p] === 0xff) {
      const marker = bytes[p + 1];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker >= 0xd0 && marker <= 0xd7) { p += 2; continue; }
      const len = (bytes[p + 2] << 8) | bytes[p + 3];
      if (marker === 0xe1) found.push(ascii(p + 4, p + 10).startsWith('Exif') ? 'exif' : 'xmp');
      else if (marker === 0xe2) found.push('icc');
      else if (marker === 0xfe) found.push('comment');
      else if (marker >= 0xe3 && marker <= 0xef) found.push(`app${marker - 0xe0}`);
      p += 2 + len;
    }
  } else if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    let p = 12;
    while (p + 8 <= bytes.length) {
      const tag = ascii(p, p + 4);
      const len = bytes[p + 4] | (bytes[p + 5] << 8) | (bytes[p + 6] << 16) | (bytes[p + 7] << 24);
      if (tag === 'EXIF') found.push('exif');
      else if (tag === 'XMP ') found.push('xmp');
      else if (tag === 'ICCP') found.push('icc');
      p += 8 + len + (len & 1);
    }
  } else if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') {
    let p = 8;
    while (p + 8 <= bytes.length) {
      const len = ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0;
      const tag = ascii(p + 4, p + 8);
      if (tag === 'eXIf') found.push('exif');
      else if (tag === 'iTXt' || tag === 'tEXt' || tag === 'zTXt') found.push('text');
      else if (tag === 'iCCP') found.push('icc');
      p += 12 + len;
    }
  }
  return found;
}
