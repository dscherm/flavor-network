import { describe, it, expect } from 'vitest';
import {
  MODE_CYCLE,
  DEFAULT_MODE,
  MODE_LABELS,
  FILTER_KEYS,
  FILTER_TO_AXIS,
  morphAxisForStack,
  HAS_ACTIVE_FILTER,
  effectiveLegacyMode,
} from '../networkModes.js';

describe('R16 Phase 1 — networkModes', () => {
  it('MODE_CYCLE has 2 entries with flavor3D first (default) — 3D hidden per ADR-1', () => {
    expect(MODE_CYCLE).toEqual(['flavor3D', '2D']);
    expect(MODE_CYCLE[0]).toBe('flavor3D');
    expect(MODE_CYCLE).not.toContain('3D');
  });

  it('DEFAULT_MODE is flavor3D', () => {
    expect(DEFAULT_MODE).toBe('flavor3D');
  });

  it('MODE_LABELS reflect the primary/legacy naming', () => {
    expect(MODE_LABELS['flavor3D']).toBe('Flavor Network');
    expect(MODE_LABELS['3D']).toBe('Recipe Network (legacy)');
  });

  // ===== ADR-1 hide-without-delete preservation gates ====================
  // The user-facing mode picker iterates MODE_CYCLE, but programmatic
  // callers (URL params, bookmarks, deep links, legacy regression tests)
  // still pass `mode='3D'`. These assertions guard against accidental
  // full-deletion of the '3D' code path in future edits.

  it("R1 preservation — MODE_LABELS['3D'] still exists for programmatic callers", () => {
    expect(MODE_LABELS).toHaveProperty('3D');
    expect(typeof MODE_LABELS['3D']).toBe('string');
    expect(MODE_LABELS['3D'].length).toBeGreaterThan(0);
  });

  it("R1 preservation — effectiveLegacyMode('3D', null) still resolves to 'ml'", () => {
    expect(effectiveLegacyMode('3D', null)).toBe('ml');
  });

  it("R1 preservation — effectiveLegacyMode('flavor3D', null) resolves to 'mlflavor'", () => {
    expect(effectiveLegacyMode('flavor3D', null)).toBe('mlflavor');
  });

  it("R1 preservation — effectiveLegacyMode('2D', null) resolves to 'ml2d'", () => {
    expect(effectiveLegacyMode('2D', null)).toBe('ml2d');
  });

  it('FILTER_KEYS has 8 entries (v3 P-C4 adds flavor-category)', () => {
    expect(FILTER_KEYS).toHaveLength(8);
    expect(FILTER_KEYS).toEqual([
      'aroma',
      'cuisine',
      'season',
      'family',
      'taste',
      'cocktail-scope',
      'sauce-scope',
      'flavor-category',
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
    expect(FILTER_TO_AXIS['flavor-category']).toBe(null);
  });

  // ===== v3 P-C4 — flavor2D mode + flavor-category scope =================

  it("v3 P-C4 — MODE_LABELS['flavor2D'] resolves but MODE_CYCLE length still 2 (ADR-1)", () => {
    expect(MODE_LABELS['flavor2D']).toBe('Flavor Network 2D');
    expect(MODE_CYCLE).toHaveLength(2);
    expect(MODE_CYCLE).not.toContain('flavor2D');
  });

  it("v3 P-C4 — effectiveLegacyMode('flavor2D', null) resolves to 'mlflavor2d'", () => {
    expect(effectiveLegacyMode('flavor2D', null)).toBe('mlflavor2d');
  });

  it('v3 P-C4 — morphAxisForStack skips flavor-category like other scope filters', () => {
    expect(morphAxisForStack(['cuisine', 'flavor-category'])).toBe('cuisine');
    expect(morphAxisForStack(['flavor-category'])).toBe(null);
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
