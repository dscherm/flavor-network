import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { winesForSauce, proteinIngredient } from '../sauceWines.js';

const read = (p) => JSON.parse(fs.readFileSync(path.resolve(process.cwd(), p), 'utf8'));
const SAUCES = read('public/data/sauce_augment.json').sauces;
const WINES = read('public/data/wine_styles.json').wines;
const INGREDIENTS = read('public/proDataset/ingredients.json');
const categoryOf = (n) => INGREDIENTS[n]?.category || null;
const sauce = (name) => {
  const s = SAUCES.find((x) => x.name === name);
  return { ...s, ingredients: s.ingredients.map((i) => i.name) };
};

describe('sauce proteins (hand-written, sauce_augment.json)', () => {
  it('every sauce lists 2-4 proteins', () => {
    for (const s of SAUCES) {
      expect(Array.isArray(s.proteins), s.name).toBe(true);
      expect(s.proteins.length, s.name).toBeGreaterThanOrEqual(2);
      expect(s.proteins.length, s.name).toBeLessThanOrEqual(4);
    }
  });
  it('every protein is an ingredient the pairing data knows', () => {
    const missing = [...new Set(SAUCES.flatMap((s) => s.proteins))].filter((p) => !(proteinIngredient(p) in INGREDIENTS));
    expect(missing).toEqual([]);
  });
});

describe('winesForSauce', () => {
  it('gives every protein a wine, grouping proteins that share one', () => {
    const r = winesForSauce(sauce('Beurre Blanc'), WINES, { categoryOf });
    expect(r.flatMap((g) => g.proteins).sort()).toEqual([...sauce('Beurre Blanc').proteins].sort());
    for (const g of r) expect(g.wine.id).toBeTruthy();
  });
  it('a red-meat sauce on beef gets a red', () => {
    const [g] = winesForSauce(sauce('Bordelaise'), WINES, { categoryOf });
    expect(g.proteins).toContain('beef');
    expect(g.wine.colour).toBe('red');
  });
  it('a white-fish butter sauce gets a white', () => {
    const g = winesForSauce(sauce('Beurre Blanc'), WINES, { categoryOf }).find((x) => x.proteins.includes('white fish'));
    expect(g.wine.colour).toBe('white');
  });
  it('nothing without proteins or wines', () => {
    expect(winesForSauce({ ingredients: ['butter'] }, WINES)).toEqual([]);
    expect(winesForSauce(sauce('Bordelaise'), [])).toEqual([]);
  });
});
