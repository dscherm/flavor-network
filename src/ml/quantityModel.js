/**
 * quantityModel.js — FM-Q2 predictor: suggest a {unit, qty} for an ingredient.
 *
 * Consumes the artifacts built by flavor-gnn/scripts/fm_q2_quantity_model.mjs:
 *   - quantity_model.json  { _meta: { minSamples, global: {unit, qty} }, model: { vocabId: {unit, qty, n} } }
 *   - vocab.json           { vocab: [name, ...] }  (id = array index)
 *
 * Pure data lookup — no training, in-browser-safe. Capability scaffold; NOT
 * wired into shipped UI yet (per the user's "build the capability" scope). A
 * predicted {unit, qty} drops straight into a Recipe Notebook BowlEntry.amount.
 */

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
    return { unit: entry.unit, qty: entry.qty, source: 'model' };
  }
  // Below the per-ingredient sample floor (or unknown ingredient) → global prior.
  if (global && global.unit) {
    return { unit: global.unit, qty: global.qty, source: 'global' };
  }
  return null;
}

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
