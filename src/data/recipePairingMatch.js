/**
 * recipePairingMatch.js — rank cocktails / sauces for a recipe by how
 * well their ingredients pair with the recipe's, using the observed
 * co-occurrence pairing graph (RecipeNLG / MealDB / CocktailDB).
 *
 * Replaces the molecular aroma cosine (recipeAromaSimilarity.js) for the
 * "goes well with" matches: the 2026-06-10 investigation found the
 * molecular profile weak at the ingredient level, and on recipes with a
 * same-name sauce this ranker put that sauce in the top 3 for 8 of 9
 * (aroma: 1 of 9).
 *
 * Score for one item = weighted mean, over the item's resolved
 * ingredients, of the best pairing score with any recipe ingredient
 * (1.0 for the same ingredient). Hub ingredients that pair with almost
 * everything (lemon juice, syrup, onion) are down-weighted on both sides
 * by an IDF-style weight, so "syrup ~ onion" can't carry a cocktail.
 *
 * Edge score: `cooccurrence` (the pipeline's `tradition` sub-score — recipe
 * NPMI + frequency + cuisine overlap) when the edge carries it, else the
 * blended `strength`. Measured with scripts/evalPairingMatch.mjs on
 * 2026-11-06: tradition agrees with the Flavor Bible at AUROC 0.63 vs 0.53
 * for strength; with the hub discounts below, 7 of 9 namesake sauces rank
 * first (MRR 0.81; strength: 3 first, MRR 0.60) and no cocktail appears in
 * more than 10 of 49 Cookbook top-8 lists (was 26).
 *
 * Items with few readable ingredients are pulled toward a prior
 * (PRIOR_WEIGHT pseudo-ingredients at PRIOR_SCORE), so a two-ingredient
 * drink can't outscore a five-ingredient one on a single lucky pair.
 */
import { normalizeIngredient } from './normalizeIngredient.js';

// Too generic to say anything about fit — dropped before and after
// resolution so they count neither as matches nor as unresolved.
const TRIVIAL = new Set([
  'water', 'cold water', 'sparkling water', 'ice', 'cubes ice', 'ice cube', 'crushed ice',
  'seltzer', 'cold seltzer', 'club soda', 'soda water', 'soda', 'cola', 'cold cola', 'co2', 'co2 bottle',
  'salt', 'sugar', 'sugar cube', 'cube sugar', 'black pepper', 'pepper', 'pinch of salt', 'pinch pepper',
  'coca cola', 'cola', 'sprite', 'mountain dew', 'surge', 'schweppes russchian', 'lemon lime soda',
  'lactic acid solution', 'phosphoric acid solution', 'salt solution',
]);
// A recipe ingredient with ≤ ~60 partners counts fully; busier hubs
// count proportionally less.
const HUB_DEGREE = 60;
// Shrinkage toward a prior for items with few readable ingredients.
// Exported as a mutable object so scripts/evalPairingMatch.mjs can sweep it.
export const TUNING = {
  priorWeight: 1.0, // in units of one typical ingredient's weight
  priorScore: 0, // pull toward zero: penalize short items, never hand out points
};
// Below this an item is not shown as a match at all (cocktails' 8th-best
// score is usually 0; at 0.1, 38 of 49 Cookbook recipes keep a real match).
export const MIN_MATCH_SCORE = 0.1;
// Below this a shown match is labelled "loose".
export const LOOSE_MATCH_SCORE = 0.2;

// Spirits, liqueurs and a few sauce ingredients that the pairing graph
// spells differently or only has a near relative of. Keys are normalized
// (lower-case, accents stripped, measures removed).
const ALIASES = {
  calvados: 'apple brandy',
  armagnac: 'brandy', 'bas armagnac': 'brandy', singani: 'brandy', grappa: 'brandy',
  'pinot noir grappa': 'brandy', 'pineau des charentes': 'brandy',
  'rhum agricole': 'rum', 'rhum agricole blanc': 'rum', 'aged rhum agricole': 'rum',
  'amburana cachaca': 'cachaca',
  amaro: 'amaro montenegro', 'cacao nib infused amaro': 'amaro montenegro',
  'artichoke based amaro': 'amaro montenegro', 'china china amer': 'amaro montenegro',
  'bitter red aperitif': 'campari', 'americano bianco': 'vermouth',
  'chamomile infused americano aperitif': 'vermouth',
  suze: 'gentian', 'gentian liqueur': 'gentian',
  curacao: 'orange curacao', 'dry curacao': 'orange curacao',
  'creme de cassis': 'blackcurrant', cassis: 'blackcurrant',
  'creme de menthe': 'peppermint schnapp', 'white creme de menthe': 'peppermint schnapp',
  madeira: 'madeira wine', 'rainwater madeira': 'madeira wine',
  cava: 'sparkling wine', chardonnay: 'white wine', 'dry unoaked chardonnay': 'white wine',
  verjus: 'grape juice', 'verjus blanc': 'grape juice',
  'crown royal': 'whiskey', aquavit: 'caraway', orgeat: 'almond syrup', anis: 'anise seed',
  limoncello: 'lemon', 'sweet and sour': 'lemon juice', 'citric acid solution': 'lemon juice',
  cayenne: 'cayenne pepper', jalapeno: 'jalapeno chile', 'aji amarillo': 'chili',
  pancetta: 'bacon', plantain: 'green plantain',
  // Brands and bar shorthand.
  'st germain': 'elderflower cordial', 'st. germain': 'elderflower cordial',
  anisette: 'sambuca', 'jack daniels': 'whiskey', 'bacardi limon': 'rum', 'absolut citron': 'vodka',
  everclear: 'vodka', corona: 'beer', 'guinness stout': 'beer', apfelkorn: 'apple', passoa: 'passion fruit',
  'pisang ambon': 'banana', 'creme de mure': 'blackberry', 'sour mix': 'lemon juice', 'hot damn': 'cinnamon',
  jagermeister: 'amaro montenegro', 'pimms no 1': 'gin', 'pimms': 'gin', strega: 'herbal liqueur',
};

const indexCache = new WeakMap();

/**
 * Build (and cache per edges array) the lookup the ranker needs.
 * Uses only observed pairings (`known: true`) when the edges carry that
 * flag; model-predicted pairings would reintroduce the weak signal.
 * @param {Array<{source,target,strength,known?}>} edges
 * @param {Iterable<string>} names — every ingredient name in the graph
 */
export function buildPairingIndex(edges, names) {
  if (indexCache.has(edges)) return indexCache.get(edges);
  const list = Array.isArray(edges) ? edges : [];
  const hasFlag = list.some((e) => e && 'known' in e);
  const strength = new Map();
  const degree = new Map();
  for (const e of list) {
    if (!e || (hasFlag && e.known !== true)) continue;
    const s = typeof e.cooccurrence === 'number' ? e.cooccurrence
      : (typeof e.strength === 'number' ? e.strength : 0);
    strength.set(`${e.source}|${e.target}`, s);
    strength.set(`${e.target}|${e.source}`, s);
    degree.set(e.source, (degree.get(e.source) || 0) + 1);
    degree.set(e.target, (degree.get(e.target) || 0) + 1);
  }
  const nameSet = new Set(names || []);
  const index = { strength, degree, names: nameSet, nodeCount: Math.max(nameSet.size, 1) };
  indexCache.set(edges, index);
  return index;
}

function idf(index, name) {
  return Math.log(1 + index.nodeCount / (1 + (index.degree.get(name) || 0)));
}

function singular(word, names) {
  if (word.endsWith('es') && names.has(word.slice(0, -2))) return word.slice(0, -2);
  if (word.endsWith('s') && names.has(word.slice(0, -1))) return word.slice(0, -1);
  return word;
}

/**
 * Map a free-text ingredient ("2 oz London dry gin", "Peychaud’s bitters")
 * to a graph ingredient name, or null. Tries the cleaned string, then its
 * word n-grams from the end ("london dry gin" → "dry gin" → "gin").
 */
function stripAccents(raw) {
  return String(raw ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function resolveIngredientName(raw, names) {
  const clean = stripAccents(raw).replace(/-/g, ' ');
  // normalizeIngredient cuts at the first comma ("gin, London dry"); a
  // leading adjective ("dark, robust maple syrup") would lose the noun, so
  // try the comma-free form as well.
  // Measure-stripped but otherwise untouched form first: normalizeIngredient
  // drops stop words, and "half and half" is nothing but stop words.
  const bare = clean.toLowerCase()
    .replace(/^[0-9¼½¾⅓⅔⅛⅜⅝⅞][0-9¼½¾⅓⅔⅛⅜⅝⅞.\s/()]*\s*(ounces?|oz|dashes?|drops?|teaspoons?|tablespoons?|tsp|tbsp|parts?|cups?|cl|ml)?\s*/, '')
    .replace(/\s+/g, ' ').trim();
  if (bare && names.has(bare)) return bare;
  if (bare && ALIASES[bare] && names.has(ALIASES[bare])) return ALIASES[bare];
  const forms = [...new Set([normalizeIngredient(clean), normalizeIngredient(clean.replace(/,/g, ' '))].filter(Boolean))];
  for (const n of forms) {
    if (TRIVIAL.has(n)) return null;
    if (names.has(n)) return n;
    if (ALIASES[n] && names.has(ALIASES[n])) return ALIASES[n];
    const words = n.split(' ').map((w) => singular(w, names));
    for (let len = Math.min(3, words.length); len >= 1; len--) {
      for (let i = words.length - len; i >= 0; i--) {
        const cand = words.slice(i, i + len).join(' ');
        if (names.has(cand)) return cand;
        if (ALIASES[cand] && names.has(ALIASES[cand])) return ALIASES[cand];
      }
    }
  }
  return null;
}

/** True for ice, soda, water and the like — ignored on both sides. */
export function isTrivialIngredient(raw) {
  const n = normalizeIngredient(stripAccents(raw));
  return !n || TRIVIAL.has(n);
}

/**
 * Score one item against a recipe.
 * @returns {{ score: number, pairedVia: Array<{ item: string, recipe: string }> } | null}
 *   null when fewer than 2 of the item's ingredients resolve.
 */
export function scoreItemForRecipe(recipeIngredients, itemIngredients, index) {
  const recipe = (recipeIngredients || []).filter((r) => index.names.has(r) && !TRIVIAL.has(r));
  if (recipe.length === 0) return null;
  const mapped = (itemIngredients || []).filter((i) => i && !isTrivialIngredient(i))
    .map((i) => resolveIngredientName(i, index.names));
  const resolved = [...new Set(mapped.filter((i) => i && !TRIVIAL.has(i)))];
  if (resolved.length < 2) return null;
  // Share of the item's (non-trivial) ingredients we could read. An item
  // judged on a sliver of its recipe — "Normandie Club Bloody Mary" read as
  // just lemon + lime juice, its aquavit and mix unmatched — would otherwise
  // pair with every savoury dish. The score is scaled by this share.
  const unresolved = mapped.filter((i) => !i).length;
  const coverage = resolved.length / (resolved.length + unresolved);

  const hubRef = Math.log(1 + index.nodeCount / (1 + HUB_DEGREE));
  let sum = 0;
  let wsum = 0;
  const links = [];
  for (const ing of resolved) {
    let best = 0;
    let bestRecipe = null;
    // Hub discount on both sides: a drink made only of bitters + lime juice
    // links to half the cookbook, which says nothing about this dish.
    const itemHub = Math.min(1, idf(index, ing) / hubRef);
    for (const r of recipe) {
      const v = ing === r
        ? 1
        : (index.strength.get(`${ing}|${r}`) || 0) * Math.min(1, idf(index, r) / hubRef) * itemHub;
      if (v > best) { best = v; bestRecipe = r; }
    }
    const w = idf(index, ing);
    sum += w * best;
    wsum += w;
    if (best > 0) links.push({ item: ing, recipe: bestRecipe, weight: w * best });
  }
  links.sort((a, b) => b.weight - a.weight);
  const k = TUNING.priorWeight * hubRef;
  const shrunk = (sum + k * TUNING.priorScore) / (wsum + k);
  return {
    score: wsum > 0 ? shrunk * coverage : 0,
    pairedVia: links.slice(0, 3).map(({ item, recipe: r }) => ({ item, recipe: r })),
  };
}

/**
 * Rank items ({ name, ingredients: string[] }) for a recipe.
 * Result shape matches rankByAromaSimilarity so the lab match views keep
 * working: { item, similarity, matchedAromas: [], pairedVia }.
 */
export function rankByPairing(recipeIngredients, items, index, topN = 8, minScore = MIN_MATCH_SCORE) {
  return (items || [])
    .map((item) => {
      const s = scoreItemForRecipe(recipeIngredients, item?.ingredients, index);
      return s && s.score >= minScore ? { item, similarity: s.score, matchedAromas: [], pairedVia: s.pairedVia } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);
}

/** Badge text for a match score; weak ones say so instead of quoting a low percent. */
export function formatMatchBadge(similarity) {
  if (typeof similarity !== 'number' || similarity < LOOSE_MATCH_SCORE) return 'loose match';
  return `${Math.round(similarity * 100)}% match`;
}

/** "red wine ↔ red wine" reads oddly; same-ingredient links say "shares X". */
export function formatPairedVia({ item, recipe }) {
  return item === recipe ? `shares ${item}` : `${item} + ${recipe}`;
}
