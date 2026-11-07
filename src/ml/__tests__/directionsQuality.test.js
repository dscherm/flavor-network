import { describe, it, expect } from 'vitest';
import {
  singular, tokens, normalizeTitle, ingredientTerms, stepMentions, stepsAligned,
  titleFoods, foodInNames, representableFoods, missingTitleFoods, foreignMeats,
  seededHash, compareCompleteness, pickTitleVariants,
} from '../directionsQuality.js';

// The real RecipeNLG row 38762: a franks recipe carrying turkey steps.
const WIENERS = {
  title: 'Barbecue Wieners',
  ner: ['franks', 'water', 'sugar', 'catsup', 'mustard', 'vinegar'],
  steps: [
    'Wash turkey thoroughly; pat dry.',
    'Season with salt, pepper and/or garlic salt.',
    'Place turkey in oven cooking bag in pan, breast side up, add 1 cup of hot melted butter and water in cavity.',
  ],
};
const GOOD = {
  title: 'No-Bake Nut Cookies',
  ner: ['brown sugar', 'milk', 'vanilla', 'nuts', 'butter', 'bite size shredded rice biscuits'],
  steps: [
    'In a heavy 2-quart saucepan, mix brown sugar, nuts, evaporated milk and butter or margarine.',
    'Stir over medium heat until mixture bubbles all over top.',
    'Stir in vanilla and cereal; mix well.',
  ],
};
const VOCAB = ['chicken', 'chicken breast', 'beef', 'ground beef', 'bean', 'kidney bean', 'potato', 'cocoa', 'mustard', 'sugar', 'water', 'vinegar', 'rice', 'turkey', 'bacon', 'celery'];

describe('text helpers', () => {
  it('singularises common plurals', () => {
    expect(singular('potatoes')).toBe('potato');
    expect(singular('cherries')).toBe('cherry');
    expect(singular('eggs')).toBe('egg');
    expect(singular('glass')).toBe('glass');
    expect(singular('peas')).toBe('pea');
    expect(singular('cookies')).toBe('cookie');
    expect(singular('pies')).toBe('pie');
  });

  it('tokenises without accents, punctuation or possessives', () => {
    expect(tokens("Mom's Sautéed Onions, 2-ways!")).toEqual(['mom', 'sauteed', 'onion', '2', 'way']);
  });

  it('normalises titles for de-duplication', () => {
    expect(normalizeTitle("Mom's Chicken & Rice (Easy!)")).toBe('mom chicken and rice');
    expect(normalizeTitle('Moms   Chicken and Rice')).toBe('mom chicken and rice');
    expect(normalizeTitle('Peanut Butter Cookies')).toBe(normalizeTitle('Peanut Butter Cookie'));
    expect(normalizeTitle('CREAMY CORN')).toBe(normalizeTitle('Creamy Corn.'));
    expect(normalizeTitle('')).toBe('');
  });
});

describe('steps ↔ ingredients alignment', () => {
  it('derives full name, head noun and significant words as terms', () => {
    expect(ingredientTerms('cream of mushroom soup')).toEqual([
      ['cream', 'of', 'mushroom', 'soup'], ['soup'], ['cream'], ['mushroom'],
    ]);
    expect(ingredientTerms('brown sugar')).toEqual([['brown', 'sugar'], ['sugar']]);
    expect(ingredientTerms('')).toEqual([]);
  });

  it('counts an ingredient as mentioned by its head noun or plural', () => {
    const m = stepMentions(GOOD.steps, GOOD.ner);
    // brown sugar, milk, vanilla, nuts, butter — not the rice biscuits ("cereal").
    expect(m).toEqual({ mentioned: 5, total: 6, frac: 5 / 6 });
    expect(stepsAligned(GOOD.steps, GOOD.ner)).toBe(true);
  });

  it('rejects steps that belong to another recipe', () => {
    const m = stepMentions(WIENERS.steps, WIENERS.ner);
    expect(m.mentioned).toBe(1); // only "water"
    expect(stepsAligned(WIENERS.steps, WIENERS.ner)).toBe(false);
  });

  it('rejects steps mentioning nothing, and empty inputs', () => {
    expect(stepsAligned(['Mix all ingredients and bake.'], ['flour', 'egg', 'sugar'])).toBe(false);
    expect(stepsAligned([], ['flour'])).toBe(false);
    expect(stepsAligned(['Stir flour.'], [])).toBe(false);
  });

  it('honours a custom minimum fraction', () => {
    const steps = ['Whisk the eggs.'];
    expect(stepsAligned(steps, ['egg', 'flour', 'sugar', 'milk'])).toBe(false);
    expect(stepsAligned(steps, ['egg', 'flour', 'sugar', 'milk'], { minFrac: 0.25 })).toBe(true);
  });
});

describe('title foods', () => {
  const rep = representableFoods(VOCAB);

  it('finds the headline foods a title names', () => {
    expect(titleFoods('Barbecue Wieners')).toEqual(['wiener']);
    expect(titleFoods('Hot Dog Casserole')).toEqual(['wiener']);
    expect(titleFoods('Senate Navy Bean Soup')).toEqual(['bean']);
    expect(titleFoods('Chicken And Potatoes')).toEqual(['chicken', 'potato']);
    expect(titleFoods('Graham Cracker Pie')).toEqual([]);
  });

  it('matches a food through its alternative ingredient words', () => {
    expect(foodInNames('chocolate', ['cocoa', 'sugar'])).toBe(true);
    expect(foodInNames('beef', ['ground chuck'])).toBe(true);
    expect(foodInNames('wiener', ['franks'])).toBe(true);
    expect(foodInNames('bean', ['bacon', 'celery'])).toBe(false);
  });

  it('knows which title foods the vocab can represent', () => {
    expect(rep.has('chicken')).toBe(true);
    expect(rep.has('bean')).toBe(true);
    expect(rep.has('wiener')).toBe(false);
  });

  it('flags a representable title food missing from the mapped list', () => {
    expect(missingTitleFoods('Senate Navy Bean Soup', { mapped: ['bacon', 'celery', 'water'], representable: rep })).toEqual(['bean']);
    expect(missingTitleFoods('Senate Navy Bean Soup', { mapped: ['kidney bean', 'bacon'], representable: rep })).toEqual([]);
  });

  it('checks an unrepresentable food against the raw list, or skips it', () => {
    const mapped = ['mustard', 'sugar', 'vinegar', 'water'];
    expect(missingTitleFoods('Barbecue Wieners', { mapped, raw: WIENERS.ner, representable: rep })).toEqual([]);
    expect(missingTitleFoods('Barbecue Wieners', { mapped, raw: ['mustard', 'sugar'], representable: rep })).toEqual(['wiener']);
    expect(missingTitleFoods('Barbecue Wieners', { mapped, representable: rep })).toEqual([]);
  });

  it('flags meats cooked in the steps but absent from list and title', () => {
    expect(foreignMeats(WIENERS.steps, WIENERS.title, WIENERS.ner)).toEqual(['turkey']);
    expect(foreignMeats(['Brown the chicken.'], 'Easy Supper', ['chicken breasts', 'salt'])).toEqual([]);
    expect(foreignMeats(['Roast the turkey.'], 'Roast Turkey', ['salt', 'butter'])).toEqual([]);
    expect(foreignMeats(GOOD.steps, GOOD.title, GOOD.ner)).toEqual([]);
  });
});

describe('de-duplication', () => {
  it('hashes deterministically per seed', () => {
    expect(seededHash(42, 1)).toBe(seededHash(42, 1));
    expect(seededHash(42, 1)).not.toBe(seededHash(42, 2));
    expect(seededHash(42, 1)).not.toBe(seededHash(43, 1));
  });

  it('orders variants by mapped ingredients, then steps (capped), then alignment', () => {
    const a = { r: 1, v: [1, 2, 3], nSteps: 3, align: 0.5 };
    const b = { r: 2, v: [1, 2, 3, 4], nSteps: 1, align: 0.4 };
    const c = { r: 3, v: [1, 2, 3], nSteps: 30, align: 0.5 };
    const d = { r: 4, v: [1, 2, 3], nSteps: 12, align: 0.9 };
    expect([a, c, d, b].sort((x, y) => compareCompleteness(x, y)).map((x) => x.r)).toEqual([2, 4, 3, 1]);
  });

  it('keeps the most complete variant plus a genuinely different one', () => {
    const group = [
      { r: 10, v: [1, 2, 3], nSteps: 3 },          // soup-based, smaller
      { r: 11, v: [1, 2, 3, 4], nSteps: 4 },       // soup-based, most complete
      { r: 12, v: [1, 2, 3, 4], nSteps: 2 },       // near copy
      { r: 13, v: [1, 7, 8, 9], nSteps: 3 },       // rice-based: different dish
    ];
    expect(pickTitleVariants(group).map((x) => x.r)).toEqual([11, 13]);
    expect(pickTitleVariants(group, { maxVariants: 1 }).map((x) => x.r)).toEqual([11]);
    expect(pickTitleVariants([]).length).toBe(0);
  });

  it('keeps a single variant when all versions overlap heavily', () => {
    const group = [
      { r: 1, v: [1, 2, 3, 4], nSteps: 4 },
      { r: 2, v: [1, 2, 3, 5], nSteps: 4 },
      { r: 3, v: [1, 2, 4, 5], nSteps: 4 },
    ];
    expect(pickTitleVariants(group)).toHaveLength(1);
  });
});
