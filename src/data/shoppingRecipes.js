/**
 * shoppingRecipes.js (SHOP-3) — the pure side of "Add from a recipe" and of "Add to shopping list" on the
 * What do I need? panels. No React, no fetch (loadRecipeSources takes its loader as an argument).
 *
 * Finding a recipe: one flat list of ENTRIES over the built-in cocktails, sauces and dishes (the three source
 * files the shared recipe page already loads, never the pairing data) and the cook's own saved cocktails,
 * sauces and recipes. Matching is by NAME only, through ingredientSearch (parseQuery + matchItem, the helper
 * the labs' browse search uses).
 *
 * Which ticks reach the list: addRecipe (SHOP-1) takes a whole recipe. The screen decides line by line (the
 * cook's ticks), then passes `withLines(recipe, tickedLines)`: the same recipe (same id, so "already on the list"
 * and the "for <recipe>" note are right) whose `lines` are only the ticked ones, called with includeBasics
 * true and a `has` that is always false, because the ticks are already the decision. The merge rule is untouched.
 *
 * Recipe ids (the id the list stores in `item.from`): built-in `<kind>:<slug>` (what addRecipe derives itself
 * from a normaliseBuiltIn recipe, so the search and the panels agree), own `own:<cocktail|sauce|recipe>:<id>`.
 */
import { parseQuery, matchItem, normalizeText } from './ingredientSearch.js';
import { addRecipe, canonicalKey, makeHas, recipeIdOf } from './shoppingList.js';
import { fromOwnItem, resolveBuiltIn, slugFor, uniqueBySlug } from './sharedRecipe.js';
import { isBasic } from './myKitchen.js';
import { formatAmount } from './shoppingUnits.js';

export const KIND_LABEL = Object.freeze({ cocktail: 'Cocktail', sauce: 'Sauce', dish: 'Dish' });
const OWN_KINDS = Object.freeze([['cocktails', 'cocktail'], ['sauces', 'sauce'], ['recipes', 'recipe']]);
const PAGE_KIND = Object.freeze({ cocktail: 'cocktail', sauce: 'sauce', recipe: 'dish' });

export const ownRecipeId = (ownKind, id) => `own:${ownKind}:${id}`;

/**
 * The identity a What do I need? panel hands to addRecipe: { kind, slug } for a built-in item, { kind, id, name }
 * for the cook's own. `item` is the codex cocktail / sauce node / dish; `ownKind` ('cocktail'|'sauce'|'recipe')
 * and `ownId` are given only for the cook's own saved item.
 */
export function recipeRefFor(kind, item, { ownKind = null, ownId = null } = {}) {
  const name = item?.name || '';
  if (ownKind && ownId != null) return { kind, id: ownRecipeId(ownKind, ownId), name };
  return { kind, slug: slugFor(kind, item), name };
}

/** @returns {Array<{ id, kind, origin: 'built-in'|'own', name, slug?, ownKind?, item? }>} */
export function buildEntries({ data = null, own = null } = {}) {
  const out = [];
  for (const [kind, list] of [['cocktail', data?.cocktails], ['sauce', data?.sauces], ['dish', data?.dishes]]) {
    for (const item of uniqueBySlug(kind, list || [])) {
      if (!item?.name) continue;
      const slug = slugFor(kind, item);
      out.push({ id: `${kind}:${slug}`, kind, origin: 'built-in', name: item.name, slug });
    }
  }
  for (const [field, ownKind] of OWN_KINDS) {
    for (const item of Array.isArray(own?.[field]) ? own[field] : []) {
      if (!item?.name || item.id == null || !fromOwnItem(ownKind, item)) continue;
      out.push({ id: ownRecipeId(ownKind, item.id), kind: PAGE_KIND[ownKind], origin: 'own', name: item.name, ownKind, item });
    }
  }
  return out;
}

/** The entries whose NAME matches every comma-separated term; exact first, then names that start with the query, then the cook's own, then A-Z. */
export function searchEntries(query, entries, limit = 8) {
  const terms = parseQuery(query);
  if (!terms.length) return [];
  const q = normalizeText(query);
  const scored = [];
  for (const e of entries || []) {
    if (!matchItem({ name: e.name, ingredients: [] }, terms).match) continue;
    const n = normalizeText(e.name);
    const rank = n === q ? 0 : n.startsWith(q) ? 1 : 2;
    scored.push({ e, rank });
  }
  scored.sort((a, b) => a.rank - b.rank
    || (a.e.origin === b.e.origin ? 0 : a.e.origin === 'own' ? -1 : 1)
    || a.e.name.localeCompare(b.e.name));
  return scored.slice(0, limit).map((s) => s.e);
}

/** The normalised recipe for an entry (the same lines the shared page and the card use), carrying the entry's id. null when it does not resolve. */
export function resolveEntry(entry, data) {
  if (!entry) return null;
  const recipe = entry.origin === 'own' ? fromOwnItem(entry.ownKind, entry.item) : resolveBuiltIn(entry.kind, entry.slug, data);
  return recipe ? { ...recipe, id: entry.id } : null;
}

/**
 * Where the cook has an ingredient: a function key -> 'My kitchen' | 'sauce pantry' | 'My bar' | 'spice rack' | null.
 * "Pantry" is everything the cook said they have: My kitchen, the sauce pantry and My bar together. (In this app
 * the sauce pantry is the same saved list as My kitchen, so it is normally empty here and "My kitchen" is named.)
 */
export function makeLocator({ kitchen = [], pantry = [], bar = [], names = null, spiceRack = false } = {}) {
  const sources = [
    ['My kitchen', makeHas({ kitchen, names })],
    ['sauce pantry', makeHas({ pantry, names })],
    ['My bar', makeHas({ bar, names })],
    ['spice rack', makeHas({ spiceRack, names })],
  ];
  return (key) => {
    for (const [label, has] of sources) if (has(key)) return label;
    return null;
  };
}

/**
 * The recipe's lines in three groups, one entry per ingredient (merged by canonical name):
 *   need    not owned, not a basic          (ticked by default)
 *   flavourings  (only when `mainOf` is given: a dish) not owned, not a basic, not a main of the dish; the same
 *           split the Cookbook panel makes, so they start UNTICKED and a tap adds them (SHOP-7)
 *   basics  not owned, a basic (salt, water, pepper, oil…)   (ticked only with "Include basics")
 *   have    owned, with where it was found  (not ticked)
 *   all     every entry in the recipe's own order (what a tick list is read against)
 * Each entry: { id, key, label, amount, where? } — `key` is the canonical name addRecipe will use.
 */
export function classifyLines(recipe, locate, names = null, { mainOf = null } = {}) {
  const out = { need: [], flavourings: [], basics: [], have: [], all: [] };
  const seen = new Set();
  for (const line of recipe?.lines || []) {
    const key = canonicalKey(line?.key, names);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const entry = { id: key, key, label: line.label || line.key, amount: line.amount || '', source: line };
    const where = locate(key);
    out.all.push(where ? { ...entry, where } : entry);
    if (where) out.have.push({ ...entry, where });
    else if (isBasic(key)) out.basics.push(entry);
    else if (mainOf && !mainOf(key)) out.flavourings.push(entry);
    else out.need.push(entry);
  }
  return out;
}

/** The same recipe (same id) with only these lines. `lines` are classifyLines entries or plain { key, amount }. */
export function withLines(recipe, lines) {
  return {
    ...recipe,
    id: recipeIdOf(recipe),
    lines: lines.map((l) => l.source || { key: l.key, amount: l.amount || '' }),
  };
}

/**
 * Run addRecipe for ticked lines. Pure: returns what addRecipe returns, so a caller can look at
 * summary.alreadyOnList before committing.
 */
export function addTicked(list, recipe, ticked, { force = false, names = null, now, newId } = {}) {
  return addRecipe(list, withLines(recipe, ticked), () => false, { includeBasics: true, force, names, now, newId });
}

/**
 * The usage-event payload for one add (usageEvents.shopRecipeAdded), or null when nothing was added or merged.
 * Counts and labels only: the kind, built_in or own, where the add came from, and the two counts. A built-in
 * recipe's slug rides along; an own recipe's id and name never do.
 */
export function shopRecipeUsage(recipe, where, summary) {
  const added = Number(summary?.added) || 0;
  const merged = Number(summary?.merged) || 0;
  if (!added && !merged) return null;
  const own = String(recipe?.id || '').startsWith('own:') || !recipe?.slug;
  return { kind: recipe?.kind, origin: own ? 'own' : 'built_in', slug: own ? undefined : recipe.slug, where, added, merged };
}

const joinList = (xs) => xs.join(', ');
const amountOf = (line, system) => (line.parts ? formatAmount(line.parts, system) : line.now);

/**
 * One or two plain sentences about what an add did. `left` = how many lines were left off because the cook has them.
 * ("Added 2: onion, carrot. Merged into lines already there: garlic: now 5 cloves.")
 */
export function summaryText(name, summary, { left = 0, system, optional = 0 } = {}) {
  const parts = [];
  const { addedLines = [], mergedLines = [] } = summary || {};
  if (addedLines.length) parts.push(`Added ${addedLines.length} for ${name}: ${joinList(addedLines.map((l) => l.label))}.`);
  if (mergedLines.length) {
    parts.push(`Merged into lines already on your list: ${joinList(mergedLines.map((l) => (amountOf(l, system) ? `${l.label}: now ${amountOf(l, system)}` : `${l.label}: already on the list`)))}.`);
  }
  if (!addedLines.length && !mergedLines.length) parts.push(`Nothing was added for ${name}.`);
  if (optional > 0) parts.push(`${optional === 1 ? '1 of those is' : `${optional} of those are`} optional.`);
  if (left > 0) parts.push(`Left off ${left} you already have.`);
  if (summary?.message) parts.push(summary.message);
  return parts.join(' ');
}

/** How many of the lines an add touched (added or merged) are in `optionalKeys` (canonical keys). */
export function countOptional(summary, optionalKeys) {
  const set = optionalKeys instanceof Set ? optionalKeys : new Set(optionalKeys || []);
  return [...(summary?.addedLines || []), ...(summary?.mergedLines || [])].filter((l) => set.has(l.key)).length;
}

export const askAgainText = (name) => `${name} is already on your list. Add it again? It will add to the quantities.`;

let pendingSources = null;
/**
 * What the recipe search loads when it opens: the three recipe source files (cocktail_codex_v2.json,
 * sauce_augment.json, and the bundled dish list with its details). Not the pairings, not the graph, not a model.
 * Cached after the first success; a failure is not cached. `loader(kind)` defaults to sharedLoaders.defaultLoadData.
 */
export function loadRecipeSources(loader = null) {
  if (loader) return Promise.all(['cocktail', 'sauce', 'dish'].map((k) => loader(k))).then((parts) => Object.assign({}, ...parts));
  if (!pendingSources) {
    pendingSources = import('./sharedLoaders.js')
      .then(({ defaultLoadData }) => Promise.all(['cocktail', 'sauce', 'dish'].map((k) => defaultLoadData(k))))
      .then((parts) => Object.assign({}, ...parts), (err) => { pendingSources = null; throw err; });
  }
  return pendingSources;
}

/** For tests. */
export function resetRecipeSources() { pendingSources = null; }
