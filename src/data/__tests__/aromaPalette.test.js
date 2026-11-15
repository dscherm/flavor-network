import { describe, it, expect } from 'vitest';
import { AROMA_COLORS, AROMA_LABELS } from '../recipeScoring.js';
import { AROMA_AXES } from '../flavorAroma.js';
import { AXES, axisColor, axisLabel, BALANCING } from '../recipeProfileAnalysis.js';

// AROMA-3: seventeen chart colours that can be told apart and read on the chalk slate.
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function lab(h) {
  const [r, g, b] = rgb(h).map(lin);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
  const y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
  const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
// CIE76 distance in Lab: coarser than the CIEDE2000 the palette was chosen on, enough to catch a clash.
const dE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

describe('the seventeen chart colours', () => {
  const colors = Object.fromEntries(AXES.map((a) => [a, axisColor(a)]));
  it('every axis has its own colour and label', () => {
    expect(AROMA_AXES.every((a) => AROMA_COLORS[a] && AROMA_LABELS[a])).toBe(true);
    expect(AROMA_AXES.map(axisLabel)).toEqual(['fruity', 'floral', 'green', 'woody', 'spice', 'creamy', 'toasty', 'nutty', 'earthy', 'smoky', 'savory']);
    expect(new Set(Object.values(colors)).size).toBe(17);
  });
  it('Spice no longer shares the red of Heat', () => {
    expect(axisColor('heat')).toBe('#ff4444');
    expect(axisColor('odor_spicy')).not.toBe('#ff4444');
  });
  it('no two colours are close (Lab distance at least 12) and each has 3:1 contrast on the slate', () => {
    const keys = Object.keys(colors);
    const close = [];
    for (let i = 0; i < keys.length; i += 1) for (let j = i + 1; j < keys.length; j += 1) if (dE(colors[keys[i]], colors[keys[j]]) < 12) close.push(`${keys[i]}/${keys[j]}`);
    expect(close).toEqual([]);
    for (const k of keys) {
      expect(contrast(colors[k], '#1c1c1c'), k).toBeGreaterThanOrEqual(3);
      expect(contrast(colors[k], '#0a0a0a'), k).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('balancing pairs for the new aromas', () => {
  it('each of the five has a counterpart a cook would accept', () => {
    expect(BALANCING.odor_toasty).toBe('odor_green');
    expect(BALANCING.odor_nutty).toBe('odor_fruity');
    expect(BALANCING.odor_earthy).toBe('odor_fruity');
    expect(BALANCING.odor_smoky).toBe('odor_fruity');
    expect(BALANCING.odor_savory).toBe('sour');
    for (const a of AXES) expect(BALANCING[a], a).toBeTruthy();
  });
});
