import { describe, it, expect } from 'vitest';
import { matchClassical, findInTree } from './classicalMatcher.js';

// Comprehensive matching tests across every classical entry in the tree.
// Each test states: given these ingredients in this mode, we expect the
// matcher to return a specific node (or a specific partial).

describe('matchClassical — sauce mode (Mother Sauces)', () => {
  it('Béchamel (root)', () => {
    const r = matchClassical('sauce', ['butter', 'flour', 'milk']);
    expect(r.complete?.name).toBe('Béchamel');
    expect(r.complete?.path).toEqual(['Béchamel']);
    expect(r.root?.name).toBe('Béchamel');
  });

  it('Mornay (Béchamel child)', () => {
    const r = matchClassical('sauce', ['butter', 'flour', 'milk', 'gruyere', 'parmesan']);
    expect(r.complete?.name).toBe('Mornay');
    expect(r.complete?.path).toEqual(['Béchamel', 'Mornay']);
  });

  it('Soubise (Béchamel + onion)', () => {
    const r = matchClassical('sauce', ['butter', 'flour', 'milk', 'onion']);
    expect(r.complete?.name).toBe('Soubise');
  });

  it('Cheddar sauce (Béchamel + cheddar)', () => {
    const r = matchClassical('sauce', ['butter', 'flour', 'milk', 'cheddar']);
    expect(r.complete?.name).toBe('Cheddar sauce');
  });

  it('Mustard sauce (Béchamel + mustard)', () => {
    const r = matchClassical('sauce', ['butter', 'flour', 'milk', 'mustard']);
    expect(r.complete?.name).toBe('Mustard sauce');
  });

  it('Velouté (root)', () => {
    const r = matchClassical('sauce', ['butter', 'flour', 'chicken stock']);
    expect(r.complete?.name).toBe('Velouté');
  });

  it('Suprême (Velouté + cream)', () => {
    const r = matchClassical('sauce', ['butter', 'flour', 'chicken stock', 'cream']);
    expect(r.complete?.name).toBe('Suprême');
  });

  it('Aurora (Velouté + tomato purée)', () => {
    const r = matchClassical('sauce', ['butter', 'flour', 'chicken stock', 'tomato puree']);
    expect(r.complete?.name).toBe('Aurora');
  });

  it('Espagnole (root)', () => {
    const r = matchClassical('sauce', [
      'butter', 'flour', 'beef stock', 'tomato paste', 'onion', 'carrot', 'celery',
    ]);
    expect(r.complete?.name).toBe('Espagnole');
  });

  it('Bordelaise (2-deep descendant of Espagnole)', () => {
    const r = matchClassical('sauce', ['beef stock', 'red wine', 'shallot', 'butter']);
    expect(r.complete?.name).toBe('Bordelaise');
    expect(r.complete?.path).toEqual(['Espagnole', 'Demi-glace', 'Bordelaise']);
  });

  it('Chasseur (Demi-glace + mushroom + tarragon)', () => {
    const r = matchClassical('sauce', ['beef stock', 'mushroom', 'white wine', 'tomato', 'tarragon']);
    expect(r.complete?.name).toBe('Chasseur');
  });

  it('Robert (Demi-glace + mustard)', () => {
    const r = matchClassical('sauce', ['beef stock', 'onion', 'mustard', 'white wine']);
    expect(r.complete?.name).toBe('Robert');
  });

  it('Bourguignon (Demi-glace + red wine + mushroom + bacon)', () => {
    const r = matchClassical('sauce', ['beef stock', 'red wine', 'mushroom', 'onion', 'bacon']);
    expect(r.complete?.name).toBe('Bourguignon');
  });

  it('Marinara (Tomate daughter)', () => {
    const r = matchClassical('sauce', ['tomato', 'garlic', 'oregano', 'basil', 'olive oil']);
    expect(r.complete?.name).toBe('Marinara');
  });

  it('Arrabiata (Tomate + chili)', () => {
    const r = matchClassical('sauce', ['tomato', 'garlic', 'red chile', 'olive oil']);
    expect(r.complete?.name).toBe('Arrabiata');
  });

  it('Puttanesca', () => {
    const r = matchClassical('sauce', ['tomato', 'olive', 'caper', 'anchovy', 'garlic']);
    expect(r.complete?.name).toBe('Puttanesca');
  });

  it('Hollandaise (root emulsion)', () => {
    const r = matchClassical('sauce', ['butter', 'egg yolk', 'lemon juice']);
    expect(r.complete?.name).toBe('Hollandaise');
  });

  it('Béarnaise (Hollandaise + tarragon + shallot + vinegar)', () => {
    const r = matchClassical('sauce', ['butter', 'egg yolk', 'tarragon', 'shallot', 'vinegar']);
    expect(r.complete?.name).toBe('Béarnaise');
  });

  it('Mousseline (Hollandaise + cream)', () => {
    const r = matchClassical('sauce', ['butter', 'egg yolk', 'lemon juice', 'cream']);
    // With 4 keys and all 4 present, Mousseline should win at ratio 1.0
    expect(r.complete?.name).toBe('Mousseline');
  });

  it('Choron (Béarnaise + tomato purée)', () => {
    const r = matchClassical('sauce', ['butter', 'egg yolk', 'tarragon', 'tomato puree']);
    expect(r.complete?.name).toBe('Choron');
  });

  it('Partial match — butter + flour is a nascent Béchamel', () => {
    const r = matchClassical('sauce', ['butter', 'flour']);
    expect(r.complete).toBeNull();
    expect(r.partial?.name).toBe('Béchamel');
    expect(r.partial?.ratio).toBeCloseTo(0.67, 1);
  });

  it('No match for completely unrelated ingredients', () => {
    const r = matchClassical('sauce', ['sushi rice', 'nori', 'wasabi']);
    expect(r.complete).toBeNull();
    expect(r.partial).toBeNull();
  });

  it('Empty ingredient list → no match', () => {
    expect(matchClassical('sauce', []).complete).toBeNull();
  });
});

describe('matchClassical — cocktail mode (Codex)', () => {
  it('Old Fashioned (root)', () => {
    const r = matchClassical('cocktail', ['whiskey', 'sugar', 'angostura bitters']);
    expect(r.complete?.name).toBe('Old Fashioned');
  });

  it('Sazerac (Old Fashioned variant)', () => {
    const r = matchClassical('cocktail', ['rye', 'sugar', 'absinthe']);
    expect(r.complete?.name).toBe('Sazerac');
  });

  it('Rum Old Fashioned', () => {
    const r = matchClassical('cocktail', ['rum', 'demerara', 'angostura bitters']);
    expect(r.complete?.name).toBe('Rum Old Fashioned');
  });

  it('Martini (root)', () => {
    const r = matchClassical('cocktail', ['gin', 'dry vermouth']);
    expect(r.complete?.name).toBe('Martini');
  });

  it('Manhattan (Martini variant)', () => {
    const r = matchClassical('cocktail', ['whiskey', 'sweet vermouth', 'angostura bitters']);
    expect(r.complete?.name).toBe('Manhattan');
  });

  it('Negroni', () => {
    const r = matchClassical('cocktail', ['gin', 'campari', 'sweet vermouth']);
    expect(r.complete?.name).toBe('Negroni');
  });

  it('Boulevardier', () => {
    const r = matchClassical('cocktail', ['bourbon', 'campari', 'sweet vermouth']);
    expect(r.complete?.name).toBe('Boulevardier');
  });

  it('Vesper', () => {
    const r = matchClassical('cocktail', ['gin', 'vodka', 'lillet blanc']);
    expect(r.complete?.name).toBe('Vesper');
  });

  it('Daiquiri (root)', () => {
    const r = matchClassical('cocktail', ['rum', 'lime juice', 'sugar']);
    expect(r.complete?.name).toBe('Daiquiri');
  });

  it('Margarita', () => {
    const r = matchClassical('cocktail', ['tequila', 'lime juice', 'triple sec']);
    expect(r.complete?.name).toBe('Margarita');
  });

  it('Whiskey Sour', () => {
    const r = matchClassical('cocktail', ['whiskey', 'lemon juice', 'sugar']);
    expect(r.complete?.name).toBe('Whiskey Sour');
  });

  it('Sidecar (root)', () => {
    const r = matchClassical('cocktail', ['cognac', 'triple sec', 'lemon juice']);
    expect(r.complete?.name).toBe('Sidecar');
  });

  it('Aviation (Sidecar variant)', () => {
    const r = matchClassical('cocktail', ['gin', 'maraschino', 'creme de violette', 'lemon juice']);
    expect(r.complete?.name).toBe('Aviation');
  });

  it('Last Word', () => {
    const r = matchClassical('cocktail', ['gin', 'green chartreuse', 'maraschino', 'lime juice']);
    expect(r.complete?.name).toBe('Last Word');
  });

  it('Gin & Tonic (Highball)', () => {
    const r = matchClassical('cocktail', ['gin', 'tonic water', 'lime juice']);
    expect(r.complete?.name).toBe('Gin & Tonic');
  });

  it('Moscow Mule', () => {
    const r = matchClassical('cocktail', ['vodka', 'ginger beer', 'lime juice']);
    expect(r.complete?.name).toBe('Moscow Mule');
  });

  it('Dark and Stormy', () => {
    const r = matchClassical('cocktail', ['dark rum', 'ginger beer', 'lime juice']);
    expect(r.complete?.name).toBe("Dark 'n' Stormy");
  });

  it('Grasshopper (Flip variant)', () => {
    const r = matchClassical('cocktail', ['creme de menthe', 'creme de cacao', 'cream']);
    expect(r.complete?.name).toBe('Grasshopper');
  });

  it('Partial — gin + lime only → sub-Daiquiri', () => {
    const r = matchClassical('cocktail', ['gin', 'lime juice']);
    expect(r.complete).toBeNull();
    expect(r.partial?.ratio).toBeGreaterThanOrEqual(0.5);
  });

  it('Deeper match preferred over shallower when ratios tie', () => {
    // Ingredient set covers both Martini (2 keys) and Negroni (3 keys).
    // With all Negroni keys present, Negroni wins despite its path being deeper.
    const r = matchClassical('cocktail', ['gin', 'campari', 'sweet vermouth', 'dry vermouth']);
    expect(r.complete?.name).toBe('Negroni');
  });
});

describe('matchClassical — edge cases', () => {
  it('Unknown mode returns empty', () => {
    const r = matchClassical('taste', ['butter', 'flour']);
    expect(r.complete).toBeNull();
    expect(r.allMatches).toEqual([]);
  });

  it('Case-insensitive ingredient matching', () => {
    const r = matchClassical('sauce', ['BUTTER', 'Flour', 'MiLk']);
    expect(r.complete?.name).toBe('Béchamel');
  });

  it('Substring matching — "lemon" finds "lemon juice" key', () => {
    const r = matchClassical('sauce', ['butter', 'egg yolk', 'lemon']);
    expect(r.complete?.name).toBe('Hollandaise');
  });
});

describe('findInTree', () => {
  it('locates nodes by name', () => {
    expect(findInTree('sauce', 'Mornay')?.name).toBe('Mornay');
    expect(findInTree('cocktail', 'Negroni')?.name).toBe('Negroni');
    expect(findInTree('sauce', 'Bordelaise')?.path).toEqual([
      'Espagnole', 'Demi-glace', 'Bordelaise',
    ]);
  });

  it('returns null for unknown names', () => {
    expect(findInTree('sauce', 'NotAThing')).toBeNull();
  });
});
