/**
 * countryFlags.js — tiny flag drawings for the Wine Lab (DESIGN-1).
 *
 * Flag emoji render as two letters ("FR") on Windows, so each country gets a
 * simplified drawing instead: stripes plus a few shapes on a 30×20 board.
 * Simplified on purpose — at 18 px wide a coat of arms is noise.
 *
 * Spec: { dir: 'h' | 'v', colors: [...], weights?: [...], shapes?: [...] }
 *   shapes: { t: 'rect', x, y, w, h, fill }
 *         | { t: 'circle', cx, cy, r, fill }
 *         | { t: 'path', d, stroke, sw, fill? }
 */
const W = 30;
const H = 20;

export const FLAG_SPECS = {
  France: { dir: 'v', colors: ['#0055A4', '#ffffff', '#EF4135'] },
  Italy: { dir: 'v', colors: ['#009246', '#ffffff', '#CE2B37'] },
  Germany: { dir: 'h', colors: ['#000000', '#DD0000', '#FFCE00'] },
  Austria: { dir: 'h', colors: ['#ED2939', '#ffffff', '#ED2939'] },
  Hungary: { dir: 'h', colors: ['#CE2939', '#ffffff', '#477050'] },
  Spain: { dir: 'h', colors: ['#AA151B', '#F1BF00', '#AA151B'], weights: [1, 2, 1] },
  Portugal: {
    dir: 'v', colors: ['#006600', '#FF0000'], weights: [2, 3],
    shapes: [{ t: 'circle', cx: 12, cy: 10, r: 3.6, fill: '#FFCC00' }],
  },
  Greece: {
    dir: 'h',
    colors: ['#0D5EAF', '#ffffff', '#0D5EAF', '#ffffff', '#0D5EAF', '#ffffff', '#0D5EAF', '#ffffff', '#0D5EAF'],
    shapes: [
      { t: 'rect', x: 0, y: 0, w: 11.1, h: 11.1, fill: '#0D5EAF' },
      { t: 'rect', x: 4.45, y: 0, w: 2.2, h: 11.1, fill: '#ffffff' },
      { t: 'rect', x: 0, y: 4.45, w: 11.1, h: 2.2, fill: '#ffffff' },
    ],
  },
  USA: {
    dir: 'h',
    colors: ['#B22234', '#ffffff', '#B22234', '#ffffff', '#B22234', '#ffffff', '#B22234'],
    shapes: [{ t: 'rect', x: 0, y: 0, w: 13, h: 11.4, fill: '#3C3B6E' }],
  },
  'New Zealand': {
    dir: 'h', colors: ['#012169'],
    shapes: [
      { t: 'rect', x: 0, y: 0, w: 15, h: 10, fill: '#012169' },
      { t: 'path', d: 'M0 0 L15 10 M15 0 L0 10', stroke: '#ffffff', sw: 2 },
      { t: 'path', d: 'M7.5 0 V10 M0 5 H15', stroke: '#ffffff', sw: 3 },
      { t: 'path', d: 'M7.5 0 V10 M0 5 H15', stroke: '#C8102E', sw: 1.6 },
      { t: 'circle', cx: 22, cy: 5, r: 1.2, fill: '#C8102E' },
      { t: 'circle', cx: 25, cy: 9, r: 1.2, fill: '#C8102E' },
      { t: 'circle', cx: 20, cy: 11, r: 1.2, fill: '#C8102E' },
      { t: 'circle', cx: 22, cy: 16, r: 1.3, fill: '#C8102E' },
    ],
  },
  Australia: {
    dir: 'h', colors: ['#012169'],
    shapes: [
      { t: 'path', d: 'M0 0 L15 10 M15 0 L0 10', stroke: '#ffffff', sw: 2 },
      { t: 'path', d: 'M7.5 0 V10 M0 5 H15', stroke: '#ffffff', sw: 3 },
      { t: 'path', d: 'M7.5 0 V10 M0 5 H15', stroke: '#C8102E', sw: 1.6 },
      { t: 'circle', cx: 7.5, cy: 15, r: 2, fill: '#ffffff' },
      { t: 'circle', cx: 23, cy: 4, r: 1.1, fill: '#ffffff' },
      { t: 'circle', cx: 19, cy: 9, r: 1.1, fill: '#ffffff' },
      { t: 'circle', cx: 26, cy: 9, r: 1.1, fill: '#ffffff' },
      { t: 'circle', cx: 23, cy: 16, r: 1.2, fill: '#ffffff' },
    ],
  },
  Argentina: {
    dir: 'h', colors: ['#74ACDF', '#ffffff', '#74ACDF'],
    shapes: [{ t: 'circle', cx: 15, cy: 10, r: 2.2, fill: '#F6B40E' }],
  },
  Chile: {
    dir: 'h', colors: ['#ffffff', '#D52B1E'],
    shapes: [
      { t: 'rect', x: 0, y: 0, w: 10, h: 10, fill: '#0039A6' },
      { t: 'circle', cx: 5, cy: 5, r: 1.8, fill: '#ffffff' },
    ],
  },
  'South Africa': {
    dir: 'h', colors: ['#E03C31', '#001489'],
    shapes: [
      { t: 'path', d: 'M0 0 L12 10 L30 10 M0 20 L12 10', stroke: '#ffffff', sw: 6.5 },
      { t: 'path', d: 'M0 0 L12 10 L30 10 M0 20 L12 10', stroke: '#007749', sw: 4 },
      { t: 'path', d: 'M0 3.5 L7.8 10 L0 16.5 Z', stroke: '#FFB81C', sw: 1.4, fill: '#000000' },
    ],
  },
};

/** The flag spec for a country, or null when we have no drawing for it. */
export function flagSpec(country) {
  return FLAG_SPECS[country] || null;
}

/**
 * Turn a spec into plain shape records (stripes first, then extras) so the
 * component only has to map them to SVG elements.
 */
export function flagShapes(spec) {
  if (!spec) return [];
  const n = spec.colors.length;
  const weights = spec.weights && spec.weights.length === n ? spec.weights : spec.colors.map(() => 1);
  const total = weights.reduce((a, b) => a + b, 0);
  const span = spec.dir === 'v' ? W : H;
  const out = [];
  let at = 0;
  spec.colors.forEach((fill, i) => {
    const size = (weights[i] / total) * span;
    out.push(spec.dir === 'v'
      ? { t: 'rect', x: at, y: 0, w: size, h: H, fill }
      : { t: 'rect', x: 0, y: at, w: W, h: size, fill });
    at += size;
  });
  return out.concat(spec.shapes || []);
}

export const FLAG_W = W;
export const FLAG_H = H;
