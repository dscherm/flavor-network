/**
 * inventVariety.js — which invented dishes / sauces to show next (WEAK-5).
 *
 * A deterministic top-k shows the same few ideas on every Shuffle. Here the
 * next idea is chosen by maximal marginal relevance: its score, minus how
 * much its ingredients overlap (Jaccard) with ideas already shown in this
 * session. Ideas already shown are never shown again, so Shuffle walks the
 * whole space and then says so (EXHAUSTED_*).
 *
 * Greedy MMR from an empty session gives one fixed order; continuing it
 * from the ideas shown so far gives the same order. So inventRecipes /
 * inventSauces can name the ideas in that order (and keep names unique
 * across a session), and the panel can call nextIdeas page by page.
 */

export const MMR_LAMBDA = 0.6;
export const EXHAUSTED_RECIPE = "That's every idea for this kitchen; add an ingredient for more.";
export const EXHAUSTED_SAUCE = "That's every idea for this pantry; add an ingredient for more.";

/** |A ∩ B| / |A ∪ B| over two lists of names (0 when both are empty). */
export function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / (A.size + B.size - inter);
}

/** Order-free identity of an idea. */
export const ideaKey = (keys) => [...new Set(keys)].sort().join('|');

const defaultScore = (x) => x.score || 0;

/**
 * The next `n` ideas by MMR, given the ideas already shown.
 * @param {Array} pool — every candidate idea
 * @param {Array} shown — ideas shown so far this session
 * @param {number} n
 * @param {{ keysOf: (idea) => string[], scoreOf?: (idea) => number, lambda?: number }} o
 * @returns {Array} up to n ideas not yet shown; [] when the space is exhausted
 */
export function nextIdeas(pool, shown = [], n = 3, { keysOf, scoreOf = defaultScore, lambda = MMR_LAMBDA } = {}) {
  if (!Array.isArray(pool) || pool.length === 0 || typeof keysOf !== 'function') return [];
  const scores = pool.map(scoreOf);
  const lo = Math.min(...scores);
  const hi = Math.max(...scores);
  const rel = (i) => (hi > lo ? (scores[i] - lo) / (hi - lo) : 1);
  const keys = pool.map((x) => keysOf(x));
  const seenKeys = new Set((shown || []).map((x) => ideaKey(keysOf(x))));
  const against = (shown || []).map((x) => keysOf(x));
  const left = pool.map((_, i) => i).filter((i) => !seenKeys.has(ideaKey(keys[i])));
  const out = [];
  while (out.length < n && left.length) {
    let best = -1; let bestVal = -Infinity;
    for (let j = 0; j < left.length; j++) {
      const i = left[j];
      let overlap = 0;
      for (const k of against) { const s = jaccard(keys[i], k); if (s > overlap) overlap = s; }
      const val = lambda * rel(i) - (1 - lambda) * overlap;
      // Ties: the pool's own order (best score first).
      if (val > bestVal + 1e-12) { bestVal = val; best = j; }
    }
    const i = left.splice(best, 1)[0];
    out.push(pool[i]);
    against.push(keys[i]);
    // A second candidate with the same ingredients is the same idea.
    const k = ideaKey(keys[i]);
    for (let j = left.length - 1; j >= 0; j--) if (ideaKey(keys[left[j]]) === k) left.splice(j, 1);
  }
  return out;
}

/** The whole pool in session order (what Shuffle would show, page after page). */
export function mmrOrder(pool, opts) {
  return nextIdeas(pool, [], Array.isArray(pool) ? pool.length : 0, opts);
}

/**
 * Drop thin copies: an idea smaller than `minSize` whose ingredients are
 * all in a better-scoring idea is that idea with things left out, not a
 * new one ("tomato + garlic" next to "tomato, garlic, shallot, lemon").
 * @param {Array} ideas — best score first
 */
export function dropThinSubsets(ideas, { keysOf, minSize }) {
  const sets = ideas.map((x) => new Set(keysOf(x)));
  return ideas.filter((_, i) => {
    if (sets[i].size >= minSize) return true;
    for (let j = 0; j < i; j++) {
      if (sets[j].size > sets[i].size && [...sets[i]].every((k) => sets[j].has(k))) return false;
    }
    return true;
  });
}

/**
 * Give each idea (in order) the first of its candidate names not already
 * taken. Ideas whose every candidate is taken are dropped.
 * @param {Array} ideas — in session order
 * @param {(idea) => string[]} namesOf — candidate names, best first
 * @returns {Array<{ idea, name }>}
 */
export function assignUniqueNames(ideas, namesOf) {
  const taken = new Set();
  const out = [];
  for (const idea of ideas) {
    const name = (namesOf(idea) || []).find((nm) => nm && !taken.has(nm));
    if (!name) continue;
    taken.add(name);
    out.push({ idea, name });
  }
  return out;
}
