// LOOK-2 contract tests (blind, TRUSTED mode): written from plan.md and the task brief only.
// The implementation in src/data/recipeLines.js was not read.
import { describe, it, expect } from 'vitest';
import {
  splitRecipeLine,
  formatRecipeLine,
  findBadLines,
} from '../../../src/data/recipeLines.js';

const parts = (amount, unit, name) => ({ amount, unit, name });

describe('splitRecipeLine', () => {
  // Covers: AC-1
  it('fixes the live Pina Colada line "tblsp Coconut milk 3"', () => {
    expect(splitRecipeLine('tblsp Coconut milk 3')).toEqual(parts('3', 'tbsp', 'Coconut milk'));
  });

  // Covers: AC-1
  it('fixes the live Pina Colada line "tblsp Pineapple 3"', () => {
    expect(splitRecipeLine('tblsp Pineapple 3')).toEqual(parts('3', 'tbsp', 'Pineapple'));
  });

  // Covers: AC-1
  it('reads amount-first "3 tbsp Coconut milk"', () => {
    expect(splitRecipeLine('3 tbsp Coconut milk')).toEqual(parts('3', 'tbsp', 'Coconut milk'));
  });

  // Covers: AC-1
  it('keeps a mixed number as written: "1 1/2 oz gin"', () => {
    expect(splitRecipeLine('1 1/2 oz gin')).toEqual(parts('1 1/2', 'oz', 'gin'));
  });

  // Covers: AC-1
  it('normalises "dashes" to "dash": "2 dashes Angostura bitters"', () => {
    expect(splitRecipeLine('2 dashes Angostura bitters')).toEqual(
      parts('2', 'dash', 'Angostura bitters'),
    );
  });

  // Covers: AC-1
  it('returns a name-only line with empty amount and unit', () => {
    expect(splitRecipeLine('Coconut milk')).toEqual(parts('', '', 'Coconut milk'));
  });

  // Covers: AC-1
  it('reads an amount with no unit: "2 eggs"', () => {
    expect(splitRecipeLine('2 eggs')).toEqual(parts('2', '', 'eggs'));
  });

  // Covers: AC-1
  it('keeps fractions, decimals and ranges as written', () => {
    expect(splitRecipeLine('1/2 cup flour')).toEqual(parts('1/2', 'cup', 'flour'));
    expect(splitRecipeLine('0.75 oz lime juice')).toEqual(parts('0.75', 'oz', 'lime juice'));
    expect(splitRecipeLine('2-3 cups stock')).toEqual(parts('2-3', 'cup', 'stock'));
  });

  // Covers: AC-1
  it('normalises every tablespoon spelling to "tbsp"', () => {
    for (const word of ['tbsp', 'tblsp', 'tbs', 'tablespoon', 'tablespoons']) {
      expect(splitRecipeLine(`2 ${word} honey`)).toEqual(parts('2', 'tbsp', 'honey'));
    }
  });

  // Covers: AC-1
  it('normalises every teaspoon spelling to "tsp"', () => {
    for (const word of ['tsp', 'teaspoon', 'teaspoons']) {
      expect(splitRecipeLine(`1 ${word} vanilla extract`)).toEqual(
        parts('1', 'tsp', 'vanilla extract'),
      );
    }
  });

  // Covers: AC-1
  it('reads capital T as tablespoon and small t as teaspoon', () => {
    expect(splitRecipeLine('1 T sugar')).toEqual(parts('1', 'tbsp', 'sugar'));
    expect(splitRecipeLine('1 t salt')).toEqual(parts('1', 'tsp', 'salt'));
  });

  // Covers: AC-1
  it('treats unit words case-insensitively but keeps the name capitalisation', () => {
    expect(splitRecipeLine('2 Tablespoons Honey')).toEqual(parts('2', 'tbsp', 'Honey'));
    expect(splitRecipeLine('1 Cup Whole Milk')).toEqual(parts('1', 'cup', 'Whole Milk'));
  });

  // Covers: AC-1
  it('normalises the metric and other listed units', () => {
    expect(splitRecipeLine('30 ml vodka')).toEqual(parts('30', 'ml', 'vodka'));
    expect(splitRecipeLine('5 cl gin')).toEqual(parts('5', 'cl', 'gin'));
    expect(splitRecipeLine('100 g butter')).toEqual(parts('100', 'g', 'butter'));
    expect(splitRecipeLine('1 kg flour')).toEqual(parts('1', 'kg', 'flour'));
    expect(splitRecipeLine('1 lb ground beef')).toEqual(parts('1', 'lb', 'ground beef'));
    expect(splitRecipeLine('1 pinch salt')).toEqual(parts('1', 'pinch', 'salt'));
    expect(splitRecipeLine('1 dash orange bitters')).toEqual(parts('1', 'dash', 'orange bitters'));
    expect(splitRecipeLine('2 cup sugar')).toEqual(parts('2', 'cup', 'sugar'));
  });

  // Covers: AC-1
  it('does not read "tomato paste" as a unit (t / tbsp-like letters at the start of a word)', () => {
    expect(splitRecipeLine('2 tbsp tomato paste')).toEqual(parts('2', 'tbsp', 'tomato paste'));
    expect(splitRecipeLine('tomato paste')).toEqual(parts('', '', 'tomato paste'));
  });

  // Covers: AC-1
  it('does not read "cup-shaped" or "gin" style words as units', () => {
    expect(splitRecipeLine('cup-shaped biscuits')).toEqual(parts('', '', 'cup-shaped biscuits'));
    expect(splitRecipeLine('2 oz gin')).toEqual(parts('2', 'oz', 'gin'));
    expect(splitRecipeLine('Tabasco')).toEqual(parts('', '', 'Tabasco'));
    expect(splitRecipeLine('lime')).toEqual(parts('', '', 'lime'));
  });

  // Covers: AC-1
  it('does not turn a bare unit word into a name', () => {
    expect(splitRecipeLine('Tbsp').name).toBe('');
    expect(splitRecipeLine('tblsp').name).toBe('');
  });

  // Covers: AC-1
  it('trims surrounding whitespace on every part', () => {
    expect(splitRecipeLine('   3 tbsp Coconut milk   ')).toEqual(
      parts('3', 'tbsp', 'Coconut milk'),
    );
    expect(splitRecipeLine('  Coconut milk ')).toEqual(parts('', '', 'Coconut milk'));
  });

  // Covers: AC-1
  it('always returns three strings, even for an empty line', () => {
    const out = splitRecipeLine('');
    expect(typeof out.amount).toBe('string');
    expect(typeof out.unit).toBe('string');
    expect(typeof out.name).toBe('string');
    expect(out).toEqual(parts('', '', ''));
  });
});

describe('formatRecipeLine', () => {
  // Covers: AC-2
  it('writes amount, unit, then name', () => {
    expect(formatRecipeLine(parts('3', 'tbsp', 'Coconut milk'))).toBe('3 tbsp Coconut milk');
    expect(formatRecipeLine(parts('1 1/2', 'oz', 'gin'))).toBe('1 1/2 oz gin');
  });

  // Covers: AC-2
  it('leaves no doubled or edge spaces when parts are empty', () => {
    expect(formatRecipeLine(parts('', '', 'Coconut milk'))).toBe('Coconut milk');
    expect(formatRecipeLine(parts('2', '', 'eggs'))).toBe('2 eggs');
    expect(formatRecipeLine(parts('', 'pinch', 'salt'))).toBe('pinch salt');
    const out = formatRecipeLine(parts('2', '', 'eggs'));
    expect(out).not.toMatch(/\s{2}/);
    expect(out).toBe(out.trim());
  });

  // Covers: AC-2
  it('round-trips the live line "tblsp Coconut milk 3" to "3 tbsp Coconut milk"', () => {
    expect(formatRecipeLine(splitRecipeLine('tblsp Coconut milk 3'))).toBe('3 tbsp Coconut milk');
  });

  // Covers: AC-2
  it('round-trips the live line "tblsp Pineapple 3" to "3 tbsp Pineapple"', () => {
    expect(formatRecipeLine(splitRecipeLine('tblsp Pineapple 3'))).toBe('3 tbsp Pineapple');
  });

  // Covers: AC-2
  it('normalises the unit spelling on the way through', () => {
    expect(formatRecipeLine(splitRecipeLine('2 dashes Angostura bitters'))).toBe(
      '2 dashes Angostura bitters',
    );
    expect(formatRecipeLine(splitRecipeLine('1 tablespoon sugar'))).toBe('1 tbsp sugar');
  });
});

describe('findBadLines', () => {
  const mixed = [
    {
      kind: 'cocktail',
      id: 'pina-colada',
      name: 'Piña Colada',
      lines: ['3 tbsp Coconut milk', '2 oz white rum', '3 tbsp', 'Pineapple'],
    },
    {
      kind: 'sauce',
      id: 'hollandaise',
      name: 'Hollandaise',
      lines: ['3 egg yolks', '1 tbsp lemon juice', 'tblsp', '1 pinch salt'],
    },
    {
      kind: 'dish',
      id: 'bolognese',
      name: 'Beef Bolognese',
      lines: ['1 lb ground beef', '2 tbsp tomato paste', 'Coconut milk'],
    },
  ];

  // Covers: AC-3
  it('reports the bad lines and only those', () => {
    const bad = findBadLines(mixed);
    expect(Array.isArray(bad)).toBe(true);
    expect(bad).toHaveLength(2);
    const lines = bad.map((b) => b.line).sort();
    expect(lines).toEqual(['3 tbsp', 'tblsp']);
  });

  // Covers: AC-3
  it('names the recipe each bad line came from, with the raw line', () => {
    const bad = findBadLines(mixed);
    const byLine = Object.fromEntries(bad.map((b) => [b.line, b]));
    expect(byLine['3 tbsp']).toMatchObject({
      kind: 'cocktail',
      id: 'pina-colada',
      name: 'Piña Colada',
      line: '3 tbsp',
    });
    expect(byLine['tblsp']).toMatchObject({
      kind: 'sauce',
      id: 'hollandaise',
      name: 'Hollandaise',
      line: 'tblsp',
    });
  });

  // Covers: AC-3
  it('gives every report a short non-empty problem string', () => {
    for (const b of findBadLines(mixed)) {
      expect(typeof b.problem).toBe('string');
      expect(b.problem.trim().length).toBeGreaterThan(0);
      expect(b.problem.length).toBeLessThan(200);
    }
  });

  // Covers: AC-3
  it('flags a line that is only an amount and a unit, or only a number', () => {
    const bad = findBadLines([
      { kind: 'cocktail', id: 'x', name: 'X', lines: ['2 oz', '1/2', 'Tbsp', 'lime'] },
    ]);
    expect(bad.map((b) => b.line).sort()).toEqual(['1/2', '2 oz', 'Tbsp'].sort());
  });

  // Covers: AC-3
  it('reports nothing for all-good recipes, no recipes, or recipes without lines', () => {
    expect(findBadLines([])).toEqual([]);
    expect(findBadLines([{ kind: 'dish', id: 'empty', name: 'Empty', lines: [] }])).toEqual([]);
    expect(
      findBadLines([
        {
          kind: 'cocktail',
          id: 'daiquiri',
          name: 'Daiquiri',
          lines: ['2 oz white rum', '1 oz lime juice', '3/4 oz simple syrup'],
        },
      ]),
    ).toEqual([]);
  });

  // Covers: AC-3
  it('is pure: does not change the recipes it is given', () => {
    const copy = JSON.parse(JSON.stringify(mixed));
    findBadLines(mixed);
    expect(mixed).toEqual(copy);
  });

  // Covers: AC-3
  it('gives the same answer on repeated calls', () => {
    expect(findBadLines(mixed)).toEqual(findBadLines(mixed));
  });
});

describe('round trip through splitRecipeLine + formatRecipeLine is clean', () => {
  const raw = [
    'tblsp Coconut milk 3',
    'tblsp Pineapple 3',
    '3 tbsp Coconut milk',
    '1 1/2 oz gin',
    '2 dashes Angostura bitters',
    'Coconut milk',
    '2 eggs',
    '1/2 cup flour',
    '0.75 oz lime juice',
    '2-3 cups chicken stock',
    '30 ml vodka',
    '100 g butter',
    '1 pinch salt',
    '2 tbsp tomato paste',
    '1 tablespoon honey',
    '2 teaspoons vanilla extract',
  ];
  const fixed = raw.map((l) => formatRecipeLine(splitRecipeLine(l)));

  // Covers: AC-4
  it('findBadLines reports nothing for lines already fixed by the round trip', () => {
    expect(fixed.length).toBeGreaterThanOrEqual(10);
    const recipes = [
      { kind: 'cocktail', id: 'pina-colada', name: 'Piña Colada', lines: fixed.slice(0, 8) },
      { kind: 'dish', id: 'mixed', name: 'Mixed', lines: fixed.slice(8) },
    ];
    expect(findBadLines(recipes)).toEqual([]);
  });

  // Covers: AC-4
  it('the round trip is stable: a fixed line comes back unchanged', () => {
    for (const line of fixed) {
      expect(formatRecipeLine(splitRecipeLine(line))).toBe(line);
    }
  });

  // Covers: AC-4
  it('no fixed line starts with a unit word or ends with a number', () => {
    for (const line of fixed) {
      expect(line).not.toMatch(/^(tblsp|tbsp|tbs|tablespoons?|tsp|teaspoons?)\b/i);
      expect(line).not.toMatch(/\s\d+(\.\d+)?$/);
    }
  });
});
