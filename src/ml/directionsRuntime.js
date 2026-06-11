/**
 * directionsRuntime — browser-side retrieval of real RecipeNLG directions.
 *
 * Given a recipe bowl (set of ingredient names), retrieves the most
 * set-similar real recipes from the pre-built directions_index.json and
 * returns their verbatim cooking directions, with optional light name
 * adaptation metadata so the UI can show provenance.
 *
 * All heavy logic (retrieveDirections, adaptSteps) is pure and unit-testable
 * — no fetch calls inside them.
 */

// ── Singleton loader ──────────────────────────────────────────────────────────

let _indexPromise = null;

/**
 * Lazily load the directions index. Returns null on any failure so callers
 * can degrade gracefully.
 * @param {string} basePath  URL prefix (default ''); useful in tests/SSR.
 * @returns {Promise<object|null>}
 */
export async function loadDirectionsIndex(basePath = '') {
  if (_indexPromise) return _indexPromise;
  _indexPromise = (async () => {
    try {
      const res = await fetch(`${basePath}/models/directions_index.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn('[directionsRuntime] failed to load index:', e);
      _indexPromise = null; // allow retry
      return null;
    }
  })();
  return _indexPromise;
}

// ── Vocab helpers ─────────────────────────────────────────────────────────────

/**
 * Build name→id and id→name maps from recipe_vocab.json `vocab` array.
 * @param {string[]} vocab
 * @returns {{ nameToId: Map<string,number>, idToName: Map<number,string> }}
 */
export function buildVocabMaps(vocab) {
  const nameToId = new Map();
  const idToName = new Map();
  if (!Array.isArray(vocab)) return { nameToId, idToName };
  for (let i = 0; i < vocab.length; i++) {
    const name = String(vocab[i]).toLowerCase();
    nameToId.set(name, i);
    idToName.set(i, name);
  }
  return { nameToId, idToName };
}

/**
 * Resolve an array of ingredient name strings to vocab ids.
 * Unknown names are silently dropped.
 * @param {string[]} names
 * @param {Map<string,number>} nameToId
 * @returns {number[]}
 */
export function resolveNamesToIds(names, nameToId) {
  if (!Array.isArray(names) || !nameToId) return [];
  const ids = [];
  const seen = new Set();
  for (const n of names) {
    const id = nameToId.get(String(n).toLowerCase());
    if (id != null && !seen.has(id)) { seen.add(id); ids.push(id); }
  }
  return ids;
}

// ── Retrieval ─────────────────────────────────────────────────────────────────

/**
 * Retrieve the top-k recipes most similar (by Jaccard) to the bowl.
 *
 * Candidate gathering uses the inverted index — only recipes that share at
 * least `minOverlap` ids with the bowl are scored, so large indexes stay fast.
 *
 * @param {string[]} bowlNames   Ingredient names in the user's bowl.
 * @param {object}   index       directions_index.json contents.
 * @param {string[]} vocab       recipe_vocab.json `vocab` array.
 * @param {{ k?: number, minOverlap?: number }} opts
 * @returns {Array<{ title:string, steps:string[], overlap:number, jaccard:number, matchedNames:string[], bowlIds:number[] }>}
 */
export function retrieveDirections(bowlNames, index, vocab, opts = {}) {
  const k          = opts.k          ?? 3;
  const minOverlap = opts.minOverlap ?? 2;

  if (!index || !index.recipes || !index.inv || !Array.isArray(vocab)) return [];
  if (!Array.isArray(bowlNames) || bowlNames.length === 0) return [];

  const { nameToId, idToName } = buildVocabMaps(vocab);
  const bowlIds  = resolveNamesToIds(bowlNames, nameToId);
  if (bowlIds.length === 0) return [];

  const bowlSet  = new Set(bowlIds);

  // Gather candidates via inverted index: count hit frequency per recipe index.
  const hitCount = new Map(); // recipeArrayIndex → overlap count
  for (const id of bowlIds) {
    const postings = index.inv[String(id)];
    if (!postings) continue;
    for (const ri of postings) {
      hitCount.set(ri, (hitCount.get(ri) ?? 0) + 1);
    }
  }

  // Filter to minOverlap and compute Jaccard.
  const scored = [];
  for (const [ri, overlap] of hitCount) {
    if (overlap < minOverlap) continue;
    const rec     = index.recipes[ri];
    if (!rec) continue;
    const recSet  = new Set(rec.v);
    const union   = bowlSet.size + recSet.size - overlap;
    const jaccard = union > 0 ? overlap / union : 0;
    scored.push({ ri, overlap, jaccard });
  }

  // Sort descending by jaccard, then overlap as tiebreak.
  scored.sort((a, b) => b.jaccard - a.jaccard || b.overlap - a.overlap);

  // Build result array.
  return scored.slice(0, k).map(({ ri, overlap, jaccard }) => {
    const rec         = index.recipes[ri];
    const recIdSet    = new Set(rec.v);
    const matchedIds  = bowlIds.filter(id => recIdSet.has(id));
    const matchedNames = matchedIds.map(id => idToName.get(id) ?? String(id));
    return {
      title:        rec.t,
      steps:        rec.d,
      overlap,
      jaccard,
      matchedNames,
      bowlIds,
    };
  });
}

// ── Cooking-method extraction ─────────────────────────────────────────────────

/**
 * Canonical cooking methods + detection regexes, ordered MOST-SPECIFIC FIRST
 * (stir-fry / deep-fry before plain fry) so the fry family doesn't double-count.
 */
export const COOKING_METHODS = [
  ['stir-fry',   /\bstir[-\s]?fr(?:y|ies|ied|ying)\b/i],
  ['deep-fry',   /\bdeep[-\s]?fr(?:y|ies|ied|ying)\b/i],
  ['sauté',      /\bsaut[eé]/i],
  ['sear',       /\bsear(?:ed|ing|s)?\b/i],
  ['roast',      /\broast(?:ed|ing|s)?\b/i],
  ['bake',       /\bbak(?:e|ed|ing)\b/i],
  ['grill',      /\bgrill(?:ed|ing|s)?\b/i],
  ['broil',      /\bbroil(?:ed|ing|s)?\b/i],
  ['braise',     /\bbrais(?:e|ed|ing)\b/i],
  ['simmer',     /\bsimmer(?:ed|ing|s)?\b/i],
  ['boil',       /\bboil(?:ed|ing|s)?\b/i],
  ['steam',      /\bsteam(?:ed|ing|s)?\b/i],
  ['poach',      /\bpoach(?:ed|ing|es)?\b/i],
  ['blanch',     /\bblanch(?:ed|ing|es)?\b/i],
  ['fry',        /\bfr(?:y|ies|ied|ying)\b/i],
  ['caramelize', /\bcarameli[sz](?:e|ed|ing)\b/i],
  ['toast',      /\btoast(?:ed|ing|s)?\b/i],
  ['marinate',   /\bmarinat(?:e|ed|ing)\b|\bmarinade\b/i],
  ['whisk',      /\bwhisk(?:ed|ing|s)?\b/i],
  ['blend',      /\bblend(?:ed|ing|s)?\b|\bpur[eé]e/i],
  ['chill',      /\bchill(?:ed|ing|s)?\b|\brefrigerat|\bfreez/i],
];

const FRY_FAMILY = new Set(['stir-fry', 'deep-fry', 'fry']);

/**
 * Detect the set of cooking methods present in a single recipe's steps.
 * The fry family is collapsed: if a specific fry (stir-fry/deep-fry) matched,
 * the generic "fry" is not also counted.
 * @param {string[]} steps
 * @returns {Set<string>}
 */
export function methodsInSteps(steps) {
  const present = new Set();
  if (!Array.isArray(steps)) return present;
  const text = steps.join(' \n ');
  for (const [name, re] of COOKING_METHODS) {
    if (re.test(text)) present.add(name);
  }
  if (present.has('stir-fry') || present.has('deep-fry')) present.delete('fry');
  return present;
}

/**
 * Rank cooking methods across a set of retrieved recipes by how many of them
 * use each method (recipe frequency). Returns the top methods — the "likely
 * cooking methods" for a bowl, grounded in real similar recipes.
 * @param {Array<{steps:string[]}>} recipes  retrieveDirections() output
 * @param {{ topN?: number }} opts
 * @returns {{ methods: Array<{method:string, count:number, frac:number}>, scanned:number }}
 */
export function extractCookingMethods(recipes, opts = {}) {
  const topN = opts.topN ?? 3;
  const list = Array.isArray(recipes) ? recipes : [];
  const tally = new Map();
  for (const rec of list) {
    for (const m of methodsInSteps(rec?.steps)) {
      tally.set(m, (tally.get(m) ?? 0) + 1);
    }
  }
  const scanned = list.length;
  const methods = [...tally.entries()]
    .map(([method, count]) => ({ method, count, frac: scanned ? count / scanned : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
  return { methods, scanned };
}

/**
 * Convenience: retrieve similar recipes for a bowl, then extract the likely
 * cooking methods. Returns [] when no match.
 */
export function retrieveCookingMethods(bowlNames, index, vocab, opts = {}) {
  const recipes = retrieveDirections(bowlNames, index, vocab, {
    k: opts.k ?? 8,
    minOverlap: opts.minOverlap ?? 2,
  });
  if (recipes.length === 0) return { methods: [], scanned: 0 };
  return extractCookingMethods(recipes, { topN: opts.topN ?? 3 });
}

// ── Adaptation ────────────────────────────────────────────────────────────────

/**
 * Light name-adaptation: identify which recipe ingredients ARE in the bowl and
 * which are absent so the UI can show provenance. Does NOT rewrite the real
 * steps — grounded real directions are returned verbatim.
 *
 * Returns the steps unchanged plus metadata lists:
 *   presentNames  — recipe ingredients the bowl also has
 *   absentNames   — recipe ingredients absent from the bowl (substitutions needed)
 *
 * @param {string[]}  steps           Verbatim steps from retrieved recipe.
 * @param {number[]}  recipeVocabIds  Vocab ids of the retrieved recipe's ingredients.
 * @param {string[]}  bowlNames       Bowl ingredient names.
 * @param {string[]}  vocab           Full vocab array.
 * @returns {{ steps: string[], presentNames: string[], absentNames: string[] }}
 */
export function adaptSteps(steps, recipeVocabIds, bowlNames, vocab) {
  if (!Array.isArray(steps))         return { steps: [], presentNames: [], absentNames: [] };
  if (!Array.isArray(vocab))         return { steps, presentNames: [], absentNames: [] };

  const { nameToId, idToName } = buildVocabMaps(vocab);
  const bowlIds = new Set(resolveNamesToIds(bowlNames, nameToId));

  const presentNames = [];
  const absentNames  = [];
  const seen         = new Set();

  for (const id of (recipeVocabIds ?? [])) {
    if (seen.has(id)) continue;
    seen.add(id);
    const name = idToName.get(id) ?? String(id);
    if (bowlIds.has(id)) presentNames.push(name);
    else                 absentNames.push(name);
  }

  // Steps are returned verbatim — no rewriting.
  return { steps, presentNames, absentNames };
}
