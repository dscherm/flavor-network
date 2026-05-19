/**
 * curatedPairings.js — extracted from CuratedWheel.jsx so consumers
 * other than the wheel itself (notably GuidedDiscoveryResults' chemistry
 * banner per OQ4 closure in ralplan track-3-guided-overhaul) can import
 * the selector without pulling in the wheel component or matching the
 * literal 'CuratedWheel' grep gate (§2.4 P6).
 *
 * CuratedWheel.jsx now re-exports `selectCuratedPairings` from this
 * module so its own callers keep working unchanged.
 */
import { surprisingAffinities, topAffinities } from './affinityTiers.js';
import { groundTruthHas } from './whyThisWorks.js';
import { passesDietaryFilters } from './dietaryFilters.js';

function uniqueByName(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item || !item.name || seen.has(item.name)) continue;
    seen.add(item.name);
    out.push(item);
  }
  return out;
}

export function selectCuratedPairings({ focal, ctx, dietary = [] }) {
  if (!focal || !ctx) return [];
  // Over-pull when dietary restrictions are active so post-filter we
  // still land 5-10 heroes. Vegan / vegetarian can prune up to ~30%
  // of a meat-heavy wheel.
  const dietaryActive = Array.isArray(dietary) && dietary.length > 0;
  const mult = dietaryActive ? 2 : 1;
  const surprising = surprisingAffinities(focal.name || focal, ctx, { N: 3 * mult }) || [];
  const top = topAffinities(focal.name || focal, ctx, { N3: 4 * mult, N2: 0, N1: 0 }) || [];
  const cited = (topAffinities(focal.name || focal, ctx, { N3: 10 * mult, N2: 0, N1: 0 }) || [])
    .filter((n) => groundTruthHas(focal.name || focal, n.name))
    .slice(0, 3 * mult);
  // Tag origin so the renderer can swap stroke + chip per source.
  let tagged = [
    ...surprising.map((n) => ({ ...n, _source: 'surprising' })),
    ...top.map((n) => ({ ...n, _source: 'top' })),
    ...cited.map((n) => ({ ...n, _source: 'cited' })),
  ];
  // Dietary filter — applied before dedup + slice so a vegan filter
  // on a chicken focal pulls in 5+ plant-based heroes rather than 1.
  if (dietaryActive) {
    tagged = tagged.filter((n) => {
      const node = ctx?.graph?.nodes?.get?.(n.name) || { name: n.name };
      return passesDietaryFilters(n.name, node, dietary);
    });
  }
  return uniqueByName(tagged).slice(0, 10);
}
