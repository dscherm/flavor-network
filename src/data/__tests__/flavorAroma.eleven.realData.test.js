import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { aromaBarsFor } from '../../../scripts/measureFlavorProfile.mjs';
import { loadFlavorNodes } from '../../../scripts/lib/flavorNodes.mjs';
import { SEED_RECIPES } from '../seedRecipes.js';
import { RECIPE_DETAILS } from '../seedRecipeDetails.js';
import { AROMAS } from '../flavorAromas.js';
import { aromaProfile, AROMA_AXES } from '../flavorAroma.js';
import { buildFlavorProfile } from '../inventProfile.js';

// AROMA-3: the named checks on the eleven aroma axes, run on the real table and the real built-in recipes.
const codex = JSON.parse(readFileSync('public/data/cocktail_codex_v2.json', 'utf8'));
const sauces = JSON.parse(readFileSync('public/data/sauce_augment.json', 'utf8')).sauces;
const data = { cocktails: codex.cocktails, families: codex.families, sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
const nodes = loadFlavorNodes();

const ranked = (id) => aromaBarsFor({ id }, data, nodes).bars
  .filter((b) => b.axis.startsWith('odor_') && b.score > 0).sort((a, b) => b.score - a.score).map((b) => b.axis.slice(5));
const lead = (id) => ranked(id)[0];
const top = (id, n) => ranked(id).slice(0, n);

describe('the eleven aroma axes', () => {
  it('the chart has eleven aroma axes with these ids', () => {
    expect(AROMA_AXES).toEqual(['odor_fruity', 'odor_floral', 'odor_green', 'odor_woody', 'odor_spicy', 'odor_fatty',
      'odor_toasty', 'odor_nutty', 'odor_earthy', 'odor_smoky', 'odor_savory']);
  });
  it('each new axis leads enough table lines to be a real axis, not a stray number', () => {
    const lead1 = (line) => Object.entries(line).filter(([k]) => k !== 'potency').sort((a, b) => b[1] - a[1])[0]?.[0];
    const count = Object.fromEntries(['toasty', 'nutty', 'earthy', 'smoky', 'savory'].map((a) => [a, Object.values(AROMAS).filter((l) => lead1(l) === a).length]));
    for (const [a, n] of Object.entries(count)) expect(n, a).toBeGreaterThanOrEqual(5);
  });
});

describe('named ingredient checks (a single ingredient, through the app aroma code)', () => {
  const one = (key) => {
    const p = aromaProfile([{ key }]);
    return Object.entries(p.scores).sort((a, b) => b[1] - a[1])[0][0].slice(5);
  };
  it.each([
    ['fish sauce', 'savory'], ['anchovy', 'savory'], ['soy sauce', 'savory'], ['miso', 'savory'],
    ['coffee', 'toasty'], ['espresso', 'toasty'], ['brown sugar', 'toasty'], ['caramel', 'toasty'], ['kahlua', 'toasty'],
    ['almond', 'nutty'], ['tahini', 'nutty'], ['peanut', 'nutty'], ['almond milk', 'nutty'], ['sherry', 'nutty'],
    ['mushroom', 'earthy'], ['beet', 'earthy'], ['truffle', 'earthy'],
    ['smoked paprika', 'smoky'], ['mezcal', 'smoky'], ['bacon', 'smoky'], ['liquid smoke', 'smoky'],
  ])('%s leads %s', (key, axis) => { expect(one(key)).toBe(axis); });
  it('vanilla is still woody, bourbon still woody, mint green', () => {
    expect(one('vanilla')).toBe('woody');
    expect(one('bourbon')).toBe('woody');
    expect(one('mint')).toBe('green');
  });
});

describe('named recipe checks on real built-in recipes', () => {
  it('a White Russian and an Irish Coffee show toasty and fatty', () => {
    expect(top('cocktail/white-russian', 2).sort()).toEqual(['fatty', 'toasty']);
    expect(lead('cocktail/irish-coffee')).toBe('toasty');
    expect(top('cocktail/irish-coffee', 3)).toContain('fatty');
  });
  it('an Old Fashioned still leads woody', () => { expect(lead('cocktail/old-fashioned')).toBe('woody'); });
  it('a mezcal drink leads smoky', () => { expect(lead('cocktail/empellon-cocinas-fat-washed-mezcal')).toBe('smoky'); });
  it('miso soup and soy-based sauces (teriyaki, tare, ponzu) and dashi lead savory', () => {
    for (const id of ['dish/miso-soup', 'sauce/teriyaki', 'sauce/tare', 'sauce/ponzu', 'sauce/dashi']) expect(lead(id), id).toBe('savory');
  });
  it('romesco, a nut sauce, leads nutty', () => { expect(lead('sauce/romesco')).toBe('nutty'); });
  it('a mushroom dish shows earthy: Bibimbap leads it, and a sauteed mushroom bowl has it in its top two', () => {
    expect(lead('dish/bibimbap')).toBe('earthy');
    const p = buildFlavorProfile(['mushroom', 'butter', 'thyme', 'garlic'], nodes, { amounts: { mushroom: '200 g', butter: '15 g', thyme: '2 g', garlic: '5 g' } });
    expect(p.bars.filter((b) => b.axis.startsWith('odor_')).slice(0, 2).map((b) => b.axis)).toContain('odor_earthy');
  });
});
