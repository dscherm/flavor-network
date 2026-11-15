import { describe, it, expect } from 'vitest';
import { amountGrams, parseAmountText } from '../amountGrams.js';

describe('amountGrams: cocktail and kitchen units', () => {
  it('weighs ounces, centilitres and millilitres', () => {
    expect(amountGrams('2 oz')).toBeCloseTo(56.7);
    expect(amountGrams('~¾ oz')).toBeCloseTo(21.26, 1);
    expect(amountGrams('1½ ounces')).toBeCloseTo(42.5, 1);
    expect(amountGrams('3 cl')).toBeCloseTo(30);
    expect(amountGrams('30 ml')).toBe(30);
  });
  it('a dash weighs about a gram, nowhere near an ounce', () => {
    expect(amountGrams('1 dash')).toBeLessThan(amountGrams('1 oz') / 10);
    expect(amountGrams('2 dashes')).toBe(2);
    expect(amountGrams('~2 dashes')).toBe(2);
    expect(amountGrams('2 drops')).toBeLessThan(1);
  });
  it('splash, barspoon, shot and parts have real weights', () => {
    expect(amountGrams('1 splash')).toBeGreaterThan(amountGrams('1 dash'));
    expect(amountGrams('1 splash')).toBeLessThan(amountGrams('1 oz'));
    expect(amountGrams('1 barspoon')).toBe(5);
    expect(amountGrams('1 shot')).toBeCloseTo(44);
    expect(amountGrams('2 parts')).toBeCloseTo(60);
  });
  it('"top with soda" and "fill" are not zero', () => {
    expect(amountGrams('Top with soda')).toBeGreaterThan(30);
    expect(amountGrams('top')).toBeGreaterThan(30);
    expect(amountGrams('Fill')).toBeGreaterThan(30);
  });
  it('leaves and stalks weigh something small', () => {
    expect(amountGrams('6 leaves')).toBe(6);
    expect(amountGrams('1 stalk')).toBe(40);
    expect(amountGrams('5 slices')).toBe(75);
    expect(amountGrams('2 stalks, bruised')).toBe(80);
  });
  it('ignores a trailing preparation note', () => {
    expect(amountGrams('1 tbsp, grated')).toBe(15);
    expect(amountGrams('1/4 cup, diced')).toBeCloseTo(60);
  });
  it('a bare count or empty text is unknown, not zero', () => {
    for (const a of ['1', '', null, undefined, 'a little', '12']) expect(amountGrams(a)).toBeNull();
  });
  it('still takes { qty, unit } objects and plain grams', () => {
    expect(amountGrams({ qty: 2, unit: 'cup' })).toBe(480);
    expect(amountGrams({ qty: 3, unit: 'cl' })).toBeCloseTo(30);
    expect(amountGrams(25)).toBe(25);
    expect(amountGrams(0)).toBeNull();
  });
  it('parseAmountText returns the unit key', () => {
    expect(parseAmountText('1 1/2 oz')).toEqual({ qty: 1.5, unit: 'oz' });
    expect(parseAmountText('nonsense words')).toBeNull();
  });
});

describe('amountGrams: weights in kilograms, pounds and litres (FLAVOR-6)', () => {
  it('reads kg, kilogram(s) and a number stuck to the unit', () => {
    expect(amountGrams('1.2 kg')).toBe(1200);
    expect(amountGrams('1 kg')).toBe(1000);
    expect(amountGrams('1.5 kilograms')).toBe(1500);
    expect(amountGrams('1.2kg')).toBe(1200);
    expect(amountGrams({ qty: 2, unit: 'kg' })).toBe(2000);
  });
  it('reads lb, lbs and pounds', () => {
    expect(amountGrams('2 lb')).toBeCloseTo(907.2, 5);
    expect(amountGrams('2 lbs')).toBeCloseTo(907.2, 5);
    expect(amountGrams('1 pound')).toBeCloseTo(453.6, 5);
  });
  it('reads g and gram variants and l, liter, litre', () => {
    expect(amountGrams('500 g')).toBe(500);
    expect(amountGrams('500g')).toBe(500);
    expect(amountGrams('250 grams')).toBe(250);
    expect(amountGrams('1 l')).toBe(1000);
    expect(amountGrams('1.5 litres')).toBe(1500);
    expect(amountGrams('1 liter')).toBe(1000);
  });
  it('1.2 kg of apples is no longer weighed as a handful', () => {
    expect(amountGrams('1.2 kg')).toBeGreaterThan(1000);
  });
});
