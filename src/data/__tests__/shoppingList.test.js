// SHOP-1: the shopping list logic. Pure; the clock and the id source are injected.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  emptyList, addLine, addRecipe, toggle, remove, clearChecked, replaceItem, undoReplace, uncheckedCount,
  groupByAisle, toText, makeHas, canonicalKey, partFromAmount, addPart, formatParts, itemAmountText,
  aisleOf, AISLES, AISLE_OF_CATEGORY, MAX_ITEMS, CAP_MESSAGE,
} from '../shoppingList.js';
import { shoppingListText, needsFromKitchen } from '../whatDoINeed.js';
import { resolveBuiltIn } from '../sharedRecipe.js';
import { SEED_RECIPES } from '../seedRecipes.js';
import { RECIPE_DETAILS } from '../seedRecipeDetails.js';
import { CATEGORY_SCHEME } from '../categoryScheme.js';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';

let seq = 0;
const T = () => ({ now: 1000, newId: () => `id${seq++}` });
const fresh = () => { seq = 0; };

const put = (list, key, amount, extra = {}) => addLine(list, { key, amount, ...extra }, T()).list;
const only = (list, key) => list.items.filter((i) => i.key === key);
const text = (list, key) => itemAmountText(only(list, key).find((i) => !i.checked) || only(list, key)[0]);

describe('amounts: what the one parser gives, and what this module makes of it', () => {
  it.each([
    ['200 g', { qty: 200, unit: 'g' }],
    ['1 cup', { qty: 1, unit: 'cup' }],
    ['2 tbsp', { qty: 2, unit: 'tbsp' }],
    ['2 cloves', { qty: 2, unit: 'clove' }],
    ['1½ tbsp', { qty: 1.5, unit: 'tbsp' }],
    ['1 1/2 cups', { qty: 1.5, unit: 'cup' }],
    ['500 g minced', { qty: 500, unit: 'g' }],
    ['3', { qty: 3, unit: '' }],
    ['1/2', { qty: 0.5, unit: '' }],
    ['1 small', { qty: 1, unit: 'small' }],
    ['1', { qty: 1, unit: '' }],
  ])('%s is a specific quantity', (raw, part) => expect(partFromAmount(raw)).toEqual(part));

  it.each([
    [''], [null], [undefined], ['a pinch'], ['to taste'], ['2-3 oz'], ['2 – 3 tbsp'], ['2 to 3 cups'], ['1 or 2'],
    ['for the pasta water'], ['3 (+1 whole egg)'], ['Top with soda'], ['0 g'],
  ])('%j is not a specific quantity', (raw) => expect(partFromAmount(raw)).toBeNull());

  it('shows quantities the way a cook writes them', () => {
    expect(formatParts([{ qty: 2, unit: 'clove' }])).toBe('2 cloves');
    expect(formatParts([{ qty: 1, unit: 'clove' }])).toBe('1 clove');
    expect(formatParts([{ qty: 1.5, unit: 'tbsp' }])).toBe('1½ tbsp');
    expect(formatParts([{ qty: 0.75, unit: 'cup' }])).toBe('¾ cup');
    expect(formatParts([{ qty: 1, unit: 'cup' }, { qty: 2, unit: 'tbsp' }])).toBe('1 cup 2 tbsp');
    expect(formatParts([{ qty: 2, unit: 'clove' }, { qty: 1, unit: 'tbsp' }])).toBe('2 cloves + 1 tbsp');
    expect(formatParts([{ qty: 3, unit: '' }])).toBe('3');
    expect(formatParts([])).toBe('');
  });
});

// The owner's criterion, as a table: [existing amount, incoming amount, the line afterwards].
// null = no quantity. Amounts are what a recipe line says.
describe('THE MERGE RULE (spec Decision 3), as a table', () => {
  const rows = [
    // existing none + anything -> still none
    [null, null, ''],
    [null, '200 g', ''],
    [null, '2 cloves', ''],
    ['a pinch', '2 tbsp', ''],
    // existing a quantity + none -> unchanged
    ['200 g', null, '200 g'],
    ['200 g', 'a pinch', '200 g'],
    ['200 g', '2-3 oz', '200 g'],
    ['1 cup', 'to taste', '1 cup'],
    // like units: summed
    ['200 g', '300 g', '500 g'],
    ['200 g', '800 g', '1000 g'],
    ['500 g', '1 kg', '1 kg 500 g'],
    ['1 kg', '1 kg', '2 kg'],
    ['1 cup', '2 tbsp', '1 cup 2 tbsp'],
    ['2 tbsp', '1 cup', '1 cup 2 tbsp'],
    ['3 tbsp', '3 tbsp', '6 tbsp'],
    ['1 tbsp', '3 tsp', '2 tbsp'],
    ['1 cup', '1 cup', '2 cups'],
    ['1/2 cup', '1/2 cup', '1 cup'],
    ['1 1/2 tbsp', '1 1/2 tbsp', '3 tbsp'],
    ['100 ml', '2 cl', '12 cl'],
    ['1 l', '250 ml', '1 l 250 ml'],
    ['1 lb', '4 oz', '1 lb 4 oz'],
    ['2 oz', '1 oz', '3 oz'],
    ['2 cloves', '3 cloves', '5 cloves'],
    ['1 clove', '1 clove', '2 cloves'],
    ['1', '2', '3'],
    ['1 can', '2 cans', '3 cans'],
    ['2 dashes', '1 dash', '3 dashes'],
    // unlike units: both parts, nothing converted
    ['2 cloves', '1 tbsp', '2 cloves + 1 tbsp'],
    ['200 g', '1 cup', '200 g + 1 cup'],
    ['200 g', '8 oz', '200 g + 8 oz'],
    ['100 ml', '1 cup', '100 ml + 1 cup'],
    ['1', '2 cloves', '1 + 2 cloves'],
    ['1 small', '1 large', '1 small + 1 large'],
  ];
  it.each(rows)('%j then %j -> %j', (a, b, want) => {
    fresh();
    let l = put(emptyList(), 'x', a);
    l = put(l, 'x', b);
    expect(l.items).toHaveLength(1);
    expect(text(l, 'x')).toBe(want);
  });

  it('a third like-unit amount adds into the matching part', () => {
    let l = put(emptyList(), 'garlic', '2 cloves');
    l = put(l, 'garlic', '1 tbsp');
    l = put(l, 'garlic', '3 cloves');
    expect(text(l, 'garlic')).toBe('5 cloves + 1 tbsp');
    l = put(l, 'garlic', '2 tbsp');
    expect(text(l, 'garlic')).toBe('5 cloves + 3 tbsp');
    expect(l.items).toHaveLength(1);
  });

  it('a range or a vague amount never produces a summed number', () => {
    for (const vague of ['2-3 oz', 'a pinch', 'to taste', '1 or 2', '2 to 3 cups']) {
      const l = put(put(emptyList(), 'x', '1 oz'), 'x', vague);
      expect(text(l, 'x'), vague).toBe('1 oz');
      const m = put(put(emptyList(), 'x', vague), 'x', '1 oz');
      expect(text(m, 'x'), vague).toBe('');
    }
  });

  it('never invents precision: a sum stays in the units that were written', () => {
    expect(text(put(put(emptyList(), 'x', '200 g'), 'x', '300 g'), 'x')).toBe('500 g');
    expect(text(put(put(emptyList(), 'x', '1/3 cup'), 'x', '1/3 cup'), 'x')).toBe('⅔ cup');
    expect(text(put(put(put(emptyList(), 'x', '1/3 cup'), 'x', '1/3 cup'), 'x', '1/3 cup'), 'x')).toBe('1 cup');
    expect(addPart([{ qty: 1, unit: 'g' }], { qty: 1, unit: 'kg' })).toEqual([{ qty: 1, unit: 'kg' }, { qty: 1, unit: 'g' }]);
  });

  it('a checked line does not count as on the list: the ingredient comes in as a new unchecked line', () => {
    fresh();
    let l = put(emptyList(), 'milk', '1 cup');
    l = toggle(l, l.items[0].id, T());
    l = put(l, 'milk', '2 cups');
    expect(only(l, 'milk')).toHaveLength(2);
    expect(only(l, 'milk').map((i) => [i.checked, itemAmountText(i)])).toEqual([[true, '1 cup'], [false, '2 cups']]);
    l = put(l, 'milk', '1 cup');
    expect(only(l, 'milk')).toHaveLength(2);
    expect(only(l, 'milk').find((i) => !i.checked).parts).toEqual([{ qty: 3, unit: 'cup' }]);
  });

  it('unchecking a line whose ingredient came back folds it into the unchecked one', () => {
    fresh();
    let l = put(emptyList(), 'milk', '1 cup');
    const first = l.items[0].id;
    l = toggle(l, first, T());
    l = put(l, 'milk', '2 cups');
    l = toggle(l, first, T());
    expect(only(l, 'milk')).toHaveLength(1);
    expect(text(l, 'milk')).toBe('3 cups');
  });

  it('names merge through the aliases', () => {
    fresh();
    let l = put(emptyList(), 'scallion', '2');
    l = put(l, 'green onion', '3');
    l = addLine(l, { text: 'Spring Onions', amount: '1' }, T()).list;
    expect(l.items).toHaveLength(1);
    expect(l.items[0].key).toBe('scallion');
    expect(l.items[0].parts).toEqual([{ qty: 6, unit: '' }]);
    // a curation alias (a misspelling merged into its canonical entry)
    expect(canonicalKey('all-purpose potatoe')).toBe('potato');
    l = put(put(emptyList(), 'potato', '1 lb'), 'all-purpose potatoe', '1 lb');
    expect(l.items).toHaveLength(1);
    expect(text(l, 'potato')).toBe('2 lb');
  });

  it('free text that matches no ingredient merges only with identical normalised text', () => {
    fresh();
    let l = addLine(emptyList(), { text: "Grandma's Chili Crisp" }, T()).list;
    l = addLine(l, { text: "  grandma's   CHILI crisp " }, T()).list;
    expect(l.items).toHaveLength(1);
    l = addLine(l, { text: "Grandma's chili crisp (hot)" }, T()).list;
    expect(l.items).toHaveLength(2);
    expect(l.items[0].label).toBe("Grandma's Chili Crisp");
  });

  it('a blank line is not added', () => {
    expect(addLine(emptyList(), { text: '   ' }, T()).status).toBe('empty');
  });
});

describe('check, remove, clear', () => {
  it('toggle, remove, clearChecked and the unchecked count', () => {
    fresh();
    let l = put(put(put(emptyList(), 'a', '1'), 'b'), 'c');
    expect(uncheckedCount(l)).toBe(3);
    l = toggle(l, l.items[0].id, { now: 5 });
    l = toggle(l, l.items[1].id, { now: 6 });
    expect(uncheckedCount(l)).toBe(1);
    expect(l.items[0]).toMatchObject({ checked: true, updatedAt: 5 });
    expect(clearChecked(l).items.map((i) => i.key)).toEqual(['c']);
    expect(remove(l, l.items[2].id).items.map((i) => i.key)).toEqual(['a', 'b']);
    expect(remove(l, 'nope')).toBe(l);
    expect(toggle(l, 'nope')).toBe(l);
  });
});

describe('the cap', () => {
  it('holds 200 items and says so plainly', () => {
    fresh();
    let l = emptyList();
    for (let i = 0; i < MAX_ITEMS; i += 1) l = put(l, `thing ${i}`);
    expect(l.items).toHaveLength(MAX_ITEMS);
    const r = addLine(l, { key: 'one more' }, T());
    expect(r.status).toBe('capped');
    expect(r.message).toBe(CAP_MESSAGE);
    expect(r.message).toMatch(/200 items/);
    expect(r.list).toBe(l);
    // merging into an existing line is still fine at the cap
    expect(addLine(l, { key: 'thing 3', amount: '1' }, T()).status).toBe('merged');
    // and a recipe says how many it left off
    const rec = addRecipe(l, { kind: 'dish', slug: 'x', name: 'X', lines: [{ key: 'new a' }, { key: 'thing 1' }, { key: 'new b' }] }, () => false, T());
    expect(rec.summary).toMatchObject({ added: 0, merged: 1, capped: 2 });
    expect(rec.summary.message).toMatch(/200 items.*2 ingredients were left off/);
    expect(rec.list.items).toHaveLength(MAX_ITEMS);
  });
});

describe('toText matches the existing copy format', () => {
  it('with and without quantities', () => {
    fresh();
    let l = put(emptyList(), 'garlic', '3 cloves');
    l = put(l, 'basil', '1 handful');
    l = put(l, 'parmesan');
    l = put(l, 'cheddar', '100 g');
    l = toggle(l, l.items[3].id, T());
    expect(toText(l)).toBe('Shopping list:\n- 3 cloves garlic\n- 1 handful basil\n- parmesan');
    expect(toText(l)).toBe(shoppingListText('', [
      { name: 'garlic', amount: '3 cloves' }, { name: 'basil', amount: '1 handful' }, { name: 'parmesan', amount: '' },
    ]));
    expect(toText(l, { title: 'Pomodoro' })).toBe('Shopping list for Pomodoro:\n- 3 cloves garlic\n- 1 handful basil\n- parmesan');
    expect(toText(emptyList())).toBe('Shopping list:');
    const n = needsFromKitchen(['pasta', 'garlic', 'basil'], ['pasta'], { amounts: { garlic: '3 cloves', basil: '1 handful' } });
    const viaExisting = shoppingListText('Pomodoro', n.missing);
    const viaList = toText(addRecipe(emptyList(), { kind: 'dish', slug: 'p', name: 'P', lines: [{ key: 'garlic', amount: '3 cloves' }, { key: 'basil', amount: '1 handful' }] }, () => false, T()).list, { title: 'Pomodoro' });
    expect(viaList).toBe(viaExisting);
  });
});

describe('aisles', () => {
  it('every category in the scheme has an aisle, and the table is stated', () => {
    for (const { category } of CATEGORY_SCHEME) expect(AISLE_OF_CATEGORY[category], category).toBeTruthy();
    for (const a of Object.values(AISLE_OF_CATEGORY)) expect(AISLES).toContain(a);
    expect(AISLES).toEqual(['produce', 'dairy', 'meat and fish', 'dry goods', 'spices', 'drinks', 'other']);
  });

  it('groups in aisle order, unchecked first, and unknown keys under other', () => {
    fresh();
    const cats = { tomato: 'vegetable', milk: 'dairy', beef: 'protein', rice: 'grain', cumin: 'spice', gin: 'spirit', egg: 'protein', butter: 'fat' };
    let l = emptyList();
    for (const k of ['gin', 'cumin', 'rice', 'beef', 'milk', 'tomato', 'egg', 'butter', 'mystery jar']) l = put(l, k);
    l = toggle(l, l.items.find((i) => i.key === 'tomato').id, T());
    l = put(l, 'onion');
    const g = groupByAisle(l, (k) => cats[k] || (k === 'onion' ? 'aromatic' : null));
    expect(g.map((x) => x.aisle)).toEqual(['produce', 'dairy', 'meat and fish', 'dry goods', 'spices', 'drinks', 'other']);
    expect(g[0].items.map((i) => [i.key, i.checked])).toEqual([['onion', false], ['tomato', true]]);
    expect(g[1].items.map((i) => i.key)).toEqual(['milk', 'egg', 'butter']);
    expect(g[2].items.map((i) => i.key)).toEqual(['beef']);
    expect(g.at(-1).items.map((i) => i.key)).toEqual(['mystery jar']);
    expect(groupByAisle(emptyList())).toEqual([]);
    expect(aisleOf('x', 'wine')).toBe('drinks');
    // a Map or an object of nodes works as well as a function
    expect(groupByAisle(l, new Map(Object.entries(cats).map(([k, c]) => [k, { category: c }])))[0].aisle).toBe('produce');
  });
});

describe('alternatives: replaceItem and undo', () => {
  it('replaces in place, keeps the quantity, and undo restores the row exactly', () => {
    fresh();
    let l = put(emptyList(), 'a', '1');
    l = put(l, 'shallot', '2 cloves', { label: 'Shallots', recipeId: 'dish:r1' });
    l = put(l, 'c', '1');
    const before = JSON.parse(JSON.stringify(l));
    const id = l.items[1].id;
    const r = replaceItem(l, id, { key: 'onion', note: 'use 1 onion for 3 shallots' }, { now: 2000, newId: T().newId });
    expect(r.status).toBe('replaced');
    expect(r.list.items[1]).toMatchObject({ id, key: 'onion', swappedFrom: 'shallot', parts: [{ qty: 2, unit: 'clove' }], from: ['dish:r1'], note: 'use 1 onion for 3 shallots', updatedAt: 2000 });
    expect(r.list.items).toHaveLength(3);
    expect(l).toEqual(before);
    const undone = undoReplace(r.list, id, { now: 3000 });
    expect(undone.items.map((i) => ({ ...i, updatedAt: 0 }))).toEqual(before.items.map((i) => ({ ...i, updatedAt: 0 })));
    expect(undone.items[1].swappedFrom).toBeUndefined();
    expect(undone.items[1].was).toBeUndefined();
    expect(JSON.parse(JSON.stringify(r.list))).toEqual(r.list);
  });

  it('an alternative that is already on the list merges instead of making a second line, and undo restores both', () => {
    fresh();
    let l = put(emptyList(), 'shallot', '100 g');
    l = put(l, 'onion', '200 g');
    l = put(l, 'z');
    const before = JSON.parse(JSON.stringify(l));
    const r = replaceItem(l, l.items[0].id, { key: 'onion' }, T());
    expect(r.status).toBe('merged');
    expect(r.list.items.map((i) => i.key)).toEqual(['onion', 'z']);
    expect(itemAmountText(r.list.items[0])).toBe('300 g');
    expect(r.list.items[0].swappedFrom).toBe('shallot');
    const undone = undoReplace(r.list, r.list.items[0].id, { now: 9 });
    expect(undone.items.map((i) => ({ ...i, updatedAt: 0 }))).toEqual(before.items.map((i) => ({ ...i, updatedAt: 0 })));
  });

  it('an alternative with a quantity of its own, a same-name swap, an unknown row', () => {
    fresh();
    const l = put(emptyList(), 'cream', '1 cup');
    const id = l.items[0].id;
    expect(replaceItem(l, id, { key: 'half and half', amount: '1 1/4 cups' }, T()).list.items[0].parts).toEqual([{ qty: 1.25, unit: 'cup' }]);
    expect(replaceItem(l, id, { key: 'cream' }, T()).status).toBe('same');
    expect(replaceItem(l, 'nope', { key: 'x' }, T()).status).toBe('missing');
    expect(replaceItem(l, id, { text: ' ' }, T()).status).toBe('empty');
  });

  it('undo after the original ingredient came back onto the list folds it in rather than listing it twice', () => {
    fresh();
    let l = put(put(emptyList(), 'shallot', '1 cup'), 'z');
    const id = l.items[0].id;
    l = replaceItem(l, id, { key: 'onion' }, T()).list;
    l = put(l, 'shallot', '2 cups');
    const u = undoReplace(l, id, T());
    expect(only(u, 'shallot')).toHaveLength(1);
    expect(text(u, 'shallot')).toBe('3 cups');
    expect(only(u, 'onion')).toHaveLength(0);
  });

  it('a checked-off line stays checked when swapped; the alternative does not merge into a checked line', () => {
    fresh();
    let l = put(put(emptyList(), 'a'), 'b');
    l = toggle(l, l.items[1].id, T());
    const r = replaceItem(l, l.items[0].id, { key: 'b' }, T());
    expect(r.status).toBe('replaced');
    expect(r.list.items.map((i) => [i.key, i.checked])).toEqual([['b', false], ['b', true]]);
  });
});

describe('what the cook has: one predicate over kitchen, pantry and bar', () => {
  it('covers by name, by equivalent, and from the bar', () => {
    const has = makeHas({ kitchen: ['garlic', 'lemon'], pantry: ['rice'], bar: ['gin', 'bourbon'] });
    expect(has('garlic')).toBe(true);
    expect(has('rice')).toBe(true);
    expect(has('gin')).toBe(true);
    expect(has('lemon juice')).toBe(true);
    expect(has('campari')).toBe(false);
    expect(has('scallion')).toBe(false);
    expect(makeHas({ kitchen: ['green onion'] })('scallion')).toBe(true);
    expect(makeHas({ spiceRack: true })('cumin')).toBe(true);
    expect(makeHas({})('cumin')).toBe(false);
  });
});

// Real recipes, loaded the way the other tests load them (recipeProfileCoverage.test.js).
const codex = readCuratedCodex();
const sauces = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/sauce_augment.json'), 'utf8')).sauces;
const data = { cocktails: codex.cocktails, families: codex.families, sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
const real = (kind, slug) => { const r = resolveBuiltIn(kind, slug, data); expect(r, `${kind}/${slug}`).toBeTruthy(); return r; };
const keys = (r) => r.lines.map((l) => l.key);

describe('addRecipe on real built-in recipes', () => {
  const bolognese = real('dish', 'beef-bolognese');
  const carbonara = real('dish', 'spaghetti-carbonara');
  const bechamel = real('sauce', 'bechamel');
  const negroni = real('cocktail', 'negroni');
  const kitchen = ['onion', 'carrot', 'garlic', 'milk'];
  const bar = ['gin', 'bourbon'];
  const has = makeHas({ kitchen, bar });

  it('a dish: only what the cook lacks, counts right', () => {
    fresh();
    const { list, summary } = addRecipe(emptyList(), bolognese, has, T());
    expect(only(list, 'onion')).toHaveLength(0);
    expect(list.items.map((i) => i.key)).toEqual(['beef', 'tomato', 'celery', 'red wine', 'pasta']);
    expect(summary).toMatchObject({ added: 5, merged: 0, skippedHave: 3, skippedBasics: 0, alreadyOnList: false });
    expect(summary.addedLines.map((x) => x.key)).toEqual(['beef', 'tomato', 'celery', 'red wine', 'pasta']);
    expect(text(list, 'beef')).toBe('500 g');
    expect(text(list, 'celery')).toBe('1 stalk');
    expect(list.recipes).toEqual([{ id: 'dish:beef-bolognese', kind: 'dish', name: 'Beef Bolognese', addedAt: 1000 }]);
    expect(list.items.every((i) => i.from.join() === 'dish:beef-bolognese' && !i.checked && i.updatedAt === 1000)).toBe(true);
  });

  it('a sauce: basics (butter, flour, salt) are skipped by default and included on request', () => {
    fresh();
    const a = addRecipe(emptyList(), bechamel, has, T());
    expect(a.list.items.map((i) => i.key)).toEqual(['white pepper', 'nutmeg']);
    expect(a.summary).toMatchObject({ added: 2, skippedHave: 1, skippedBasics: 3 });
    const b = addRecipe(emptyList(), bechamel, has, { ...T(), includeBasics: true });
    expect(b.list.items.map((i) => i.key)).toEqual(['butter', 'flour', 'salt', 'white pepper', 'nutmeg']);
    expect(b.summary).toMatchObject({ added: 5, skippedHave: 1, skippedBasics: 0 });
    expect(text(b.list, 'butter')).toBe('2 tbsp');
    expect(text(b.list, 'nutmeg')).toBe('');
  });

  it('a cocktail: the bar covers gin, so only the rest comes onto the list', () => {
    fresh();
    const { list, summary } = addRecipe(emptyList(), negroni, has, T());
    expect(keys(negroni)).toEqual(['gin', 'sweet vermouth', 'campari']);
    expect(list.items.map((i) => i.key)).toEqual(['sweet vermouth', 'campari']);
    expect(text(list, 'campari')).toBe('30 ml');
    expect(summary).toMatchObject({ added: 2, skippedHave: 1, skippedBasics: 0 });
    expect(addRecipe(emptyList(), negroni, makeHas({ bar: ['gin', 'sweet vermouth', 'campari'] }), T()).list.items).toEqual([]);
  });

  it('two real recipes sharing an ingredient with like-unit amounts leave one line with the summed amount', () => {
    fresh();
    let r = addRecipe(emptyList(), bolognese, () => false, T());
    r = addRecipe(r.list, carbonara, () => false, T());
    expect(only(r.list, 'pasta')).toHaveLength(1);
    expect(text(r.list, 'pasta')).toBe('600 g');
    expect(only(r.list, 'pasta')[0].from).toEqual(['dish:beef-bolognese', 'dish:spaghetti-carbonara']);
    expect(r.summary.mergedLines).toEqual([{ key: 'pasta', label: 'pasta', now: '600 g' }]);
    expect(r.summary.merged).toBe(1);
    // egg yolk's "3 (+1 whole egg)" is not a specific quantity
    expect(text(r.list, 'egg yolk')).toBe('');
    expect(r.list.recipes.map((x) => x.id)).toEqual(['dish:beef-bolognese', 'dish:spaghetti-carbonara']);
  });

  it('the same recipe again is reported and adds nothing unless forced (then it doubles, by the rule)', () => {
    fresh();
    const first = addRecipe(emptyList(), bolognese, has, T());
    const again = addRecipe(first.list, bolognese, has, T());
    expect(again.summary).toMatchObject({ alreadyOnList: true, added: 0, merged: 0 });
    expect(again.list).toBe(first.list);
    const forced = addRecipe(first.list, bolognese, has, { ...T(), force: true });
    expect(forced.summary).toMatchObject({ alreadyOnList: true, added: 0, merged: 5 });
    expect(text(forced.list, 'beef')).toBe('1000 g');
    expect(forced.list.recipes).toHaveLength(1);
  });

  it('a recipe whose lines were all checked off or removed is no longer "on the list"', () => {
    fresh();
    let l = addRecipe(emptyList(), negroni, has, T()).list;
    l = clearChecked(l.items.reduce((acc, i) => toggle(acc, i.id, T()), l));
    expect(l.items).toEqual([]);
    expect(l.recipes).toEqual([]);
    expect(addRecipe(l, negroni, has, T()).summary.alreadyOnList).toBe(false);
  });

  it('merging into a line the cook already typed notes the recipe on it', () => {
    fresh();
    const l = put(emptyList(), 'celery', '2 stalks');
    const r = addRecipe(l, bolognese, has, T());
    expect(only(r.list, 'celery')).toHaveLength(1);
    expect(text(r.list, 'celery')).toBe('3 stalks');
    expect(only(r.list, 'celery')[0].from).toEqual(['dish:beef-bolognese']);
    expect(r.summary.mergedLines).toEqual([{ key: 'celery', label: 'celery', now: '3 stalks' }]);
  });
});

// Property-style: seeded random sequences over a small ingredient set.
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const NAMES = ['garlic', 'scallion', 'green onion', 'milk', 'pasta', 'onion', 'basil', 'gin', 'lemon'];
const AMOUNTS = [null, '', '2 cloves', '1 tbsp', '200 g', '1 cup', '2-3 oz', 'a pinch', '3', '1 kg', '2 tsp', '1/2 cup'];
const mkRecipe = (r, n) => ({
  kind: 'dish', slug: `r${n}`, name: `R${n}`,
  lines: Array.from({ length: 1 + Math.floor(r() * 4) }, () => ({ key: NAMES[Math.floor(r() * NAMES.length)], amount: AMOUNTS[Math.floor(r() * AMOUNTS.length)] })),
});

describe('property: any sequence of operations', () => {
  for (const seed of Array.from({ length: 40 }, (_, i) => i + 1)) {
    it(`seed ${seed}: no two unchecked items share a key; JSON-safe; ids unique`, () => {
      const r = rng(seed);
      let n = 0;
      const ids = () => `p${seed}-${n++}`;
      let list = emptyList();
      let now = 0;
      for (let step = 0; step < 120; step += 1) {
        now += 1;
        const opts = { now, newId: ids };
        const pick = () => list.items[Math.floor(r() * list.items.length)];
        const op = Math.floor(r() * 7);
        if (op === 0) list = addLine(list, { key: NAMES[Math.floor(r() * NAMES.length)], amount: AMOUNTS[Math.floor(r() * AMOUNTS.length)] }, opts).list;
        else if (op === 1) list = addRecipe(list, mkRecipe(r, Math.floor(r() * 5)), (k) => k === 'gin', { ...opts, force: r() < 0.5 }).list;
        else if (op === 2 && list.items.length) list = toggle(list, pick().id, opts);
        else if (op === 3 && list.items.length) list = replaceItem(list, pick().id, { key: NAMES[Math.floor(r() * NAMES.length)] }, opts).list;
        else if (op === 4 && list.items.length) list = remove(list, pick().id);
        else if (op === 5 && r() < 0.3) list = clearChecked(list);
        else if (op === 6 && list.items.length) { const p = pick(); if (p.was) list = undoReplace(list, p.id, opts); }
        const unchecked = list.items.filter((i) => !i.checked).map((i) => i.key);
        expect(new Set(unchecked).size, `step ${step}`).toBe(unchecked.length);
        expect(JSON.parse(JSON.stringify(list))).toEqual(list);
        expect(new Set(list.items.map((i) => i.id)).size).toBe(list.items.length);
        expect(list.items.length).toBeLessThanOrEqual(MAX_ITEMS);
        for (const it of list.items) {
          expect(it.parts.every((p) => p.qty > 0 && typeof p.unit === 'string')).toBe(true);
          expect(Number.isFinite(it.updatedAt)).toBe(true);
        }
      }
    });
  }

  it('functions never mutate their input (deep-frozen lists)', () => {
    const deepFreeze = (o) => { Object.values(o).forEach((v) => { if (v && typeof v === 'object') deepFreeze(v); }); return Object.freeze(o); };
    fresh();
    const l = addRecipe(emptyList(), { kind: 'dish', slug: 'a', name: 'A', lines: [{ key: 'garlic', amount: '2 cloves' }, { key: 'milk', amount: '1 cup' }] }, () => false, T()).list;
    deepFreeze(l);
    const id = l.items[0].id;
    expect(() => {
      addLine(l, { key: 'garlic', amount: '1 tbsp' }, T());
      addLine(l, { key: 'lemon' }, T());
      addRecipe(l, { kind: 'dish', slug: 'b', name: 'B', lines: [{ key: 'garlic', amount: '1 clove' }] }, () => false, T());
      toggle(l, id, T());
      remove(l, id);
      clearChecked(l);
      const r = replaceItem(l, id, { key: 'shallot' }, T());
      deepFreeze(r.list);
      undoReplace(r.list, id, T());
      replaceItem(l, id, { key: 'milk' }, T());
      groupByAisle(l);
      toText(l);
    }).not.toThrow();
  });
});
