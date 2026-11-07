/**
 * everydayPairs.js — the "everyday pairs" index (WEAK-A).
 *
 * The shipped pairing graph misses the most common pairs in cooking
 * (chicken|garlic, garlic|onion, garlic|olive oil …): its blend favours
 * NPMI and keeps only the strongest 40k. public/proDataset/everyday_pairs.json
 * (scripts/build_everyday_pairs.mjs) holds each ingredient's top ~30
 * partners by a lift-aware RecipeNLG count score, with a 0..1 strength on
 * the same scale as the curated graph.
 *
 * Used ONLY by the invent and kitchen features (Invent a recipe / sauce /
 * cocktail, the pantry and bar panels). The Pairing Lab, the Cookbook
 * "goes well with" ranking and scripts/evalPairingMatch.mjs keep the
 * curated graph alone.
 *
 * Fail-safe: loadEverydayPairs() resolves to null on any failure, and
 * blendIndex(curated, null) returns `curated` unchanged.
 */

export const EVERYDAY_PAIRS_URL = '/proDataset/everyday_pairs.json';

/**
 * Parse the artifact into lookups.
 * @param {{ names: string[], pairs: number[] }} json
 * @returns {{ strength: Map<string,number>, partnersOf: Map<string,Array<{name:string,s:number}>>, names: Set<string> } | null}
 */
export function parseEverydayPairs(json) {
  const names = Array.isArray(json?.names) ? json.names : null;
  const flat = Array.isArray(json?.pairs) ? json.pairs : null;
  if (!names || !flat || flat.length % 3 !== 0) return null;
  const strength = new Map();
  const partnersOf = new Map();
  const add = (x, y, s) => {
    if (!partnersOf.has(x)) partnersOf.set(x, []);
    partnersOf.get(x).push({ name: y, s });
  };
  for (let i = 0; i < flat.length; i += 3) {
    const a = names[flat[i]];
    const b = names[flat[i + 1]];
    const s = flat[i + 2] / 100;
    if (typeof a !== 'string' || typeof b !== 'string' || !(s > 0)) continue;
    strength.set(`${a}|${b}`, s);
    strength.set(`${b}|${a}`, s);
    add(a, b, s);
    add(b, a, s);
  }
  for (const list of partnersOf.values()) list.sort((p, q) => q.s - p.s || p.name.localeCompare(q.name));
  return { strength, partnersOf, names: new Set(partnersOf.keys()) };
}

let _promise = null;

/**
 * Load (once) the everyday-pairs index. Resolves to null on failure; a
 * failed load is retried on the next call.
 * @param {(url: string) => Promise<Response>} [fetchImpl]
 */
export function loadEverydayPairs(fetchImpl) {
  if (!_promise) {
    const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!f) return Promise.resolve(null);
    _promise = Promise.resolve()
      .then(() => f(EVERYDAY_PAIRS_URL))
      .then((r) => (r && r.ok ? r.json() : null))
      .then((j) => (j ? parseEverydayPairs(j) : null))
      .catch(() => null)
      .then((idx) => { if (!idx) _promise = null; return idx; });
  }
  return _promise;
}

/** Test hook: forget the cached load. */
export function resetEverydayPairs() { _promise = null; }

/** Everyday strength of a pair (0 when unknown or no index). */
export function strength(everyday, a, b) {
  return everyday?.strength?.get(`${a}|${b}`) || 0;
}

/** The k strongest everyday partners of `a`: [{ name, s }]. */
export function partners(everyday, a, k = 10) {
  return (everyday?.partnersOf?.get(a) || []).slice(0, k);
}

const blendCache = new WeakMap();

/**
 * A pairing index shaped like buildPairingIndex()'s — { strength, degree,
 * names, nodeCount } — whose strength per pair is the max of the curated
 * and the everyday strength. Existing scorers take it unchanged.
 * Either side may be null: no everyday → `curated` itself; no curated →
 * an index of the everyday pairs alone.
 */
export function blendIndex(curated, everyday) {
  if (!everyday?.strength) return curated || null;
  const key = curated || everyday;
  let byEveryday = blendCache.get(key);
  if (!byEveryday) { byEveryday = new WeakMap(); blendCache.set(key, byEveryday); }
  if (byEveryday.has(everyday)) return byEveryday.get(everyday);

  const strengthMap = new Map(curated?.strength || []);
  for (const [k, s] of everyday.strength) {
    if (!(s <= (strengthMap.get(k) || 0))) strengthMap.set(k, s);
  }
  const degree = new Map();
  for (const k of strengthMap.keys()) {
    const a = k.slice(0, k.indexOf('|'));
    degree.set(a, (degree.get(a) || 0) + 1);
  }
  const names = curated?.names?.size ? curated.names : new Set(everyday.names);
  const out = { strength: strengthMap, degree, names, nodeCount: Math.max(names.size, 1) };
  byEveryday.set(everyday, out);
  return out;
}
