/**
 * everydayPairsSelect.js — the pure selection rule behind
 * scripts/build_everyday_pairs.mjs (WEAK-A).
 *
 * The shipped pairing graph (pairings.json) drops the most common pairs in
 * cooking: chicken|garlic, garlic|onion, garlic|olive oil … are not there,
 * because 07-blend-v2.js weights NPMI heavily (hub pairs score low on it)
 * and keeps only the 40k strongest. The raw RecipeNLG counts have them.
 * This module turns those counts into a small "everyday pairs" list:
 *
 *   1. Map the co-occurrence names onto the app's vocabulary (exact, then
 *      spelling variants: hyphens, joined words, plural/singular, a leading
 *      "light"/"fresh"/"low-fat" … modifier, and a short alias table).
 *      Names that map to the same vocab name have their counts summed.
 *   2. Drop the trivial set (water, salt, pepper, sugar, flour, ice …).
 *   3. Keep pairs seen in at least `minCount` recipes with positive PMI.
 *   4. Score each pair  log10(count)^3 · min(PMI, 3)^(1/3)  — count does
 *      most of the work (everyday pairs are common ones) and lift breaks
 *      ties, so a pair has to occur MORE than chance but a hub pair with a
 *      modest lift (chicken|lemon, PMI 0.21) still beats a rare odd one.
 *   5. Keep a pair when it is in the top `topK` partners of either side.
 *   6. Strength 0..1 = the pair's score percentile, mapped onto the
 *      curated graph's strength distribution (quantile mapping) when one
 *      is given, so max(curated, everyday) compares like with like.
 *
 * Everything here is deterministic and free of I/O.
 */

export const EVERYDAY_MIN_COUNT = 30;
export const EVERYDAY_TOP_K = 32;
export const EVERYDAY_PMI_CAP = 3;

/** Lift-aware everyday score of one pair (0 when it does not qualify). */
export function everydayScore(count, pmi) {
  if (!(count > 1) || !(pmi > 0)) return 0;
  return Math.log10(count) ** 3 * Math.cbrt(Math.min(pmi, EVERYDAY_PMI_CAP));
}

/** log2 PMI from counts (the co-occurrence file's `pmi` is clipped at 0). */
export function pmiOf(count, countA, countB, total) {
  if (!(count > 0) || !(countA > 0) || !(countB > 0) || !(total > 0)) return -Infinity;
  return Math.log2((count * total) / (countA * countB));
}

// British / alternative spellings and near-synonyms the parser kept apart.
export const COOCCURRENCE_ALIASES = {
  aubergine: 'eggplant',
  courgette: 'zucchini',
  'lemon grass': 'lemongrass',
  'corn starch': 'cornstarch',
  'corn meal': 'cornmeal',
  'chilli powder': 'chili powder',
  'chile powder': 'chili powder',
  chilli: 'chili',
  'extravirgin olive oil': 'extra-virgin olive oil',
  'extra virgin olive oil': 'extra-virgin olive oil',
  'red-wine vinegar': 'red wine vinegar',
  'white-wine vinegar': 'white wine vinegar',
  'philadelphia cream cheese': 'cream cheese',
  'freshly parmesan': 'parmesan',
  'squeezed lemon juice': 'lemon juice',
  'powdered ginger': 'ginger',
  'flax seed': 'flaxseed',
  'pecan halve': 'pecan',
  'walnut halve': 'walnut',
  'crab meat': 'crab',
  'boiling water': 'water',
  'very water': 'water',
  'vegetable oil cooking spray': 'cooking spray',
  'vegetable cooking spray': 'cooking spray',
  'vegetable oil spray': 'cooking spray',
};

// A leading word that does not change what the ingredient is.
const MODIFIER = /^(light|lite|low-fat|lowfat|nonfat|non-fat|fat-free|reduced-fat|freshly|fresh|squeezed|regular|plain|peeled|chopped|minced|large|small|whole|unsalted|salted|good|quality|extra|very)\s+/;

/** Candidate spellings of a co-occurrence name, most literal first. */
export function nameVariants(name) {
  const out = [];
  const push = (s) => { const t = String(s || '').trim().replace(/\s+/g, ' '); if (t && !out.includes(t)) out.push(t); };
  const base = String(name || '').toLowerCase().trim();
  push(base);
  if (COOCCURRENCE_ALIASES[base]) push(COOCCURRENCE_ALIASES[base]);
  push(base.replace(/-/g, ' '));
  push(base.replace(/-/g, ''));
  push(base.replace(/ /g, ''));
  let stripped = base;
  while (MODIFIER.test(stripped)) stripped = stripped.replace(MODIFIER, '');
  if (stripped !== base) {
    push(stripped);
    if (COOCCURRENCE_ALIASES[stripped]) push(COOCCURRENCE_ALIASES[stripped]);
  }
  for (const s of [...out]) {
    if (s.endsWith('es')) push(s.slice(0, -2));
    if (s.endsWith('s')) push(s.slice(0, -1));
    push(`${s}s`);
  }
  return out;
}

/**
 * Map co-occurrence names to vocab names.
 * @param {Iterable<string>} coNames
 * @param {Set<string>} vocab
 * @returns {{ map: Map<string,string>, direct: number, aliased: number, unmapped: string[] }}
 */
export function mapCooccurrenceNames(coNames, vocab) {
  const map = new Map();
  let direct = 0; let aliased = 0;
  const unmapped = [];
  for (const raw of coNames) {
    if (vocab.has(raw)) { map.set(raw, raw); direct += 1; continue; }
    const hit = nameVariants(raw).find((v) => vocab.has(v));
    if (hit) { map.set(raw, hit); aliased += 1; } else unmapped.push(raw);
  }
  return { map, direct, aliased, unmapped };
}

/**
 * Select the everyday pairs.
 * @param {{ pairs: Object<string,{count:number}>, ingredients: Object<string,number>, totalRecipes: number }} co
 * @param {{ vocab: Set<string>, exclude?: Iterable<string>, minCount?: number, topK?: number }} opts
 * @returns {{ pairs: Array<{a:string,b:string,count:number,pmi:number,score:number}>, mapping: object }}
 *   pairs sorted by (a, b) with a < b.
 */
export function selectEverydayPairs(co, { vocab, exclude = [], minCount = EVERYDAY_MIN_COUNT, topK = EVERYDAY_TOP_K } = {}) {
  const ex = new Set([...exclude].map((s) => String(s).toLowerCase()));
  const mapping = mapCooccurrenceNames(Object.keys(co.ingredients || {}), vocab);
  const { map } = mapping;

  // Merge counts onto vocab names.
  const ingCount = new Map();
  for (const [raw, c] of Object.entries(co.ingredients || {})) {
    const v = map.get(raw);
    if (v) ingCount.set(v, (ingCount.get(v) || 0) + c);
  }
  const pairCount = new Map();
  for (const [key, info] of Object.entries(co.pairs || {})) {
    const sep = key.indexOf('|');
    if (sep < 0) continue;
    const a = map.get(key.slice(0, sep));
    const b = map.get(key.slice(sep + 1));
    if (!a || !b || a === b || ex.has(a) || ex.has(b)) continue;
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    pairCount.set(k, (pairCount.get(k) || 0) + (info?.count || 0));
  }

  // Score, bucket per endpoint.
  const total = co.totalRecipes;
  const scored = new Map();
  const byName = new Map();
  for (const [k, count] of pairCount) {
    if (count < minCount) continue;
    const sep = k.indexOf('|');
    const a = k.slice(0, sep); const b = k.slice(sep + 1);
    const pmi = pmiOf(count, ingCount.get(a), ingCount.get(b), total);
    const score = everydayScore(count, pmi);
    if (!(score > 0)) continue;
    const rec = { a, b, count, pmi, score };
    scored.set(k, rec);
    for (const x of [a, b]) {
      if (!byName.has(x)) byName.set(x, []);
      byName.get(x).push(rec);
    }
  }

  // Top-K per endpoint (ties broken by name for determinism); union.
  const keep = new Set();
  for (const [x, list] of byName) {
    list.sort((p, q) => q.score - p.score || (p.a === x ? p.b : p.a).localeCompare(q.a === x ? q.b : q.a));
    for (const r of list.slice(0, topK)) keep.add(`${r.a}|${r.b}`);
  }
  const pairs = [...keep].sort().map((k) => scored.get(k));
  return { pairs, mapping };
}

/**
 * Strength 0..1 for each selected pair: its score percentile, mapped onto
 * `reference` (sorted ascending curated strengths) when given.
 * @returns {number[]} parallel to `pairs`, rounded to 0.01, ≥ 0.01
 */
export function pairStrengths(pairs, reference = null) {
  const order = pairs.map((p, i) => [p.score, i]).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const out = new Array(pairs.length);
  const n = order.length;
  const ref = Array.isArray(reference) && reference.length ? reference : null;
  for (let r = 0; r < n; r++) {
    const pct = n === 1 ? 1 : r / (n - 1);
    let s = pct;
    if (ref) s = ref[Math.min(ref.length - 1, Math.round(pct * (ref.length - 1)))];
    out[order[r][1]] = Math.max(0.01, Math.round(s * 100) / 100);
  }
  return out;
}
