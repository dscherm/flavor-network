/**
 * flavorCharts.js — CHART-2. The pure pieces behind four ways of drawing a recipe's flavor profile: the tasting-note
 * sentence, the two strips, the fixed wheel and the fixed grid. No drawing here, only what to draw.
 *
 * Self-contained like flavorDisplay.js (the share card layout is copied into the Cloud Functions package and
 * scripts/buildShareIndex.mjs inlines display code there): the ONLY import is flavorDisplay.js, on one line so the
 * inliner can drop it. Ordering, the 0.05 floor, the axis lists and group membership all come from flavorDisplay.js.
 *
 * Input everywhere is a list of bars { axis?, label?, color?, score } as profileForRecipe returns them, or as a share
 * card stores them (label + color + score only). A bar whose axis cannot be read is ignored, so nothing outside the
 * seventeen axes can ever be placed.
 *
 * Labels and colours: a bar carries its own colour. Labels come from AXIS_LABEL below (the chart words of
 * recipeScoring.AROMA_LABELS and the taste names, capitalised; a test pins it to those), so an axis the recipe does
 * not have still has a label. Its colour is null unless the caller passes `colors` ({ axis: '#hex' }, e.g. from
 * axisColor). An absent axis is drawn as an empty track or ring, which needs no colour.
 */
import { AXES, TASTE_AXES, AROMA_AXES, FLOOR, axisOfBar, barGroup, compareBars } from './flavorDisplay.js';

export const AXIS_LABEL = {
  sweet: 'Sweet', sour: 'Sour', bitter: 'Bitter', salty: 'Salty', umami: 'Umami', heat: 'Heat',
  odor_fruity: 'Fruity', odor_floral: 'Floral', odor_green: 'Green', odor_woody: 'Woody', odor_spicy: 'Spice',
  odor_fatty: 'Creamy', odor_toasty: 'Toasty', odor_nutty: 'Nutty', odor_earthy: 'Earthy', odor_smoky: 'Smoky', odor_savory: 'Savory',
};

/** A strip segment is labelled when its length (share of the shared scale) is at least this. */
export const STRIP_LABEL_MIN = 0.17;
/** A wedge that is on is drawn at least this long (fraction of full radius), so a faint note stays visible. */
export const WEDGE_MIN_LENGTH = 0.08;
/** Wedge geometry in degrees (SVG angles: -90 is twelve o'clock, increasing clockwise): the gap at the top and between aromas and tastes, and the gap between wedges. */
export const WHEEL_GAP = 16;
export const WHEEL_WEDGE_GAP = 1.2;
/** How many of the strongest wedges are labelled, by size. Any other size labels every wedge that is on. */
export const WHEEL_LABELS = { mini: 3, card: 4 };
/** Fixed grid shape: tastes in one row of six, aromas in rows of six and five. */
export const GRID_ROWS = [6, 6, 5];

/**
 * The bars that count: readable axis, score at or above the floor, one per axis (the larger wins), strongest first.
 * With an `axisSet` (WHEEL-2: a wheel for axes that are not the seventeen, e.g. a wine's structure) a bar counts when its
 * `axis` is in axisSet.order; labels come from axisSet.labels and ties go by that order.
 */
function liveBars(bars, axisSet = null) {
  const byAxis = new Map();
  for (const b of Array.isArray(bars) ? bars : []) {
    const axis = axisSet ? (axisSet.order.includes(b?.axis) ? b.axis : null) : axisOfBar(b);
    const score = Number(b?.score);
    if (!axis || !Number.isFinite(score) || score < FLOOR || score <= 0) continue;
    const prev = byAxis.get(axis);
    if (!prev || score > prev.score) byAxis.set(axis, { axis, label: axisSet ? axisSet.labels[axis] : AXIS_LABEL[axis], color: b.color || null, score, group: axisSet ? 'axis' : barGroup({ axis }) });
  }
  const list = [...byAxis.values()];
  if (!axisSet) return list.sort(compareBars);
  const r3 = (v) => Math.round(v * 1000);
  return list.sort((a, b) => (r3(b.score) - r3(a.score)) || (axisSet.order.indexOf(a.axis) - axisSet.order.indexOf(b.axis)));
}

const join = (words) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words[0]);

/**
 * The tasting note. Lead: the two strongest notes, or the single strongest "above all" when it is at least twice the
 * second (or the only one). Behind: up to three more. Names notes only. No notes: empty text and arrays.
 *   { lead: [axis], behind: [axis], text, words: [{ axis, label, color, role: 'lead'|'behind' }] }
 */
export function flavorNote(bars) {
  const all = liveBars(bars);
  if (!all.length) return { lead: [], behind: [], text: '', words: [] };
  const solo = all.length < 2 || all[0].score >= 2 * all[1].score;
  const lead = all.slice(0, solo ? 1 : 2);
  const behind = all.slice(solo ? 1 : 2, solo ? 4 : 5);
  const w = (b) => b.label.toLowerCase();
  const head = solo ? `${w(lead[0])} above all` : `${w(lead[0])} and ${w(lead[1])}`;
  const tail = behind.length ? `, with ${join(behind.map(w))} behind` : '';
  const sentence = `${head}${tail}.`;
  return {
    lead: lead.map((b) => b.axis),
    behind: behind.map((b) => b.axis),
    text: sentence[0].toUpperCase() + sentence.slice(1),
    words: [
      ...lead.map((b) => ({ axis: b.axis, label: b.label, color: b.color, role: 'lead' })),
      ...behind.map((b) => ({ axis: b.axis, label: b.label, color: b.color, role: 'behind' })),
    ],
  };
}

/**
 * Two strips on ONE scale: a segment's length is its score over the larger of the two group totals, so a recipe with
 * faint tastes gets a short Taste strip. A segment is `labelled` when length >= STRIP_LABEL_MIN.
 *   { scale, labelMin, taste: { total, length, segments }, aroma: { ... } }
 *   segment { axis, label, color, score, length, labelled }; a row's `length` is the sum of its segment lengths.
 */
export function flavorStrips(bars) {
  const all = liveBars(bars);
  const total = (g) => all.filter((b) => b.group === g).reduce((t, b) => t + b.score, 0);
  const scale = Math.max(total('taste'), total('aroma')) || 1;
  const row = (g) => {
    const segments = all.filter((b) => b.group === g).map((b) => {
      const length = b.score / scale;
      return { axis: b.axis, label: b.label, color: b.color, score: b.score, length, labelled: length >= STRIP_LABEL_MIN };
    });
    return { total: total(g), length: segments.reduce((t, s) => t + s.length, 0), segments };
  };
  return { scale, labelMin: STRIP_LABEL_MIN, taste: row('taste'), aroma: row('aroma') };
}

const colorOf = (axis, live, colors) => live.get(axis)?.color || colors?.[axis] || null;

/**
 * The fixed wheel: seventeen wedges, the eleven aromas clockwise from the top, a gap, the six tastes (they land on the
 * upper left), and a gap at the top. Positions never depend on the recipe. Length is score over the recipe's strongest
 * note (0..1); `drawn` is that length raised to WEDGE_MIN_LENGTH for a wedge that is on. Only wedges that are on and
 * among the strongest WHEEL_LABELS[size] are labelled (every wedge that is on for a size not in WHEEL_LABELS).
 *   { size, peak, gap, wedgeGap, minLength, wedges: [{ index, axis, label, group, color, score, on, length, drawn,
 *     start, end, mid, labelled }] }
 *
 * `axisSet` (WHEEL-2) draws the same wheel for another set of axes, with the same gaps, wedge gap, minimum length,
 * label rule and wedge shape: { order: [axis], labels: { axis: 'Label' }, breakAt?: index where a second gap goes
 * (none by default: one gap at the top), absolute?: true when scores are already 0..1 on fixed scales, so a length is the
 * score itself rather than the share of the strongest note }. Its bars carry `axis` and `color`.
 */
export function flavorWheel(bars, size = 'full', { colors, axisSet = null } = {}) {
  const liveList = liveBars(bars, axisSet);
  const live = new Map(liveList.map((b) => [b.axis, b]));
  const peak = axisSet?.absolute ? 1 : (liveList.length ? liveList[0].score : 0);
  const order = axisSet ? axisSet.order : [...AROMA_AXES, ...TASTE_AXES];
  const breakAt = axisSet ? (Number.isInteger(axisSet.breakAt) ? axisSet.breakAt : null) : AROMA_AXES.length;
  const width = (360 - (breakAt === null ? 1 : 2) * WHEEL_GAP) / order.length;
  const cap = WHEEL_LABELS[size] ?? Infinity;
  const labelled = new Set(liveList.slice(0, cap).map((b) => b.axis));
  const wedges = order.map((axis, index) => {
    const start = -90 + WHEEL_GAP / 2 + index * width + (breakAt !== null && index >= breakAt ? WHEEL_GAP : 0);
    const end = start + width - WHEEL_WEDGE_GAP;
    const b = live.get(axis);
    const on = !!b;
    const length = on && peak > 0 ? Math.min(1, b.score / peak) : 0;
    return {
      index, axis, label: axisSet ? axisSet.labels[axis] : AXIS_LABEL[axis],
      group: axisSet ? 'axis' : (AROMA_AXES.includes(axis) ? 'aroma' : 'taste'), color: colorOf(axis, live, colors),
      score: on ? b.score : 0, on, length, drawn: on ? Math.max(length, WEDGE_MIN_LENGTH) : 0,
      start, end, mid: (start + end) / 2, labelled: on && labelled.has(axis),
    };
  });
  return { size, peak, gap: WHEEL_GAP, wedgeGap: WHEEL_WEDGE_GAP, minLength: WEDGE_MIN_LENGTH, wedges };
}

/**
 * The fixed grid: seventeen cells, a row of six tastes, then the aromas as a row of six and a row of five. A dot's
 * AREA follows the score: radius factor = sqrt(score / scale), at most 1; absent cells have radius 0 and on false.
 * `scale` defaults to the profile's strongest note; pass one value to two grids (before / after) to share a scale.
 *   { scale, rows: GRID_ROWS, cells: [{ index, axis, label, group, color, row, col, score, on, radius }] }
 */
export function flavorGrid(bars, { scale, colors } = {}) {
  const liveList = liveBars(bars);
  const live = new Map(liveList.map((b) => [b.axis, b]));
  const s = Number.isFinite(Number(scale)) && Number(scale) > 0 ? Number(scale) : (liveList.length ? liveList[0].score : 0);
  const order = [...TASTE_AXES, ...AROMA_AXES];
  let row = 0;
  let col = 0;
  const cells = order.map((axis, index) => {
    if (col >= GRID_ROWS[row]) { row += 1; col = 0; }
    const b = live.get(axis);
    const on = !!b && s > 0;
    const cell = {
      index, axis, label: AXIS_LABEL[axis], group: TASTE_AXES.includes(axis) ? 'taste' : 'aroma', color: colorOf(axis, live, colors),
      row, col, score: b ? b.score : 0, on, radius: on ? Math.min(1, Math.sqrt(b.score / s)) : 0,
    };
    col += 1;
    return cell;
  });
  return { scale: s, rows: GRID_ROWS, cells };
}
