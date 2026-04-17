/**
 * GNN-informed recipe compatibility scoring.
 *
 * Given a list of ingredient names, aggregates their GNN-predicted taste
 * probability vectors (from gnn_entropy.json) and returns:
 *   - balance: 0..1  (higher = more evenly spread across taste axes)
 *   - coverage: 0..1 (fraction of the 5 tastes present with >= threshold probability)
 *   - profile: 5-D vector summed and normalized
 *   - dominantTastes: sorted list of taste names by aggregate probability
 *   - confidence: 0..1 (fraction of ingredients with GNN predictions — the
 *                       rest fall back to their node.taste string)
 *
 * This is a heuristic: a well-balanced recipe covers multiple tastes in
 * moderate proportion (think sweet + sour + salty = a good vinaigrette),
 * while a monotone recipe (five bitter things) scores low.
 *
 * Falls back gracefully to node.taste string parsing when a given ingredient
 * has no GNN prediction — the scorer returns a result even with zero GNN
 * coverage.
 */

const TASTES = ['sweet', 'bitter', 'umami', 'salty', 'sour'];
const PRESENT_THRESHOLD = 0.3;

/**
 * Convert a node.taste whitespace-joined string ("sweet sour") to a 5-D
 * one-hot-ish vector with 1.0 on mentioned tastes and 0 elsewhere.
 */
function tasteStringToVector(tasteStr) {
  const v = { sweet: 0, bitter: 0, umami: 0, salty: 0, sour: 0 };
  if (!tasteStr || typeof tasteStr !== 'string') return v;
  const tokens = tasteStr.toLowerCase().split(/\s+/);
  for (const t of TASTES) {
    if (tokens.some((tok) => tok.includes(t))) v[t] = 1;
  }
  return v;
}

/**
 * @param {Array<{name:string, taste?:string, gnnProbs?:Record<string,number>}>} ingredients
 * @returns {{balance:number, coverage:number, profile:number[], dominantTastes:string[], confidence:number}}
 */
export function scoreRecipe(ingredients) {
  if (!ingredients || ingredients.length === 0) {
    return { balance: 0, coverage: 0, profile: [0, 0, 0, 0, 0], dominantTastes: [], confidence: 0 };
  }

  const agg = [0, 0, 0, 0, 0];
  let gnnCount = 0;

  for (const ing of ingredients) {
    let vec;
    if (ing && ing.gnnProbs) {
      vec = ing.gnnProbs;
      gnnCount++;
    } else {
      vec = tasteStringToVector(ing?.taste || '');
    }
    for (let i = 0; i < TASTES.length; i++) {
      agg[i] += vec[TASTES[i]] || 0;
    }
  }

  // Normalize to sum to 1
  const total = agg.reduce((s, v) => s + v, 0) || 1;
  const profile = agg.map((v) => v / total);

  // Balance: 1 - normalized variance. Max variance for 5 axes is when all
  // mass is on one axis (var = 0.2 * 0.8 = 0.16). Invert and clamp.
  const mean = 1 / TASTES.length;
  const variance = profile.reduce((s, v) => s + (v - mean) ** 2, 0) / TASTES.length;
  const maxVar = (1 - mean) * mean; // per-axis variance when fully concentrated
  const balance = Math.max(0, 1 - variance / maxVar);

  // Coverage: fraction of tastes with enough mass after scaling by max ingredient count
  const cap = Math.max(1, ingredients.length);
  const capped = agg.map((v) => Math.min(1, v / cap));
  const coverage = capped.filter((v) => v >= PRESENT_THRESHOLD).length / TASTES.length;

  const dominant = TASTES
    .map((t, i) => ({ t, p: profile[i] }))
    .sort((a, b) => b.p - a.p)
    .filter((x) => x.p > 0)
    .map((x) => x.t);

  const confidence = ingredients.length > 0 ? gnnCount / ingredients.length : 0;

  return {
    balance: Math.max(0, Math.min(1, balance)),
    coverage: Math.max(0, Math.min(1, coverage)),
    profile,
    dominantTastes: dominant,
    confidence,
  };
}

/** Human-readable verdict for the UI. */
export function verdictForScore(score) {
  if (!score || score.balance == null) return '—';
  const b = score.balance;
  const c = score.coverage;
  if (b > 0.75 && c >= 0.6) return 'Well-balanced across tastes';
  if (b > 0.5 && c >= 0.4) return 'Moderately balanced';
  if (c < 0.2) return `Monotone — dominated by ${score.dominantTastes[0] || 'one taste'}`;
  return 'Uneven — try adding a contrasting taste';
}
