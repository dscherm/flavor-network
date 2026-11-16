import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { measure, profileFor, validateTruth } from '../../../scripts/measureFlavorProfile.mjs';
import { loadFlavorNodes } from '../../../scripts/lib/flavorNodes.mjs';
import { resolveBuiltIn } from '../sharedRecipe.js';
import { SEED_RECIPES } from '../seedRecipes.js';
import { RECIPE_DETAILS } from '../seedRecipeDetails.js';
import { summarize, TASTES } from '../flavorScore.js';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';

const truth = JSON.parse(readFileSync('data/flavor-truth.json', 'utf8'));
const holdout = JSON.parse(readFileSync('data/flavor-holdout.json', 'utf8'));
const codex = readCuratedCodex();
const sauces = JSON.parse(readFileSync('public/data/sauce_augment.json', 'utf8')).sauces;
const data = { cocktails: codex.cocktails, families: codex.families, sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
const nodes = loadFlavorNodes();

/** The taste bars of a built-in recipe, strongest first: [[axis, score]]. */
function chart(id) {
  const [kind, slug] = id.split('/');
  const recipe = resolveBuiltIn(kind, slug, data);
  expect(recipe, id).toBeTruthy();
  const p = profileFor(recipe, { nodes, kind });
  return p.bars.filter((b) => TASTES.includes(b.axis)).sort((a, b) => b.score - a.score).map((b) => [b.axis, b.score]);
}
const top = (id, n = 2) => chart(id).slice(0, n).map(([a]) => a);

describe('the measurement after FLAVOR-4', () => {
  it('the main answer key: top taste expected for at least 85% of items and no forbidden taste leads', () => {
    expect(validateTruth(truth)).toEqual([]);
    const { rows, missing } = measure(truth, data, nodes, profileFor);
    expect(missing).toEqual([]);
    const sum = summarize(rows);
    expect(sum.top1Pct).toBeGreaterThanOrEqual(85);
    expect(sum.forbiddenLeads).toBe(0);
    expect(sum.noChart).toBe(0);
  });
  it('the hold-out (written before the table was tuned) moves the same way', () => {
    expect(validateTruth(holdout)).toEqual([]);
    const { rows, missing } = measure(holdout, data, nodes, profileFor);
    expect(missing).toEqual([]);
    const sum = summarize(rows);
    expect(sum.top1Pct).toBeGreaterThanOrEqual(85);
    expect(sum.forbiddenLeads).toBeLessThanOrEqual(1);
  });
  it('the hold-out shares no recipe with the main key (it must not be tuned on)', () => {
    const main = new Set(truth.items.map((i) => i.id));
    expect(holdout.items.filter((i) => main.has(i.id))).toEqual([]);
    expect(holdout.items.length).toBeGreaterThanOrEqual(15);
  });
});

describe('named checks on the real recipes', () => {
  it('Negroni charts bitter then sweet, and sour is not in the top two', () => {
    expect(top('cocktail/negroni')).toEqual(['bitter', 'sweet']);
  });
  it('Daiquiri charts sour and sweet', () => {
    expect([...top('cocktail/daiquiri')].sort()).toEqual(['sour', 'sweet']);
  });
  it('Old Fashioned charts sweet and bitter, with the bitters registering', () => {
    const c = Object.fromEntries(chart('cocktail/old-fashioned'));
    expect([...top('cocktail/old-fashioned')].sort()).toEqual(['bitter', 'sweet']);
    expect(c.bitter).toBeGreaterThan(0.1);
    expect(c.sour ?? 0).toBeLessThan(c.bitter);
  });
  it('Margarita never charts bitter on top, has sour in the top two and a little salt from the rim; the dry one leads sour', () => {
    const c = chart('cocktail/margarita');
    expect(c[0][0]).not.toBe('bitter');
    expect(top('cocktail/margarita')).toContain('sour');
    expect(Object.fromEntries(c).salty).toBeGreaterThan(0);
    expect(Object.fromEntries(c).salty).toBeLessThan(0.15);
    expect(top('cocktail/margarita-dry', 1)).toEqual(['sour']);
  });
  it('Bolognese and marinara no longer lead sweet; marinara leads umami', () => {
    expect(top('dish/beef-bolognese', 1)).not.toEqual(['sweet']);
    expect(top('sauce/bolognese', 1)).not.toEqual(['sweet']);
    expect(top('sauce/marinara', 1)).toEqual(['umami']);
    expect(top('dish/margherita-pizza', 1)).not.toEqual(['sweet']);
  });
  it('a soy-based sauce charts salty and umami', () => {
    expect(new Set(top('sauce/teriyaki'))).toEqual(new Set(['salty', 'umami']));
    expect(new Set(top('dish/caesar-salad'))).toEqual(new Set(['salty', 'umami']));
  });
  it('a Thai curry shows heat', () => {
    const heat = (id) => Object.fromEntries(chart(id)).heat ?? 0;
    expect(heat('dish/thai-green-curry')).toBeGreaterThanOrEqual(0.1);
    expect(heat('sauce/thai-green-curry')).toBeGreaterThanOrEqual(0.1);
    expect(top('sauce/thai-green-curry')).toContain('heat');
  });
  it('a gin and tonic and a highball still chart; soda water does not erase them', () => {
    expect(chart('cocktail/gin-and-tonic').length).toBeGreaterThan(0);
    expect(chart('cocktail/whisky-highball')[0][1]).toBeGreaterThanOrEqual(0.05);
  });
  it('tequila no longer charts a Gimlet or a Margarita bitter', () => {
    expect(top('cocktail/gimlet', 1)).toEqual(['sour']);
    expect(top('cocktail/aperol-spritz', 1)).not.toEqual(['sour']);
    expect(chart('cocktail/margarita')[0][0]).not.toBe('bitter');
  });
});
