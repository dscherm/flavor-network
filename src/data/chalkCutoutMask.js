// The pure arithmetic around the cut-out model (PICTURE-8): shrinking a photo to the model's input,
// normalising it, turning the model's answer into a per-pixel subject map at the photo's size, and
// judging whether the map found anything. No DOM, no network, no model: testable with plain arrays.
// Ported from docs/prototypes/chalk-cutout-bench.html so the numbers match the trial the owner ran.

export const CUTOUT_NET = 320;                 // the model's square input side
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

/** A subject covering less than this share of the picture, or more than 1 minus it, is "not found". */
export const MIN_SUBJECT_SHARE = 0.03;

/** Shrink RGBA pixels to net x net by averaging the source pixels under each target pixel. */
export function resizeRGBA(data, w, h, net = CUTOUT_NET) {
  const out = new Uint8ClampedArray(net * net * 4);
  for (let y = 0; y < net; y++) {
    const y0 = Math.floor((y * h) / net);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / net));
    for (let x = 0; x < net; x++) {
      const x0 = Math.floor((x * w) / net);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / net));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < h; yy++) {
        for (let xx = x0; xx < x1 && xx < w; xx++) {
          const o = (yy * w + xx) * 4;
          r += data[o]; g += data[o + 1]; b += data[o + 2]; n++;
        }
      }
      const o = (y * net + x) * 4;
      if (n) { out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; }
      out[o + 3] = 255;
    }
  }
  return out;
}

/** Channel-first float input for the model: scaled by the brightest value, then mean and spread. */
export function modelInput(rgba, net = CUTOUT_NET) {
  const n = net * net;
  let peak = 1;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (rgba[o] > peak) peak = rgba[o];
    if (rgba[o + 1] > peak) peak = rgba[o + 1];
    if (rgba[o + 2] > peak) peak = rgba[o + 2];
  }
  const input = new Float32Array(3 * n);
  for (let ch = 0; ch < 3; ch++) {
    for (let i = 0; i < n; i++) input[ch * n + i] = (rgba[i * 4 + ch] / peak - MEAN[ch]) / STD[ch];
  }
  return input;
}

/**
 * The model's net x net answer, as one 0..1 value per pixel of a w x h photo: stretched to use the
 * whole 0..1 range, then enlarged bilinearly. Returns a new Float32Array.
 */
export function maskFromOutput(out, w, h, net = CUTOUT_NET) {
  const n = net * net;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) { if (out[i] < lo) lo = out[i]; if (out[i] > hi) hi = out[i]; }
  const span = hi - lo || 1;
  const small = new Float32Array(n);
  for (let i = 0; i < n; i++) small[i] = (out[i] - lo) / span;
  const mask = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(net - 1, Math.max(0, ((y + 0.5) * net) / h - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(net - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(net - 1, Math.max(0, ((x + 0.5) * net) / w - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(net - 1, x0 + 1), tx = fx - x0;
      const top = small[y0 * net + x0] * (1 - tx) + small[y0 * net + x1] * tx;
      const bot = small[y1 * net + x0] * (1 - tx) + small[y1 * net + x1] * tx;
      mask[y * w + x] = top * (1 - ty) + bot * ty;
    }
  }
  return mask;
}

/** Share of the picture the subject map keeps (values above one half), 0..1. */
export function keptShare(mask) {
  let kept = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] > 0.5) kept++;
  return mask.length ? kept / mask.length : 0;
}

/** 'ok', or 'nothing' when the map keeps almost nothing or almost everything (no clear subject). */
export function judgeMask(mask) {
  const share = keptShare(mask);
  return share < MIN_SUBJECT_SHARE || share > 1 - MIN_SUBJECT_SHARE ? 'nothing' : 'ok';
}
