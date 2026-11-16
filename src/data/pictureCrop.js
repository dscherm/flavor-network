// Centre crop of decoded RGBA pixels for the picture chooser: a square, or a 4:3 landscape.
// Pure; the original image is never modified.

export const CROP_SHAPES = ['square', 'landscape'];

/** Size of the centre crop of a width x height picture for a shape. */
export function cropSize(width, height, shape = 'square') {
  if (shape === 'landscape') {
    const ratio = 4 / 3;
    if (width / height > ratio) return { width: Math.max(1, Math.round(height * ratio)), height };
    return { width, height: Math.max(1, Math.round(width / ratio)) };
  }
  const side = Math.min(width, height);
  return { width: side, height: side };
}

/** Centre-crop { data, width, height } to a shape. Returns the input itself when nothing is cut. */
export function cropCentre(image, shape = 'square') {
  const { width: sw, height: sh, data } = image;
  const { width: cw, height: ch } = cropSize(sw, sh, shape);
  if (cw === sw && ch === sh) return image;
  const x0 = Math.floor((sw - cw) / 2);
  const y0 = Math.floor((sh - ch) / 2);
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y += 1) {
    const from = ((y + y0) * sw + x0) * 4;
    out.set(data.subarray(from, from + cw * 4), y * cw * 4);
  }
  return { data: out, width: cw, height: ch };
}
