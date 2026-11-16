// STANDIN-2: the food entries of the stand-in table, read through the same function the shopping sheet uses.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { STAND_INS, SWAPS, standInKind, swapsFor, findSwap } from '../kitchenSwaps.js';
import { alternativesFor } from '../shoppingAlternatives.js';
import { canonicalKey } from '../shoppingList.js';
import { isSuggestable } from '../curation/suggestable.js';
import { categoryLookup } from '../recipeMains.js';
import { loadCurationTables, applyCuration } from '../../../scripts/lib/curationTables.mjs';

const raw = JSON.parse(fs.readFileSync(`${process.cwd()}/public/proDataset/ingredients.json`, 'utf8'));
const curated = applyCuration(raw, null, loadCurationTables()).ingredients;
const names = new Set(Object.keys(curated).filter((k) => !k.startsWith('_')));
const categoryOf = categoryLookup(raw);
// Names a cook types that the ingredient graph has no node for (the swap table's own list).
const UNSTORED = new Set(['baking powder', 'baking soda', 'vegetable oil', 'spaghetti']);

const alts = (key, ctx = {}) => alternativesFor({ key }, { names, ...ctx });
const keysOf = (key, ctx) => alts(key, ctx).alternatives.map((a) => a.key);

describe('named cases', () => {
  it('garlic: jarred garlic and garlic powder, each with an amount; never shallot or onion', () => {
    const { alternatives } = alts('garlic');
    expect(alternatives.map((a) => [a.key, a.kind])).toEqual([['jarred garlic', 'form'], ['garlic powder', 'form']]);
    expect(alternatives.find((a) => a.key === 'garlic powder').amountNote).toBe('1/8 tsp garlic powder for each fresh clove');
    expect(alternatives.find((a) => a.key === 'jarred garlic').amountNote).toMatch(/1\/2 tsp/);
    expect(keysOf('garlic')).not.toContain('shallot');
    expect(keysOf('garlic')).not.toContain('onion');
    expect(swapsFor('garlic')).toEqual([]);
  });
  it('eggs: nothing replaces them, with the reason, and no alternatives', () => {
    const r = alts('egg');
    expect(r.alternatives).toEqual([]);
    expect(r.none.reason).toMatch(/sets and binds/);
    expect(alts('egg yolk').none.reason).toMatch(/emulsifies and thickens/);
  });
  it('fresh thyme: dried thyme with the amount, and the other way round', () => {
    const { alternatives } = alts('thyme');
    expect(alternatives.find((a) => a.key === 'dried thyme')).toMatchObject({ kind: 'form', amountNote: '1 tsp dried for 1 tbsp fresh', dropQty: true, sameKey: true });
    expect(alternatives.find((a) => a.key === 'fresh thyme').amountNote).toBe('1 tbsp fresh for 1 tsp dried');
  });
  it('baking powder: made from baking soda and cream of tartar, with the amounts', () => {
    const { alternatives } = alts('baking powder');
    expect(alternatives).toHaveLength(1);
    expect(alternatives[0]).toMatchObject({ key: 'baking soda', kind: 'make', plus: ['cream of tartar'], dropQty: true });
    expect(alternatives[0].amountNote).toBe('1/4 tsp baking soda and 1/2 tsp cream of tartar for each 1 tsp baking powder');
    expect(alternatives[0].useText).toBe('Make it from baking soda and cream of tartar.');
  });
  it('butter for frying appears only for a supporting use; salt, flour, yeast and saffron say so honestly', () => {
    expect(keysOf('butter', { main: false })).toEqual(expect.arrayContaining(['olive oil', 'vegetable oil']));
    expect(keysOf('butter', { main: true })).toEqual([]);
    expect(keysOf('butter')).toEqual([]);
    for (const k of ['flour', 'yeast', 'saffron', 'fish sauce', 'sesame oil']) expect(alts(k).none.reason.length, k).toBeGreaterThan(20);
    expect(alts('saffron').none.reason).toMatch(/turmeric gives only the yellow color/);
  });
  it('a cut or a herb is never swapped for another kind only because it is in the same group', () => {
    expect(keysOf('basil')).not.toContain('mint');
    expect(keysOf('cilantro')).not.toContain('mint');
    expect(keysOf('chicken')).not.toContain('pork');
    expect(keysOf('shrimp')).not.toContain('scallop');
    expect(keysOf('soy sauce')).not.toContain('fish sauce');
  });
  it('a recipe-side caller still sees swaps only: a form, a make or a none never makes a recipe makeable', () => {
    const has = (k) => ['garlic powder', 'baking soda', 'cream of tartar', 'dried thyme', 'sugar', 'water'].includes(k);
    expect(findSwap('garlic', has)).toBeNull();
    expect(findSwap('baking powder', has)).toBeNull();
    expect(findSwap('thyme', has)).toBeNull();
    expect(findSwap('egg', () => true)).toBeNull();
    expect(SWAPS.every((s) => standInKind(s) === 'swap')).toBe(true);
  });
});

describe('every entry in the table', () => {
  it('names are the ones the app stores: `for` resolves to itself; every offered name is suggestable and stored', () => {
    for (const s of STAND_INS) {
      const kind = standInKind(s);
      if (!UNSTORED.has(s.for)) {
        // A bar entry may use a name only cocktail lines use (sweet sour, seltzer's canonical soda water): barStandIns's own
        // name check (standIns.bar.test.js and `npm run check:standins`) holds those to the cocktail line keys.
        if (!s.bar) expect(names.has(s.for), `for ${s.for}`).toBe(true);
        expect(canonicalKey(s.for, names), `for ${s.for}`).toBe(s.for);
      }
      if (kind === 'none') continue;
      for (const p of [s.use, ...(s.plus || [])]) {
        expect(isSuggestable(p), `${p} for ${s.for}`).toBe(true);
        if (UNSTORED.has(p) || s.bar) continue;
        // A form may be the row's own ingredient under another name (dried thyme -> thyme); anything else is a stored name.
        if (kind === 'form' && p === s.use) expect(names.has(p) || canonicalKey(p, names) === s.for, `${p} for ${s.for}`).toBe(true);
        else expect(names.has(p), `${p} for ${s.for}`).toBe(true);
      }
    }
  });
  it('a none has a reason and no replacement; a make has parts; a form has an amount or a note', () => {
    for (const s of STAND_INS) {
      const kind = standInKind(s);
      if (kind === 'none') { expect(s.use, s.for).toBeNull(); expect(String(s.reason).length, s.for).toBeGreaterThan(20); }
      // A make starts from a first part and says how much: most have more parts (simple syrup: sugar and water); a squeeze has one (lemon juice from a lemon).
      if (kind === 'make') { expect(s.use, s.for).toBeTruthy(); expect(s.amountNote, s.for).toBeTruthy(); }
      if (kind === 'form') expect(s.amountNote || s.note, s.for).toBeTruthy();
    }
  });
  it('no two entries are the same answer twice, and nothing stands in for itself', () => {
    const seen = new Set();
    for (const s of STAND_INS) {
      const id = `${s.for}|${s.use}|${(s.plus || []).join('+')}`;
      expect(seen.has(id), id).toBe(false);
      seen.add(id);
      if (standInKind(s) !== 'form') expect(s.for === s.use, id).toBe(false);
    }
  });
  it('a swap keeps one role: both sides carry the declared category (the rule the existing test holds for the old entries)', () => {
    for (const s of SWAPS) {
      for (const n of [s.for, s.use]) {
        if (UNSTORED.has(n)) continue;
        expect(categoryOf(n), `${s.use} for ${s.for}: ${n}`).toBe(s.role);
      }
    }
  });
  it('a swap, a form or a make never reaches across kinds of ingredient that the table itself keeps apart', () => {
    // The spot cases the brief names: never garlic for onion, never a herb for another herb, never a protein for a dairy.
    const has = (f, u) => STAND_INS.some((s) => s.for === f && s.use === u);
    expect(has('garlic', 'onion') || has('onion', 'garlic') || has('garlic', 'shallot')).toBe(false);
    expect(has('basil', 'mint') || has('mint', 'basil') || has('cilantro', 'mint')).toBe(false);
    expect(has('butter', 'cream') || has('milk', 'cream')).toBe(false);
  });
});
