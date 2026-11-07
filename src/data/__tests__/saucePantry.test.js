import { describe, it, expect } from 'vitest';
import {
  sauceRoleOf, sauceKind, sameRoleAndKind, buildCategoryMap, standInFor, coverSauce,
  whatSauceCanIMake, commonSauceIngredients, sauceIngredientNames,
} from '../saucePantry.js';
import { buildPairingIndex } from '../recipePairingMatch.js';

const meta = [
  { name: 'butter', category: 'Fat' }, { name: 'olive oil', category: 'Fat' },
  { name: 'flour', category: 'Thickener' }, { name: 'cornstarch', category: 'Thickener' }, { name: 'egg yolk', category: 'Thickener' },
  { name: 'milk', category: 'Liquid' }, { name: 'cream', category: 'Liquid' }, { name: 'white wine', category: 'Liquid' }, { name: 'chicken stock', category: 'Liquid' },
  { name: 'lemon juice', category: 'Acid' }, { name: 'lime juice', category: 'Acid' }, { name: 'white wine vinegar', category: 'Acid' }, { name: 'tomato', category: 'Acid' },
  { name: 'onion', category: 'Aromatic' }, { name: 'shallot', category: 'Aromatic' }, { name: 'garlic', category: 'Aromatic' },
  { name: 'tarragon', category: 'Herb' }, { name: 'parsley', category: 'Herb' },
  { name: 'nutmeg', category: 'Seasoning' }, { name: 'salt', category: 'Seasoning' },
  { name: 'sour cream', category: 'Other' }, { name: 'tahini', category: 'Other' }, { name: 'ketchup', category: 'Other' },
];
const catMap = buildCategoryMap(meta);

const hollandaise = { name: 'Hollandaise', family_id: 3, ingredients: ['egg yolk', 'butter', 'lemon juice', 'salt'] };
const bearnaise = { name: 'Béarnaise', family_id: 3, ingredients: ['egg yolk', 'butter', 'white wine vinegar', 'shallot', 'tarragon'] };
const bechamel = { name: 'Béchamel', family_id: 0, ingredients: ['butter', 'flour', 'milk', 'nutmeg', 'salt'] };
const soubise = { name: 'Soubise', family_id: 0, ingredients: ['butter', 'flour', 'milk', 'onion'] };
const smetana = { name: 'Smetana', family_id: 1, ingredients: ['butter', 'onion', 'white wine', 'crème fraîche'] };
const sauces = [hollandaise, bearnaise, bechamel, soubise, smetana];

describe('sauce roles and kinds', () => {
  it('reads the catalogue, with dairy and eggs classed by name', () => {
    expect(sauceRoleOf('butter', catMap)).toBe('Fat');
    expect(sauceRoleOf('sour cream', catMap)).toBe('Liquid'); // catalogue says Other; it is dairy
    expect(sauceRoleOf('crème fraîche', catMap)).toBe('Liquid');
    expect(sauceRoleOf('eggs', catMap)).toBe('Thickener');
    expect(sauceRoleOf('lemon', catMap)).toBe('Acid');
    expect(sauceRoleOf('coconut milk', new Map([['coconut milk', 'Liquid']]))).toBe('Liquid');
    expect(sauceRoleOf('', catMap)).toBeNull();
  });
  it('separates kinds within a role', () => {
    expect(sauceKind('egg yolk', 'Thickener')).toBe('egg');
    expect(sauceKind('flour', 'Thickener')).toBe('flour');
    expect(sauceKind('cornstarch', 'Thickener')).toBe('starch');
    expect(sauceKind('cream', 'Liquid')).toBe(sauceKind('crème fraîche', 'Liquid'));
    expect(sauceKind('milk', 'Liquid')).not.toBe(sauceKind('cream', 'Liquid'));
    expect(sauceKind('ketchup', 'Other')).not.toBe(sauceKind('tahini', 'Other'));
  });
  it('same role and kind: lime for lemon, shallot for onion — never across', () => {
    expect(sameRoleAndKind('lime juice', 'lemon juice', catMap)).toBe(true);
    expect(sameRoleAndKind('shallot', 'onion', catMap)).toBe(true);
    expect(sameRoleAndKind('cream', 'crème fraîche', catMap)).toBe(true);
    expect(sameRoleAndKind('flour', 'egg yolk', catMap)).toBe(false); // a starch cannot emulsify
    expect(sameRoleAndKind('garlic', 'onion', catMap)).toBe(false);
    expect(sameRoleAndKind('vinegar', 'lemon juice', catMap)).toBe(false);
    expect(sameRoleAndKind('butter', 'lemon juice', catMap)).toBe(false);
  });
});

describe('stand-ins', () => {
  it('offers a same-role, same-kind stand-in from the pantry', () => {
    expect(standInFor('lemon juice', hollandaise, ['lime', 'egg yolk'], { catMap })).toMatchObject({ for: 'lemon juice', use: 'lime', role: 'Acid', kind: 'citrus' });
    expect(standInFor('onion', soubise, ['shallot', 'garlic'], { catMap })?.use).toBe('shallot');
    expect(standInFor('crème fraîche', smetana, ['cream'], { catMap })?.use).toBe('cream');
  });
  it('never stands in across roles or kinds', () => {
    expect(standInFor('egg yolk', hollandaise, ['flour', 'cornstarch', 'milk'], { catMap })).toBeNull();
    expect(standInFor('milk', bechamel, ['cream'], { catMap })).toBeNull(); // cream is not milk
    expect(standInFor('onion', soubise, ['garlic'], { catMap })).toBeNull();
  });
  it('ranks stand-ins by pairing with the rest of the sauce', () => {
    const idx = buildPairingIndex([{ source: 'lime juice', target: 'butter', strength: 0.9 }], ['lime juice', 'butter']);
    expect(standInFor('lemon juice', hollandaise, ['yuzu', 'lime juice'], { catMap, sauceIndex: idx })?.use).toBe('lime juice');
  });
});

describe('what can I make', () => {
  it('nothing from an empty pantry, basics alone do not make a sauce', () => {
    expect(whatSauceCanIMake(sauces, [], { catMap })).toEqual({ make: [], nearly: [] });
  });
  it('sorts into can-make and one-or-two-away, naming what is missing', () => {
    const kitchen = ['egg yolk', 'lemon', 'milk', 'onion', 'shallot', 'white wine'];
    const r = whatSauceCanIMake(sauces, kitchen, { catMap });
    // butter, flour and salt are assumed basics; lemon covers lemon juice.
    expect(r.make.map((e) => e.item.name).sort()).toEqual(['Hollandaise', 'Soubise']);
    const byName = Object.fromEntries(r.nearly.map((e) => [e.item.name, e]));
    expect(byName['Béchamel'].missing).toEqual(['nutmeg']);
    expect(byName['Béarnaise'].missing.sort()).toEqual(['tarragon', 'white wine vinegar']);
    expect(byName['Smetana'].missing).toEqual(['crème fraîche']);
  });
  it('puts a one-away sauce with a pantry stand-in first', () => {
    const r = whatSauceCanIMake([bechamel, smetana], ['milk', 'onion', 'white wine', 'cream'], { catMap });
    expect(r.nearly[0].item.name).toBe('Smetana');
    expect(r.nearly[0].standIn?.use).toBe('cream');
    expect(r.nearly[1].standIn).toBeNull(); // nutmeg: nothing of that kind
  });
  it('without assumed basics, butter and flour count', () => {
    const r = whatSauceCanIMake([bechamel], ['milk', 'nutmeg'], { catMap, assumeBasics: false });
    expect(r.make).toEqual([]);
    expect(r.nearly).toEqual([]); // butter, flour and salt: three away
  });
  it('a pantry egg covers a recipe yolk', () => {
    expect(coverSauce(hollandaise, ['eggs', 'lemon'], { catMap }).missing).toEqual([]);
  });
});

describe('vocabulary', () => {
  it('common ingredients skip basics; names cover catalogue and sauce lines', () => {
    const common = commonSauceIngredients(sauces, 5);
    expect(common).not.toContain('butter');
    expect(common).not.toContain('salt');
    expect(common.slice(0, 3)).toEqual(['egg yolk', 'milk', 'onion']); // 2 sauces each, then by name
    const names = sauceIngredientNames(meta, sauces);
    expect(names.has('crème fraîche')).toBe(true);
    expect(names.has('ketchup')).toBe(true);
  });
});
