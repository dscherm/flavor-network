/**
 * recipeCandidates — shared candidate-name computation for the recipe lab's
 * unified "ingredient choices" flow. Both the IngredientPicker (which lists the
 * candidates) and SuggestionCardDeck (the radar-card preview) source their
 * candidate names here so the two never drift.
 *
 *  - SUGGEST: set-completion model ranked against the whole recipe (pairing-aware).
 *  - REPLACE: same-category substitutes ranked by recipe fit (similar flavor that
 *    also pairs with the bowl), with a cuisine-affinity re-rank and a guard that
 *    keeps Western pastas out of Asian-noodle swaps.
 *  - ADD:     open-ended — no curated list (the picker browses the full universe).
 */
import { deriveBowlCuisine } from './deriveBowlCuisine.js';

const ALPHA = 0.3; // popularity-discount strength (mild — high α promotes junk)

let _modelPromise = null;
function getModel() {
  if (!_modelPromise) {
    _modelPromise = import('../ml/recipeRuntime.js')
      .then((m) => m.loadRecipeModel().then((model) => ({ ...m, model })))
      .catch(() => { _modelPromise = null; return null; });
  }
  return _modelPromise;
}

// Coarse cuisine regions — for replace we prioritize substitutes whose PRIMARY
// cuisine matches the recipe's dominant cuisine (or its region). Using the
// primary cuisine (not the noisy full list) keeps e.g. lasagna out of an
// Asian-noodle swap even though the data noisily tags it Thai.
const CUISINE_REGION = {
  thai: 'asian', vietnamese: 'asian', chinese: 'asian', japanese: 'asian', korean: 'asian',
  indonesian: 'asian', malaysian: 'asian', filipino: 'asian', 'pacific islander': 'asian',
  'southeast asian': 'asian', indian: 'asian', pakistani: 'asian', 'sri lankan': 'asian',
  italian: 'european', french: 'european', spanish: 'european', greek: 'european', german: 'european',
  british: 'european', hungarian: 'european', polish: 'european', russian: 'european',
  portuguese: 'european', scandinavian: 'european',
  mexican: 'latin', 'tex-mex': 'latin', peruvian: 'latin', argentine: 'latin', brazilian: 'latin',
  caribbean: 'latin', 'cajun/creole': 'latin',
  'middle eastern': 'mideast', persian: 'mideast', lebanese: 'mideast', turkish: 'mideast',
  moroccan: 'mideast', israeli: 'mideast',
  'west african': 'african', 'south african': 'african', ethiopian: 'african', african: 'african',
  american: 'american', 'southern us': 'american', australian: 'american',
};
const cuisineRegion = (c) => CUISINE_REGION[c] || null;
function primaryCuisine(node) {
  const cs = node?.cuisines;
  if (!Array.isArray(cs) || cs.length === 0) return null;
  return (cs[0] || '').toLowerCase().replace(/ cuisine$/, '').trim() || null;
}

// Western pastas that are never sensible swaps for an Asian-style noodle.
const WRONG_FOR_NOODLE = /lasagn|macaroni|\bziti\b|rigatoni|\bpenne\b|spaghetti/i;

/**
 * SUGGEST candidates — model ingredients that complete the recipe, pairing-aware
 * over the whole bowl. Returns ranked ingredient names (in the bowl excluded).
 */
export async function loadSuggestCandidates(bowlNames, nodes, { k = 60 } = {}) {
  if (!Array.isArray(bowlNames) || bowlNames.length === 0 || !nodes) return [];
  const rt = await getModel();
  if (!rt || !rt.model) return [];
  const cuisine = deriveBowlCuisine(bowlNames, nodes, rt.model.meta.cuisine_vocab);
  const sugg = await rt.suggestIngredients(bowlNames, { cuisine, alpha: ALPHA, k }, rt.model);
  const bowlSet = new Set(bowlNames);
  return sugg.map((s) => s.name).filter((nm) => !bowlSet.has(nm) && nodes.get(nm));
}

/**
 * REPLACE candidates — same-category substitutes for `ingredient` ranked by how
 * well they fit the rest of the recipe (similar flavor + pairs with the bowl),
 * with a cuisine-affinity re-rank and the noodle guard. Returns ranked names.
 */
export async function loadReplaceCandidates(ingredient, bowlNames, nodes, { k = 60 } = {}) {
  if (!ingredient || !Array.isArray(bowlNames) || !nodes) return [];
  const rt = await getModel();
  if (!rt || !rt.model) return [];
  const observed = bowlNames.filter((x) => x !== ingredient);
  const bowlSet = new Set(bowlNames);
  const cuisine = deriveBowlCuisine(bowlNames, nodes, rt.model.meta.cuisine_vocab);

  // Restrict to same-category substitutes (rice noodle → grains, not condiments).
  let candidateNames = null;
  const focalCat = nodes.get(ingredient)?.category;
  if (focalCat) {
    candidateNames = [];
    for (const [nm, node] of nodes) {
      if (node?.category === focalCat && nm !== ingredient && !bowlSet.has(nm)) candidateNames.push(nm);
    }
  }

  const sugg = await rt.suggestIngredients(observed, { cuisine, alpha: ALPHA, k, candidateNames }, rt.model);

  const dom = (cuisine || '').toLowerCase();
  const domRegion = cuisineRegion(dom);
  const focalIsNoodle = /noodle/i.test(ingredient || '');
  return sugg
    .filter((s) => !(focalIsNoodle && WRONG_FOR_NOODLE.test(s.name)))
    .map((s, idx) => {
      const pc = primaryCuisine(nodes.get(s.name));
      let aff = 0;
      if (pc && dom) {
        if (pc === dom) aff = 2;
        else if (domRegion && cuisineRegion(pc) === domRegion) aff = 1;
      }
      return { s, idx, aff };
    })
    .sort((a, b) => (b.aff - a.aff) || (a.idx - b.idx))
    .map((x) => x.s.name)
    .filter((nm) => !bowlSet.has(nm) && nm !== ingredient && nodes.get(nm));
}
