/**
 * sauceSimilarity.js — ingredient-set similarity between sauces.
 *
 * The Jaccard measure the Sauce Lab's "similar sauces" edges use
 * (sauceCodex.js), exported on its own so the pantry and Invent panels can
 * find the closest existing sauce to an invented one without loading the
 * codex module.
 */

// Words that contribute zero signal for ingredient-set similarity. Salt,
// water and oil are intentionally NOT here: they matter in saucework.
const STOP_KW = new Set([
  'fresh', 'dried', 'ground', 'whole', 'small', 'large', 'medium', 'to', 'taste',
  'a', 'an', 'and', 'or', 'of', 'the', 'for', 'with',
]);

export function tokensOf(name) {
  if (!name) return [];
  return String(name)
    .toLowerCase()
    .split(/[\s/,()-]+/)
    .filter((t) => t.length > 2 && !STOP_KW.has(t));
}

/** Keyword set of an ingredient list (strings or {name}). */
export function sauceKeywordSet(ingredients) {
  const set = new Set();
  for (const ing of ingredients || []) {
    const name = typeof ing === 'string' ? ing : (ing?.name || '');
    for (const t of tokensOf(name)) set.add(t);
  }
  return set;
}

export function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * The k sauces whose ingredient keywords overlap most with `ingredients`.
 * @returns {{ sauce: object, similarity: number }[]}  similarity > 0 only
 */
export function nearestSauces(ingredients, sauces, k = 3) {
  const mine = sauceKeywordSet(ingredients);
  const out = [];
  for (const s of sauces || []) {
    const sim = jaccard(mine, sauceKeywordSet(s.ingredients));
    if (sim > 0) out.push({ sauce: s, similarity: sim });
  }
  out.sort((a, b) => b.similarity - a.similarity || String(a.sauce.name).localeCompare(String(b.sauce.name)));
  return out.slice(0, k);
}
