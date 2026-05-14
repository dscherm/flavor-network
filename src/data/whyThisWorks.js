/**
 * whyThisWorks — Phase 4 dual-sentence honest story.
 *
 * Output schema (Critic-imposed Constraint #5):
 *   {
 *     causalSentence: string,                       // always present — engine attribution
 *     annotativeSentence: string | null,            // bridge_compounds lookup; null if no bridge
 *     isAnnotativeCompoundUsedByRuntime: boolean,   // bridge.compound ∈ pair.sharedCompounds
 *     citationsIfAny: Citation[],                   // ground_truth matches (Phase 1 file)
 *     surpriseAxesMatched: string[],                // 0..4 of the surprise axes from chemDataset/validation/lib/axes.js
 *   }
 *
 * Honesty model:
 *   - causalSentence describes what the engine ACTUALLY did
 *     (recipe co-occurrence over the live pairing corpus). Always
 *     rendered — there's nothing speculative about it.
 *   - annotativeSentence describes a chemistry hypothesis
 *     (compound bridge from bridge_compounds.json or GNN-entropy
 *     fallback). Rendered as "supporting context" — explicitly
 *     marked as annotation, NOT as the ranking signal.
 *   - isAnnotativeCompoundUsedByRuntime — false signals that the
 *     cited compound was NOT used by the engine to rank this pair
 *     (e.g. because pair.sharedCompounds is empty thanks to
 *     x3_chemical=0.5 globally). The StoryPanel uses this to render
 *     a disclaimer chip "annotation only — not used in ranking".
 *
 * Pure data templating only — no LLM calls (ADR-001 explicit
 * rejection).
 *
 * @typedef {Object} Citation
 * @property {string} ref
 * @property {string} [url]
 *
 * @typedef {Object} Pair
 * @property {string} ingredientA
 * @property {string} ingredientB
 * @property {number} [strength]
 * @property {string[]} [sharedCompounds]
 * @property {{ x1?: number, x2?: number, x3?: number, x4?: number, x5?: number, x6?: number, x7?: number, x8?: number }} [breakdown]
 */

// NOTE: Node-only modules (node:fs, node:path, node:url) are loaded
// LAZILY inside Node-side helpers below. Importing them at the top
// would break the Vite browser bundle (Rollup's __vite-browser-external
// stub doesn't export `dirname` / `readFileSync`). The browser path
// short-circuits via the `_isNode` guard.
//
// Phase 1 axis classifiers — pure functions, safe to import in both
// environments. The chemDataset/validation/lib/axes.js file is pure
// ESM with no Node-only side effects.
import {
  chemBridgedRare,
  absentFromBooks,
  crossCuisine,
  crossAroma,
} from '../../chemDataset/validation/lib/axes.js';

// ───────── Path helpers (Node-side only; no-op in the browser) ─────────

const _isNode =
  typeof process !== 'undefined' &&
  typeof process.versions !== 'undefined' &&
  typeof process.versions.node === 'string';

// Lazy Node-module loaders. Vite/Rollup tree-shake these out of the
// browser bundle as long as they're behind the `_isNode` guard.
let _nodeMods = null;
function nodeMods() {
  if (!_isNode) return null;
  if (_nodeMods) return _nodeMods;
  try {
    // eslint-disable-next-line no-new-func
    const _require = new Function('m', 'return require(m)');
    _nodeMods = {
      fs: _require('node:fs'),
      path: _require('node:path'),
      url: _require('node:url'),
    };
  } catch {
    _nodeMods = null;
  }
  return _nodeMods;
}

let _moduleDir = null;
function moduleDir() {
  if (_moduleDir) return _moduleDir;
  const mods = nodeMods();
  if (!mods) return null;
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      _moduleDir = mods.path.dirname(mods.url.fileURLToPath(import.meta.url));
    }
  } catch {
    _moduleDir = null;
  }
  return _moduleDir;
}

// REPO root, only used at Node-side load (snapshot script + tests).
function repoPath(...segs) {
  const dir = moduleDir();
  const mods = nodeMods();
  if (!dir || !mods) return null;
  return mods.path.resolve(dir, '..', '..', ...segs);
}

// ───────── Lazy-load ground_truth.json (Node only, memoized) ─────────

let _groundTruthCache = null;
function loadGroundTruth() {
  if (_groundTruthCache !== null) return _groundTruthCache;
  const mods = nodeMods();
  if (!_isNode || !mods) {
    // Browser path — caller must inject ground truth via ctx.groundTruth.
    _groundTruthCache = { pairings: [] };
    return _groundTruthCache;
  }
  try {
    const p = repoPath('chemDataset', 'validation', 'ground_truth.json');
    if (!p || !mods.fs.existsSync(p)) {
      _groundTruthCache = { pairings: [] };
      return _groundTruthCache;
    }
    _groundTruthCache = JSON.parse(mods.fs.readFileSync(p, 'utf-8')) || { pairings: [] };
  } catch {
    _groundTruthCache = { pairings: [] };
  }
  return _groundTruthCache;
}

// ───────── Lazy-load bridge_compounds.json (Node only, memoized) ─────────

let _bridgeCompoundsCache = null;
function loadBridgeCompounds() {
  if (_bridgeCompoundsCache !== null) return _bridgeCompoundsCache;
  const mods = nodeMods();
  if (!_isNode || !mods) {
    _bridgeCompoundsCache = {};
    return _bridgeCompoundsCache;
  }
  try {
    const p = repoPath('public', 'proDataset', 'bridge_compounds.json');
    if (!p || !mods.fs.existsSync(p)) {
      _bridgeCompoundsCache = {};
      return _bridgeCompoundsCache;
    }
    _bridgeCompoundsCache = JSON.parse(mods.fs.readFileSync(p, 'utf-8')) || {};
  } catch {
    _bridgeCompoundsCache = {};
  }
  return _bridgeCompoundsCache;
}

/** mtime in epoch-millis for the bridge_compounds.json artifact, or null. */
export function bridgeCompoundsMtime() {
  const mods = nodeMods();
  if (!_isNode || !mods) return null;
  try {
    const p = repoPath('public', 'proDataset', 'bridge_compounds.json');
    if (!p || !mods.fs.existsSync(p)) return null;
    return mods.fs.statSync(p).mtimeMs;
  } catch {
    return null;
  }
}

// ───────── Helpers ─────────

function lc(s) {
  return typeof s === 'string' ? s.toLowerCase() : '';
}

/** Deduped, lower-cased pair-key in alphabetical order: "a|b". */
function pairKey(a, b) {
  const A = lc(a);
  const B = lc(b);
  return A < B ? `${A}|${B}` : `${B}|${A}`;
}

/** Pretty-print pairing count with thousands separators. */
function fmtCount(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US');
}

/**
 * Look up a bridge_compounds entry for (a, b), tolerant of either
 * ordering and case-insensitive. The shipped JSON uses lowercased
 * ingredient names already, but we normalize defensively.
 */
function lookupBridge(a, b, bridgeCompounds) {
  if (!bridgeCompounds) return null;
  const A = lc(a);
  const B = lc(b);
  // Try both orderings as stored.
  const k1 = `${A}|${B}`;
  const k2 = `${B}|${A}`;
  const direct = bridgeCompounds[k1] || bridgeCompounds[k2];
  if (direct && Array.isArray(direct.bridges) && direct.bridges.length > 0) {
    return direct;
  }
  return null;
}

/**
 * GNN-entropy fallback: when no curated bridge exists, look for a
 * shared "top class" between the two ingredients. Returns a tuple
 * `{compound: string, class: string}` shaped like the bridge entry's
 * surface fields so the renderer can format both uniformly. Returns
 * null when neither side has GNN data OR when the top class doesn't
 * agree.
 */
function gnnEntropyFallback(a, b, gnnEntropy) {
  if (!gnnEntropy) return null;
  const eA = gnnEntropy[a] || gnnEntropy[lc(a)];
  const eB = gnnEntropy[b] || gnnEntropy[lc(b)];
  if (!eA || !eB) return null;
  const probsA = eA.probs || eA.probabilities || eA;
  const probsB = eB.probs || eB.probabilities || eB;
  if (!probsA || !probsB) return null;
  const topClass = (probs) => {
    let best = null;
    let bestVal = -Infinity;
    for (const [k, v] of Object.entries(probs)) {
      if (typeof v !== 'number') continue;
      if (v > bestVal) { bestVal = v; best = k; }
    }
    return { name: best, value: bestVal };
  };
  const tA = topClass(probsA);
  const tB = topClass(probsB);
  if (!tA.name || !tB.name) return null;
  if (tA.name === tB.name) {
    return {
      sharedClass: tA.name,
      strength: Math.min(tA.value, tB.value),
    };
  }
  return null;
}

/** Determine if a string compound name appears in a sharedCompounds[]. */
function compoundInShared(compound, sharedCompounds) {
  if (!compound || !Array.isArray(sharedCompounds) || sharedCompounds.length === 0) {
    return false;
  }
  const target = lc(compound);
  for (const c of sharedCompounds) {
    if (lc(c) === target) return true;
  }
  return false;
}

/** Phase 1 surprise axes — runs every classifier against the pair. */
function computeSurpriseAxes(pair, ctx) {
  const out = [];
  if (!pair) return out;
  const gtSet = ctx?.groundTruthSet;
  const ingredientMeta = ctx?.ingredientMeta || {};
  const gnnEntropy = ctx?.gnnEntropy || null;
  try {
    if (chemBridgedRare(pair)) out.push('chem-bridged-rare');
  } catch { /* defensive — classifier failures should not break the story */ }
  try {
    if (gtSet && absentFromBooks(pair, gtSet)) out.push('absent-from-books');
  } catch { /* noop */ }
  try {
    if (crossCuisine(pair, ingredientMeta)) out.push('cross-cuisine');
  } catch { /* noop */ }
  try {
    if (crossAroma(pair, gnnEntropy)) out.push('cross-aroma');
  } catch { /* noop */ }
  return out;
}

/** Build the Set<pairKey> from a ground-truth pairings[] array. */
function buildGroundTruthSet(groundTruth) {
  const set = new Set();
  if (!groundTruth?.pairings) return set;
  for (const e of groundTruth.pairings) {
    set.add(pairKey(e.a, e.b));
  }
  return set;
}

/** Find ground_truth citations matching (a, b). */
function citationsFor(a, b, groundTruth) {
  if (!groundTruth?.pairings) return [];
  const key = pairKey(a, b);
  const out = [];
  for (const e of groundTruth.pairings) {
    if (pairKey(e.a, e.b) !== key) continue;
    if (Array.isArray(e.sources)) {
      for (const s of e.sources) {
        if (s?.ref) out.push({ ref: s.ref, url: s.url || null });
      }
    }
  }
  return out;
}

// ───────── Public API ─────────

/**
 * @param {Pair} pair
 * @param {{
 *   pairingCount: number,
 *   sharedCompoundsForPair?: (a: string, b: string) => string[],
 * }} runtime
 * @param {{
 *   bridgeCompounds?: Record<string, any>,
 *   gnnEntropy?: Record<string, any>,
 *   groundTruth?: { pairings: Array<{ a: string, b: string, sources?: Array<{ ref: string, url?: string }> }> },
 *   ingredientMeta?: Record<string, any>,
 * }} [ctx]
 * @returns {{
 *   causalSentence: string,
 *   annotativeSentence: string | null,
 *   isAnnotativeCompoundUsedByRuntime: boolean,
 *   citationsIfAny: Citation[],
 *   surpriseAxesMatched: string[],
 * }}
 */
export function whyThisWorks(pair, runtime, ctx = {}) {
  const a = pair?.ingredientA || pair?.a || '';
  const b = pair?.ingredientB || pair?.b || '';

  // ── causalSentence — always rendered ──
  const pairingCount = Number(runtime?.pairingCount) || 0;
  const causalSentence = pairingCount > 0
    ? `Our pairing engine ranked this from recipe co-occurrence in ${fmtCount(pairingCount)} pairings.`
    : `Our pairing engine ranked this from recipe co-occurrence.`;

  // ── annotativeSentence ──
  const bridgeCompounds = ctx.bridgeCompounds ?? loadBridgeCompounds();
  const gnnEntropy = ctx.gnnEntropy ?? null;

  let annotativeSentence = null;
  let annotativeCompound = null;

  const bridge = lookupBridge(a, b, bridgeCompounds);
  if (bridge) {
    const top = bridge.bridges?.[0] || null;
    if (top && top.name) {
      const tags = Array.isArray(top.tags) && top.tags.length > 0
        ? ` (${top.tags.slice(0, 2).join(', ')})`
        : '';
      annotativeSentence = `Both share ${top.name}${tags}.`;
      annotativeCompound = top.name;
    }
  }
  if (!annotativeSentence) {
    const fb = gnnEntropyFallback(a, b, gnnEntropy);
    if (fb && fb.sharedClass) {
      annotativeSentence = `Both lean toward the ${fb.sharedClass} class in our aroma model.`;
      annotativeCompound = null; // class-name, not a compound — never matches sharedCompounds
    }
  }

  // ── isAnnotativeCompoundUsedByRuntime ──
  let runtimeShared = Array.isArray(pair?.sharedCompounds) ? pair.sharedCompounds : [];
  if (typeof runtime?.sharedCompoundsForPair === 'function' && runtimeShared.length === 0) {
    try {
      runtimeShared = runtime.sharedCompoundsForPair(a, b) || [];
    } catch { /* runtime fallback is optional */ }
  }
  const isAnnotativeCompoundUsedByRuntime =
    !!annotativeCompound && compoundInShared(annotativeCompound, runtimeShared);

  // ── citationsIfAny ──
  const groundTruth = ctx.groundTruth ?? loadGroundTruth();
  const citationsIfAny = citationsFor(a, b, groundTruth);

  // ── surpriseAxesMatched ──
  const surpriseCtx = {
    groundTruthSet: ctx.groundTruthSet || buildGroundTruthSet(groundTruth),
    ingredientMeta: ctx.ingredientMeta || {},
    gnnEntropy,
  };
  const surpriseAxesMatched = computeSurpriseAxes(pair, surpriseCtx);

  return {
    causalSentence,
    annotativeSentence,
    isAnnotativeCompoundUsedByRuntime,
    citationsIfAny,
    surpriseAxesMatched,
  };
}

/**
 * Phase 2 compatibility: kept so CuratedWheel's existing call site
 * doesn't have to change. Returns true iff the pair has at least one
 * citation in ground_truth.
 */
export function groundTruthHas(a, b, ctx = {}) {
  const groundTruth = ctx.groundTruth ?? loadGroundTruth();
  return citationsFor(a, b, groundTruth).length > 0;
}

// ───────── Fixture loader (used by snapshot script + audit) ─────────

/**
 * Load the pre-baked curated_stories.json fixture if present AND fresh
 * (generatedAt >= mtime(bridge_compounds.json)). Returns null when the
 * fixture is missing OR stale; callers fall back to live whyThisWorks().
 *
 * Node-only; in the browser returns null.
 */
export function loadCuratedStoriesFixture() {
  const mods = nodeMods();
  if (!_isNode || !mods) return null;
  try {
    const p = repoPath('src', 'data', '__fixtures__', 'curated_stories.json');
    if (!p || !mods.fs.existsSync(p)) return null;
    const parsed = JSON.parse(mods.fs.readFileSync(p, 'utf-8'));
    if (!parsed?.generatedAt) return null;
    const bridgeMtime = bridgeCompoundsMtime();
    if (bridgeMtime !== null) {
      const generatedAt = new Date(parsed.generatedAt).getTime();
      if (Number.isFinite(generatedAt) && generatedAt < bridgeMtime) {
        // Stale — fall back to live compute.
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Test-only: clear memoized caches. */
export function _resetCachesForTests() {
  _groundTruthCache = null;
  _bridgeCompoundsCache = null;
}
