// INVENT-12: saved inventions in the profile, and their adapters to the codex shapes.
import { describe, it, expect } from 'vitest';
import {
  readSaved, saveInvention, deleteInvention, recipeFromItem,
  savedCocktailToCodex, withSavedCocktails, savedSauceToCodex, withSavedSauces,
  cocktailFamilyId, sauceFamilyId,
} from '../savedInventions.js';
import { SAVED_LIMITS } from '../inventSaved.js';

const FAMILIES = [0, 1, 2, 3, 4, 5].map((id) => ({ id, name: `Family ${id}`, color: '#abcdef' }));
const lines = (...keys) => keys.map((key) => ({ key, amount: '', role: null }));
const input = (over = {}) => ({ kind: 'cocktail', name: 'My Drink', category: 3, lines: [{ key: 'bourbon', amount: '2 oz', role: 'spirit' }, { key: 'bitters', amount: '2 dashes', role: 'aromatic' }], ...over });
const ctx = (n = 1) => ({ now: 1000 + n, makeId: () => `id-${n}` });

describe('saveInvention', () => {
  it('appends one item to the right array and changes nothing else', () => {
    const profile = { cuisines: ['thai'], recipes: [{ name: 'Old', ingredients: [] }], cocktails: [], sauces: [], pairings: [], quizAnswers: null };
    const res = saveInvention(profile, input(), ctx());
    expect(res.ok).toBe(true);
    expect(res.profile.cocktails).toHaveLength(1);
    expect(res.profile.cocktails[0]).toMatchObject({ id: 'id-1', kind: 'cocktail', name: 'My Drink', category: 3, source: 'invent' });
    const { cocktails: _a, ...restBefore } = profile;
    const { cocktails: _b, ...restAfter } = res.profile;
    expect(restAfter).toEqual(restBefore);
    expect(profile.cocktails).toEqual([]);
  });

  it('puts sauces in sauces and leaves cocktails alone', () => {
    const res = saveInvention({ cocktails: [], sauces: [] }, input({ kind: 'sauce', category: 'Tomato' }), ctx());
    expect(res.profile.sauces).toHaveLength(1);
    expect(res.profile.cocktails).toEqual([]);
  });

  it('the same id replaces in place; a new id goes first', () => {
    let p = saveInvention({}, input({ name: 'A' }), ctx(1)).profile;
    p = saveInvention(p, input({ name: 'B' }), ctx(2)).profile;
    expect(p.cocktails.map((x) => x.name)).toEqual(['B', 'A']);
    const edited = saveInvention(p, input({ id: 'id-1', name: 'A renamed' }), ctx(3));
    expect(edited.profile.cocktails.map((x) => [x.id, x.name])).toEqual([['id-2', 'B'], ['id-1', 'A renamed']]);
  });

  it('refuses over 200 with a plain reason, but still lets an existing one be edited', () => {
    let p = { cocktails: [] };
    for (let i = 0; i < SAVED_LIMITS.perKind; i++) p = saveInvention(p, input({ name: `D${i}` }), ctx(i)).profile;
    expect(p.cocktails).toHaveLength(200);
    const over = saveInvention(p, input({ name: 'one more' }), ctx(999));
    expect(over.ok).toBe(false);
    expect(over.reason).toMatch(/200 saved cocktails/);
    expect(over.profile).toBe(p);
    expect(saveInvention(p, input({ id: 'id-5', name: 'edited' }), ctx(5)).ok).toBe(true);
  });

  it('reports a validation problem without touching the profile', () => {
    const profile = { cocktails: [] };
    const res = saveInvention(profile, input({ name: '  ' }), ctx());
    expect(res).toMatchObject({ ok: false, reason: 'Give it a name first.' });
    expect(res.profile).toBe(profile);
  });

  it('keeps older Profile-panel entries that are not inventions', () => {
    const legacy = { id: 'cocktail_1', name: 'Legacy', ingredients: ['rum'], instructions: '' };
    const res = saveInvention({ cocktails: [legacy] }, input(), ctx());
    expect(res.profile.cocktails).toHaveLength(2);
    expect(res.profile.cocktails).toContainEqual(legacy);
    const del = deleteInvention(res.profile, 'cocktail', 'id-1');
    expect(del.cocktails).toEqual([legacy]);
  });

  it('saves a recipe in the existing user-recipe shape, marked source invent', () => {
    const res = saveInvention({ recipes: [{ name: 'Old', ingredients: [] }] }, {
      kind: 'recipe', name: 'Weeknight Stir-fry', category: 'stir-fry', cuisine: 'chinese', method: 'Stir fast.',
      lines: [{ key: 'Chicken', amount: '1 lb', role: null }, { key: 'broccoli', amount: '', role: null }],
    }, ctx());
    expect(res.ok).toBe(true);
    expect(res.profile.recipes).toHaveLength(2);
    expect(res.profile.recipes[1]).toEqual({
      id: 'id-1', name: 'Weeknight Stir-fry',
      ingredients: [
        { name: 'chicken', quantity: null, unit: null, raw: '1 lb Chicken' },
        { name: 'broccoli', quantity: null, unit: null, raw: 'broccoli' },
      ],
      instructions: 'Stir fast.', cuisine: 'chinese', source: 'invent',
    });
    expect(res.profile.cocktails).toBeUndefined();
  });

  it('saving the same invented recipe again replaces it', () => {
    const rec = { kind: 'recipe', name: 'Soup', lines: lines('stock', 'carrot') };
    let p = saveInvention({ recipes: [] }, rec, ctx(1)).profile;
    p = saveInvention(p, { ...rec, id: 'id-1', lines: lines('stock', 'carrot', 'leek') }, ctx(2)).profile;
    expect(p.recipes).toHaveLength(1);
    expect(p.recipes[0].ingredients).toHaveLength(3);
  });
});

describe('deleteInvention / readSaved', () => {
  it('removes one by id', () => {
    let p = saveInvention({}, input({ name: 'A' }), ctx(1)).profile;
    p = saveInvention(p, input({ name: 'B' }), ctx(2)).profile;
    expect(deleteInvention(p, 'cocktail', 'id-1').cocktails.map((x) => x.name)).toEqual(['B']);
    expect(recipeFromItem({ id: 'x', name: 'N', lines: lines('a', 'b') }).source).toBe('invent');
  });

  it('a profile with no fields, or malformed entries, reads as empty lists', () => {
    expect(readSaved(undefined, 'cocktail')).toEqual([]);
    expect(readSaved({}, 'sauce')).toEqual([]);
    expect(readSaved({ cocktails: 'nope', sauces: { a: 1 } }, 'cocktail')).toEqual([]);
    const bad = [null, 5, 'x', {}, { id: 'a', kind: 'cocktail', name: '', lines: [] }, { id: 'b', kind: 'sauce', name: 'wrong kind', lines: lines('a', 'b') }, { name: 'legacy', ingredients: ['a'] }];
    expect(readSaved({ cocktails: bad }, 'cocktail')).toEqual([]);
    expect(deleteInvention({}, 'cocktail', 'zzz')).toEqual({ cocktails: [] });
  });
});

describe('cocktail adapters', () => {
  const item = saveInvention({}, input({ name: 'Bourbon Bitters', method: 'Stir.', glass: 'rocks' }), ctx()).item;

  it('turns a saved cocktail into a codex cocktail', () => {
    const c = savedCocktailToCodex(item, { families: FAMILIES });
    expect(c).toMatchObject({
      name: 'Bourbon Bitters', canonical: 'bourbon bitters', family_id: 3, mine: true, savedId: 'id-1',
      glass: 'rocks', recipe_text: 'Stir.', iba_official: false, subcluster_id: null,
    });
    expect(c.ingredients_raw).toEqual([{ raw: '2 oz bourbon' }, { raw: '2 dashes bitters' }]);
  });

  it('uses the recommended family when no category was saved, else null (Uncategorised)', () => {
    const noCat = { ...item, category: null };
    const fid = cocktailFamilyId(noCat, FAMILIES, {});
    expect(fid === null || FAMILIES.some((f) => f.id === fid)).toBe(true);
    const odd = { ...item, category: null, lines: lines('zzz one', 'zzz two') };
    expect(cocktailFamilyId(odd, FAMILIES, {})).toBeNull();
    expect(cocktailFamilyId({ ...item, category: '99' }, FAMILIES, {})).not.toBe(99);
  });

  it('merges into the graph without touching the original', () => {
    const base = { families: FAMILIES, cocktails: [{ name: 'Negroni', canonical: 'negroni', family_id: 3 }], byFamily: new Map([[3, [{ name: 'Negroni' }]]]), byCanonical: new Map() };
    expect(withSavedCocktails(base, [], {})).toBe(base);
    const merged = withSavedCocktails(base, [item], {});
    expect(merged.cocktails.map((c) => c.name)).toEqual(['Negroni', 'Bourbon Bitters']);
    expect(merged.byFamily.get(3).map((c) => c.name)).toEqual(['Negroni', 'Bourbon Bitters']);
    expect(merged.mine).toHaveLength(1);
    expect(base.cocktails).toHaveLength(1);
    expect(base.byFamily.get(3)).toHaveLength(1);
  });

  it('keeps an uncategorised drink out of every family and gives a clashing name a suffix', () => {
    const base = { families: FAMILIES, cocktails: [{ name: 'Negroni', canonical: 'negroni', family_id: 3 }], byFamily: new Map(), byCanonical: new Map() };
    const odd = { ...item, id: 'u1', name: 'Negroni', category: null, lines: lines('zzz one', 'zzz two') };
    const merged = withSavedCocktails(base, [odd], {});
    expect(merged.mine[0].name).toBe('Negroni (yours)');
    expect(merged.mine[0].family_id).toBeNull();
    expect([...merged.byFamily.values()].flat()).toHaveLength(0);
  });
});

describe('sauce adapters', () => {
  const CLUSTERS = [{ id: 0, name: 'Béchamel', color: '#111111' }, { id: 4, name: 'Tomato', color: '#d94a3d' }];
  const sauce = saveInvention({}, { kind: 'sauce', name: 'Red Thing', category: 'Tomato', protein: 'pasta', method: 'Simmer.', lines: [{ key: 'tomato', amount: '1 can', role: null }, { key: 'garlic', amount: '2 cloves', role: null }] }, ctx()).item;

  it('maps a style id to its family and builds a codex node', () => {
    expect(sauceFamilyId(sauce, CLUSTERS)).toBe(4);
    const n = savedSauceToCodex(sauce, { clusters: CLUSTERS });
    expect(n).toMatchObject({ name: 'Red Thing', family_id: 4, family: 'Tomato', mine: true, savedId: 'id-1', instructions: 'Simmer.', proteins: ['pasta'] });
    expect(n.ingredients).toEqual(['tomato', 'garlic']);
    expect(n.ingredientsDetailed).toEqual([{ name: 'tomato', measure: '1 can' }, { name: 'garlic', measure: '2 cloves' }]);
  });

  it('falls back to Uncategorised when nothing fits', () => {
    const odd = { ...sauce, category: null, lines: lines('zzz one', 'zzz two') };
    expect(sauceFamilyId(odd, CLUSTERS)).toBeNull();
    expect(savedSauceToCodex(odd, { clusters: CLUSTERS }).family).toBe('Uncategorised');
  });

  it('adds saved sauces to graph.nodes by display name', () => {
    const codex = { codex: { clusters: CLUSTERS }, graph: { nodes: new Map([['Red Thing', { name: 'Red Thing' }]]), edges: [] } };
    expect(withSavedSauces(codex, [], {})).toBe(codex);
    const m = withSavedSauces(codex, [sauce], {});
    expect([...m.graph.nodes.keys()]).toEqual(['Red Thing', 'Red Thing (yours)']);
    expect(codex.graph.nodes.size).toBe(1);
    expect(m.mine).toHaveLength(1);
  });
});

describe('one display name everywhere (title, Yours row, search, lookup)', () => {
  it('cocktail: a clash with a codex name is "Negroni (yours)" in every place the lists read', () => {
    const base = { families: FAMILIES, cocktails: [{ name: 'Negroni', canonical: 'negroni', family_id: 3 }], byFamily: new Map(), byCanonical: new Map() };
    const mine = saveInvention({}, input({ name: 'Negroni' }), ctx()).item;
    const merged = withSavedCocktails(base, [mine], {});
    const row = merged.mine[0];
    expect(row.name).toBe('Negroni (yours)');
    expect(row.canonical).toBe('negroni yours');
    expect(merged.cocktails.map((c) => c.name)).toEqual(['Negroni', 'Negroni (yours)']);
    expect(merged.cocktails[1]).toBe(row);
    expect(merged.byCanonical.get(row.canonical)).toBe(row);
    expect(merged.byFamily.get(3)[0]).toBe(row);
  });
  it('sauce: the node key, the node name and the Yours row agree', () => {
    const CLUSTERS = [{ id: 4, name: 'Tomato', color: '#d94a3d' }];
    const s = saveInvention({}, { kind: 'sauce', name: 'Red Thing', category: 'Tomato', lines: [{ key: 'tomato', amount: '', role: null }, { key: 'garlic', amount: '', role: null }] }, ctx()).item;
    const codex = { codex: { clusters: CLUSTERS }, graph: { nodes: new Map([['Red Thing', { name: 'Red Thing' }]]), edges: [] } };
    const m = withSavedSauces(codex, [s], {});
    const row = m.mine[0];
    expect(row.name).toBe('Red Thing (yours)');
    expect(m.graph.nodes.get('Red Thing (yours)')).toBe(row);
  });
});
