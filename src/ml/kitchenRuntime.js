/**
 * kitchenRuntime — lazy loaders for the Recipe Lab's kitchen panel and
 * "Invent a recipe" (KITCHEN-2). Every loader resolves to null on failure
 * so the UI can degrade (Cookbook coverage keeps working without them).
 *
 *   loadRealRecipes()  → { index, vocab }  the 40k RecipeNLG directions
 *                        index (~14 MB) + the model vocab it is keyed on.
 *   loadInventModel()  → { suggest, cuisineVocab }  the FM-P2 set-completion
 *                        model (onnxruntime-web, ~4 MB), bound to suggest().
 */
import { loadDirectionsIndex } from './directionsRuntime.js';

let _vocabPromise = null;
function loadVocab() {
  if (!_vocabPromise) {
    _vocabPromise = fetch('/models/recipe_vocab.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (Array.isArray(j?.vocab) ? j.vocab : null))
      .catch(() => null)
      .then((v) => { if (!v) _vocabPromise = null; return v; });
  }
  return _vocabPromise;
}

export async function loadRealRecipes() {
  try {
    const [index, vocab] = await Promise.all([loadDirectionsIndex(), loadVocab()]);
    return index && vocab ? { index, vocab } : null;
  } catch {
    return null;
  }
}

let _modelPromise = null;
export function loadInventModel() {
  if (!_modelPromise) {
    _modelPromise = import('./recipeRuntime.js')
      .then(async (rt) => {
        const model = await rt.loadRecipeModel();
        return {
          suggest: (observed, opts) => rt.suggestIngredients(observed, opts, model),
          cuisineVocab: model.meta?.cuisine_vocab || [],
        };
      })
      .catch((e) => {
        console.warn('[kitchenRuntime] recipe model failed to load:', e);
        _modelPromise = null;
        return null;
      });
  }
  return _modelPromise;
}
