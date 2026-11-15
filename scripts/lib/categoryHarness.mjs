// DATA-4. The before/after behaviour harness for the category scheme change.
//
// computeSnapshot() runs, over the REAL data (curated ingredients, curated pairings, the codex, the sauce
// catalogue, the Cookbook), every code path that reads an ingredient's `category`, and records what each
// one returns. The snapshot taken before DATA-4 is committed as
// src/data/__tests__/fixtures/categoryBehaviour.before.json; src/data/__tests__/categoryScheme.test.js
// recomputes it and fails on any difference that is not listed there as intended and explained.
//
//   node scripts/snapshotCategoryBehaviour.mjs     writes the fixture (only ever run on the pre-change tree)
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCurationTables, applyCuration } from './curationTables.mjs';
import * as m_data_recipePairingMatch from '../../src/data/recipePairingMatch.js';
import * as m_data_dishSkeletons from '../../src/data/dishSkeletons.js';
import * as m_data_cocktailInvent from '../../src/data/cocktailInvent.js';
import * as m_data_cocktailRiff from '../../src/data/cocktailRiff.js';
import * as m_data_inventSauce from '../../src/data/inventSauce.js';
import * as m_data_saucePantry from '../../src/data/saucePantry.js';
import * as m_data_myBar from '../../src/data/myBar.js';
import * as m_data_seedRecipes from '../../src/data/seedRecipes.js';
import * as m_data_inventRecipe from '../../src/data/inventRecipe.js';
import * as m_data_recipeMains from '../../src/data/recipeMains.js';
import * as m_data_dietaryFilters from '../../src/data/dietaryFilters.js';
import * as m_ml_kitchenUnits from '../../src/ml/kitchenUnits.js';
import * as m_data_categoricalAxes from '../../src/data/categoricalAxes.js';
import * as m_data_seasoningRecommendation from '../../src/data/seasoningRecommendation.js';
import * as m_data_notebookStarters from '../../src/data/notebookStarters.js';
import * as m_data_structureScoring from '../../src/data/structureScoring.js';
import * as m_data_winePairing from '../../src/data/winePairing.js';
import * as m_data_seedRecipeDetails from '../../src/data/seedRecipeDetails.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));

const sortedUniq = (a) => [...new Set(a)].sort();

export async function computeSnapshot() {
  const raw = readJson('public/proDataset/ingredients.json');
  const rawPairs = readJson('public/proDataset/pairings.json');
  const cur = applyCuration(raw, rawPairs, loadCurationTables());
  const nodes = new Map(Object.entries(cur.ingredients).filter(([k]) => !k.startsWith('_')));
  const names = [...nodes.keys()].sort();
  const edges = cur.pairings.map((p) => ({ source: p.ingredientA, target: p.ingredientB, strength: p.strength, cooccurrence: p.tradition, known: p.known === true }));

  const { buildPairingIndex } = m_data_recipePairingMatch;
  const pairingIndex = buildPairingIndex(edges, nodes.keys());
  const snap = {};

  // 0. how many ingredients per category (the report's before/after table)
  const counts = {};
  for (const [, v] of nodes) counts[v.category || '(none)'] = (counts[v.category || '(none)'] || 0) + 1;
  snap.categoryCounts = Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));

  // 1. Dish kinds (dishSkeletons.KINDS): which names each kind accepts, with the real category
  const ds = m_data_dishSkeletons;
  snap.dishKinds = {};
  for (const [kind, fn] of Object.entries(ds.KINDS)) {
    snap.dishKinds[kind] = names.filter((n) => fn(n.toLowerCase(), nodes.get(n)?.category));
  }

  // 2. Dish slot shortlists: every type x slot x three builds, top 8
  snap.dishShortlists = {};
  for (const typeId of ds.DISH_SKELETON_ORDER) {
    const sk = ds.dishSkeleton(typeId, { nodes });
    for (const slot of [...sk.slots, null]) {
      for (const build of [[], ['chicken'], ['tofu']]) {
        const r = ds.rankDishSlot({ slot, currentKeys: build, kitchen: [], nodes, pairingIndex });
        snap.dishShortlists[`${typeId}/${slot ? slot.id : '*'}/${build.join('+') || '-'}`] = r.slice(0, 8).map((c) => c.key);
      }
    }
  }

  // 3. Cocktail slot shortlists: every family x slot x four builds, top 8
  const ci = m_data_cocktailInvent;
  const { buildRolePool } = m_data_cocktailRiff;
  const roles = readJson('public/data/cocktail_roles.json').byIngredient;
  const rolePool = buildRolePool(roles, new Set(nodes.keys()));
  snap.cocktailShortlists = {};
  for (const fam of ci.INVENT_FAMILY_ORDER) {
    const sk = ci.cocktailSkeleton(fam, { roles });
    for (const slot of [...sk.slots, null]) {
      for (const build of [[], ['bourbon'], ['gin'], ['rum']]) {
        const r = ci.rankCocktailSlot({ slot, currentKeys: build, bar: [], pool: rolePool, roles, pairingIndex });
        snap.cocktailShortlists[`${fam}/${slot ? slot.id : '*'}/${build.join('+') || '-'}`] = r.slice(0, 8).map((c) => c.key);
      }
    }
  }

  // 4. Sauce slot shortlists: every style x slot x two builds, top 8
  const is = m_data_inventSauce;
  const sp = m_data_saucePantry;
  const augment = readJson('public/data/sauce_augment.json');
  const catMap = sp.buildCategoryMap(augment.ingredients);
  const pool = is.buildSaucePool(augment.ingredients, augment.sauces.map((s) => ({ ...s, ingredients: s.ingredients.map((i) => i.name) })));
  const kitchen = ['butter', 'flour', 'milk', 'onion', 'garlic', 'tomato', 'chicken stock', 'lemon juice', 'olive oil', 'cream', 'white wine', 'soy sauce', 'parmesan'];
  snap.sauceShortlists = {};
  for (const style of is.INVENT_STYLES) {
    for (const slot of [...is.sauceSkeleton(style.id, { catMap }).slots, null]) {
      for (const build of [['butter'], ['tomato']]) {
        const r = is.rankSauceSlot({ slot, currentKeys: build, kitchen, pool, catMap });
        snap.sauceShortlists[`${style.id}/${slot ? slot.id : '*'}/${build.join('+')}`] = r.slice(0, 8).map((c) => c.key);
      }
    }
  }

  // 5. My bar: every bottle name the cocktail data knows, recognised or not
  const mb = m_data_myBar;
  const nameSet = new Set(nodes.keys());
  snap.bar = {};
  for (const raw0 of Object.keys(roles).sort()) {
    const key = mb.barKey(raw0, nameSet);
    snap.bar[raw0] = `${key}|${mb.isBooze(key, roles) ? 'booze' : 'not'}`;
  }
  snap.boozeByName = names.filter((n) => mb.isBooze(n, roles));

  // 6. Recipe roles and mains over every Cookbook recipe
  const { SEED_RECIPES } = m_data_seedRecipes;
  const ir = m_data_inventRecipe;
  const rm = m_data_recipeMains;
  const nameOf = (i) => (typeof i === 'string' ? i : i?.name);
  snap.recipeRoles = {};
  snap.recipeMains = {};
  for (const r of SEED_RECIPES) {
    const ns = (r.ingredients || []).map(nameOf).filter(Boolean);
    snap.recipeRoles[r.id] = ir.recipeRoles(ns, { nodes });
    snap.recipeMains[r.id] = rm.splitRecipe(r, { categoryOf: rm.categoryLookup(nodes) }).main;
  }
  snap.mainNames = names.filter((n) => rm.ingredientClass(n, { category: nodes.get(n)?.category }) === 'main');

  // 7. Dietary filters: who each restriction rules out
  const df = m_data_dietaryFilters;
  snap.dietaryBlocked = {};
  for (const r of df.DIETARY_RESTRICTIONS) snap.dietaryBlocked[r] = names.filter((n) => !df.isAllowedUnder(r, n, nodes.get(n)));

  // 8. Quantity units: the dimension a category implies
  const ku = m_ml_kitchenUnits;
  snap.unitDimension = {};
  for (const n of names) {
    const d = ku.CATEGORY_DEFAULT_DIMENSION[nodes.get(n)?.category] || '(none)';
    (snap.unitDimension[d] ||= []).push(n);
  }

  // 9. Family wheel bucket, seasoning pool, starters, structure templates
  const ca = m_data_categoricalAxes;
  snap.familyBucket = {};
  for (const n of names) {
    const b = ca.bucketOf('family', nodes.get(n), {}) ?? '(none)';
    (snap.familyBucket[b] ||= []).push(n);
  }
  const sr = m_data_seasoningRecommendation;
  snap.seasoningPool = sortedUniq(sr.deriveSeasoningPool(nodes));
  const ns = m_data_notebookStarters;
  snap.starters = ns.pickStarterIngredients([...nodes].map(([name, v]) => ({ ...v, name, pairingCount: v.totalCount })), 10).map((p) => `${p.category}:${p.name}`);
  const ss = m_data_structureScoring;
  snap.structures = {};
  const sets = [['parmesan', 'butter', 'flour', 'milk'], ['bourbon', 'lemon juice', 'sugar'], ['soy sauce', 'garlic', 'ginger'],
    ['gin', 'sweet vermouth', 'campari'], ['white wine', 'butter', 'shallot'], ['orange juice', 'vodka', 'cranberry juice']];
  for (const set of sets) {
    for (const mode of ['cocktail', 'sauce']) {
      snap.structures[`${mode}:${set.join('+')}`] = ss.scoreStructures(set, nodes, mode).map((s) => `${s.key}:${s.confidence}`);
    }
  }

  // 10. Wine pairing: the top three wines for every Cookbook recipe, using the category hints
  const wp = m_data_winePairing;
  const { RECIPE_DETAILS } = m_data_seedRecipeDetails;
  const wines = readJson('public/data/wine_styles.json').wines;
  const categoryOf = (n) => nodes.get(n)?.category || null;
  snap.winePairing = {};
  for (const r of SEED_RECIPES) {
    const d = RECIPE_DETAILS[r.id];
    const ranked = wp.rankWinesForRecipe((r.ingredients || []).map(nameOf).filter(Boolean), wines,
      { categoryOf, cuisine: r.cuisine, dishType: r.cluster, methodText: d ? d.steps.join(' ') : '' }, 3);
    snap.winePairing[r.id] = ranked.map((x) => x.item.id);
  }

  return snap;
}

const ORDERED = new Set(['dishShortlists', 'cocktailShortlists', 'sauceShortlists', 'winePairing', 'starters', 'structures']);

/**
 * Differences between two snapshots, as rows { section, key, removed[], added[] } for a set-like list and
 * { section, key, before, after } for anything ordered or scalar (a shortlist, a count).
 */
export function diffSnapshots(before, after) {
  const out = [];
  const setRow = (section, key, bv, av) => {
    const bs = new Set(bv); const as = new Set(av);
    return { section, key, removed: bv.filter((x) => !as.has(x)), added: av.filter((x) => !bs.has(x)) };
  };
  for (const section of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
    const bs = before[section]; const as = after[section];
    if (Array.isArray(bs) && Array.isArray(as) && !ORDERED.has(section)) {
      const row = setRow(section, '*', bs, as);
      if (row.removed.length || row.added.length) out.push(row);
      continue;
    }
    const b = bs || {}; const a = as || {};
    for (const key of [...new Set([...Object.keys(b), ...Object.keys(a)])].sort()) {
      const bv = b[key]; const av = a[key];
      if (JSON.stringify(bv) === JSON.stringify(av)) continue;
      if (Array.isArray(bv) && Array.isArray(av) && !ORDERED.has(section)) out.push(setRow(section, key, bv, av));
      else out.push({ section, key, before: bv, after: av });
    }
  }
  return out;
}
