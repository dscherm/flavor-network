/**
 * recipeProfileAnalysis — pure flavor-profile math for the Flavor Profiles card
 * and the profile-delta suggestion cards. No React, no I/O → unit-testable.
 *
 * The recipe's profile is the mean of its ingredients' gnnProbs across the 11
 * taste+aroma axes. From that we derive: per-axis drivers, an insight line, the
 * profile shift a candidate ingredient would cause, and boost/temper rankings.
 */
import { AROMA_LABELS, AROMA_COLORS } from './recipeScoring.js';
import { UNIT_DENSITY } from './portionParser.js';

export const TASTE_AXES = ['sweet', 'sour', 'bitter', 'salty', 'umami'];
export const AROMA_AXES = ['odor_fruity', 'odor_floral', 'odor_green', 'odor_woody', 'odor_spicy', 'odor_fatty'];
export const AXES = [...TASTE_AXES, ...AROMA_AXES];

const TASTE_COLOR = {
  sweet: '#ff5fa2', sour: '#2bd4d4', bitter: '#a855f7', salty: '#5b8def', umami: '#e0a93b',
};

export function axisLabel(axis) {
  if (AROMA_LABELS[axis]) return AROMA_LABELS[axis];
  return axis.charAt(0).toUpperCase() + axis.slice(1);
}
export function axisColor(axis) {
  return TASTE_COLOR[axis] || AROMA_COLORS[axis] || '#a09070';
}

// Which axis counterbalances a given one (used for "temper" suggestions).
export const BALANCING = {
  sweet: 'sour', sour: 'sweet', bitter: 'sweet', salty: 'sour', umami: 'sour',
  odor_fruity: 'odor_green', odor_floral: 'odor_woody', odor_green: 'odor_fruity',
  odor_woody: 'odor_fruity', odor_spicy: 'sweet', odor_fatty: 'odor_green',
};

/** A node's 11-axis probability vector, or null. */
export function nodeProbs(name, nodes) {
  const p = nodes?.get?.(name)?.gnnProbs;
  if (!p) return null;
  return p;
}

/**
 * Aggregate per-axis profile of a bowl: mean over ingredients that have probs.
 * @returns {{ scores: Record<string,number>, drivers: Record<string,string[]>, n: number }}
 */
export function recipeAxisProfile(bowlNames, nodes) {
  const names = Array.isArray(bowlNames) ? bowlNames : [];
  const sums = Object.fromEntries(AXES.map((a) => [a, 0]));
  const contrib = Object.fromEntries(AXES.map((a) => [a, []])); // {axis: [{name, v}]}
  let n = 0;
  for (const name of names) {
    const p = nodeProbs(name, nodes);
    if (!p) continue;
    n += 1;
    for (const a of AXES) {
      const v = p[a] || 0;
      sums[a] += v;
      contrib[a].push({ name, v });
    }
  }
  const scores = {};
  const drivers = {};
  for (const a of AXES) {
    scores[a] = n ? sums[a] / n : 0;
    drivers[a] = contrib[a]
      .filter((c) => c.v > 0.05)
      .sort((x, y) => y.v - x.v)
      .slice(0, 3)
      .map((c) => c.name);
  }
  return { scores, drivers, n };
}

/**
 * Gram-equivalent weight for a BowlEntry `amount`, or null when unknown.
 * A unit-only amount ("a pinch") defaults qty→1; an amount whose unit isn't
 * in UNIT_DENSITY falls back to the 'each' density so a parsed entry still
 * counts. Returns null only when nothing parseable is present.
 */
export function amountGrams(amount) {
  if (!amount) return null;
  const { qty, unit } = amount;
  if (qty == null && unit == null) return null;
  const density = unit
    ? (UNIT_DENSITY[unit] != null ? UNIT_DENSITY[unit] : UNIT_DENSITY.each)
    : null;
  if (density == null) return null; // qty without a unit isn't a real measure
  const q = qty == null ? 1 : qty;
  return q * density;
}

/**
 * Quantity-weighted per-axis profile of a bowl. `entries` may be a BowlEntry[]
 * ({ ingredient, amount }) or a plain string[]. Each ingredient's gnnProbs are
 * weighted by its amount's gram-equivalent; an ingredient with no parsed amount
 * falls back to the mean known weight (so it still counts). When NO amounts are
 * known, every ingredient is weighted equally → identical to recipeAxisProfile's
 * mean. Only ingredients that have gnnProbs contribute.
 * @returns {{ scores: Record<string,number>, n: number, weighted: boolean }}
 */
export function recipeAxisProfileWeighted(entries, nodes) {
  const list = Array.isArray(entries) ? entries : [];
  const rows = [];
  for (const e of list) {
    const name = typeof e === 'string' ? e : e?.ingredient;
    if (!name) continue;
    const p = nodeProbs(name, nodes);
    if (!p) continue;
    const amount = typeof e === 'string' ? null : e?.amount;
    rows.push({ p, grams: amountGrams(amount) });
  }
  const n = rows.length;
  const scores = Object.fromEntries(AXES.map((a) => [a, 0]));
  if (n === 0) return { scores, n: 0, weighted: false };

  const known = rows.map((r) => r.grams).filter((g) => g != null && g > 0);
  const weighted = known.length > 0;
  const fallback = weighted ? known.reduce((s, g) => s + g, 0) / known.length : 1;

  let wSum = 0;
  for (const r of rows) {
    const w = (r.grams != null && r.grams > 0) ? r.grams : fallback;
    wSum += w;
    for (const a of AXES) scores[a] += (r.p[a] || 0) * w;
  }
  for (const a of AXES) scores[a] = wSum ? scores[a] / wSum : 0;
  return { scores, n, weighted };
}

/** Rule-based insight line for an axis given its aggregate score. */
export function axisInsight(axis, score) {
  const bal = axisLabel(BALANCING[axis] || '');
  const isTaste = TASTE_AXES.includes(axis);
  if (score >= 0.5) {
    return isTaste
      ? `Leans ${axisLabel(axis).toLowerCase()} — balance with ${bal.toLowerCase()}.`
      : `Strong ${axisLabel(axis).toLowerCase()} aroma — temper with ${bal.toLowerCase()} if it dominates.`;
  }
  if (score >= 0.2) return `${axisLabel(axis)} is present and balanced.`;
  return `Faint ${axisLabel(axis).toLowerCase()} — boost it if you want more.`;
}

const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Preparation-method → flavor effect (FP-OV-5). The likely cooking method is
 * inferred UPSTREAM from real similar-recipe directions
 * (directionsRuntime.retrieveCookingMethods), grounded in how the most
 * set-similar RecipeNLG recipes were actually cooked. Each canonical method
 * maps to a culinary family with a shared flavor-effect clause: Maillard
 * browning deepens roasted/sweet/savory notes, moist heat melds or stays
 * flavor-conservative, no-cook keeps fresh top notes forward.
 *
 * This is a DESCRIPTION-layer signal: `note` narrates the shift in
 * describeRecipeProfile. `axes` records the directional nudge (sign only, not a
 * calibrated magnitude) for a possible future opt-in "as-cooked" overlay — the
 * numeric bar-chart profile is deliberately NOT mutated here (it stays an
 * honest ingredient-flavor-potential reading).
 */
const METHOD_FAMILY = {
  roast: 'brown', sear: 'brown', grill: 'brown', broil: 'brown', bake: 'brown', toast: 'brown',
  fry: 'fry', 'deep-fry': 'fry', 'stir-fry': 'fry', 'sauté': 'fry', saute: 'fry',
  caramelize: 'caramelize',
  braise: 'meld', simmer: 'meld',
  steam: 'gentle', poach: 'gentle', boil: 'gentle', blanch: 'gentle',
  marinate: 'marinate',
  raw: 'raw', chill: 'raw', whisk: 'raw', blend: 'raw',
};

const FAMILY_EFFECT = {
  brown:      { note: 'browning brings out deeper, sweeter, roasted notes', axes: { sweet: 1, umami: 1, odor_woody: 1, odor_green: -1 } },
  fry:        { note: 'frying adds richness and a toasted edge', axes: { odor_fatty: 1, umami: 1, odor_woody: 1 } },
  caramelize: { note: 'caramelizing pushes it sweeter and richer', axes: { sweet: 2, odor_woody: 1 } },
  meld:       { note: 'the slow simmer melds everything and deepens its savory, umami side', axes: { umami: 1, odor_green: -1 } },
  gentle:     { note: 'gentle moist heat keeps it clean and fresh, easing the sharper aromas', axes: { odor_green: 1, odor_fruity: -1 } },
  marinate:   { note: 'marinating works acid and salt deeper into it', axes: { sour: 1, salty: 1 } },
  raw:        { note: 'kept raw, its bright, fresh top notes stay forward', axes: { odor_green: 1, odor_fruity: 1 } },
};

/**
 * Flavor effect of a preparation method, or null for an empty/unknown method.
 * @param {string|null|undefined} method  a canonical method from COOKING_METHODS
 * @returns {{ method: string, family: string, note: string, axes: Record<string,number> }|null}
 */
export function methodFlavorEffect(method) {
  if (!method) return null;
  const m = String(method).toLowerCase();
  const family = METHOD_FAMILY[m];
  if (!family) return null;
  const eff = FAMILY_EFFECT[family];
  if (!eff) return null;
  return { method: m, family, note: eff.note, axes: eff.axes };
}

/**
 * describeRecipeProfile — deterministic, on-device chef-style paragraph for the
 * Overview page. NO LLM / network: pure rules over the (quantity-weighted)
 * per-axis profile, the dominant taste + its balancing axis, the driving
 * ingredients, the dominant aroma, a mouthfeel cue (creamy/odor_fatty vs
 * green), and an optional aroma-match pairing signal.
 *
 * @param {{scores: Record<string,number>, drivers?: Record<string,string[]>, n: number}} profile
 * @param {{aromaMatch?: {name: string, similarity?: number}|null, cookingMethod?: string|null}} [opts]
 * @returns {string}
 */
export function describeRecipeProfile(profile, { aromaMatch = null, cookingMethod = null } = {}) {
  const scores = profile?.scores || {};
  const drivers = profile?.drivers || {};
  const n = profile?.n || 0;
  if (!n) return 'Add ingredients with flavor data to read this recipe’s profile.';

  const val = (a) => Math.max(0, scores[a] || 0);
  const strongest = (axesList) => axesList
    .map((a) => ({ a, v: val(a) }))
    .sort((x, y) => y.v - x.v)[0];
  const driverPhrase = (a) => {
    const d = (drivers[a] || []).slice(0, 2);
    return d.length ? ` from ${d.join(' and ')}` : '';
  };

  const sentences = [];

  // 1. Dominant taste + what drives it.
  const tt = strongest(TASTE_AXES);
  if (tt.v >= 0.08) {
    const lead = tt.v >= 0.5 ? 'leads with' : tt.v >= 0.2 ? 'leans' : 'carries a touch of';
    sentences.push(`This recipe ${lead} ${axisLabel(tt.a).toLowerCase()}${driverPhrase(tt.a)}.`);
  } else {
    sentences.push('This recipe is mild and even across the basic tastes.');
  }

  // 2. Balance against the dominant taste's counter-axis.
  const bal = BALANCING[tt.a];
  if (tt.v >= 0.2 && bal) {
    const bv = val(bal);
    if (bv >= 0.15) {
      sentences.push(`${capFirst(axisLabel(tt.a).toLowerCase())} and ${axisLabel(bal).toLowerCase()} sit in balance.`);
    } else {
      sentences.push(`There’s little ${axisLabel(bal).toLowerCase()} to offset it — a hit of ${axisLabel(bal).toLowerCase()} would round it out.`);
    }
  }

  // 3. Dominant aroma.
  const ta = strongest(AROMA_AXES);
  if (ta.v >= 0.08) {
    sentences.push(`Aromatically it reads ${axisLabel(ta.a).toLowerCase()}${driverPhrase(ta.a)}.`);
  }

  // 4. Mouthfeel cue — creamy (odor_fatty) richness vs green brightness.
  const rich = val('odor_fatty');
  const green = val('odor_green');
  if (rich >= 0.3) sentences.push('The overall feel is rich and rounded.');
  else if (green >= 0.3 && rich < 0.15) sentences.push('The overall feel is bright and clean.');

  // 5. Optional aroma-match pairing signal.
  if (aromaMatch?.name) {
    const pct = typeof aromaMatch.similarity === 'number' ? ` (${Math.round(aromaMatch.similarity * 100)}% match)` : '';
    sentences.push(`Its aromatics echo ${aromaMatch.name}${pct} — a natural pairing.`);
  }

  // 6. Optional preparation-method effect (FP-OV-5). Narrates how the likely
  //    cooking method (inferred from similar-recipe directions) shifts the
  //    flavor; does not alter the numeric profile above.
  const eff = methodFlavorEffect(cookingMethod);
  if (eff) sentences.push(`Likely ${eff.method} — ${eff.note}.`);

  return sentences.join(' ');
}

/**
 * Per-axis shift a candidate ingredient causes if added to the bowl.
 * delta[axis] = (cand[axis] - mean[axis]) / (n + 1).
 * @returns {Record<string, number>|null}
 */
export function profileDelta(candidateName, scores, n, nodes) {
  const p = nodeProbs(candidateName, nodes);
  if (!p) return null;
  const delta = {};
  for (const a of AXES) delta[a] = ((p[a] || 0) - (scores[a] || 0)) / (n + 1);
  return delta;
}

/** The axes a candidate moves most (by |delta|), for the card's delta arrows. */
export function topMovers(delta, k = 3) {
  if (!delta) return [];
  return AXES
    .map((a) => ({ axis: a, delta: delta[a] }))
    .filter((d) => Math.abs(d.delta) > 0.002)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, k);
}

/**
 * Rank candidate names by their impact on a target axis.
 *  - mode 'boost'  → largest positive delta on `axis`
 *  - mode 'temper' → largest positive delta on the balancing axis of `axis`
 * Only candidates with probs are considered. Returns [{name, delta}].
 */
export function rankByAxisImpact(candidateNames, axis, scores, n, nodes, { mode = 'boost', topN = 4 } = {}) {
  const target = mode === 'temper' ? (BALANCING[axis] || axis) : axis;
  const out = [];
  for (const name of candidateNames || []) {
    const d = profileDelta(name, scores, n, nodes);
    if (!d) continue;
    if (d[target] <= 0) continue;
    out.push({ name, delta: d[target] });
  }
  out.sort((a, b) => b.delta - a.delta);
  return out.slice(0, topN);
}

/**
 * Per-axis enhancement buckets for the Overview "Enhance" page: for each axis,
 * the boost candidates ("More {axis}? Try…") and temper candidates ("tone
 * down"), drawn from the model candidate pool via rankByAxisImpact. Axes with
 * no boost and no temper candidate are dropped so the page has no dead rows.
 * @returns {Array<{axis: string, boost: Array<{name,delta}>, temper: Array<{name,delta}>}>}
 */
export function buildAxisEnhancements(axes, candidateNames, scores, n, nodes, { boostN = 3, temperN = 2 } = {}) {
  const list = Array.isArray(axes) ? axes : [];
  return list
    .map((a) => ({
      axis: a,
      boost: rankByAxisImpact(candidateNames, a, scores, n, nodes, { mode: 'boost', topN: boostN }),
      temper: rankByAxisImpact(candidateNames, a, scores, n, nodes, { mode: 'temper', topN: temperN }),
    }))
    .filter((r) => r.boost.length > 0 || r.temper.length > 0);
}
