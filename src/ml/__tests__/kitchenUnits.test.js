import { describe, it, expect } from 'vitest';
import {
  normalizeUnit, unitDimension, toBase, roundKitchen, isKitchenQty,
  chooseVolumeUnit, chooseWeightUnit, kitchenAmount, toKitchen, formatKitchenQty,
} from '../kitchenUnits.js';
import { parseAmount, UNIT_DENSITY } from '../../data/portionParser.js';

describe('WEAK-4 normalizeUnit', () => {
  it.each([
    ['c', 'cup'], ['C.', 'cup'], ['cups', 'cup'], ['Cup', 'cup'],
    ['T', 'tbsp'], ['T.', 'tbsp'], ['Tbsp.', 'tbsp'], ['tbsp', 'tbsp'], ['tablespoons', 'tbsp'], ['Tbs', 'tbsp'],
    ['t', 'tsp'], ['t.', 'tsp'], ['tsp.', 'tsp'], ['teaspoon', 'tsp'], ['teaspoons', 'tsp'],
    ['lb.', 'lb'], ['lbs', 'lb'], ['pounds', 'lb'], ['oz.', 'oz'], ['ounces', 'oz'],
    ['grams', 'g'], ['kg', 'kg'], ['cloves', 'clove'], ['pkg.', 'pkg'], ['cans', 'can'],
    ['large', 'each'], ['slices', 'each'], ['fl oz', 'floz'],
  ])('%s → %s', (tok, want) => { expect(normalizeUnit(tok)).toBe(want); });

  it('returns null for non-units', () => {
    expect(normalizeUnit('chicken')).toBeNull();
    expect(normalizeUnit('')).toBeNull();
    expect(normalizeUnit(null)).toBeNull();
  });

  it('classifies dimensions and converts to base', () => {
    expect(unitDimension('cup')).toBe('volume');
    expect(unitDimension('lb')).toBe('weight');
    expect(unitDimension('clove')).toBe('count');
    expect(toBase(2, 'tbsp')).toBe(30);
    expect(toBase(1, 'lb')).toBeCloseTo(453.6);
    expect(toBase(1, 'dozen')).toBe(12);
  });
});

describe('WEAK-4 roundKitchen', () => {
  it('rounds spoons and cups to kitchen fractions', () => {
    expect(roundKitchen(0.83, 'cup')).toBeCloseTo(3 / 4);
    expect(roundKitchen(0.3, 'cup')).toBeCloseTo(1 / 3);
    expect(roundKitchen(0.6, 'tsp')).toBe(0.5);   // spoons have no thirds
    expect(roundKitchen(0.6, 'cup')).toBeCloseTo(2 / 3);
    expect(roundKitchen(0.1, 'cup')).toBe(0.25);   // cups have no eighths
    expect(roundKitchen(0.15, 'tsp')).toBe(0.125);
    expect(roundKitchen(1.4, 'cup')).toBeCloseTo(4 / 3);
    expect(roundKitchen(2.3, 'cup')).toBe(2.5);
    expect(roundKitchen(6.4, 'cup')).toBe(6);
  });
  it('never leaves "3.6 each"', () => {
    expect(roundKitchen(3.6, 'each')).toBe(4);
    expect(roundKitchen(0.6, 'each')).toBe(0.5);
    expect(roundKitchen(0.15, 'each')).toBe(0.5);
    expect(roundKitchen(2.27, 'each')).toBe(2);
  });
  it('whole cloves, sprigs, cans', () => {
    expect(roundKitchen(2.4, 'clove')).toBe(2);
    expect(roundKitchen(0.3, 'clove')).toBe(1);
    expect(roundKitchen(1.6, 'can')).toBe(2);
  });
  it('quarter pounds, half ounces, 25 g steps', () => {
    expect(roundKitchen(1.1, 'lb')).toBe(1);
    expect(roundKitchen(0.4, 'lb')).toBe(0.5);
    expect(roundKitchen(0.3, 'lb')).toBe(0.25);
    expect(roundKitchen(3.3, 'lb')).toBe(3.5);
    expect(roundKitchen(10.75, 'oz')).toBe(11);
    expect(roundKitchen(1.3, 'oz')).toBe(1.5);
    expect(roundKitchen(333, 'g')).toBe(325);
    expect(roundKitchen(12, 'g')).toBe(10);
    expect(roundKitchen(2, 'g')).toBe(5);
  });
  it('rejects non-positive / non-numeric', () => {
    expect(roundKitchen(0, 'cup')).toBeNull();
    expect(roundKitchen(-1, 'cup')).toBeNull();
    expect(roundKitchen(NaN, 'cup')).toBeNull();
  });
  it('isKitchenQty is the fixed point of roundKitchen', () => {
    expect(isKitchenQty(0.75, 'cup')).toBe(true);
    expect(isKitchenQty(0.83, 'cup')).toBe(false);
    expect(isKitchenQty(3.6, 'each')).toBe(false);
    expect(isKitchenQty(4.54, 'each')).toBe(false);
    expect(isKitchenQty(1.5, 'lb')).toBe(true);
    expect(isKitchenQty(0.6, 'each')).toBe(false);
  });
});

describe('WEAK-4 category rules', () => {
  it('spices → tsp/tbsp up to 3 tbsp, oils/sauces → tbsp below ¼ cup, cups from ¼ cup', () => {
    expect(chooseVolumeUnit(5, 'spice')).toBe('tsp');
    expect(chooseVolumeUnit(30, 'spice')).toBe('tbsp');
    expect(chooseVolumeUnit(45, 'spice')).toBe('tbsp');
    expect(chooseVolumeUnit(30, 'fat')).toBe('tbsp');
    expect(chooseVolumeUnit(45, 'condiment')).toBe('tbsp');
    expect(chooseVolumeUnit(60, 'acid')).toBe('cup');
    expect(chooseVolumeUnit(60, 'dairy')).toBe('cup');
    expect(chooseVolumeUnit(30, 'herb')).toBe('tbsp');
    expect(chooseVolumeUnit(120, 'herb')).toBe('cup');
  });
  it('meat, fish and pasta by the pound from ~½ lb; small weights in ounces', () => {
    expect(chooseWeightUnit(454, 'protein')).toBe('lb');
    expect(chooseWeightUnit(227, 'protein')).toBe('lb');
    expect(chooseWeightUnit(227, 'grain')).toBe('lb');
    expect(chooseWeightUnit(227, 'dairy')).toBe('oz');
    expect(chooseWeightUnit(100, 'protein')).toBe('oz');
  });
  it('kitchenAmount composes dimension + category + rounding', () => {
    expect(kitchenAmount({ dimension: 'volume', base: 200, category: 'dairy' })).toEqual({ unit: 'cup', qty: 0.75 });
    expect(kitchenAmount({ dimension: 'volume', base: 30, category: 'fat' })).toEqual({ unit: 'tbsp', qty: 2 });
    expect(kitchenAmount({ dimension: 'volume', base: 14.5, category: 'spice' })).toEqual({ unit: 'tbsp', qty: 1 });
    expect(kitchenAmount({ dimension: 'weight', base: 453.6, category: 'grain' })).toEqual({ unit: 'lb', qty: 1 });
    expect(kitchenAmount({ dimension: 'count', base: 3, category: 'aromatic', countUnit: 'clove' })).toEqual({ unit: 'clove', qty: 3 });
    expect(kitchenAmount({ dimension: 'count', base: 3.6, category: 'protein' })).toEqual({ unit: 'each', qty: 4 });
    expect(kitchenAmount({ dimension: 'volume', base: 0, category: 'fat' })).toBeNull();
  });
  it('toKitchen repairs legacy predictions', () => {
    expect(toKitchen('c', 0.83)).toEqual({ unit: 'cup', qty: 0.75 });
    expect(toKitchen('each', 3.6)).toEqual({ unit: 'each', qty: 4 });
    expect(toKitchen('teaspoon', 1, 'spice')).toEqual({ unit: 'tsp', qty: 1 });
    expect(toKitchen('g', 333)).toEqual({ unit: 'g', qty: 325 });
    expect(toKitchen('pound', 1)).toEqual({ unit: 'lb', qty: 1 });
  });
});

describe('WEAK-4 formatKitchenQty round-trips through parseAmount', () => {
  it.each([[1.5, 'lb', '1 1/2'], [0.75, 'cup', '3/4'], [2, 'clove', '2'], [1 / 3, 'cup', '1/3'], [0.125, 'tsp', '1/8']])(
    '%s %s', (q, u, want) => {
      expect(formatKitchenQty(q)).toBe(want);
      const p = parseAmount(`${formatKitchenQty(q)} ${u}`);
      expect(p.qty).toBeCloseTo(q);
      expect(p.unit).toBe(u);
    });
  it('every emitted unit has a gram density', () => {
    for (const u of ['tsp', 'tbsp', 'cup', 'oz', 'lb', 'g', 'each', 'clove', 'sprig', 'handful', 'pinch', 'can', 'pkg']) {
      expect(UNIT_DENSITY[u]).toBeGreaterThan(0);
    }
  });
});
