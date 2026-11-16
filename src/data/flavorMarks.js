/**
 * flavorMarks.js - BUILDER-5. One mark per ingredient on the fixed flavor wheel, placed from that ingredient's OWN notes
 * (nodeProbs: the curated taste labels and the hand-tuned aroma table, the same values the chart is built from).
 *
 * Placement: every note the ingredient has pulls toward that note's wedge (the wedge's middle angle on the fixed wheel).
 * The mark sits at the direction of the pull; its distance from the centre is the pull's length, scaled so the most
 * single-flavoured ingredient sits near the rim and a balanced one near the middle. Only axes of a half the chart
 * actually draws count, so a mark never points at a wedge the wheel does not show.
 *
 * Pure: no React, no I/O.
 */
import { nodeProbs, AXES, axisLabel } from './recipeProfileAnalysis.js';
import { flavorWheel } from './flavorCharts.js';
import { TASTE_AXES } from './flavorTaste.js';
import { AROMA_AXES } from './flavorAroma.js';

const MAX_REACH = 0.85; // of the rim: where the strongest pull lands

/**
 * @param {string[]} names recipe ingredient names (duplicates are collapsed)
 * @param {Map} nodes graph nodes by name (for the curated taste label)
 * @param {{ taste?: boolean, aroma?: boolean }} [halves] which halves the chart draws (default both)
 * @returns {Array<{ name, angle, t, dominant, notes: string[] }>} angle in degrees (SVG, -90 = top), t in 0..1 of the
 *   radius, dominant = the strongest axis, notes = up to three strongest note labels. Ingredients with no note are left out.
 */
export function ingredientMarks(names, nodes, halves = {}) {
  const { taste = true, aroma = true } = halves;
  const mid = new Map(flavorWheel([], 'card').wedges.map((w) => [w.axis, w.mid]));
  const use = AXES.filter((a) => (TASTE_AXES.includes(a) ? taste : AROMA_AXES.includes(a) ? aroma : false));
  const seen = new Set();
  const raw = [];
  for (const name of Array.isArray(names) ? names : []) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const p = nodeProbs(name, nodes);
    if (!p) continue;
    let vx = 0;
    let vy = 0;
    let best = null;
    const ranked = [];
    for (const a of use) {
      const v = p[a] || 0;
      if (v <= 0) continue;
      const rad = (mid.get(a) * Math.PI) / 180;
      vx += v * Math.cos(rad);
      vy += v * Math.sin(rad);
      ranked.push([a, v]);
      if (!best || v > best[1]) best = [a, v];
    }
    if (!best) continue;
    ranked.sort((x, y) => y[1] - x[1]);
    raw.push({ name, vx, vy, mag: Math.hypot(vx, vy), dominant: best[0], notes: ranked.slice(0, 3).map(([a]) => axisLabel(a)) });
  }
  const maxMag = raw.reduce((m, r) => Math.max(m, r.mag), 0) || 1;
  return raw.map((r) => ({
    name: r.name,
    angle: r.mag > 1e-6 ? (Math.atan2(r.vy, r.vx) * 180) / Math.PI : mid.get(r.dominant),
    t: (r.mag / maxMag) * MAX_REACH,
    dominant: r.dominant,
    notes: r.notes,
  }));
}

/** Text drawn beside a mark: long names are cut. */
export function markLabel(name, max = 9) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/**
 * Pick which marks get a drawn label so labels never sit on each other. Marks are tried strongest first (largest t);
 * a label is kept when its box clears every kept one. Every mark is still drawn and listed; only text is thinned.
 * @param {Array<{ x, y, name, t }>} placed marks with pixel positions in the chart's own units
 * @returns {Set<string>} names that keep a label
 */
export function thinLabels(placed, { fontSize = 10, charWidth = 5.4, gap = 2, offset = 5 } = {}) {
  const boxes = [];
  const keep = new Set();
  const order = [...placed].sort((a, b) => b.t - a.t);
  for (const m of order) {
    const w = markLabel(m.name).length * charWidth;
    const h = fontSize;
    // label sits to the right of the mark on the right half, to the left on the left half
    const right = m.x >= 0;
    const x0 = right ? m.x + offset : m.x - offset - w;
    const box = { x0, y0: m.y - h / 2, x1: x0 + w, y1: m.y + h / 2 };
    const clash = boxes.some((b) => box.x0 < b.x1 + gap && box.x1 + gap > b.x0 && box.y0 < b.y1 + gap && box.y1 + gap > b.y0);
    if (!clash) { boxes.push(box); keep.add(m.name); }
  }
  return keep;
}
