/**
 * Before / after pair for a suggestion card: the recipe's profile now, and with the candidate added or swapped in,
 * both drawn as fixed grids (flavorCharts.flavorGrid) on ONE shared scale. No new calculation: `after` is exactly
 * what the old radar drew, clamp01(before + delta), with the delta the deck already computed.
 */
import { AXES } from './flavorDisplay.js';
import { flavorGrid } from './flavorCharts.js';
import { axisLabel, axisColor } from './recipeProfileAnalysis.js';

/** A note is marked when its score changes by more than this (scores run 0..1; the profile floor is 0.05). */
export const MARK_THRESHOLD = 0.02;
/** At most this many marked notes carry a text label under their dot (the ones the text line names). */
export const LABELLED_MOVERS = 2;

/**
 * Label rule for the "With ..." grid: every note that is on gets its label when the label fits inside its own
 * cell, so it cannot touch a neighbour's label. A label is about LABEL_CHAR_PX per character at the grid's 11 px
 * hand font; a cell is at least MIN_CELL_PX wide down to a 320 px phone (6 columns, two grids side by side).
 * Labels of absent notes stay hidden. The movers are always labelled.
 */
export const LABEL_CHAR_PX = 5.4;
export const MIN_CELL_PX = 38;
export const labelFits = (label) => String(label || '').length * LABEL_CHAR_PX <= MIN_CELL_PX;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

const barsOf = (profile) => AXES.map((axis) => ({ axis, score: profile[axis] || 0 }));
const colorsOf = () => Object.fromEntries(AXES.map((a) => [a, axisColor(a)]));

/** "More creamy, less sour" / "More creamy and sweet" / "Less sour and salty" / "Hardly changes the flavor". */
export function changeText(movers) {
  const ups = movers.filter((m) => m.diff > 0).map((m) => axisLabel(m.axis).toLowerCase());
  const downs = movers.filter((m) => m.diff < 0).map((m) => axisLabel(m.axis).toLowerCase());
  if (!ups.length && !downs.length) return 'Hardly changes the flavor';
  const part = (word, list) => `${word} ${list.join(' and ')}`;
  if (ups.length && downs.length) return `${part('More', ups)}, ${part('less', downs)}`;
  return ups.length ? part('More', ups) : part('Less', downs);
}

/**
 * @param before  {axis: score} the recipe's profile now
 * @param delta   {axis: change} per-axis shift the candidate causes
 * @returns {{ scale, before, after, marks, movers, labelled: Set (the two biggest movers; the Now grid), labelledAfter: Set (movers plus every note that is on and fits; the With grid), text }}
 */
export function profilePair(before = {}, delta = {}) {
  const b = {};
  const a = {};
  for (const axis of AXES) {
    b[axis] = clamp01(before[axis] || 0);
    a[axis] = clamp01((before[axis] || 0) + (delta?.[axis] || 0));
  }
  const colors = colorsOf();
  const bars = { before: barsOf(b), after: barsOf(a) };
  const strongest = (list) => list.reduce((m, x) => Math.max(m, x.score), 0);
  const scale = Math.max(strongest(bars.before), strongest(bars.after)) || 1;

  const diffs = AXES.map((axis) => ({ axis, diff: a[axis] - b[axis] }))
    .filter((d) => Math.abs(d.diff) > MARK_THRESHOLD)
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
  const marks = {};
  for (const d of diffs) marks[d.axis] = d.diff > 0 ? 'up' : 'down';
  const top = diffs.slice(0, LABELLED_MOVERS);
  const after = flavorGrid(bars.after, { scale, colors });
  const labelledAfter = new Set(top.map((d) => d.axis));
  for (const c of after.cells) if (c.on && labelFits(c.label)) labelledAfter.add(c.axis);

  return {
    scale,
    before: flavorGrid(bars.before, { scale, colors }),
    after,
    marks,
    movers: diffs,
    labelled: new Set(top.map((d) => d.axis)),
    labelledAfter,
    text: changeText(top),
  };
}
