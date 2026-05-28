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

/* ──────────────────────────────────────────────────────────────────
 * Aroma profile (replaces the misleading "taste balance" UI).
 *
 * Aggregates the GNN-predicted odor_* probabilities across the
 * selected ingredients and returns a normalized 6-D profile. This
 * is closer to how flavor actually works — taste (sweet/bitter/...)
 * is only ~5 channels, but aroma is the dominant flavor signal and
 * the GNN heads for it (fruity/floral/green/woody/spicy/fatty) are
 * decent post-calibration.
 *
 * Reports a profile rather than a single "balance" score because
 * food-pairing theory says aroma OVERLAP (not diversity) predicts
 * good pairings — so a balance number would be misleading. Showing
 * the bars lets the user see "this combo trends woody + spicy"
 * directly.
 * ────────────────────────────────────────────────────────────── */
const AROMAS = ['odor_fruity', 'odor_floral', 'odor_green', 'odor_woody', 'odor_spicy', 'odor_fatty'];

export const AROMA_LABELS = {
  odor_fruity: 'fruity',
  odor_floral: 'floral',
  odor_green: 'green',
  odor_woody: 'woody',
  odor_spicy: 'spicy',
  odor_fatty: 'creamy',  // 2026-05-27 (batch 6 chef-vocab): renamed
};

export const AROMA_COLORS = {
  odor_fruity: '#ff8c42',
  odor_floral: '#e879a8',
  odor_green:  '#6bcb77',
  odor_woody:  '#a67c52',
  odor_spicy:  '#ff4444',
  odor_fatty:  '#d4aa70',
};

export function scoreRecipeAroma(ingredients) {
  if (!ingredients || ingredients.length === 0) {
    return {
      profile: AROMAS.map(() => 0),
      dominantAromas: [],
      confidence: 0,
      hasSignal: false,
      compoundCount: 0,
      compoundNames: [],
    };
  }
  const agg = AROMAS.map(() => 0);
  let gnnCount = 0;
  // Track ingredients whose GNN probabilities were synthesized from
  // their constituent ingredients (compound foods like mayonnaise,
  // vinaigrette, garam masala). The wheel surfaces a "Predicted from
  // components" badge when at least one is present so the user knows
  // part of the aroma signal isn't a direct molecular prediction.
  const compoundNames = [];
  for (const ing of ingredients) {
    if (!ing?.gnnProbs) continue;
    gnnCount++;
    if (ing.gnnProbsSource === 'compound' && ing.name) {
      compoundNames.push(ing.name);
    }
    for (let i = 0; i < AROMAS.length; i++) {
      agg[i] += ing.gnnProbs[AROMAS[i]] || 0;
    }
  }
  const total = agg.reduce((s, v) => s + v, 0);
  const profile = total > 0 ? agg.map(v => v / total) : agg;
  const dominantAromas = AROMAS
    .map((a, i) => ({ a, p: profile[i] }))
    .sort((x, y) => y.p - x.p)
    .filter(x => x.p > 0)
    .map(x => x.a);
  return {
    profile,
    dominantAromas,
    confidence: gnnCount / ingredients.length,
    hasSignal: total > 0,
    compoundCount: compoundNames.length,
    compoundNames,
  };
}
