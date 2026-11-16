/**
 * flavorDisplay.js — AROMA-4. THE display rule for flavor charts, written once. Pure, no imports (the share card
 * layout module is copied into the Cloud Functions package, and scripts/buildShareIndex.mjs inlines this file
 * into that copy, so keep it self-contained).
 *
 * With six tastes and eleven aromas a full chart has seventeen bars, so the ranked bars show only the strongest.
 * The owner has chosen this as the design for the Recipe Notebook overview (CHART-5); the wheel is the other chart.
 *
 * The rule, in plain words
 *   1. Tastes and aromas are two groups ("Taste", "Aroma"), each ordered strongest first.
 *   2. A bar is shown only when its score is at least FLOOR (0.05, the floor the invent panels, the shared page
 *      and the cards already used).
 *   3. Each group has a maximum that depends on the surface's room (SURFACES below). When bars are hidden a short
 *      line says so ("+3 fainter notes"); surfaces with room (compact, full) also offer "show all".
 *   4. Ties are broken one way everywhere: scores are compared at 3 decimal places, and a tie goes to the axis
 *      that comes first in AXES (the canonical order: sweet, sour, bitter, salty, umami, heat, then fruity,
 *      floral, green, woody, spice, creamy, toasty, nutty, earthy, smoky, savory).
 *   5. A radar plots only the axes the rule selects for it (so a recipe's radar has 3 to 8 spokes, never 17).
 */

export const TASTE_AXES = ['sweet', 'sour', 'bitter', 'salty', 'umami', 'heat'];
export const AROMA_AXES = ['odor_fruity', 'odor_floral', 'odor_green', 'odor_woody', 'odor_spicy', 'odor_fatty', 'odor_toasty', 'odor_nutty', 'odor_earthy', 'odor_smoky', 'odor_savory'];
export const AXES = [...TASTE_AXES, ...AROMA_AXES];

/** Chart labels as drawn (recipeScoring.AROMA_LABELS): used to read a group off a bar that carries only a label. */
const LABEL_TO_AXIS = {
  sweet: 'sweet', sour: 'sour', bitter: 'bitter', salty: 'salty', umami: 'umami', heat: 'heat',
  fruity: 'odor_fruity', floral: 'odor_floral', green: 'odor_green', woody: 'odor_woody', spice: 'odor_spicy',
  creamy: 'odor_fatty', toasty: 'odor_toasty', nutty: 'odor_nutty', earthy: 'odor_earthy', smoky: 'odor_smoky', savory: 'odor_savory',
};

/** Below this a bar is not drawn. */
export const FLOOR = 0.05;

/**
 * How many bars of each group a surface shows.
 *   card     the share cards (preview, portrait, tall): 3 + 3 (the headings and the caption take room)
 *   cover    the first card of a set of three: 4 + 4
 *   compact  invent panels, shared page: 4 + 4, with "show all"
 *   full     the Recipe Notebook overview: 6 + 6, with "show all"
 *   radar    a radar plots at most 4 + 4 spokes (never fewer than MIN_SPOKES)
 *   mini     the 132 px radar on a suggestion card: 3 + 3
 */
export const SURFACES = {
  card: { taste: 3, aroma: 3, showAll: false },
  cover: { taste: 4, aroma: 4, showAll: false },
  compact: { taste: 4, aroma: 4, showAll: true },
  full: { taste: 6, aroma: 6, showAll: true },
  radar: { taste: 4, aroma: 4, showAll: false },
  mini: { taste: 3, aroma: 3, showAll: false },
};
export const MIN_SPOKES = 3;
export const GROUP_TITLE = { taste: 'Taste', aroma: 'Aroma' };

export const hiddenLine = (n) => `+${n} fainter note${n === 1 ? '' : 's'}`;

export const axisGroup = (axis) => (TASTE_AXES.includes(axis) ? 'taste' : 'aroma');

/** The canonical axis for a bar { axis?, label? }; null when neither is known. */
export function axisOfBar(bar) {
  if (bar && typeof bar.axis === 'string' && AXES.includes(bar.axis)) return bar.axis;
  const l = String(bar?.label || '').trim().toLowerCase();
  return LABEL_TO_AXIS[l] || null;
}

/** 'taste' or 'aroma' for a bar; a bar of unknown axis counts as aroma. */
export const barGroup = (bar) => {
  if (bar && (bar.group === 'taste' || bar.group === 'aroma')) return bar.group;
  const a = axisOfBar(bar);
  return a ? axisGroup(a) : 'aroma';
};

const round3 = (v) => Math.round((Number(v) || 0) * 1000);
const orderOf = (bar) => {
  const a = axisOfBar(bar);
  return a ? AXES.indexOf(a) : AXES.length;
};

/** The one ordering: strongest first (3 decimals), ties by canonical axis order. */
export function compareBars(a, b) {
  const d = round3(b.score) - round3(a.score);
  return d !== 0 ? d : orderOf(a) - orderOf(b);
}

/** Axes at or above `floor`, strongest first by the one ordering. `scores` is { axis: number }. */
export function rankAxes(scores, { floor = FLOOR, axes = AXES } = {}) {
  return axes
    .filter((a) => (Number(scores?.[a]) || 0) >= floor && (Number(scores?.[a]) || 0) > 0)
    .map((a) => ({ axis: a, score: scores[a] }))
    .sort(compareBars)
    .map((b) => b.axis);
}

/**
 * The bars a surface shows. `bars` is any list of { axis?, label?, score, ... } (a profile's bars, or the stored
 * bars of a share card, which carry a label only). Returns
 *   { groups: [{ id: 'taste'|'aroma', title, bars }]  (only non-empty groups, taste first),
 *     bars:   the same bars flat, taste first then aroma,
 *     hidden: how many bars above the floor are not shown,
 *     canShowAll: the surface offers "show all" and something is hidden }
 * `all` shows every bar above the floor (only honoured on surfaces with showAll).
 */
export function groupBars(bars, surface = 'compact', { all = false, floor = FLOOR } = {}) {
  const cfg = SURFACES[surface] || SURFACES.compact;
  const live = (Array.isArray(bars) ? bars : [])
    .filter((b) => b && Number.isFinite(Number(b.score)) && Number(b.score) >= floor && Number(b.score) > 0)
    .map((b) => ({ ...b, group: barGroup(b) }))
    .sort(compareBars);
  const showEvery = all && cfg.showAll;
  const out = [];
  let hidden = 0;
  for (const id of ['taste', 'aroma']) {
    const mine = live.filter((b) => b.group === id);
    const shown = showEvery ? mine : mine.slice(0, cfg[id]);
    hidden += mine.length - shown.length;
    if (shown.length) out.push({ id, title: GROUP_TITLE[id], bars: shown });
  }
  return { groups: out, bars: out.flatMap((g) => g.bars), hidden, canShowAll: cfg.showAll && hidden > 0 };
}

/**
 * The axes a surface shows, from { axis: score }: { taste: [axis], aroma: [axis], axes: [axis] strongest first
 * across both groups, hidden }.
 */
export function selectAxes(scores, surface = 'full', { all = false, floor = FLOOR } = {}) {
  const bars = AXES.map((a) => ({ axis: a, score: Number(scores?.[a]) || 0 }));
  const g = groupBars(bars, surface, { all, floor });
  const pick = (id) => (g.groups.find((x) => x.id === id)?.bars || []).map((b) => b.axis);
  const axes = [...g.bars].sort(compareBars).map((b) => b.axis);
  return { taste: pick('taste'), aroma: pick('aroma'), axes, hidden: g.hidden };
}

/**
 * The axes a radar plots, in canonical order (so the shape does not jump around): the selected axes for the
 * surface (restricted to `pool` when given, e.g. only the aromas), padded with the next-strongest (then canonical-first) axes up to MIN_SPOKES so a polygon can be drawn.
 */
export function radarAxes(scores, surface = 'radar', { extra = [], floor = FLOOR, pool = AXES } = {}) {
  const inPool = (a) => pool.includes(a);
  const picked = new Set([...selectAxes(scores, surface, { floor }).axes.filter(inPool), ...extra.filter((a) => AXES.includes(a) && inPool(a))]);
  if (picked.size < MIN_SPOKES) {
    const rest = pool.map((a) => ({ axis: a, score: Number(scores?.[a]) || 0 })).sort(compareBars);
    for (const r of rest) { if (picked.size >= MIN_SPOKES) break; picked.add(r.axis); }
  }
  return pool.filter((a) => picked.has(a));
}

/**
 * Generic version for a radar whose keys are not the seventeen axes (the Cookbook card radar's chef vocabulary):
 * `signal` is Map or object key -> 0..1; returns up to `max` keys with a signal, in `canonical` order, padded to
 * MIN_SPOKES from the start of `canonical`.
 */
export function radarKeys(signal, canonical, max = 8) {
  const get = (k) => (signal instanceof Map ? signal.get(k) : signal?.[k]) || 0;
  const ranked = canonical
    .map((k, i) => ({ k, v: get(k), i }))
    .filter((r) => r.v > 0)
    .sort((a, b) => (round3(b.v) - round3(a.v)) || (a.i - b.i))
    .slice(0, max)
    .map((r) => r.k);
  const picked = new Set(ranked);
  for (const k of canonical) { if (picked.size >= Math.min(MIN_SPOKES, canonical.length)) break; picked.add(k); }
  return canonical.filter((k) => picked.has(k));
}
