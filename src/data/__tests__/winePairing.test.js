import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { dishProfile, idealWine, rankWinesForRecipe, scaleWord } from '../winePairing.js';
import { ANSWER_KEY, HELD_OUT } from '../wineAnswerKey.js';
import { SEED_RECIPES } from '../seedRecipes.js';
import { RECIPE_DETAILS } from '../seedRecipeDetails.js';

const root = process.cwd();
const data = JSON.parse(fs.readFileSync(path.join(root, 'public/data/wine_styles.json'), 'utf8'));
const ingredients = JSON.parse(fs.readFileSync(path.join(root, 'public/proDataset/ingredients.json'), 'utf8'));
const wines = data.wines;
const categoryOf = (n) => ingredients[n]?.category || null;
const ctxFor = (r) => ({ categoryOf, cuisine: r.cuisine, dishType: r.cluster, methodText: RECIPE_DETAILS[r.id]?.steps.join(' ') || '' });
const top = (ings, ctx = { categoryOf }, n = 3) => rankWinesForRecipe(ings, wines, ctx, n).map((r) => r.item);

describe('wine_styles.json', () => {
  const families = new Set(data._meta.families.map((f) => f.id));
  it('has ~50 styles with unique ids in known families', () => {
    expect(wines.length).toBeGreaterThanOrEqual(50);
    expect(new Set(wines.map((w) => w.id)).size).toBe(wines.length);
    for (const w of wines) expect(families.has(w.family), w.id).toBe(true);
    for (const f of families) expect(wines.some((w) => w.family === f), f).toBe(true);
  });
  it('every structure score is on its scale', () => {
    for (const w of wines) {
      for (const k of ['body', 'acidity', 'sweetness', 'alcohol']) expect(w[k], `${w.id}.${k}`).toBeGreaterThanOrEqual(1);
      for (const k of ['body', 'acidity', 'tannin', 'sweetness', 'alcohol']) expect(w[k], `${w.id}.${k}`).toBeLessThanOrEqual(5);
      expect(w.tannin).toBeGreaterThanOrEqual(0);
      expect([0, 1, 2]).toContain(w.oak);
      expect(['red', 'white', 'rosé']).toContain(w.colour);
      expect(w.aromas.length).toBeGreaterThan(0);
    }
  });
  it('whites and rosés have little or no tannin', () => {
    for (const w of wines.filter((x) => x.colour !== 'red')) expect(w.tannin, w.id).toBeLessThanOrEqual(1);
  });
  it('every wine has a country, its countries include it, and a region', () => {
    for (const w of wines) {
      expect(w.country, w.id).toBeTruthy();
      expect(w.countries, w.id).toContain(w.country);
      expect(w.area, w.id).toBeTruthy();
    }
  });
  it('every country has a flag', async () => {
    const { countryFlag } = await import('../wineStyles.js');
    for (const c of new Set(wines.flatMap((w) => w.countries))) expect(countryFlag(c), c).not.toBe('');
  });
  it('every classic match is an ingredient name in ProData', () => {
    const missing = wines.flatMap((w) => w.classicMatches.filter((m) => !(m in ingredients)).map((m) => `${w.id}: ${m}`));
    expect(missing).toEqual([]);
  });
});

describe('dishProfile', () => {
  it('stock and broth are not a protein', () => {
    expect(dishProfile(['onion', 'beef stock', 'gruyere'], { categoryOf }).protein).toBe('none');
  });
  it('the main protein wins over cured pork used as seasoning', () => {
    expect(dishProfile(['clam', 'potato', 'bacon', 'cream'], { categoryOf }).protein).toBe('shellfish');
    expect(dishProfile(['chicken', 'red wine', 'bacon', 'mushroom'], { categoryOf }).protein).toBe('poultry');
    expect(dishProfile(['pork rib', 'barbecue sauce'], { categoryOf }).protein).toBe('pork');
  });
  it('detects desserts from sugar plus a dessert marker in a baked dish', () => {
    expect(dishProfile(['cream', 'egg yolk', 'sugar', 'vanilla'], { categoryOf, dishType: 'baking' }).dessert).toBe(true);
    expect(dishProfile(['flour', 'yeast', 'sugar', 'garlic', 'salt'], { categoryOf, dishType: 'baking' }).dessert).toBe(false);
  });
  it('separates hot chilies from mild dried ones', () => {
    const hot = dishProfile(['jalapeno chile', 'serrano pepper', 'lime'], { categoryOf });
    const mild = dishProfile(['ancho chili', 'paprika', 'cayenne pepper'], { categoryOf });
    expect(hot.heat).toBeGreaterThan(mild.heat);
  });
  it('reads wine cooked into the dish', () => {
    expect(dishProfile(['beef', 'red wine'], { categoryOf }).cookedWith.red).toBe(true);
    expect(dishProfile(['mussel', 'white wine'], { categoryOf }).cookedWith.white).toBe(true);
  });
});

describe('idealWine', () => {
  it('a dessert wants sweetness at least 4', () => {
    expect(idealWine(dishProfile(['cream', 'egg yolk', 'sugar', 'vanilla'], { categoryOf, dishType: 'baking' })).sweetness).toBeGreaterThanOrEqual(4);
  });
  it('chili heat lowers the tannin and alcohol target and raises sweetness', () => {
    const calm = idealWine(dishProfile(['chicken', 'lime'], { categoryOf }));
    const hot = idealWine(dishProfile(['chicken', 'lime', 'jalapeno chile', 'serrano pepper'], { categoryOf }));
    expect(hot.tannin).toBeLessThanOrEqual(calm.tannin);
    expect(hot.alcohol).toBeLessThan(calm.alcohol);
    expect(hot.sweetness).toBeGreaterThan(calm.sweetness);
  });
});

describe('rankWinesForRecipe — classic rules', () => {
  it('steak gets a tannic red', () => {
    const [first] = top(['beef steak', 'butter', 'black pepper', 'rosemary']);
    expect(first.colour).toBe('red');
    expect(first.tannin).toBeGreaterThanOrEqual(3);
  });
  it('oysters get a crisp white or fizz, never a red', () => {
    for (const w of top(['oyster', 'lemon'])) expect(w.colour).not.toBe('red');
  });
  it('a sweet dessert gets a dessert or fortified wine', () => {
    const [first] = top(['cream', 'egg yolk', 'sugar', 'vanilla'], { categoryOf, dishType: 'baking' });
    expect(first.sweetness).toBeGreaterThanOrEqual(4);
  });
  it('a dry wine is never first for a dessert, a sweet wine never first for a savoury main', () => {
    const [d] = top(['apple', 'pie crust', 'sugar', 'cinnamon', 'butter'], { categoryOf, dishType: 'baking' });
    expect(d.sweetness).toBeGreaterThanOrEqual(3);
    const [m] = top(['chicken', 'garlic', 'thyme', 'butter']);
    expect(m.sweetness).toBeLessThanOrEqual(2);
  });
  it('a hot dish gets an off-dry, low-alcohol wine', () => {
    const [first] = top(['shrimp', 'lime', 'fish sauce', 'jalapeno chile', 'serrano pepper', 'lemongrass']);
    expect(first.sweetness).toBeGreaterThanOrEqual(2);
    expect(first.alcohol).toBeLessThanOrEqual(3);
  });
  it('every result explains itself and similarity is 0..1 with the best at 1', () => {
    const ranked = rankWinesForRecipe(['beef', 'red wine', 'mushroom', 'bacon', 'thyme'], wines, { categoryOf, cuisine: 'French' }, 5);
    expect(ranked[0].similarity).toBeCloseTo(1, 6);
    for (const r of ranked) {
      expect(r.similarity).toBeGreaterThanOrEqual(0);
      expect(r.similarity).toBeLessThanOrEqual(1);
      expect(r.reasons.length).toBeGreaterThan(0);
    }
  });
});

describe('answer keys (regression floors)', () => {
  const hit3 = (key) => Object.entries(key).filter(([id, ok]) => {
    const r = SEED_RECIPES.find((x) => x.id === id);
    return rankWinesForRecipe(r.ingredients, wines, ctxFor(r), 3).some((m) => ok.includes(m.item.id));
  }).length;
  it('every key names real recipes and wines', () => {
    const ids = new Set(wines.map((w) => w.id));
    for (const key of [ANSWER_KEY, HELD_OUT]) {
      for (const [rid, ok] of Object.entries(key)) {
        expect(SEED_RECIPES.some((r) => r.id === rid), rid).toBe(true);
        for (const w of ok) expect(ids.has(w), `${rid}: ${w}`).toBe(true);
      }
    }
  });
  it('tuned key: an accepted wine in the top 3 for at least 30 of 42 dishes (shipped: 31)', () => {
    expect(hit3(ANSWER_KEY)).toBeGreaterThanOrEqual(30);
  });
  it('held-out key: at least 9 of 16 (shipped: 10)', () => {
    expect(hit3(HELD_OUT)).toBeGreaterThanOrEqual(9);
  });
});

describe('scaleWord', () => {
  it('names the scales', () => {
    expect(scaleWord('sweetness', 1)).toBe('bone dry');
    expect(scaleWord('tannin', 0)).toBe('none');
    expect(scaleWord('body', 5)).toBe('very full');
  });
});

describe('countryIndex / fromCountry', () => {
  it('counts a wine under every country it is made in, regions under its home country', async () => {
    const { countryIndex, fromCountry } = await import('../wineStyles.js');
    const idx = countryIndex(wines);
    const france = idx.find((c) => c.country === 'France');
    expect(france.count).toBeGreaterThanOrEqual(19);
    expect(france.areas.map((a) => a.area)).toEqual(expect.arrayContaining(['Burgundy', 'Loire Valley', 'Bordeaux', 'Rhône Valley']));
    expect(idx[0].count).toBeGreaterThanOrEqual(idx[idx.length - 1].count);
    const rosado = wines.find((w) => w.id === 'rosado');
    expect(fromCountry(rosado, 'France')).toBe(true);
    expect(fromCountry(rosado, 'Italy')).toBe(false);
    expect(fromCountry(rosado, null)).toBe(true);
  });
});
