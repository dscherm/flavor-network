import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  normalizeGlass, deriveFacets, matchesFacetFilter, GLASS_TYPES, OCCASIONS, SEASONS,
} from '../cocktailFacets.js';

const SLOTS = {
  gin: 'spirit', whiskey: 'spirit', rum: 'spirit', vodka: 'spirit', campari: 'amaro_liqueur',
  'sweet vermouth': 'vermouth', 'lime juice': 'sour', 'lemon juice': 'sour', 'simple syrup': 'sweet',
  'soda water': 'modifier', 'orange juice': 'modifier', cream: 'modifier', 'creme de cacao': 'amaro_liqueur',
  bitters: 'bitter', 'pineapple juice': 'modifier', 'coconut cream': 'modifier',
};
const SEASON = { pineapple: 'spring-summer', cranberry: 'autumn-winter', strawberry: 'summer' };
const ctx = { slotOf: (n) => SLOTS[n] || null, seasonOf: (n) => SEASON[n] || null };
const drink = (name, ingredients, extra = {}) => ({ name, ingredients_raw: ingredients.map((raw) => ({ raw })), ...extra });

describe('normalizeGlass', () => {
  it('folds the 40+ spellings into a few types', () => {
    expect(normalizeGlass('Old-Fashioned glass')).toBe('rocks');
    expect(normalizeGlass('old fashioned glass')).toBe('rocks');
    expect(normalizeGlass('Nick and Nora Glass')).toBe('coupe');
    expect(normalizeGlass('Collins Glass')).toBe('highball');
    expect(normalizeGlass('Champagne flute')).toBe('flute');
    expect(normalizeGlass('Irish coffee cup')).toBe('mug');
  });
  it('infers a glass from the ice format when none is recorded', () => {
    expect(normalizeGlass(null, { ice: 'up' })).toBe('coupe');
    expect(normalizeGlass(null, { ice: 'tall' })).toBe('highball');
    expect(normalizeGlass(null, {})).toBeNull();
  });
  it('every rule output is a known type', () => {
    for (const g of ['coupe', 'rocks', 'highball', 'flute', 'wine', 'mug', 'beer', 'hurricane', 'punch', 'shot']) {
      expect(GLASS_TYPES).toContain(g);
    }
  });
});

describe('deriveFacets', () => {
  it('a stirred spirit + amaro + vermouth drink is strong, bitter, a nightcap', () => {
    const f = deriveFacets(drink('Negroni', ['Gin', 'Campari', 'Sweet vermouth'], { build_method: 'stir', ice_format: 'rocks', family_id: 4 }), ctx);
    expect(f.strength).toBe('strong');
    expect(f.character).toEqual(expect.arrayContaining(['bitter', 'boozy']));
    expect(f.occasions).toContain('nightcap');
    expect(f.equipment).toBe('none');
    expect(f.glass).toBe('rocks');
  });
  it('a shaken sour is medium strength and sour', () => {
    const f = deriveFacets(drink('Daiquiri', ['Rum', 'Lime juice', 'Simple syrup'], { build_method: 'shake', ice_format: 'up' }), ctx);
    expect(f.strength).toBe('medium');
    expect(f.character).toContain('sour');
    expect(f.equipment).toBe('shaker');
    expect(f.effort).toBe('moderate');
  });
  it('a soda highball is light and bubbly', () => {
    const f = deriveFacets(drink('Gin and Soda', ['Gin', 'Soda water'], { build_method: 'build', ice_format: 'tall' }), ctx);
    expect(f.strength).toBe('light');
    expect(f.character).toContain('bubbly');
    expect(f.effort).toBe('easy');
  });
  it('a blended tropical drink is frozen, poolside, summer', () => {
    const f = deriveFacets(drink('Pina Colada', ['Rum', 'Pineapple juice', 'Coconut cream'], { build_method: 'blend', family_id: 0 }), ctx);
    expect(f.temperature).toBe('frozen');
    expect(f.equipment).toBe('blender');
    expect(f.occasions).toContain('poolside');
    expect(f.seasons).toContain('summer');
  });
  it('a hot coffee drink is hot, winter, holiday', () => {
    const f = deriveFacets(drink('Irish Coffee', ['Irish whiskey', 'Hot coffee', 'Sugar', 'Cream'], { build_method: 'build' }), ctx);
    expect(f.temperature).toBe('hot');
    expect(f.seasons).toContain('winter');
    expect(f.occasions).toContain('holiday');
    expect(f.dietary.dairy).toBe(true);
  });
  it('flags egg and reads seasons off seasonal ingredients', () => {
    const f = deriveFacets(drink('Cranberry Flip', ['Brandy', 'Cranberry', 'Whole egg', 'Simple syrup'], { build_method: 'shake' }), ctx);
    expect(f.dietary.egg).toBe(true);
    expect(f.seasons).toEqual(expect.arrayContaining(['autumn', 'winter']));
    expect(f.batchable).toBe(false);
  });
  it('only emits known occasion and season values', () => {
    const f = deriveFacets(drink('Mimosa', ['Champagne', 'Orange juice'], { build_method: 'build', family_id: 5 }), ctx);
    for (const o of f.occasions) expect(OCCASIONS).toContain(o);
    for (const s of f.seasons) expect(SEASONS).toContain(s);
    expect(f.occasions).toContain('brunch');
  });
});

describe('guessSlot', () => {
  it('does not read "ginger beer" as gin, and handles accents', async () => {
    const { guessSlot } = await import('../cocktailFacets.js');
    expect(guessSlot('ginger beer')).toBe('modifier');
    expect(guessSlot('London dry gin')).toBe('spirit');
    expect(guessSlot('Bénédictine')).toBe('amaro_liqueur');
    expect(guessSlot('Peychaud’s bitters')).toBe('bitter');
    expect(guessSlot('sweet vermouth')).toBe('vermouth');
  });
});

describe('matchesFacetFilter', () => {
  const f = { strength: 'light', occasions: ['brunch'], seasons: ['summer'], character: ['bubbly'], dietary: { egg: false, dairy: true }, glass: 'flute' };
  it('matches scalar and list facets, ignores empty values', () => {
    expect(matchesFacetFilter(f, { strength: 'light', occasions: 'brunch', glass: '' })).toBe(true);
    expect(matchesFacetFilter(f, { strength: 'strong' })).toBe(false);
    expect(matchesFacetFilter(f, { seasons: 'winter' })).toBe(false);
  });
  it('dietary toggles exclude, not select', () => {
    expect(matchesFacetFilter(f, { noDairy: true })).toBe(false);
    expect(matchesFacetFilter(f, { noEgg: true })).toBe(true);
  });
});

describe('against the shipped codex', () => {
  const codex = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data/cocktail_codex_v2.json'), 'utf8'));
  const roles = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data/cocktail_roles.json'), 'utf8')).byIngredient;
  const seasons = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data/season_region.json'), 'utf8'));
  const real = { slotOf: (n) => roles[n]?.role || null, seasonOf: (n) => seasons[n]?.season || null };
  const all = codex.cocktails.map((c) => deriveFacets(c, real));

  it('every cocktail gets a glass type', () => {
    expect(all.filter((f) => !f.glass).length).toBe(0);
  });
  it('no single facet value swallows the whole corpus', () => {
    const n = all.length;
    for (const key of ['strength', 'effort']) {
      const counts = {};
      for (const f of all) counts[f[key]] = (counts[f[key]] || 0) + 1;
      for (const v of Object.values(counts)) expect(v).toBeLessThan(n * 0.8);
    }
    for (const o of OCCASIONS) {
      const c = all.filter((f) => f.occasions.includes(o)).length;
      expect(c, o).toBeGreaterThan(5);
      expect(c, o).toBeLessThan(n * 0.8);
    }
  });
});
