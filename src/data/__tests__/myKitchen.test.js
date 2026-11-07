import { describe, it, expect } from 'vitest';
import {
  loadKitchen, saveKitchen, kitchenKey, addToKitchen, removeFromKitchen,
  haveIngredient, coverIngredients, whatCanICook, loadAssumeBasics, saveAssumeBasics,
} from '../myKitchen.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const names = new Set(['garlic', 'tomato', 'basil', 'pasta', 'olive oil', 'parmesan', 'onion', 'lemon', 'chicken']);

describe('kitchen storage', () => {
  it('round-trips and survives bad data', () => {
    const s = memory();
    expect(loadKitchen(s)).toEqual([]);
    saveKitchen(['garlic', 'tomato'], s);
    expect(loadKitchen(s)).toEqual(['garlic', 'tomato']);
    s.setItem('fn-my-kitchen', '{not json');
    expect(loadKitchen(s)).toEqual([]);
    expect(loadKitchen(null)).toEqual([]);
  });
  it('basics are assumed unless turned off', () => {
    const s = memory();
    expect(loadAssumeBasics(s)).toBe(true);
    saveAssumeBasics(false, s);
    expect(loadAssumeBasics(s)).toBe(false);
  });
});

describe('kitchen keys', () => {
  it('stores the graph name when it resolves', () => {
    expect(kitchenKey('2 cloves garlic', names)).toBe('garlic');
    expect(addToKitchen([], 'Tomatoes', names)).toEqual(['tomato']);
    expect(addToKitchen(['tomato'], 'tomato', names)).toEqual(['tomato']);
    expect(removeFromKitchen(['tomato', 'basil'], 'tomato')).toEqual(['basil']);
  });
});

describe('coverage', () => {
  it('covers exact, equivalent and basic ingredients', () => {
    const k = new Set(['lemon', 'tomato']);
    expect(haveIngredient('tomato', k).covered).toBe(true);
    expect(haveIngredient('lemon juice', k).via).toBe('lemon');
    expect(haveIngredient('salt', k)).toEqual({ covered: true, basic: true });
    expect(haveIngredient('salt', k, { assumeBasics: false }).covered).toBe(false);
  });
  it('a pantry egg covers yolks; clarified or cold butter is butter', () => {
    expect(haveIngredient('egg yolk', new Set(['eggs'])).covered).toBe(true);
    expect(haveIngredient('clarified butter', new Set(['butter'])).via).toBe('butter');
    expect(haveIngredient('clarified butter', new Set()).covered).toBe(true); // butter is a basic
    expect(haveIngredient('clarified butter', new Set(), { assumeBasics: false }).covered).toBe(false);
    expect(haveIngredient('cold butter', new Set(), { names: new Set(['butter']) }).covered).toBe(true);
  });
  it('counts real ingredients only, not assumed basics', () => {
    const c = coverIngredients(['pasta', 'tomato', 'garlic', 'olive oil', 'salt'], ['pasta', 'tomato']);
    expect(c).toMatchObject({ total: 3, covered: 2, missing: ['garlic'] });
  });
  it('sorts recipes into can-make and nearly', () => {
    const recipes = [
      { name: 'Pomodoro', ingredients: ['pasta', 'tomato', 'garlic', 'basil', 'olive oil'] },
      { name: 'Aglio', ingredients: ['pasta', 'garlic', 'olive oil'] },
      { name: 'Roast chicken', ingredients: ['chicken', 'lemon', 'garlic', 'onion'] },
    ];
    const r = whatCanICook(recipes, ['pasta', 'garlic', 'tomato']);
    expect(r.make.map((x) => x.item.name)).toEqual(['Aglio']);
    expect(r.nearly.map((x) => x.item.name)).toEqual(['Pomodoro']);
    expect(r.nearly[0].missing).toEqual(['basil']);
  });
});
