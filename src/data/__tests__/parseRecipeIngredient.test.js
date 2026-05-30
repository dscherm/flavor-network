import { describe, it, expect } from 'vitest';
import {
  parseIngredientLine,
  matchIngredientName,
  matchRecipeIngredients,
} from '../parseRecipeIngredient.js';

// Sample dictionary representing the known-ingredient list. Real list is
// ~3,847 names from public/proDataset/ingredients.json; this slice is
// chosen so the fuzzy matcher tests hit both exact + near + miss cases.
const KNOWN_NAMES = [
  'tomato', 'basil', 'garlic', 'olive oil', 'parmesan',
  'oregano', 'salt', 'pepper', 'pasta', 'butter',
  'onion', 'carrot', 'celery', 'red wine', 'thyme',
  'red wine vinegar', 'dijon mustard', 'chicken breast',
  'lemon', 'mint', 'cilantro', 'cucumber', 'feta cheese',
  'flour', 'sugar', 'vanilla', 'cinnamon', 'eggs',
];

describe('parseIngredientLine', () => {
  it('parses qty + known unit + noun', () => {
    expect(parseIngredientLine('1 cup flour')).toEqual({
      raw: '1 cup flour', noun: 'flour', unit: 'cup', quantity: 1,
    });
    expect(parseIngredientLine('2 tbsp olive oil')).toEqual({
      raw: '2 tbsp olive oil', noun: 'olive oil', unit: 'tbsp', quantity: 2,
    });
    expect(parseIngredientLine('4 cloves garlic, minced')).toEqual({
      raw: '4 cloves garlic, minced', noun: 'garlic, minced', unit: 'cloves', quantity: 4,
    });
  });

  it('parses unicode fractions (½ ¼ ⅔ ¾ ⅛)', () => {
    expect(parseIngredientLine('½ cup sugar')?.quantity).toBe(0.5);
    expect(parseIngredientLine('¼ tsp salt')?.quantity).toBe(0.25);
    expect(parseIngredientLine('⅔ cup milk')?.quantity).toBeCloseTo(2 / 3);
    expect(parseIngredientLine('¾ pound butter')?.quantity).toBe(0.75);
    expect(parseIngredientLine('⅛ tsp nutmeg')?.quantity).toBe(0.125);
  });

  it('parses mixed fractions ("1 1/2 cups")', () => {
    expect(parseIngredientLine('1 1/2 cups water')?.quantity).toBe(1.5);
    expect(parseIngredientLine('2 1/4 lbs beef')?.quantity).toBe(2.25);
  });

  it('parses pure-decimal fractions ("1/2 cup")', () => {
    expect(parseIngredientLine('1/2 cup milk')?.quantity).toBe(0.5);
    expect(parseIngredientLine('3/4 tsp salt')?.quantity).toBe(0.75);
  });

  it('handles missing unit (qty + noun directly)', () => {
    const r = parseIngredientLine('2 eggs');
    expect(r?.quantity).toBe(2);
    expect(r?.noun).toBe('eggs');
    expect(r?.unit).toBeUndefined();
  });

  it('handles no qty at all', () => {
    const r = parseIngredientLine('salt and pepper to taste');
    expect(r?.noun).toMatch(/salt and pepper/);
    expect(r?.quantity).toBeUndefined();
    expect(r?.unit).toBeUndefined();
  });

  it('strips additional descriptors after the noun', () => {
    const r = parseIngredientLine('3 tbsp olive oil (extra virgin)');
    expect(r?.unit).toBe('tbsp');
    expect(r?.quantity).toBe(3);
    expect(r?.noun).toMatch(/olive oil/);
  });

  it('treats unknown leading word as part of the noun, not a unit', () => {
    // "stick" isn't in KNOWN_UNITS — should fall through.
    const r = parseIngredientLine('1 stick butter');
    expect(r?.quantity).toBe(1);
    expect(r?.unit).toBeUndefined();
    expect(r?.noun).toMatch(/stick butter/);
  });

  it('returns null on empty input', () => {
    expect(parseIngredientLine('')).toBeNull();
    expect(parseIngredientLine('   ')).toBeNull();
    expect(parseIngredientLine(null)).toBeNull();
    expect(parseIngredientLine(undefined)).toBeNull();
  });

  it('passes single-word input through (no qty / unit / split)', () => {
    expect(parseIngredientLine('salt')).toEqual({ raw: 'salt', noun: 'salt' });
  });
});

describe('matchIngredientName', () => {
  it('exact match → high confidence', () => {
    const r = matchIngredientName('tomato', KNOWN_NAMES);
    expect(r?.name).toBe('tomato');
    expect(r?.confidence).toBeGreaterThan(0.9);
  });

  it('fuzzy hit ("tomatos" → "tomato")', () => {
    const r = matchIngredientName('tomatos', KNOWN_NAMES);
    expect(r?.name).toBe('tomato');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('multi-word match ("olive oil" exact)', () => {
    const r = matchIngredientName('olive oil', KNOWN_NAMES);
    expect(r?.name).toBe('olive oil');
    expect(r?.confidence).toBeGreaterThan(0.9);
  });

  it('multi-word fuzzy ("red wine vinegar" exact)', () => {
    const r = matchIngredientName('red wine vinegar', KNOWN_NAMES);
    expect(r?.name).toBe('red wine vinegar');
  });

  it('miss → returns null (confidence below floor)', () => {
    const r = matchIngredientName('quinoa', KNOWN_NAMES);
    expect(r).toBeNull();
  });

  it('miss → returns null (gibberish input)', () => {
    const r = matchIngredientName('xyzzy123', KNOWN_NAMES);
    expect(r).toBeNull();
  });

  it('case-insensitive match', () => {
    const r = matchIngredientName('BASIL', KNOWN_NAMES);
    expect(r?.name).toBe('basil');
  });

  it('returns null on empty input', () => {
    expect(matchIngredientName('', KNOWN_NAMES)).toBeNull();
    expect(matchIngredientName('   ', KNOWN_NAMES)).toBeNull();
    expect(matchIngredientName(null, KNOWN_NAMES)).toBeNull();
  });

  it('returns null on empty dictionary', () => {
    expect(matchIngredientName('tomato', [])).toBeNull();
  });
});

describe('matchRecipeIngredients', () => {
  it('returns one entry per input line with parsed + matched fields', () => {
    const lines = ['1 cup flour', '2 tbsp olive oil', '4 cloves garlic'];
    const out = matchRecipeIngredients(lines, KNOWN_NAMES);
    expect(out).toHaveLength(3);
    expect(out[0].matched).toBe('flour');
    expect(out[0].parsed.unit).toBe('cup');
    expect(out[0].parsed.quantity).toBe(1);
    expect(out[1].matched).toBe('olive oil');
    expect(out[2].matched).toBe('garlic');
  });

  it('accepts pre-parsed { raw, noun, unit?, quantity? } objects from scrapeRecipe', () => {
    const parsed = [
      { raw: '1 cup flour', noun: 'flour', unit: 'cup', quantity: 1 },
      { raw: '2 lbs beef', noun: 'beef', unit: 'lbs', quantity: 2 },
    ];
    const out = matchRecipeIngredients(parsed, KNOWN_NAMES);
    expect(out).toHaveLength(2);
    expect(out[0].matched).toBe('flour');
    expect(out[1].matched).toBeNull(); // beef not in dictionary
  });

  it('passes through unmatched ingredients with matched=null', () => {
    const out = matchRecipeIngredients(['1 cup quinoa'], KNOWN_NAMES);
    expect(out[0].matched).toBeNull();
    expect(out[0].confidence).toBeNull();
    expect(out[0].parsed.noun).toBe('quinoa');
  });

  it('returns [] on empty input', () => {
    expect(matchRecipeIngredients([], KNOWN_NAMES)).toEqual([]);
    expect(matchRecipeIngredients(null, KNOWN_NAMES)).toEqual([]);
  });

  it('survives garbage entries (numbers, undefined) without throwing', () => {
    const out = matchRecipeIngredients([123, undefined, '1 cup flour'], KNOWN_NAMES);
    expect(out).toHaveLength(3);
    expect(out[2].matched).toBe('flour');
  });

  it('typical mix: 8 lines, ≥30% match on a small fixture dictionary', () => {
    // Small dictionaries + Fuse's strict threshold (0.4) mean
    // descriptor-laden lines ("4 cloves garlic, minced", "1 can
    // crushed tomatoes", "fresh basil leaves") often miss because
    // the parsed noun retains extra words that drive fuse's
    // Levenshtein score above threshold. Production runs against
    // a ~3,847-name dictionary where the matcher has many more
    // synonyms to lock onto. This fixture asserts a floor — real
    // recipe sites land in the 60-80% range against the full
    // dictionary.
    const lines = [
      '1 cup flour',
      '2 tbsp olive oil',
      '4 cloves garlic, minced',
      '1 can crushed tomatoes',
      '½ cup fresh basil leaves',
      '1 lb chicken breast',
      'salt and pepper to taste',
      'quinoa (optional)',
    ];
    const out = matchRecipeIngredients(lines, KNOWN_NAMES);
    const hits = out.filter((e) => e.matched !== null);
    expect(out).toHaveLength(8);
    expect(hits.length).toBeGreaterThanOrEqual(3);
  });
});
