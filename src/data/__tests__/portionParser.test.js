import { describe, it, expect } from 'vitest';
import { parseAmount, UNIT_DENSITY } from '../portionParser.js';

describe('parseAmount — RECIPE-LAB-SPEC §11.4 acceptance', () => {
  it('parses a simple "1 tbsp"', () => {
    expect(parseAmount('1 tbsp')).toEqual({ qty: 1, unit: 'tbsp' });
  });

  it('parses a simple fraction "1/2 cup"', () => {
    expect(parseAmount('1/2 cup')).toEqual({ qty: 0.5, unit: 'cup' });
  });

  it('parses a mixed-number fraction "1 1/2 cups" (canonical singular "cup")', () => {
    expect(parseAmount('1 1/2 cups')).toEqual({ qty: 1.5, unit: 'cup' });
  });

  it('parses "a pinch" as qty=null + unit=pinch', () => {
    expect(parseAmount('a pinch')).toEqual({ qty: null, unit: 'pinch' });
  });

  it('parses "to taste" as the to_taste sentinel', () => {
    expect(parseAmount('to taste')).toEqual({ qty: null, unit: 'to_taste' });
  });

  it('returns null for unparseable "nonsense"', () => {
    expect(parseAmount('nonsense')).toBeNull();
  });
});

describe('parseAmount — number formats', () => {
  it('parses bare integer + unit ("2 medium")', () => {
    expect(parseAmount('2 medium')).toEqual({ qty: 2, unit: 'medium' });
  });

  it('parses decimal + unit ("0.5 cup")', () => {
    expect(parseAmount('0.5 cup')).toEqual({ qty: 0.5, unit: 'cup' });
  });

  it('parses compact (no-space) "1tbsp"', () => {
    expect(parseAmount('1tbsp')).toEqual({ qty: 1, unit: 'tbsp' });
  });

  it('parses three-quarter fraction "3/4 tsp"', () => {
    expect(parseAmount('3/4 tsp')).toEqual({ qty: 0.75, unit: 'tsp' });
  });

  it('rejects division-by-zero fraction "1/0 cup"', () => {
    expect(parseAmount('1/0 cup')).toBeNull();
  });
});

describe('parseAmount — unit aliases', () => {
  it('parses long-form units (teaspoon, tablespoon, ounce, etc.)', () => {
    expect(parseAmount('1 teaspoon')).toEqual({ qty: 1, unit: 'tsp' });
    expect(parseAmount('2 tablespoons')).toEqual({ qty: 2, unit: 'tbsp' });
    expect(parseAmount('3 ounces')).toEqual({ qty: 3, unit: 'oz' });
    expect(parseAmount('1 pound')).toEqual({ qty: 1, unit: 'lb' });
    expect(parseAmount('500 grams')).toEqual({ qty: 500, unit: 'g' });
    expect(parseAmount('1 liter')).toEqual({ qty: 1, unit: 'l' });
  });

  it('case-sensitive disambiguates bare "t" vs "T"', () => {
    // Lowercase "t" = teaspoon
    expect(parseAmount('1 t')).toEqual({ qty: 1, unit: 'tsp' });
    // Uppercase "T" = tablespoon
    expect(parseAmount('1 T')).toEqual({ qty: 1, unit: 'tbsp' });
  });

  it('parses bare "c" as cup', () => {
    expect(parseAmount('1 c')).toEqual({ qty: 1, unit: 'cup' });
    expect(parseAmount('1 C')).toEqual({ qty: 1, unit: 'cup' });
  });

  it('is case-insensitive for multi-letter units (TBSP, Cup, OZ)', () => {
    expect(parseAmount('1 TBSP')).toEqual({ qty: 1, unit: 'tbsp' });
    expect(parseAmount('1 Cup')).toEqual({ qty: 1, unit: 'cup' });
    expect(parseAmount('3 OZ')).toEqual({ qty: 3, unit: 'oz' });
  });

  it('parses trace + fuzzy units', () => {
    expect(parseAmount('2 cloves')).toEqual({ qty: 2, unit: 'clove' });
    expect(parseAmount('3 sprigs')).toEqual({ qty: 3, unit: 'sprig' });
    expect(parseAmount('1 dash')).toEqual({ qty: 1, unit: 'dash' });
    expect(parseAmount('1 handful')).toEqual({ qty: 1, unit: 'handful' });
  });

  it('parses count-style units (each, medium, small, large)', () => {
    expect(parseAmount('3 each')).toEqual({ qty: 3, unit: 'each' });
    expect(parseAmount('2 medium')).toEqual({ qty: 2, unit: 'medium' });
    expect(parseAmount('4 small')).toEqual({ qty: 4, unit: 'small' });
    expect(parseAmount('1 large')).toEqual({ qty: 1, unit: 'large' });
  });
});

describe('parseAmount — sentinel + article forms', () => {
  it('treats "To Taste" / "TO TASTE" case-insensitively', () => {
    expect(parseAmount('To Taste')).toEqual({ qty: null, unit: 'to_taste' });
    expect(parseAmount('TO TASTE')).toEqual({ qty: null, unit: 'to_taste' });
  });

  it('parses "an ounce" via the "an" article path', () => {
    expect(parseAmount('an ounce')).toEqual({ qty: null, unit: 'oz' });
  });

  it('parses "a dash" / "a handful"', () => {
    expect(parseAmount('a dash')).toEqual({ qty: null, unit: 'dash' });
    expect(parseAmount('a handful')).toEqual({ qty: null, unit: 'handful' });
  });

  it('returns null for "a banana" (article + non-unit)', () => {
    expect(parseAmount('a banana')).toBeNull();
  });

  it('parses bare unit "pinch" with no qty or article', () => {
    expect(parseAmount('pinch')).toEqual({ qty: null, unit: 'pinch' });
  });
});

describe('parseAmount — defensive', () => {
  it('returns null for empty / whitespace-only input', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('   ')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount(123)).toBeNull();
    expect(parseAmount({})).toBeNull();
  });

  it('returns null for qty-only without a unit ("5")', () => {
    expect(parseAmount('5')).toBeNull();
  });

  it('returns null for qty + non-unit token ("1 banana")', () => {
    expect(parseAmount('1 banana')).toBeNull();
  });

  it('trims leading + trailing whitespace before parsing', () => {
    expect(parseAmount('  1 tbsp  ')).toEqual({ qty: 1, unit: 'tbsp' });
  });
});

describe('UNIT_DENSITY — RECIPE-LAB-SPEC §13.2', () => {
  it('covers every unit token §11.2 lists', () => {
    const tokens = [
      'tsp', 'teaspoon', 't',
      'tbsp', 'tablespoon', 'T',
      'cup', 'c',
      'g', 'gram',
      'oz', 'ounce',
      'lb', 'pound',
      'ml',
      'l', 'liter',
      'pinch', 'dash', 'sprig', 'clove',
      'each', 'medium', 'large', 'small', 'handful',
    ];
    for (const tok of tokens) {
      expect(UNIT_DENSITY[tok]).toBeGreaterThan(0);
    }
  });

  it('uses the §13.2 spec densities for canonical units', () => {
    expect(UNIT_DENSITY.g).toBe(1);
    expect(UNIT_DENSITY.oz).toBeCloseTo(28.35);
    expect(UNIT_DENSITY.lb).toBeCloseTo(453.6);
    expect(UNIT_DENSITY.tsp).toBe(5);
    expect(UNIT_DENSITY.tbsp).toBe(15);
    expect(UNIT_DENSITY.cup).toBe(240);
    expect(UNIT_DENSITY.ml).toBe(1);
    expect(UNIT_DENSITY.l).toBe(1000);
    expect(UNIT_DENSITY.each).toBe(100);
    expect(UNIT_DENSITY.medium).toBe(100);
    expect(UNIT_DENSITY.small).toBe(50);
    expect(UNIT_DENSITY.large).toBe(200);
    expect(UNIT_DENSITY.pinch).toBe(1);
    expect(UNIT_DENSITY.dash).toBe(1);
    expect(UNIT_DENSITY.sprig).toBe(2);
    expect(UNIT_DENSITY.clove).toBe(3);
    expect(UNIT_DENSITY.handful).toBe(30);
    expect(UNIT_DENSITY.to_taste).toBe(1);
  });

  it('long-form aliases carry the same density as canonical short form', () => {
    expect(UNIT_DENSITY.teaspoon).toBe(UNIT_DENSITY.tsp);
    expect(UNIT_DENSITY.tablespoon).toBe(UNIT_DENSITY.tbsp);
    expect(UNIT_DENSITY.ounce).toBe(UNIT_DENSITY.oz);
    expect(UNIT_DENSITY.pound).toBe(UNIT_DENSITY.lb);
    expect(UNIT_DENSITY.gram).toBe(UNIT_DENSITY.g);
    expect(UNIT_DENSITY.liter).toBe(UNIT_DENSITY.l);
    expect(UNIT_DENSITY.c).toBe(UNIT_DENSITY.cup);
    expect(UNIT_DENSITY.t).toBe(UNIT_DENSITY.tsp);
    expect(UNIT_DENSITY.T).toBe(UNIT_DENSITY.tbsp);
  });
});
