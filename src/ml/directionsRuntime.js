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
