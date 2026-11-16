import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseSearchForInvent, cocktailSeedFromSearch, sauceSeedFromSearch, recipeSeedFromSearch,
} from '../inventSearch.js';
import { buildPairingIndex } from '../recipePairingMatch.js';
import { cocktailSkeleton, isBaseSpirit, INVENT_FAMILY_ORDER } from '../cocktailInvent.js';
import { INVENT_STYLE_BY_ID, sauceSkeleton } from '../inventSauce.js';
import { buildCategoryMap } from '../saucePantry.js';
import { dishSkeleton, DISH_SKELETON_ORDER } from '../dishSkeletons.js';
import { seedBuild, buildKeys } from '../inventBuild.js';
import { SEED_RECIPES } from '../seedRecipes.js';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';

// Real data throughout: the shipped codex, roles, sauce catalogue and ingredient graph.
const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const ingredients = read('public/proDataset/ingredients.json');
const nodes = new Map(Object.entries(ingredients));
const roles = read('public/data/cocktail_roles.json').byIngredient;
const cocktails = readCuratedCodex().cocktails;
const index = buildPairingIndex([], Object.keys(ingredients));
const names = index.names;

const augment = read('public/data/sauce_augment.json');
const FAMILY_NAMES = ['Béchamel', 'Velouté', 'Espagnole', 'Hollandaise', 'Tomato', 'Curry', 'Stir-fry', 'Mole', 'Salsa', 'Nut Sauce'];
const sauces = augment.sauces
  .map((s) => ({ ...s, ingredients: s.ingredients.map((i) => i.name), family_id: FAMILY_NAMES.indexOf(s.motherSauce) }))
  .filter((s) => s.family_id >= 0);
const catMap = buildCategoryMap(augment.ingredients);
const catalogue = new Set(augment.ingredients.map((i) => i.name.toLowerCase()));

const cocktailCtx = { cocktails, roles, names };
const sauceCtx = { sauces, catMap, names: catalogue };
const recipeCtx = { recipes: SEED_RECIPES, nodes };

const cocktailBuild = (seed) => {
  const base = seed.base ? [{ key: seed.base, source: 'user' }] : [];
  const pinned = [...base, ...seed.pinned.filter((p) => p.key !== seed.base)];
  return seedBuild(cocktailSkeleton(seed.familyId, { roles }), { pinned });
};
const sauceBuild = (seed) => seedBuild(sauceSkeleton(seed.styleId, { catMap }), { pinned: seed.pinned });
const recipeBuild = (seed) => seedBuild(dishSkeleton(seed.type, { nodes }), {
  pinned: [...(seed.main ? [{ key: seed.main, source: 'search' }] : []), ...seed.pinned],
});
const locked = (build) => build.slots.filter((s) => s.line && s.locked).length;
const keysOf = (seed) => seed.pinned.map((p) => p.key);

describe('parseSearchForInvent', () => {
  const recipeNames = ['Negroni', 'Gin Fizz', 'Old Fashioned', 'Bénédictine Sour'];
  const toKey = (t) => t;
  const known = (k) => ['gin', 'campari', 'cucumber', 'benedictine'].includes(k);
  const parse = (q) => parseSearchForInvent(q, { recipeNames, toKey, isKnown: known });

  it('an exact name (case, accents, punctuation ignored) is a name', () => {
    expect(parse('NEGRONI').names).toEqual(['Negroni']);
    expect(parse('old-fashioned').names).toEqual(['Old Fashioned']);
    expect(parse('benedictine sour').names).toEqual(['Bénédictine Sour']);
  });
  it('an ingredient reading beats a partial name: gin is not Gin Fizz', () => {
    const p = parse('gin');
    expect(p.names).toEqual([]);
    expect(p.ingredients).toEqual(['gin']);
  });
  it('a name typed in full wins even over an ingredient reading', () => {
    expect(parseSearchForInvent('gin fizz', { recipeNames, toKey: () => 'gin', isKnown: () => true }).names).toEqual(['Gin Fizz']);
  });
  it('a half-typed name that is no ingredient and fits one recipe is a name', () => {
    expect(parse('negron').names).toEqual(['Negroni']);
    expect(parse('old fash').names).toEqual(['Old Fashioned']);
  });
  it('a near match shared by several recipes is not guessed', () => {
    const p = parseSearchForInvent('fizz', { recipeNames: ['Gin Fizz', 'Ramos Fizz'], toKey: (t) => t, isKnown: () => false });
    expect(p.names).toEqual([]);
    expect(p.unknown).toEqual(['fizz']);
  });
  it('keeps unknown text, in typed order, and never drops a term', () => {
    const p = parse('gin, dragonfruit, negroni, campari');
    expect(p.terms.map((t) => [t.text, t.kind])).toEqual([
      ['gin', 'ingredient'], ['dragonfruit', 'unknown'], ['negroni', 'name'], ['campari', 'ingredient'],
    ]);
    expect(p.unknown).toEqual(['dragonfruit']);
  });
  it('splits on commas and plus signs, drops repeats and blanks', () => {
    expect(parse('gin + gin, ,campari').ingredients).toEqual(['gin', 'campari']);
    expect(parse('   ').terms).toEqual([]);
  });
});

describe('cocktail seed', () => {
  it('negroni → the Negroni family with its lines pinned as search, base gin', () => {
    const { seed, summary } = cocktailSeedFromSearch('negroni', cocktailCtx);
    const negroni = cocktails.find((c) => c.name === 'Negroni');
    expect(seed.familyId).toBe(negroni.family_id);
    expect(seed.fromName).toBe(true);
    expect(seed.base).toBe('gin');
    expect(keysOf(seed)).toEqual(['gin', 'sweet vermouth', 'campari']);
    expect(seed.pinned.every((p) => p.source === 'search')).toBe(true);
    expect(summary).toBe('a Negroni');
  });
  it('a typed name keeps the codex spelling ("an Old Fashioned"), water and garnish left out', () => {
    const { seed, summary } = cocktailSeedFromSearch('old fashioned', cocktailCtx);
    expect(summary).toBe('an Old Fashioned');
    expect(keysOf(seed).some((k) => /water|ice/.test(k))).toBe(false);
    expect(isBaseSpirit(seed.base, roles)).toBe(true);
  });
  it('gin, cucumber → both pinned, base gin, family picked by most slots filled', () => {
    const { seed, summary } = cocktailSeedFromSearch('gin, cucumber', cocktailCtx);
    expect(keysOf(seed)).toEqual(['gin', 'cucumber']);
    expect(seed.base).toBe('gin');
    expect(summary).toBe('gin + cucumber');
    expect(seed.fromName).toBeUndefined(); // best fit only: the panel recommends it
    const counts = INVENT_FAMILY_ORDER.map((id) => locked(seedBuild(cocktailSkeleton(id, { roles }), { pinned: seed.pinned })));
    expect(locked(cocktailBuild(seed))).toBe(Math.max(...counts));
    expect(seed.familyId).toBe(INVENT_FAMILY_ORDER[counts.indexOf(Math.max(...counts))]);
  });
  it('a fit decides the family: gin + campari + sweet vermouth lands in the stirred family', () => {
    const { seed } = cocktailSeedFromSearch('gin, campari, sweet vermouth', cocktailCtx);
    expect(seed.familyId).toBe(4);
    expect(locked(cocktailBuild(seed))).toBe(3);
  });
  it('negroni, mezcal → the Negroni baseline with mezcal as the base, not gin', () => {
    const { seed, summary } = cocktailSeedFromSearch('negroni, mezcal', cocktailCtx);
    expect(seed.familyId).toBe(cocktails.find((c) => c.name === 'Negroni').family_id);
    expect(seed.base).toBe('mezcal');
    expect(keysOf(seed)).toEqual(['mezcal', 'sweet vermouth', 'campari']);
    expect(summary).toBe('a Negroni with mezcal');
    const build = cocktailBuild(seed);
    expect(build.rejected).toEqual([]);
    expect(build.slots.find((s) => s.id === 'base').line.key).toBe('mezcal');
  });
  it('gin alone is an ingredient, not the cocktail Gin Fizz', () => {
    const { seed, parsed } = cocktailSeedFromSearch('gin', cocktailCtx);
    expect(parsed.names).toEqual([]);
    expect(keysOf(seed)).toEqual(['gin']);
    expect(seed.base).toBe('gin');
  });
  it('an unknown term is kept as a pin, never dropped', () => {
    const { seed, parsed } = cocktailSeedFromSearch('gin, dragonfruit zest', cocktailCtx);
    expect(parsed.unknown).toEqual(['dragonfruit zest']);
    expect(keysOf(seed)).toContain('dragonfruit zest');
    const build = cocktailBuild(seed);
    expect(buildKeys(build)).toContain('dragonfruit zest');
  });
  it('an unknown term next to a name is kept too', () => {
    const { seed } = cocktailSeedFromSearch('negroni, dragonfruit zest', cocktailCtx);
    expect(keysOf(seed)).toContain('dragonfruit zest');
  });
  it('active chips override the best-fit baseline', () => {
    const free = cocktailSeedFromSearch('gin, cucumber', cocktailCtx).seed;
    const other = INVENT_FAMILY_ORDER.find((id) => id !== free.familyId);
    expect(cocktailSeedFromSearch('gin, cucumber', { ...cocktailCtx, filterFamily: other }).seed.familyId).toBe(other);
    // a spirit chip becomes the base when no spirit was typed ...
    const chip = cocktailSeedFromSearch('cucumber', { ...cocktailCtx, filterSpirit: 'tequila' }).seed;
    expect(chip.base).toBe('tequila');
    // ... and a typed spirit wins over the chip
    expect(cocktailSeedFromSearch('gin, cucumber', { ...cocktailCtx, filterSpirit: 'tequila' }).seed.base).toBe('gin');
    // a chip that is not a base spirit (liqueur) sets nothing
    expect(cocktailSeedFromSearch('cucumber', { ...cocktailCtx, filterSpirit: 'liqueur' }).seed.base).toBeUndefined();
  });
  it('a typed name keeps its own family even with a different family chip active', () => {
    const negroni = cocktails.find((c) => c.name === 'Negroni');
    const other = INVENT_FAMILY_ORDER.find((id) => id !== negroni.family_id);
    expect(cocktailSeedFromSearch('negroni', { ...cocktailCtx, filterFamily: other }).seed.familyId).toBe(negroni.family_id);
  });
  it('an empty or blank query gives null', () => {
    expect(cocktailSeedFromSearch('', cocktailCtx)).toBeNull();
    expect(cocktailSeedFromSearch('  , ', cocktailCtx)).toBeNull();
  });
  it('every codex cocktail name seeds a build with no rejected pins', () => {
    for (const c of cocktails) {
      const res = cocktailSeedFromSearch(c.name, cocktailCtx);
      expect(res, c.name).not.toBeNull();
      const build = cocktailBuild(res.seed);
      const bad = build.rejected.filter((r) => !/base spirit|sour/.test(r.reason));
      expect(bad, c.name).toEqual([]);
    }
  });
});

describe('sauce seed', () => {
  it('hollandaise → the Emulsion style with its ingredients pinned', () => {
    const { seed, summary } = sauceSeedFromSearch('hollandaise', sauceCtx);
    expect(seed.styleId).toBe('Hollandaise');
    expect(seed.fromName).toBe(true);
    expect(INVENT_STYLE_BY_ID.get(seed.styleId).label).toBe('Emulsion');
    expect(keysOf(seed)).toEqual(['egg yolk', 'clarified butter', 'lemon juice', 'cayenne']);
    expect(seed.pinned.every((p) => p.source === 'search')).toBe(true);
    expect(summary).toBe('a Hollandaise');
    const build = sauceBuild(seed);
    expect(build.rejected).toEqual([]);
    expect(build.slots.filter((s) => s.required && s.line).length).toBe(3);
  });
  it('tomato, basil → a fitting style with both pinned and placed', () => {
    const { seed } = sauceSeedFromSearch('tomato, basil', sauceCtx);
    expect(keysOf(seed)).toEqual(['tomato', 'basil']);
    expect(seed.fromName).toBeUndefined(); // a best fit, not a named sauce
    expect(seed.protein).toBeUndefined();
    const build = sauceBuild(seed);
    expect(build.rejected).toEqual([]);
    expect(locked(build)).toBe(2);
  });
  it('chicken, lemon → protein chicken, lemon pinned', () => {
    const { seed, summary } = sauceSeedFromSearch('chicken, lemon', sauceCtx);
    expect(seed.protein).toBe('chicken');
    expect(keysOf(seed)).toEqual(['lemon']);
    expect(summary).toBe('lemon for chicken');
  });
  it('a loose protein word finds the protein of the list: fish → white fish', () => {
    expect(sauceSeedFromSearch('fish, butter', sauceCtx).seed.protein).toBe('white fish');
  });
  it('egg stays an ingredient (an emulsifier), not a protein', () => {
    const { seed } = sauceSeedFromSearch('egg yolk, butter, lemon', sauceCtx);
    expect(seed.protein).toBeUndefined();
    expect(seed.styleId).toBe('Hollandaise');
    expect(locked(sauceBuild(seed))).toBe(3);
  });
  it('a name plus a typed ingredient adds the pin', () => {
    const { seed, summary } = sauceSeedFromSearch('hollandaise, tarragon', sauceCtx);
    expect(keysOf(seed)).toContain('tarragon');
    expect(summary).toBe('a Hollandaise with tarragon');
  });
  it('an unknown term is kept as a pin, never dropped', () => {
    const { seed, parsed } = sauceSeedFromSearch('tomato, dragonfruit zest', sauceCtx);
    expect(parsed.unknown).toEqual(['dragonfruit zest']);
    expect(keysOf(seed)).toEqual(['tomato', 'dragonfruit zest']);
    expect(buildKeys(sauceBuild(seed))).toContain('dragonfruit zest');
  });
  it('the active family chip overrides the best fit; a cuisine chip narrows it', () => {
    expect(sauceSeedFromSearch('tomato, basil', { ...sauceCtx, filterFamily: 5 }).seed.styleId).toBe('Curry');
    const asian = sauceSeedFromSearch('garlic', { ...sauceCtx, filterCuisine: 'Chinese' }).seed.styleId;
    const families = new Set(sauces.filter((s) => s.cuisine === 'Chinese').map((s) => FAMILY_NAMES[s.family_id]));
    expect(families.has(asian)).toBe(true);
  });
  it('an empty query gives null', () => {
    expect(sauceSeedFromSearch('', sauceCtx)).toBeNull();
  });
  it('every sauce name seeds a build with no rejected pins', () => {
    for (const s of sauces) {
      const res = sauceSeedFromSearch(s.name, sauceCtx);
      expect(res, s.name).not.toBeNull();
      expect(sauceBuild(res.seed).rejected, s.name).toEqual([]);
    }
  });
});

describe('recipe seed', () => {
  it('a real Cookbook recipe → its dish type, mains pinned, its cuisine', () => {
    const bolognese = SEED_RECIPES.find((r) => r.name === 'Beef Bolognese');
    const { seed, summary } = recipeSeedFromSearch('beef bolognese', recipeCtx);
    expect(seed.type).toBe('pasta');
    expect(seed.fromName).toBe(true);
    expect(seed.cuisine).toBe(bolognese.cuisine);
    expect(seed.main).toBe('beef');
    expect(seed.pinned.every((p) => p.source === 'search')).toBe(true);
    expect(keysOf(seed)).not.toContain('salt');
    expect(keysOf(seed).length).toBeLessThan(bolognese.ingredients.length);
    expect(summary).toBe('a dish like Beef Bolognese');
  });
  it('chicken alone → main chicken with a dish type chosen', () => {
    const { seed } = recipeSeedFromSearch('chicken', recipeCtx);
    expect(seed.main).toBe('chicken');
    expect(seed.fromName).toBeUndefined();
    expect(DISH_SKELETON_ORDER).toContain(seed.type);
    expect(seed.pinned).toEqual([]);
  });
  it('noodle, soy sauce, ginger, chicken → stir-fry, chicken the main, the rest pinned', () => {
    const { seed } = recipeSeedFromSearch('noodle, soy sauce, ginger, chicken', recipeCtx);
    expect(seed.type).toBe('stir-fry');
    expect(seed.main).toBe('chicken');
    expect(seed.pinned.length).toBe(3);
    const build = recipeBuild(seed);
    expect(build.rejected).toEqual([]);
    expect(locked(build)).toBe(4);
  });
  it('an unknown term is kept as a pin, never dropped', () => {
    const { seed, parsed } = recipeSeedFromSearch('chicken, dragonfruit zest', recipeCtx);
    expect(parsed.unknown).toEqual(['dragonfruit zest']);
    expect(keysOf(seed)).toContain('dragonfruit zest');
  });
  it('the active cuisine chip becomes the cuisine; a recipe keeps its own', () => {
    expect(recipeSeedFromSearch('chicken', { ...recipeCtx, filterCuisine: 'Thai' }).seed.cuisine).toBe('Thai');
    expect(recipeSeedFromSearch('chicken').seed.cuisine).toBeUndefined();
    const own = SEED_RECIPES.find((r) => r.name === 'Beef Bolognese');
    expect(recipeSeedFromSearch('beef bolognese', { ...recipeCtx, filterCuisine: 'Thai' }).seed.cuisine).toBe(own.cuisine);
  });
  it('an empty query gives null', () => {
    expect(recipeSeedFromSearch('', recipeCtx)).toBeNull();
  });
  it('every Cookbook recipe name seeds a dish type with its mains, nothing rejected', () => {
    for (const r of SEED_RECIPES) {
      const res = recipeSeedFromSearch(r.name, recipeCtx);
      expect(res, r.name).not.toBeNull();
      expect(DISH_SKELETON_ORDER, r.name).toContain(res.seed.type);
      expect(res.seed.cuisine, r.name).toBe(r.cuisine);
      expect(recipeBuild(res.seed).rejected, r.name).toEqual([]);
    }
  });
});
