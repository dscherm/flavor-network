import { describe, it, expect } from 'vitest';
import {
  MODE_CYCLE,
  DEFAULT_MODE,
  MODE_LABELS,
  FILTER_KEYS,
  FILTER_TO_AXIS,
  morphAxisForStack,
  HAS_ACTIVE_FILTER,
} from '../networkModes.js';

describe('R16 Phase 1 — networkModes', () => {
  it('MODE_CYCLE has 3 entries with flavor3D first (default)', () => {
    expect(MODE_CYCLE).toEqual(['flavor3D', '3D', '2D']);
    expect(MODE_CYCLE[0]).toBe('flavor3D');
  });

  it('DEFAULT_MODE is flavor3D', () => {
    expect(DEFAULT_MODE).toBe('flavor3D');
  });

  it('MODE_LABELS reflect the primary/legacy naming', () => {
    expect(MODE_LABELS['flavor3D']).toBe('Flavor Network');
    expect(MODE_LABELS['3D']).toBe('Recipe Network (legacy)');
  });

  it('FILTER_KEYS has 7 entries', () => {
    expect(FILTER_KEYS).toHaveLength(7);
    expect(FILTER_KEYS).toEqual([
      'aroma',
      'cuisine',
      'season',
      'family',
      'taste',
      'cocktail-scope',
      'sauce-scope',
    ]);
  });

  it('FILTER_TO_AXIS maps singular filter keys to plural axis keys', () => {
    expect(FILTER_TO_AXIS['aroma']).toBe('aromas');
    expect(FILTER_TO_AXIS['cuisine']).toBe('cuisine');
    expect(FILTER_TO_AXIS['season']).toBe('season');
    expect(FILTER_TO_AXIS['family']).toBe('family');
    expect(FILTER_TO_AXIS['taste']).toBe('taste');
  });

  it('FILTER_TO_AXIS scope filters map to null', () => {
    expect(FILTER_TO_AXIS['cocktail-scope']).toBe(null);
    expect(FILTER_TO_AXIS['sauce-scope']).toBe(null);
  });

  it('morphAxisForStack empty stack returns null (cooccurrence)', () => {
    expect(morphAxisForStack([])).toBe(null);
  });

  it('morphAxisForStack returns most-recent non-null-axis filter', () => {
    expect(morphAxisForStack(['cuisine'])).toBe('cuisine');
    expect(morphAxisForStack(['aroma', 'cuisine'])).toBe('cuisine');
    expect(morphAxisForStack(['cuisine', 'aroma'])).toBe('aromas');
  });

  it('morphAxisForStack skips scope filters (tail-first)', () => {
    expect(morphAxisForStack(['cuisine', 'cocktail-scope'])).toBe('cuisine');
    expect(morphAxisForStack(['cocktail-scope'])).toBe(null);
    expect(morphAxisForStack(['cocktail-scope', 'sauce-scope'])).toBe(null);
  });

  it('C2 acceptance — removing a non-tail filter preserves morphAxis', () => {
    const before = morphAxisForStack(['aroma', 'cuisine', 'season']);
    expect(before).toBe('season');
    const after = morphAxisForStack(['aroma', 'season']);
    expect(after).toBe('season');
  });

  it('HAS_ACTIVE_FILTER reflects whether the stack has any entries', () => {
    expect(HAS_ACTIVE_FILTER([])).toBe(false);
    expect(HAS_ACTIVE_FILTER(['aroma'])).toBe(true);
    expect(HAS_ACTIVE_FILTER(['cocktail-scope'])).toBe(true);
  });
});
