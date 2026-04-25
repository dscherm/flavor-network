/**
 * recipeSuggestionEngine.js — weighted recipe-level co-occurrence ranker
 * (Approach A). Replaces the legacy "average pairwise NPMI" ranking in
 * SuggestionDrawer.
 *
 * Score per candidate `c`:
 *   score(c) = Σ_{s ∈ bowl} log1p(count(s, c))   if globalCount(c) ≥ FLOOR
 *              dropped                            otherwise
 *
 * `count(s, c)` is the number of RecipeNLG recipes containing both `s`
 * and `c`. `globalCount(c)` is the recipe-frequency of `c` overall —
 * used purely as a HARD GATE (not a multiplier). Multiplying by
 * familiarity makes every bowl converge on the same global-popular
 * ingredients (sugar/onion/garlic/butter); using it only as a floor
 * lets the bowl-specific co-occurrence sum drive ranking while still
 * dropping obscure-but-tightly-paired noise.
 *
 * Floor = 50 recipes (matches `proDataset/config.js:MIN_INGREDIENT_RECIPES`).
 *
 * Returns `[{ name, strength }]` with strength ∈ [0, 1] (max-normalized
 * within the result set) so the UI's `matchPct` rendering keeps working.
 */

const FAMILIARITY_FLOOR = 50;

export function rankByRecipeCooccurrence(bowl, recipePairs, globalCount, K = 100) {
  if (!recipePairs || !globalCount) return [];

  if (!bowl || bowl.length === 0) {
    const entries = [];
    for (const name in globalCount) {
      const c = globalCount[name];
      if (c >= FAMILIARITY_FLOOR) entries.push([name, c]);
    }
    entries.sort((a, b) => b[1] - a[1]);
    entries.length = Math.min(entries.length, K);
    const max = entries[0]?.[1] || 1;
    return entries.map(([name, count]) => ({ name, strength: count / max }));
  }

  const bowlSet = new Set(bowl);
  const scoreSum = new Map();

  for (const s of bowl) {
    const partners = recipePairs[s];
    if (!partners) continue;
    for (const partner in partners) {
      if (bowlSet.has(partner)) continue;
      const count = partners[partner];
      scoreSum.set(partner, (scoreSum.get(partner) || 0) + Math.log1p(count));
    }
  }

  const ranked = [];
  for (const [name, sum] of scoreSum) {
    if ((globalCount[name] || 0) < FAMILIARITY_FLOOR) continue;
    ranked.push({ name, raw: sum });
  }

  ranked.sort((a, b) => b.raw - a.raw);
  ranked.length = Math.min(ranked.length, K);

  const max = ranked[0]?.raw || 1;
  return ranked.map(({ name, raw }) => ({ name, strength: raw / max }));
}
