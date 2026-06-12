/**
 * deriveBowlCuisine — infer the dominant cuisine of a recipe bowl so the
 * FM-P2 set-completion model can condition on it (cuisine is its strongest
 * signal). Pure + dependency-free so it is unit-testable.
 *
 * App nodes carry `cuisines: ['italian cuisine', ...]` (lowercase, " cuisine"
 * suffix — see useProData). The model's cuisine_vocab is title-case
 * ('Italian', 'French', ...). We tally bowl members' cuisines, pick the most
 * common, and resolve it against cuisine_vocab case-insensitively. Returns the
 * canonical cuisine_vocab member, or null when nothing matches (the model then
 * falls back to its cuisine_null condition).
 */

/** Strip the " cuisine" suffix and lowercase for matching. */
function normalizeCuisine(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim().toLowerCase();
  if (s.endsWith(' cuisine')) s = s.slice(0, -' cuisine'.length).trim();
  return s || null;
}

/**
 * @param {Array<{ingredient?: string, name?: string}>|string[]} bowl  BowlEntry[] or name[]
 * @param {Map<string, {cuisines?: string[]}>} nodes  graph nodes (name → node)
 * @param {string[]} cuisineVocab  model cuisine_vocab (title-case)
 * @returns {string|null} a cuisineVocab member, or null
 */
export function deriveBowlCuisine(bowl, nodes, cuisineVocab) {
  if (!Array.isArray(bowl) || bowl.length === 0) return null;
  if (!nodes || typeof nodes.get !== 'function') return null;
  if (!Array.isArray(cuisineVocab) || cuisineVocab.length === 0) return null;

  // Case-insensitive lookup from normalized cuisine → canonical vocab entry.
  // Keep the FIRST occurrence: the model's cuisine_vocab contains both a proper
  // 'Thai' (well-trained, earlier) and a duplicate lowercase 'thai' (rare,
  // later). Without keep-first, the weak lowercase variant would win and the
  // suggestions would lose cuisine conditioning (→ staple collapse).
  const canon = new Map();
  for (const c of cuisineVocab) {
    if (typeof c === 'string' && !canon.has(c.toLowerCase())) canon.set(c.toLowerCase(), c);
  }

  const tally = new Map(); // canonical vocab entry → count
  for (const item of bowl) {
    const name = typeof item === 'string' ? item : (item?.ingredient ?? item?.name);
    if (!name) continue;
    const node = nodes.get(name);
    const cuisines = node?.cuisines;
    if (!Array.isArray(cuisines)) continue;
    for (const raw of cuisines) {
      const norm = normalizeCuisine(raw);
      if (!norm) continue;
      const hit = canon.get(norm);
      if (!hit) continue; // not a model cuisine (e.g. "tex-mex" absent) → skip
      tally.set(hit, (tally.get(hit) || 0) + 1);
    }
  }

  if (tally.size === 0) return null;
  // Dominant cuisine; ties broken by cuisineVocab order (stable, deterministic).
  let best = null;
  let bestCount = 0;
  for (const c of cuisineVocab) {
    const n = tally.get(c) || 0;
    if (n > bestCount) { bestCount = n; best = c; }
  }
  return best;
}
