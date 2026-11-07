/**
 * quantityModel.js — FM-Q2 predictor: suggest a {unit, qty} for an ingredient.
 *
 * Consumes the artifacts built by flavor-gnn/scripts/fm_q2_quantity_model.mjs:
 *   - quantity_model.json  { _meta: { minSamples, global: {unit, qty} }, model: { vocabId: {unit, qty, n} } }
 *   - vocab.json           { vocab: [name, ...] }  (id = array index)
 *
 * Pure data lookup — no training, in-browser-safe. A predicted {unit, qty}
 * drops straight into a Recipe Notebook BowlEntry.amount (via quantityRuntime).
 *
 * WEAK-4: predictions are always kitchen units with kitchen fractions — see
 * kitchenize() below and src/ml/kitchenUnits.js.
 */
import { normalizeUnit, isKitchenQty, toKitchen } from './kitchenUnits.js';

/** Build a name → vocab-id index from vocab.json's `vocab` array. */
export function buildVocabIndex(vocabArray) {
  const idx = new Map();
  if (Array.isArray(vocabArray)) {
    for (let i = 0; i < vocabArray.length; i++) idx.set(String(vocabArray[i]).toLowerCase(), i);
  }
  return idx;
}

/**
 * Predict a quantity for one ingredient.
 * @param {string} name ingredient name (matched case-insensitively against vocab)
 * @param {{ artifact: object, vocabIndex: Map<string, number> }} ctx
 * @returns {{ unit: string, qty: number, source: 'model'|'global' } | null}
 */
export function predictQuantity(name, ctx) {
  if (!name || !ctx || !ctx.artifact) return null;
  const { artifact, vocabIndex } = ctx;
  const meta = artifact._meta || {};
  const minSamples = meta.minSamples ?? 5;
  const global = meta.global || null;

  const id = vocabIndex instanceof Map ? vocabIndex.get(String(name).toLowerCase()) : undefined;
  const entry = id != null ? artifact.model?.[id] : undefined;

  if (entry && (entry.n ?? 0) >= minSamples && entry.unit) {
    return { ...kitchenize(entry.unit, entry.qty), source: 'model' };
  }
  // Below the per-ingredient sample floor (or unknown ingredient) → global prior.
  if (global && global.unit) {
    return { ...kitchenize(global.unit, global.qty), source: 'global' };
  }
  return null;
}

/**
 * WEAK-4 post-processing: the artifact (since WEAK-4) already stores kitchen
 * units + kitchen fractions, so this is a no-op for it. For anything else (an
 * older artifact, a hand-built one) it normalises the unit name (c → cup,
 * teaspoon → tsp, lbs → lb) and rounds to a measurable quantity (0.83 cup → ¾
 * cup, 3.6 each → 4 each). A unit that is already canonical and a qty that is
 * already a kitchen fraction pass through untouched, so the build-time
 * category choice (e.g. 4 tbsp olive oil, not ¼ cup) is preserved.
 */
export function kitchenize(unit, qty) {
  const u = normalizeUnit(unit) || unit;
  if (typeof qty !== 'number' || !(qty > 0)) return { unit: u, qty };
  if (EMITTABLE.has(u) && isKitchenQty(qty, u)) return { unit: u, qty };
  return toKitchen(u, qty);
}

// Units the app's parseAmount / UNIT_DENSITY understand (src/data/portionParser.js).
const EMITTABLE = new Set(['tsp', 'tbsp', 'cup', 'oz', 'lb', 'g', 'ml', 'l', 'each', 'clove', 'sprig', 'handful', 'pinch', 'dash', 'can', 'pkg']);

/**
 * Predict quantities for a whole bowl of ingredient names.
 * @returns {Array<{ name: string, unit: string, qty: number, source: string } | { name: string, prediction: null }>}
 */
export function predictBowlQuantities(names, ctx) {
  if (!Array.isArray(names)) return [];
  return names.map((name) => {
    const p = predictQuantity(name, ctx);
    return p ? { name, ...p } : { name, prediction: null };
  });
}
