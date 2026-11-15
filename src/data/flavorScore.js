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
