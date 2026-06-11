/**
 * quantityRuntime — lazy browser loader for the FM-Q2 quantity model. Fetches
 * /models/quantity_model.json once and builds the vocab index from the
 * already-shipped /models/recipe_vocab.json (same 3891-entry vocab, verified
 * byte-identical). Exposes predictAmount(name) → a BowlEntry.amount-shaped
 * {raw, qty, unit, inferred:true} so a model-suggested ingredient can prefill
 * an editable amount.
 *
 * Pure prediction lives in src/ml/quantityModel.js (unit-tested); this module
 * only handles the lazy fetch + amount formatting. Null-safe: any load failure
 * resolves the predictor to null and predictAmount returns null.
 */
import { predictQuantity, buildVocabIndex } from './quantityModel.js';

let _ctxPromise = null;

/** Lazily load the quantity artifact + vocab index. Singleton. */
export function loadQuantityModel(basePath = '') {
  if (_ctxPromise) return _ctxPromise;
  _ctxPromise = (async () => {
    try {
      const [artRes, vocabRes] = await Promise.all([
        fetch(`${basePath}/models/quantity_model.json`),
        fetch(`${basePath}/models/recipe_vocab.json`),
      ]);
      if (!artRes.ok || !vocabRes.ok) return null;
      const artifact = await artRes.json();
      const vocabMeta = await vocabRes.json();
      const vocabIndex = buildVocabIndex(vocabMeta.vocab);
      return { artifact, vocabIndex };
    } catch {
      return null; // offline / missing artifact → quantity prefill silently off
    }
  })();
  return _ctxPromise;
}

/** Format a predicted {unit, qty} into a BowlEntry.amount. */
function toAmount(pred) {
  if (!pred || !pred.unit) return null;
  const qty = typeof pred.qty === 'number' ? pred.qty : null;
  const raw = qty != null ? `${qty} ${pred.unit}` : pred.unit;
  return { raw, qty, unit: pred.unit, inferred: true };
}

/**
 * Synchronous amount prediction from an already-loaded ctx (from
 * loadQuantityModel). Lets a click handler prefill without awaiting — call
 * loadQuantityModel() once up front, then this on each add.
 * @returns {{raw:string, qty:number|null, unit:string, inferred:true}|null}
 */
export function predictAmountFromCtx(name, ctx) {
  if (!name || !ctx) return null;
  return toAmount(predictQuantity(name, ctx));
}

/**
 * Predict an editable amount for an ingredient name.
 * @returns {Promise<{raw:string, qty:number|null, unit:string, inferred:true}|null>}
 */
export async function predictAmount(name, basePath = '') {
  if (!name) return null;
  const ctx = await loadQuantityModel(basePath);
  if (!ctx) return null;
  return toAmount(predictQuantity(name, ctx));
}

/** Test seam: reset the singleton so a test can re-stub fetch. */
export function __resetQuantityRuntime() {
  _ctxPromise = null;
}
