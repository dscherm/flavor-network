// DATA-7: ONE dish-type list for the Cookbook and Invent a recipe. A test fails when they disagree.
import { describe, it, expect } from 'vitest';
import { DISH_TYPE_LIST, DISH_TYPE_BY_ID, LEGACY_DISH_TYPE, canonicalDishType, skeletonForDishType } from '../dishTypes.js';
import { DISH_TYPES, dishTypeOf } from '../dishType.js';
import { DISH_SKELETONS, DISH_SKELETON_ORDER, dishTypeForIngredients, inventSkeletonFor } from '../dishSkeletons.js';
import { SEED_RECIPES } from '../seedRecipes.js';
import { inventSeedForShared } from '../sharedSeed.js';
import { resolveBuiltIn, slugFor } from '../sharedRecipe.js';
import { RECIPE_DETAILS } from '../seedRecipeDetails.js';
import { DISH_ART_KINDS } from '../../components/chalkArt.jsx';
import { dishChecks } from '../dataAudit.js';

describe('one list of dish types', () => {
  it('the Cookbook reads exactly this list', () => {
    expect(Object.keys(DISH_TYPES)).toEqual(DISH_TYPE_LIST.map((t) => t.id));
    for (const t of DISH_TYPE_LIST) expect(DISH_TYPES[t.id]).toBe(t.label);
  });

  it('every type has a chalk drawing', () => {
    for (const t of DISH_TYPE_LIST) expect(DISH_ART_KINDS).toContain(t.id);
  });

  it('every Invent a recipe skeleton names a type that points back at it', () => {
    for (const id of DISH_SKELETON_ORDER) {
      const def = DISH_SKELETONS[id];
      const type = DISH_TYPE_BY_ID.get(def.dishType);
      expect(type, `${id} -> ${def.dishType}`).toBeTruthy();
      expect(type.skeleton, `${def.dishType}`).toBe(id);
    }
  });

  it('every type either has a skeleton that exists or says in writing why it has none; a nearest skeleton says why too', () => {
    for (const t of DISH_TYPE_LIST) {
      if (t.skeleton) expect(DISH_SKELETONS[t.skeleton], `${t.id} -> ${t.skeleton}`).toBeTruthy();
      const own = t.skeleton && DISH_SKELETONS[t.skeleton].dishType === t.id;
      if (!own) expect(String(t.why || '').length, `${t.id} needs a reason`).toBeGreaterThan(15);
    }
  });

  it('no type is left without a skeleton by accident: the ones without one are the listed ones', () => {
    expect(DISH_TYPE_LIST.filter((t) => !t.skeleton).map((t) => t.id)).toEqual(['sandwich', 'dumpling', 'dip', 'bake', 'dessert', 'veg', 'plate']);
  });
});

describe('every Cookbook dish', () => {
  const types = SEED_RECIPES.map((r) => [r, dishTypeOf(r)]);

  it('maps to a type in the list, never the fallback', () => {
    for (const [r, t] of types) {
      expect(DISH_TYPE_BY_ID.has(t), r.id).toBe(true);
      expect(t, r.id).not.toBe('plate');
    }
  });

  it('no type has a single dish', () => {
    const n = {};
    for (const [, t] of types) n[t] = (n[t] || 0) + 1;
    for (const [t, c] of Object.entries(n)) expect(c, t).toBeGreaterThanOrEqual(2);
  });

  it('opens Invent a recipe on a real skeleton or on the ingredients, by the stated rule', () => {
    for (const [r, t] of types) {
      const seed = inventSeedForShared(resolveBuiltIn('dish', slugFor('dish', r), { dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS }));
      expect(seed.lab).toBe('make');
      expect(DISH_SKELETONS[seed.seed.type], `${r.id} (${t})`).toBeTruthy();
      const want = skeletonForDishType(t);
      if (want) expect(seed.seed.type, `${r.id} (${t})`).toBe(want);
    }
  });

  it('one rule gives a dish the same type everywhere: the Cookbook type decides, the ingredients only when the type has no skeleton', () => {
    for (const [r, t] of types) {
      const want = skeletonForDishType(t);
      expect(inventSkeletonFor(t, r.ingredients), r.id).toBe(want || dishTypeForIngredients(r.ingredients));
    }
    expect(inventSkeletonFor(undefined, ['spaghetti', 'garlic'])).toBe(dishTypeForIngredients(['spaghetti', 'garlic']));
  });

  it('dishTypeForIngredients answers with a skeleton whose type is in the list', () => {
    for (const [r] of types) {
      const id = dishTypeForIngredients(r.ingredients);
      expect(DISH_TYPE_BY_ID.has(DISH_SKELETONS[id].dishType), r.id).toBe(true);
    }
  });
});

describe('folded types', () => {
  it('an old id still resolves to the type it was folded into', () => {
    for (const [from, to] of Object.entries(LEGACY_DISH_TYPE)) {
      expect(DISH_TYPE_BY_ID.has(from)).toBe(false);
      expect(canonicalDishType(from)).toBe(to);
      expect(DISH_TYPE_BY_ID.has(to)).toBe(true);
    }
    expect(canonicalDishType('wok')).toBe('wok');
    expect(canonicalDishType('nonsense')).toBe('plate');
    expect(canonicalDishType(undefined)).toBe('plate');
  });
  it('skeletonForDishType follows the rule: own, nearest, or none', () => {
    expect(skeletonForDishType('wok')).toBe('stir-fry');
    expect(skeletonForDishType('curry')).toBe('braise-stew');
    expect(skeletonForDishType('wrap')).toBe('tacos');
    expect(skeletonForDishType('dessert')).toBeNull();
    expect(skeletonForDishType('nonsense')).toBeNull();
  });
});

describe('the audit reads the same list', () => {
  const inventTypes = DISH_SKELETON_ORDER.map((id) => ({ id, label: DISH_SKELETONS[id].label, dishType: DISH_SKELETONS[id].dishType }));
  it('finds no singleton and no type without an Invent equivalent', () => {
    const dishTypes = Object.fromEntries(SEED_RECIPES.map((r) => [r.name, dishTypeOf(r)]));
    const r = dishChecks({ dishTypes, cookbookTypes: DISH_TYPES, inventTypes, typeList: DISH_TYPE_LIST });
    expect(r.findings.filter((f) => f.rule === 'dish-singleton')).toEqual([]);
    expect(r.findings.filter((f) => f.rule === 'dish-no-invent-equivalent')).toEqual([]);
  });
  it('still flags a type with neither a skeleton nor a reason', () => {
    const r = dishChecks({ dishTypes: { a: 'x', b: 'x' }, cookbookTypes: { x: 'X' }, inventTypes, typeList: [{ id: 'x', skeleton: null }] });
    expect(r.findings.map((f) => f.rule)).toEqual(['dish-no-invent-equivalent']);
  });
});
