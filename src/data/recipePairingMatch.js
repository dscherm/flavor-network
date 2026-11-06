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
 * ingredients, of the best pairing strength with any recipe ingredient
 * (1.0 for the same ingredient). Hub ingredients that pair with almost
 * everything (lemon juice, syrup, onion) are down-weighted on both sides
 * by an IDF-style weight, so "syrup ~ onion" can't carry a cocktail.
 */
import { normalizeIngredient } from './normalizeIngredient.js';

// Too generic to say anything about fit.
const TRIVIAL = new Set(['water', 'ice', 'salt', 'sugar', 'black pepper', 'pepper', 'soda water']);
// A recipe ingredient with ≤ ~60 partners counts fully; busier hubs
// count proportionally less.
const HUB_DEGREE = 60;

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
    const s = typeof e.strength === 'number' ? e.strength : 0;
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
export function resolveIngredientName(raw, names) {
  const n = normalizeIngredient(raw);
  if (!n) return null;
  if (names.has(n)) return n;
  const words = n.split(' ').map((w) => singular(w, names));
  for (let len = Math.min(3, words.length); len >= 1; len--) {
    for (let i = words.length - len; i >= 0; i--) {
      const cand = words.slice(i, i + len).join(' ');
      if (names.has(cand)) return cand;
    }
  }
  return null;
}

/**
 * Score one item against a recipe.
 * @returns {{ score: number, pairedVia: Array<{ item: string, recipe: string }> } | null}
 *   null when fewer than 2 of the item's ingredients resolve.
 */
export function scoreItemForRecipe(recipeIngredients, itemIngredients, index) {
  const recipe = (recipeIngredients || []).filter((r) => index.names.has(r) && !TRIVIAL.has(r));
  if (recipe.length === 0) return null;
  const resolved = [...new Set((itemIngredients || [])
    .map((i) => resolveIngredientName(i, index.names))
    .filter((i) => i && !TRIVIAL.has(i)))];
  if (resolved.length < 2) return null;

  const hubRef = Math.log(1 + index.nodeCount / (1 + HUB_DEGREE));
  let sum = 0;
  let wsum = 0;
  const links = [];
  for (const ing of resolved) {
    let best = 0;
    let bestRecipe = null;
    for (const r of recipe) {
      const v = ing === r
        ? 1
        : (index.strength.get(`${ing}|${r}`) || 0) * Math.min(1, idf(index, r) / hubRef);
      if (v > best) { best = v; bestRecipe = r; }
    }
    const w = idf(index, ing);
    sum += w * best;
    wsum += w;
    if (best > 0) links.push({ item: ing, recipe: bestRecipe, weight: w * best });
  }
  links.sort((a, b) => b.weight - a.weight);
  return {
    score: wsum > 0 ? sum / wsum : 0,
    pairedVia: links.slice(0, 3).map(({ item, recipe: r }) => ({ item, recipe: r })),
  };
}

/**
 * Rank items ({ name, ingredients: string[] }) for a recipe.
 * Result shape matches rankByAromaSimilarity so the lab match views keep
 * working: { item, similarity, matchedAromas: [], pairedVia }.
 */
export function rankByPairing(recipeIngredients, items, index, topN = 8) {
  return (items || [])
    .map((item) => {
      const s = scoreItemForRecipe(recipeIngredients, item?.ingredients, index);
      return s ? { item, similarity: s.score, matchedAromas: [], pairedVia: s.pairedVia } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);
}

/** "red wine ↔ red wine" reads oddly; same-ingredient links say "shares X". */
export function formatPairedVia({ item, recipe }) {
  return item === recipe ? `shares ${item}` : `${item} + ${recipe}`;
}
