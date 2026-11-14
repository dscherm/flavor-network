/**
 * inventSearch.js — "✨ Invent this": turn whatever is in a lab's search box
 * into the `seed` of that lab's Invent panel (pure; no React, no fetch).
 *
 * A search is comma-separated terms (ingredientSearch.parseQuery, the same
 * parser the browse lists use). Each term is one of
 *   - a recipe NAME ("negroni", "old fashioned", "hollandaise"): it becomes the
 *     baseline, the recipe's own lines are pinned;
 *   - an INGREDIENT ("gin", "cucumber"): pinned into the first slot that takes it;
 *   - UNKNOWN (no known ingredient, no recipe): never dropped, pinned as typed.
 *
 * Name vs ingredient, in order:
 *   1. the term equals a recipe name after normalizeText (case, accents,
 *      punctuation) → NAME, even if it is also an ingredient;
 *   2. the lab's key function resolves it to a KNOWN ingredient → INGREDIENT
 *      (so "gin" stays gin although "Gin Fizz" exists);
 *   3. else a near match: 4+ letters, every term word is a word of the recipe
 *      name (the last may be a prefix: "old fash", "negron"), and exactly one
 *      recipe fits (or exactly one has the term as the start of its name) → NAME;
 *   4. else UNKNOWN.
 *
 * Baselines: a name gives that recipe's family / style / dish type with its
 * lines pinned. Ingredients alone use the browse page's active chip when set,
 * else the skeleton that locks the most pins in distinct slots (a dry
 * rankCategories), ties going to the panel's display order / the most common style.
 *
 * Seeds (all pins are { key, source: 'search' }; an empty query gives null):
 *   cocktail { familyId, base?, pinned }   sauce { styleId, protein?, pinned }
 *   recipe   { type, main?, cuisine?, pinned }   (type = a DISH_SKELETONS id)
 * Each fromSearch function returns { seed, summary, parsed } | null.
 */
import { parseQuery, normalizeText } from './ingredientSearch.js';
import { rankCategories } from './inventBuild.js';
import { cocktailSkeleton, isBaseSpirit, FAMILY_SKELETONS, INVENT_FAMILY_ORDER } from './cocktailInvent.js';
import { riffRows } from './cocktailRiff.js';
import { barKey } from './myBar.js';
import { isTrivialIngredient, resolveIngredientName } from './recipePairingMatch.js';
import { INVENT_STYLES, sauceSkeleton, proteinVocabulary } from './inventSauce.js';
import { kitchenKey } from './myKitchen.js';
import { DISH_SKELETONS, dishTypeForIngredients, isMainKey } from './dishSkeletons.js';
import { dishTypeOf } from './dishType.js';
import { splitRecipe, categoryLookup } from './recipeMains.js';

const lower = (s) => String(s ?? '').toLowerCase().trim();
const pins = (keys) => keys.map((key) => ({ key, source: 'search' }));
const withArticle = (label) => `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`;
const uniq = (list) => [...new Set(list)];
const phrase = (keys) => keys.join(' + ');
const joinWords = (list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0] || '');

function singularWord(w) {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** Recipe names a not-otherwise-known term could be a partial typing of. */
function nearNames(term, entries) {
  if (term.length < 4) return [];
  const tw = term.split(' ').map(singularWord);
  const hits = entries.filter(({ norm }) => {
    const nw = norm.split(' ').map(singularWord);
    return tw.every((w, i) => nw.includes(w) || (i === tw.length - 1 && w.length >= 4 && nw.some((x) => x.startsWith(w))));
  });
  if (hits.length <= 1) return hits;
  return hits.filter(({ norm }) => norm.startsWith(term));
}

/**
 * Classify a search into recipe names, ingredient keys and unknown text.
 * @param {string} query
 * @param {{ recipeNames?: string[], toKey?: (text)=>string, isKnown?: (key)=>boolean }} opts
 *   toKey: the lab's key function (barKey / kitchenKey); isKnown: does that key
 *   name a real ingredient (default: every key does).
 * @returns {{ names: string[], ingredients: string[], unknown: string[],
 *             terms: Array<{ text, kind: 'name'|'ingredient'|'unknown', name?, key? }> }}
 *   `terms` keeps the typed order; `unknown` holds typed text, never dropped.
 */
export function parseSearchForInvent(query, { recipeNames = [], toKey = normalizeText, isKnown = () => true } = {}) {
  const entries = [];
  const byNorm = new Map();
  for (const name of recipeNames || []) {
    const norm = normalizeText(name);
    if (norm && !byNorm.has(norm)) { byNorm.set(norm, name); entries.push({ norm, name }); }
  }
  const terms = [];
  const seen = new Set();
  for (const text of parseQuery(query)) {
    if (seen.has(text)) continue;
    seen.add(text);
    if (byNorm.has(text)) { terms.push({ text, kind: 'name', name: byNorm.get(text) }); continue; }
    const key = lower(toKey(text));
    if (key && isKnown(key)) { terms.push({ text, kind: 'ingredient', key }); continue; }
    const near = nearNames(text, entries);
    if (near.length === 1) { terms.push({ text, kind: 'name', name: near[0].name }); continue; }
    terms.push({ text, kind: 'unknown', key: key || text });
  }
  return {
    names: terms.filter((t) => t.kind === 'name').map((t) => t.name),
    ingredients: terms.filter((t) => t.kind === 'ingredient').map((t) => t.key),
    unknown: terms.filter((t) => t.kind === 'unknown').map((t) => t.text),
    terms,
  };
}

/** The typed terms other than the first recipe name; a second name is kept as free text. */
function typedTerms(parsed) {
  let nameSeen = false;
  const out = [];
  for (const t of parsed.terms) {
    if (t.kind === 'name') {
      if (nameSeen) out.push({ text: t.text, kind: 'unknown', key: lower(t.text) });
      nameSeen = true;
    } else out.push(t);
  }
  return out;
}

/** The candidate whose skeleton places the most keys in distinct slots (inventBuild.rankCategories); ties go to the heavier, then earlier one. */
function bestFit(candidates, keys) {
  const ranked = rankCategories(keys, candidates.map(({ id, skeleton }) => ({ id, skeleton })), {
    order: [...candidates].sort((a, b) => (b.weight || 0) - (a.weight || 0)).map((c) => c.id),
  });
  return ranked.length ? ranked[0].id : null;
}

// ---------------------------------------------------------------- cocktail
function bestCocktailFamily(keys, roles, filterFamily) {
  if (filterFamily != null && FAMILY_SKELETONS[filterFamily]) return filterFamily;
  return bestFit(INVENT_FAMILY_ORDER.map((id) => ({ id, skeleton: cocktailSkeleton(id, { roles }) })), keys);
}

/**
 * @param {string} query
 * @param {{ cocktails: object[], roles?: object, names?: Set<string>, filterFamily?: number|null, filterSpirit?: string|null }} ctx
 *   cocktails = codex cocktails (name, family_id, ingredients_raw); roles =
 *   cocktail_roles byIngredient; names = pairing-graph names; the two filters
 *   are the Cocktail Lab's active chips.
 * @returns {{ seed: { familyId, base?, pinned }, summary: string, parsed } | null}
 */
export function cocktailSeedFromSearch(query, { cocktails = [], roles = {}, names = new Set(), filterFamily = null, filterSpirit = null } = {}) {
  const parsed = parseSearchForInvent(query, {
    recipeNames: (cocktails || []).map((c) => c.name),
    toKey: (t) => barKey(t, names),
    isKnown: names.size ? (k) => names.has(k) || !!roles[k] : undefined,
  });
  if (!parsed.terms.length) return null;
  const typed = typedTerms(parsed);
  const typedPins = uniq(typed.map((t) => t.key));
  const typedSpirit = typedPins.find((k) => isBaseSpirit(k, roles)) || null;
  const nameTerm = parsed.terms.find((t) => t.kind === 'name');
  const cocktail = nameTerm ? cocktails.find((c) => c.name === nameTerm.name) : null;

  if (cocktail) {
    const lines = uniq(riffRows(cocktail, roles, names)
      .filter((r) => r.swappable && !isTrivialIngredient(r.raw))
      .map((r) => barKey(r.raw, names) || r.key));
    const own = lines.filter((k) => isBaseSpirit(k, roles));
    const base = typedSpirit || own[0] || null;
    // One base spirit: a typed one replaces the recipe's, and a recipe with two keeps its first.
    const kept = lines.filter((k) => !isBaseSpirit(k, roles) || (!typedSpirit && k === own[0]));
    const pinned = uniq([...(typedSpirit ? [typedSpirit] : []), ...kept, ...typedPins]);
    const familyId = FAMILY_SKELETONS[cocktail.family_id] ? cocktail.family_id : bestCocktailFamily(pinned, roles, filterFamily);
    return {
      seed: { familyId, ...(base ? { base } : {}), pinned: pins(pinned) },
      summary: `${withArticle(cocktail.name)}${typedPins.length ? ` with ${joinWords(typedPins)}` : ''}`,
      parsed,
    };
  }

  let base = typedSpirit;
  if (!base && filterSpirit) {
    const k = barKey(filterSpirit, names);
    if (k && isBaseSpirit(k, roles)) base = k;
  }
  const ordered = uniq([...(typedSpirit ? [typedSpirit] : []), ...typedPins]);
  return {
    seed: { familyId: bestCocktailFamily(ordered, roles, filterFamily), ...(base ? { base } : {}), pinned: pins(ordered) },
    summary: phrase(ordered),
    parsed,
  };
}

// ------------------------------------------------------------------- sauce
const SAUCE_TRIVIAL = /^(salt|water|ice|black pepper|white pepper|pepper)$/;
const STYLE_BY_FAMILY = new Map(INVENT_STYLES.map((s) => [s.familyId, s]));
const STYLE_BY_ID = new Map(INVENT_STYLES.map((s) => [s.id, s]));

function sauceFamilyId(sauce) {
  if (Number.isInteger(sauce?.family_id)) return sauce.family_id;
  const style = STYLE_BY_ID.get(sauce?.motherSauce);
  return style ? style.familyId : null;
}
const sauceIngredientNames = (sauce) => (sauce?.ingredients || []).map((i) => lower(typeof i === 'string' ? i : i?.name)).filter(Boolean);

/** A typed word that names a protein of the sauce list ("chicken", "fish" → "white fish"); eggs stay an ingredient. */
function proteinFor(text, vocab) {
  const t = normalizeText(text);
  if (!t || /^eggs?$/.test(t)) return null;
  const sing = (s) => s.replace(/s$/, '');
  const exact = vocab.find((p) => normalizeText(p) === t || sing(normalizeText(p)) === sing(t));
  if (exact) return exact;
  const part = vocab.filter((p) => normalizeText(p).split(' ').includes(t));
  return part.length === 1 ? part[0] : null;
}

function bestSauceStyle(keys, sauces, catMap, filterFamily, filterCuisine) {
  const chip = STYLE_BY_FAMILY.get(filterFamily);
  if (chip) return chip.id;
  const inCuisine = filterCuisine ? (sauces || []).filter((s) => s.cuisine === filterCuisine) : [];
  const allowed = inCuisine.length ? new Set(inCuisine.map(sauceFamilyId)) : null;
  const counts = new Map();
  for (const s of sauces || []) counts.set(sauceFamilyId(s), (counts.get(sauceFamilyId(s)) || 0) + 1);
  const styles = INVENT_STYLES.filter((s) => !allowed || allowed.has(s.familyId));
  return bestFit(
    (styles.length ? styles : INVENT_STYLES).map((s) => ({ id: s.id, skeleton: sauceSkeleton(s.id, { catMap }), weight: counts.get(s.familyId) || 0 })),
    keys,
  );
}

/**
 * @param {string} query
 * @param {{ sauces: object[], catMap?: Map, names?: Set<string>, filterFamily?: number|null, filterCuisine?: string|null }} ctx
 *   sauces = the Sauce Lab's sauce nodes (name, ingredients, family_id, cuisine, proteins);
 *   catMap / names = what the Sauce Lab hands InventSauce (pantryCtx.catMap / catalogueNames).
 * @returns {{ seed: { styleId, protein?, pinned }, summary: string, parsed } | null}
 */
export function sauceSeedFromSearch(query, { sauces = [], catMap = null, names = new Set(), filterFamily = null, filterCuisine = null } = {}) {
  const vocab = proteinVocabulary(sauces);
  // A protein word is never a half-typed sauce name ("chicken" is not a chicken gravy).
  const parsed = parseSearchForInvent(query, {
    recipeNames: (sauces || []).map((s) => s.name),
    toKey: (t) => kitchenKey(t, names),
    isKnown: names.size ? (k) => names.has(k) || !!proteinFor(k, vocab) : undefined,
  });
  if (!parsed.terms.length) return null;
  let protein = null;
  const typed = [];
  for (const t of typedTerms(parsed)) {
    const p = protein ? null : proteinFor(t.text, vocab);
    if (p) protein = p; else typed.push(t);
  }
  const typedPins = uniq(typed.map((t) => t.key));
  const nameTerm = parsed.terms.find((t) => t.kind === 'name');
  const sauce = nameTerm ? sauces.find((s) => s.name === nameTerm.name) : null;
  const tail = protein ? ` for ${protein}` : '';

  if (sauce) {
    const own = sauceIngredientNames(sauce).filter((k) => !SAUCE_TRIVIAL.test(k));
    const pinned = uniq([...own, ...typedPins]);
    const family = STYLE_BY_FAMILY.get(sauceFamilyId(sauce));
    const styleId = family ? family.id : bestSauceStyle(pinned, sauces, catMap, filterFamily, filterCuisine);
    return {
      seed: { styleId, fromName: true, ...(protein ? { protein } : {}), pinned: pins(pinned) },
      summary: `${withArticle(sauce.name)}${typedPins.length ? ` with ${joinWords(typedPins)}` : ''}${tail}`,
      parsed,
    };
  }
  return {
    seed: { styleId: bestSauceStyle(typedPins, sauces, catMap, filterFamily, filterCuisine), ...(protein ? { protein } : {}), pinned: pins(typedPins) },
    summary: `${phrase(typedPins) || 'a sauce'}${tail}`,
    parsed,
  };
}

// ------------------------------------------------------------------ recipe
// DishArt type → skeleton id straight from each skeleton; the rest by nearest kin, else by what the ingredients fit.
const SKELETON_BY_DISH_TYPE = new Map(Object.values(DISH_SKELETONS).map((d) => [d.dishType, d.id]));
const NEAREST_SKELETON = { curry: 'braise-stew', noodles: 'stir-fry', fish: 'roast', wrap: 'tacos' };
const RECIPE_TRIVIAL = /^(salt|water|ice|black pepper|white pepper|pepper|(\w+ )?oil)$/;

function skeletonForRecipe(recipe, keys, nodes) {
  const dt = dishTypeOf(recipe);
  return SKELETON_BY_DISH_TYPE.get(dt) || NEAREST_SKELETON[dt] || dishTypeForIngredients(keys, { nodes });
}

/**
 * @param {string} query
 * @param {{ recipes: object[], nodes?: Map, names?: Set<string>, filterCuisine?: string|null }} ctx
 *   recipes = Cookbook recipes (name, ingredients[], cuisine?, cluster?); nodes = graph
 *   nodes (name → { category }); names defaults to the node names.
 *   `main` is NOT repeated in `pinned` (the panel puts it in the main slot itself).
 * @returns {{ seed: { type, main?, cuisine?, pinned }, summary: string, parsed } | null}
 */
export function recipeSeedFromSearch(query, { recipes = [], nodes = null, names = null, filterCuisine = null } = {}) {
  const known = names || new Set(nodes && typeof nodes.keys === 'function' ? nodes.keys() : []);
  const parsed = parseSearchForInvent(query, {
    recipeNames: (recipes || []).map((r) => r.name),
    toKey: (t) => kitchenKey(t, known),
    isKnown: known.size ? (k) => known.has(k) : undefined,
  });
  if (!parsed.terms.length) return null;
  const typedPins = uniq(typedTerms(parsed).map((t) => t.key));
  const nameTerm = parsed.terms.find((t) => t.kind === 'name');
  const recipe = nameTerm ? recipes.find((r) => r.name === nameTerm.name) : null;
  const cuisine = (recipe && recipe.cuisine) || filterCuisine || null;

  if (recipe) {
    const split = splitRecipe(recipe, { categoryOf: categoryLookup(nodes), resolve: (n) => resolveIngredientName(n, known) });
    const mains = uniq(split.main.map((n) => kitchenKey(n, known)).filter((k) => k && !RECIPE_TRIVIAL.test(k)));
    const all = uniq((recipe.ingredients || []).map((n) => kitchenKey(typeof n === 'string' ? n : n?.name, known)).filter(Boolean));
    const type = skeletonForRecipe(recipe, [...all, ...typedPins], nodes);
    const main = mains.find((k) => isMainKey(k, nodes)) || mains[0] || null;
    const rest = uniq([...mains, ...typedPins]).filter((k) => k !== main);
    return {
      seed: { type, ...(main ? { main } : {}), ...(cuisine ? { cuisine } : {}), pinned: pins(rest) },
      summary: `a dish like ${recipe.name}${typedPins.length ? ` with ${joinWords(typedPins)}` : ''}`,
      parsed,
    };
  }

  const type = dishTypeForIngredients(typedPins, { nodes });
  const main = typedPins.find((k) => isMainKey(k, nodes)) || null;
  return {
    seed: { type, ...(main ? { main } : {}), ...(cuisine ? { cuisine } : {}), pinned: pins(typedPins.filter((k) => k !== main)) },
    summary: phrase(typedPins),
    parsed,
  };
}
