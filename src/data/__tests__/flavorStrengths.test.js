import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { STRENGTHS, STRENGTH_ALIASES, NOT_IN_GRAPH, DEFAULT_GRAMS, strengthFor, defaultGrams, garnishTasteLines } from '../flavorStrengths.js';
import { ingredientTaste, tasteProfile, TASTE_AXES, TASTELESS_WEIGHT, STRENGTH_MAX, LABEL_STRENGTH_PER_WEIGHT } from '../flavorTaste.js';
import { buildFlavorProfile } from '../inventProfile.js';
import { loadCurationTables, applyCuration } from '../../../scripts/lib/curationTables.mjs';
import { resolveBuiltIn, uniqueBySlug, slugFor } from '../sharedRecipe.js';
import { SEED_RECIPES } from '../seedRecipes.js';
import { RECIPE_DETAILS } from '../seedRecipeDetails.js';
import { resolveIngredientName } from '../recipePairingMatch.js';
import { GENERIC_BOTTLE_KEYS, barKey } from '../myBar.js';
import { EXTRA_BOTTLES } from '../barScan.js';

const raw = JSON.parse(readFileSync('public/proDataset/ingredients.json', 'utf8'));
const GRAPH = new Set(Object.keys(applyCuration(raw, null, loadCurationTables()).ingredients).filter((k) => !k.startsWith('_')));
const codex = JSON.parse(readFileSync('public/data/cocktail_codex_v2.json', 'utf8'));
const sauces = JSON.parse(readFileSync('public/data/sauce_augment.json', 'utf8')).sauces;
const data = { cocktails: codex.cocktails, families: codex.families, sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
const known = (k) => Boolean(strengthFor(k));
const noLabel = () => undefined;

/** Ingredient keys of every built-in recipe of a kind, most used first (the same resolution the chart uses). */
function mostUsed(kinds) {
  const counts = new Map();
  const lists = { cocktail: codex.cocktails, sauce: sauces, dish: SEED_RECIPES };
  for (const kind of kinds) {
    for (const it of uniqueBySlug(kind, lists[kind])) {
      const r = resolveBuiltIn(kind, slugFor(kind, it), data);
      for (const l of r.lines) {
        const k = resolveIngredientName(l.label || l.key, GRAPH);
        if (k) counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
}

describe('the strength table is well formed', () => {
  it('every line has a potency and only known tastes on 0..3', () => {
    const bad = [];
    for (const [k, e] of Object.entries(STRENGTHS)) {
      if (typeof e.potency !== 'number' || e.potency < 0) bad.push(`${k}: potency`);
      for (const [a, v] of Object.entries(e)) {
        if (a === 'potency') continue;
        if (!TASTE_AXES.includes(a)) bad.push(`${k}: unknown key ${a}`);
        else if (typeof v !== 'number' || v <= 0 || v > STRENGTH_MAX) bad.push(`${k}: ${a}=${v} (omit zeros; max ${STRENGTH_MAX})`);
      }
      if (!TASTE_AXES.some((a) => e[a] > 0) && e.potency !== 0) bad.push(`${k}: no taste, so write potency: 0`);
    }
    expect(bad).toEqual([]);
  });
  it('every name is an ingredient in the curated data (or is listed in NOT_IN_GRAPH)', () => {
    const unknown = Object.keys(STRENGTHS).filter((k) => !GRAPH.has(k) && !NOT_IN_GRAPH.includes(k));
    expect(unknown).toEqual([]);
  });
  it('NOT_IN_GRAPH lists only names that really are missing from the graph, and each has a line', () => {
    expect(NOT_IN_GRAPH.filter((k) => GRAPH.has(k))).toEqual([]);
    expect(NOT_IN_GRAPH.filter((k) => !STRENGTHS[k])).toEqual([]);
  });
  it('every alias points at a line, and every default amount at a line', () => {
    expect(Object.entries(STRENGTH_ALIASES).filter(([, to]) => !STRENGTHS[to])).toEqual([]);
    expect(Object.keys(DEFAULT_GRAMS).filter((k) => !STRENGTHS[k])).toEqual([]);
  });
  it('there are 150 to 300 lines (the coverage tests below are what sets the size)', () => {
    expect(Object.keys(STRENGTHS).length).toBeGreaterThanOrEqual(150);
    expect(Object.keys(STRENGTHS).length).toBeLessThanOrEqual(300);
  });
});

describe('coverage: the ingredients that matter most all have a line', () => {
  it('every base spirit, every bottle in the bar list and every generic bottle key', () => {
    const spirits = ['gin', 'vodka', 'rum', 'whiskey', 'bourbon', 'rye', 'scotch', 'tequila', 'mezcal', 'brandy', 'cognac', 'pisco', 'cachaca', 'apple brandy'];
    const bar = EXTRA_BOTTLES.map((e) => barKey(e, GRAPH)).filter(Boolean);
    const missing = [...new Set([...spirits, ...GENERIC_BOTTLE_KEYS, ...bar])].filter((k) => !known(k));
    expect(missing).toEqual([]);
  });
  it('the 40 most used cocktail ingredients', () => {
    expect(mostUsed(['cocktail']).slice(0, 40).filter((k) => !known(k))).toEqual([]);
  });
  it('the 60 most used sauce and dish ingredients', () => {
    expect(mostUsed(['sauce', 'dish']).slice(0, 60).filter((k) => !known(k))).toEqual([]);
  });
  it('the bottles that are not graph names still chart', () => {
    const p = tasteProfile([{ key: 'licor 43', amount: '1 oz' }, { key: 'gin', amount: '1 oz' }], noLabel);
    expect(p.counted).toEqual(['licor 43', 'gin']);
    expect(p.scores.sweet).toBeGreaterThan(0);
  });
});

describe('an entry overrides the label', () => {
  it('lime juice is sour 3 with potency 2.5 whatever its label says', () => {
    const t = ingredientTaste('lime juice', 'sweet');
    expect(t.fromTable).toBe(true);
    expect(t.axes.sour).toBe(3);
    expect(t.axes.sweet).toBe(0);
    expect(t.potency).toBe(2.5);
  });
  it('a table ingredient with no label still counts', () => {
    expect(ingredientTaste('strega', undefined).any).toBe(true);
    expect(tasteProfile([{ key: 'strega', amount: '1 oz' }], noLabel).counted).toEqual(['strega']);
  });
  it('turning the table off falls back to the label', () => {
    const p = tasteProfile([{ key: 'lime juice', amount: '1 oz' }], () => 'sweet', { strengths: null });
    expect(p.scores.sweet).toBe(1);
    expect(p.scores.sour).toBe(0);
  });
  it('rich still comes from the label for a table ingredient', () => {
    expect(ingredientTaste('cream', 'rich sweet').rich).toBeGreaterThan(0);
  });
});

describe('potency: a small amount of something strong counts', () => {
  it('two dashes of bitters register against 2 oz of spirit', () => {
    const neat = tasteProfile([{ key: 'bourbon', amount: '2 oz' }], noLabel);
    const dashed = tasteProfile([{ key: 'bourbon', amount: '2 oz' }, { key: 'angostura bitters', amount: '2 dashes' }], noLabel);
    expect(dashed.scores.bitter).toBeGreaterThan(2 * neat.scores.bitter);
    expect(dashed.scores.bitter).toBeGreaterThan(0.1);
    expect(dashed.drivers.bitter[0]).toBe('angostura bitters');
  });
  it('without the table the same two dashes weigh 2 g against 57 g and barely show', () => {
    const lab = (k) => ({ bourbon: 'sweet bitter', 'angostura bitters': 'bitter' }[k]);
    const lines = [{ key: 'bourbon', amount: '2 oz' }, { key: 'angostura bitters', amount: '2 dashes' }];
    const labelOnly = tasteProfile(lines, lab, { strengths: null });
    const tabled = tasteProfile(lines, lab);
    expect(labelOnly.scores.bitter).toBeLessThan(0.1 + tasteProfile([lines[0]], lab, { strengths: null }).scores.bitter);
    expect(tabled.scores.bitter).not.toBeCloseTo(labelOnly.scores.bitter, 2);
  });
  it('3/4 oz of lime juice outweighs 2 oz of a spirit labelled bitter, for sour', () => {
    const p = tasteProfile([{ key: 'tequila', amount: '2 oz' }, { key: 'lime juice', amount: '0.75 oz' }], () => 'bitter');
    expect(p.scores.sour).toBeGreaterThan(p.scores.bitter);
  });
  it('a teaspoon of salt counts for more than its grams, and scores stay within 0..1', () => {
    const p = tasteProfile([{ key: 'salt', amount: '1 tsp' }, { key: 'tomato', amount: '400 g' }], noLabel);
    expect(p.scores.salty).toBeGreaterThan(0.05);
    expect(Math.max(...TASTE_AXES.map((a) => p.scores[a]))).toBeLessThanOrEqual(1);
    expect(p.drivers.salty[0]).toBe('salt');
  });
});

describe('zero potency: soda water and water do not erase the chart, but they do dilute it', () => {
  it('a highball still tastes of its spirit and reads weaker than the same drink neat', () => {
    const neat = tasteProfile([{ key: 'bourbon', amount: '2 oz' }, { key: 'simple syrup', amount: '0.5 oz' }], noLabel);
    const long = tasteProfile([{ key: 'bourbon', amount: '2 oz' }, { key: 'simple syrup', amount: '0.5 oz' }, { key: 'soda water', amount: '4 oz' }], noLabel);
    expect(long.charted).toBe(true);
    expect(long.scores.sweet).toBeGreaterThan(0.05);
    expect(long.scores.sweet).toBeLessThan(neat.scores.sweet);
    expect(long.scores.sweet).toBeGreaterThan(0.4 * neat.scores.sweet);
    expect(long.counted).toContain('soda water');
  });
  it('soda water costs the same as any other tasteless ingredient: its grams at TASTELESS_WEIGHT', () => {
    const a = tasteProfile([{ key: 'simple syrup', amount: '1 oz' }, { key: 'soda water', amount: '4 oz' }], noLabel);
    const b = tasteProfile([{ key: 'simple syrup', amount: '1 oz' }, { key: 'water', amount: '4 oz' }], noLabel);
    expect(a.scores.sweet).toBeCloseTo(b.scores.sweet, 6);
    const syrupWeight = 28.35 * strengthFor('simple syrup').potency;
    expect(a.scores.sweet).toBeCloseTo(syrupWeight / (syrupWeight + 4 * 28.35 * TASTELESS_WEIGHT), 4);
  });
  it('a recipe of only soda and water has nothing to chart', () => {
    expect(tasteProfile([{ key: 'soda water' }, { key: 'water' }], noLabel).charted).toBe(false);
  });
});

describe('label-only ingredients sit on the same scale as table ingredients', () => {
  it('the first word of a label is strength 3 (the top of the scale), potency 1', () => {
    const t = ingredientTaste('some unlisted thing', 'sour sweet bitter');
    expect(LABEL_STRENGTH_PER_WEIGHT).toBe(STRENGTH_MAX);
    expect(t.fromTable).toBe(false);
    expect(t.axes.sour).toBe(3);
    expect(t.axes.sweet).toBeCloseTo(1.8);
    expect(t.axes.bitter).toBeCloseTo(1.05);
    expect(t.potency).toBe(1);
  });
  it('spicy plus pungent cannot pass the top of the scale', () => {
    expect(ingredientTaste('some unlisted thing', 'spicy pungent').axes.heat).toBe(3);
  });
  it('a label-only recipe charts exactly as the mean of its label weights, as before the table', () => {
    const lk = (k) => ({ 'x one': 'sweet', 'x two': 'sour sweet' }[k]);
    const p = tasteProfile([{ key: 'x one', amount: '1 oz' }, { key: 'x two', amount: '1 oz' }], lk);
    expect(p.scores.sweet).toBeCloseTo((1 + 0.6) / 2);
    expect(p.scores.sour).toBeCloseTo(0.5);
  });
  it('mixing the two: a label-only sweet ingredient and the sugar line are comparable', () => {
    const p = tasteProfile([{ key: 'some unlisted thing', amount: '10 g' }, { key: 'sugar', amount: '10 g' }], (k) => (k === 'some unlisted thing' ? 'sweet' : undefined));
    expect(p.scores.sweet).toBeGreaterThan(0.9);
  });
});

describe('typical amounts for lines that carry none', () => {
  it('a few dashes of hot sauce, not the recipe mean', () => {
    expect(defaultGrams('hot sauce', '')).toBe(2);
    expect(defaultGrams('tabasco', undefined)).toBe(2);
  });
  it('a bare count multiplies the typical portion', () => {
    expect(defaultGrams('chili', '6, rehydrated')).toBe(48);
    expect(defaultGrams('lime juice', '8 limes')).toBe(240);
    expect(defaultGrams('egg', '½')).toBe(25);
  });
  it('another potent table ingredient gets a small fixed default; an ingredient not in the table gets none', () => {
    expect(defaultGrams('cumin', 'to taste')).toBe(3);
    expect(defaultGrams('gin', '')).toBeNull();
    expect(defaultGrams('some unlisted thing', '1')).toBeNull();
  });
  it('an unmeasured hot sauce does not take over a Bloody Mary', () => {
    const p = tasteProfile([
      { key: 'tomato juice', amount: '90 ml' }, { key: 'lemon juice', amount: '15 ml' }, { key: 'hot sauce', amount: '' },
    ], noLabel);
    expect(p.scores.heat).toBeLessThan(p.scores.umami);
  });
  it('the defaults are not counted as measured amounts (a recipe with only defaults is still equal-weighted)', () => {
    const p = tasteProfile([{ key: 'salt', amount: '' }, { key: 'sugar', amount: '' }], noLabel);
    expect(p.weighted).toBe(false);
  });
});

describe('garnish and rim', () => {
  it('a salt rim adds a thin dusting of salt', () => {
    expect(garnishTasteLines('Kosher salt')).toEqual([{ key: 'salt', amount: 0.5 }]);
    expect(garnishTasteLines('Kosher salt and pepper')).toEqual([{ key: 'salt', amount: 0.5 }]);
  });
  it('a sugar rim and a chili rim are read; other garnishes add nothing', () => {
    expect(garnishTasteLines('Sugar rim')).toEqual([{ key: 'sugar', amount: 1 }]);
    expect(garnishTasteLines('Tajin')).toEqual([{ key: 'chili powder', amount: 0.5 }]);
    expect(garnishTasteLines('1 orange half wheel')).toEqual([]);
    expect(garnishTasteLines('No garnish')).toEqual([]);
    expect(garnishTasteLines('')).toEqual([]);
    expect(garnishTasteLines(null)).toEqual([]);
  });
  it('a salted Margarita charts salty, and only a little', () => {
    const nodes = new Map([['tequila', {}], ['lime juice', {}], ['triple sec', {}], ['salt', {}]]);
    const keys = ['tequila', 'lime juice', 'triple sec'];
    const amounts = { tequila: '2 oz', 'lime juice': '1 oz', 'triple sec': '1 oz' };
    const plain = buildFlavorProfile(keys, nodes, { amounts });
    const rimmed = buildFlavorProfile(keys, nodes, { amounts, garnish: 'Kosher salt' });
    expect(plain.scores.salty).toBe(0);
    expect(rimmed.scores.salty).toBeGreaterThan(0);
    expect(rimmed.scores.salty).toBeLessThan(0.15);
    expect(rimmed.scores.sour).toBeGreaterThan(rimmed.scores.salty);
  });
});
