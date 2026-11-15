/**
 * flavorScore.js — scores a drawn flavor chart against the answer key in data/flavor-truth.json.
 * Pure: no file or network access; the profile function stays outside (scripts/measureFlavorProfile.mjs).
 *
 * A "taste" bar is one of sweet, sour, bitter, salty, umami, heat. (Until FLAVOR-3 the chart had no heat
 * axis, so an item that expected heat first could never score top-1; that is what the baseline showed.)
 * Aroma bars have axes odor_fruity ... odor_fatty; the key writes them without the prefix ("green").
 */
export const TASTES = ['sweet', 'sour', 'bitter', 'salty', 'umami', 'heat'];
const AROMA_PREFIX = 'odor_';

const byScore = (bars) => [...(Array.isArray(bars) ? bars : [])].sort((a, b) => b.score - a.score);

/**
 * scoreItem(bars, truth, { counted, total }) →
 *   { tops, noChart, top1, top2, forbiddenLead, aromaOk, coverage }
 * bars: [{ axis, score }] as drawn (any order). truth: { expect, not?, aroma? }.
 * top2 is null when the item expects only one taste; aromaOk is null when no aroma is given.
 */
export function scoreItem(bars, truth, { counted = 0, total = 0 } = {}) {
  const sorted = byScore(bars);
  const tastes = sorted.filter((b) => TASTES.includes(b.axis));
  const aromas = sorted.filter((b) => b.axis && b.axis.startsWith(AROMA_PREFIX));
  const expect = truth.expect || [];
  const not = truth.not || [];
  const tops = tastes.slice(0, 2).map((b) => b.axis);
  const noChart = tastes.length === 0;
  const top1 = !noChart && expect.includes(tops[0]);
  const top2 = expect.length < 2 ? null : tops.length === 2 && tops.every((t) => expect.includes(t));
  const forbiddenLead = !noChart && not.includes(tops[0]);
  let aromaOk = null;
  if (truth.aroma?.length) {
    const topAroma = aromas.slice(0, 2).map((b) => b.axis.slice(AROMA_PREFIX.length));
    aromaOk = truth.aroma.every((a) => topAroma.includes(a));
  }
  return { tops, noChart, top1, top2, forbiddenLead, aromaOk, coverage: total ? counted / total : 0 };
}

const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : null);

/** summarize(rows) where each row is a scoreItem result → overall counts and percentages. */
export function summarize(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const two = list.filter((r) => r.top2 !== null);
  const aro = list.filter((r) => r.aromaOk !== null);
  const top1 = list.filter((r) => r.top1).length;
  const top2 = two.filter((r) => r.top2).length;
  const aromaOk = aro.filter((r) => r.aromaOk).length;
  return {
    items: list.length,
    top1, top1Pct: pct(top1, list.length),
    top2, top2Of: two.length, top2Pct: pct(top2, two.length),
    forbiddenLeads: list.filter((r) => r.forbiddenLead).length,
    noChart: list.filter((r) => r.noChart).length,
    aromaOk, aromaOf: aro.length, aromaPct: pct(aromaOk, aro.length),
    countedPct: list.length ? Math.round((1000 * list.reduce((s, r) => s + r.coverage, 0)) / list.length) / 10 : null,
  };
}

/**
 * FLAVOR-5. scoreAroma(bars, item) scores one aroma-key item against the drawn aroma bars.
 * bars: [{ axis, score }] (axes odor_fruity ... odor_fatty; others ignored). item: { expect, not? } with aroma
 * names without the prefix. ok = every expected aroma is among the top TWO aroma bars; forbiddenLead = the top
 * bar is one the item must not lead with; noChart = no aroma bar at all.
 */
export function scoreAroma(bars, item) {
  const aromas = byScore(bars).filter((b) => b.axis && b.axis.startsWith(AROMA_PREFIX) && b.score > 0);
  const tops = aromas.slice(0, 2).map((b) => b.axis.slice(AROMA_PREFIX.length));
  const expect = item.expect || [];
  const not = item.not || [];
  const noChart = aromas.length === 0;
  return {
    tops, noChart,
    ok: !noChart && expect.every((a) => tops.includes(a)),
    forbiddenLead: !noChart && not.includes(tops[0]),
  };
}

/** summarizeAroma(rows) where each row is { ok, forbiddenLead, noChart } → counts and percentages. */
export function summarizeAroma(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const ok = list.filter((r) => r.ok).length;
  return {
    items: list.length, ok, okPct: pct(ok, list.length),
    forbiddenLeads: list.filter((r) => r.forbiddenLead).length,
    noChart: list.filter((r) => r.noChart).length,
  };
}

/**
 * AROMA-1. The blind aroma key and the outside (chef) key are scored by scoreAromaKey. The axis set is a parameter
 * so AROMA-3 can move the charts from six aromas to eleven without touching the scorer: a set says which aroma
 * names exist, which bar id carries each one, and which field of a key item holds the expectation for it.
 */
export const AROMA_SET_SIX = {
  name: 'six',
  names: ['fruity', 'floral', 'green', 'woody', 'spice', 'fatty'],
  id: (n) => (n === 'spice' ? 'odor_spicy' : `odor_${n}`),
  expectField: 'expect6',
};
export const AROMA_SET_ELEVEN = {
  name: 'eleven',
  names: ['fruity', 'floral', 'green', 'woody', 'spice', 'fatty', 'toasty', 'nutty', 'earthy', 'smoky', 'savory'],
  id: (n) => (n === 'spice' ? 'odor_spicy' : `odor_${n}`),
  expectField: 'expect',
};

/**
 * scoreAromaKey(bars, item, set) → { tops, expected, inexpressible, noChart, top1, top2, forbiddenLead }
 * bars [{ axis, score }]; item { expect, expect6?, not? } (aroma names; the chef key is an unordered set, so only
 * top1 membership and top2 overlap are used, never order). expected is the item's list for the set; when it is
 * empty the item cannot be expressed on this set (inexpressible) and is not scored.
 * top1: the strongest aroma is an expected one. top2: at least one of the two strongest is expected.
 * forbiddenLead: the strongest aroma is one the item must not lead with. noChart: no aroma bar above zero.
 */
export function scoreAromaKey(bars, item, set = AROMA_SET_SIX) {
  const idToName = new Map(set.names.map((n) => [set.id(n), n]));
  const ranked = byScore(bars).filter((b) => idToName.has(b.axis) && b.score > 0);
  const tops = ranked.slice(0, 2).map((b) => idToName.get(b.axis));
  const expected = (item[set.expectField] ?? item.expect ?? []).filter((n) => set.names.includes(n));
  const not = (item.not || []).filter((n) => set.names.includes(n));
  const noChart = ranked.length === 0;
  const inexpressible = expected.length === 0;
  return {
    tops, expected, inexpressible, noChart,
    top1: !inexpressible && !noChart && expected.includes(tops[0]),
    top2: !inexpressible && !noChart && tops.some((t) => expected.includes(t)),
    forbiddenLead: !noChart && not.includes(tops[0]),
  };
}

/** summarizeAromaKey(rows of scoreAromaKey) → counts. Scored items exclude the inexpressible ones. */
export function summarizeAromaKey(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const inexpressible = list.filter((r) => r.inexpressible).length;
  const scored = list.filter((r) => !r.inexpressible);
  const top1 = scored.filter((r) => r.top1).length;
  const top2 = scored.filter((r) => r.top2).length;
  return {
    items: list.length, inexpressible, scored: scored.length,
    top1, top1Pct: pct(top1, scored.length),
    top2, top2Pct: pct(top2, scored.length),
    forbiddenLeads: list.filter((r) => r.forbiddenLead).length,
    noChart: scored.filter((r) => r.noChart).length,
  };
}
