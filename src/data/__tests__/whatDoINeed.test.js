import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { needsFromKitchen, needsFromBarCoverage, shoppingListText } from '../whatDoINeed.js';
import { isBooze, splitBar, stockFor } from '../myBar.js';

const ROLES = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data/cocktail_roles.json'), 'utf8')).byIngredient;

describe('needsFromKitchen', () => {
  const recipe = ['pasta', 'tomato', 'garlic', 'basil', 'olive oil', 'salt'];
  const amounts = { pasta: '400 g', basil: '1 handful', garlic: '3 cloves' };

  it('splits have / missing / basics, with amounts on what to buy', () => {
    const n = needsFromKitchen(recipe, ['pasta', 'tomato'], { amounts });
    expect(n.have.map((h) => h.name)).toEqual(['pasta', 'tomato']);
    expect(n.missing).toEqual([{ name: 'garlic', amount: '3 cloves' }, { name: 'basil', amount: '1 handful' }]);
    expect(n.basics).toEqual(['olive oil', 'salt']);
    expect(n.total).toBe(4);
  });

  it('a missing pinch is "nice to have", not something you need', () => {
    const n = needsFromKitchen([{ name: 'egg yolk', measure: '3' }, { name: 'cayenne', measure: 'pinch' }], ['eggs']);
    expect(n.missing).toEqual([]);
    expect(n.optional).toEqual([{ name: 'cayenne', amount: 'pinch' }]);
  });

  it('says which kitchen item covers a line', () => {
    const n = needsFromKitchen(['lemon juice'], ['lemon']);
    expect(n.have).toEqual([{ name: 'lemon juice', amount: '', via: 'lemon' }]);
  });

  it('writes a shopping list', () => {
    const n = needsFromKitchen(recipe, ['pasta', 'tomato'], { amounts });
    expect(shoppingListText('Pomodoro', n.missing, [{ name: 'parmesan', amount: 'to serve' }]))
      .toBe('Shopping list for Pomodoro:\n- 3 cloves garlic\n- 1 handful basil\n\nNice to have:\n- to serve parmesan');
  });
});

describe('needsFromBarCoverage', () => {
  it('turns cocktail coverage into have / missing, keeping swaps and stand-ins', () => {
    const lines = [
      { key: 'rye', name: 'bourbon', measure: '2 oz' },
      { key: 'lemon juice', name: 'lemon juice', measure: '3/4 oz' },
      { key: 'simple syrup', name: 'simple syrup', measure: '3/4 oz' },
    ];
    const cov = {
      missing: [{ key: 'simple syrup', name: 'simple syrup', measure: '3/4 oz' }],
      substitutions: [{ from: 'rye', to: 'bourbon' }],
      suggestion: { for: 'simple syrup', use: 'honey syrup' },
    };
    const n = needsFromBarCoverage(cov, lines);
    expect(n.have.map((h) => h.name)).toEqual(['bourbon', 'lemon juice']);
    expect(n.have[0].via).toBe('bourbon');
    expect(n.missing).toEqual([{ name: 'simple syrup', amount: '3/4 oz', hint: 'or use your honey syrup' }]);
  });
});

describe('bar = booze only', () => {
  it('knows bottles from mixers', () => {
    for (const k of ['gin', 'bourbon', 'campari', 'sweet vermouth', 'angostura bitters', 'cherry liqueur', 'cherry brandy', 'prosecco', 'baileys irish cream']) {
      expect(isBooze(k, ROLES), k).toBe(true);
    }
    for (const k of ['lemon juice', 'simple syrup', 'mint', 'egg white', 'soda water', 'maraschino cherry', 'ginger beer', 'heavy cream', 'grenadine']) {
      expect(isBooze(k, ROLES), k).toBe(false);
    }
  });

  it('moves non-booze from an old bar to the kitchen, once', () => {
    expect(splitBar(['gin', 'lemon juice', 'campari', 'sugar'], ROLES)).toEqual({ bar: ['gin', 'campari'], moved: ['lemon juice', 'sugar'] });
    expect(splitBar(['gin'], ROLES).moved).toEqual([]);
  });

  it('cocktails are checked against bar + kitchen together', () => {
    expect(stockFor(['gin'], ['lemon', 'gin'])).toEqual(['gin', 'lemon']);
  });
});
