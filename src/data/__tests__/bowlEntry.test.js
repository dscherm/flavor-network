import { describe, it, expect } from 'vitest';
import {
  bowlNames,
  bowlFromIngredients,
  bowlIncludes,
  bowlAddIngredient,
  bowlRemoveIngredient,
  bowlSwapIngredient,
  bowlSetAmount,
  bowlGetAmount,
  makeBowlEntry,
  emptyAmount,
} from '../bowlEntry.js';

describe('bowlEntry — helpers (RL-PORTIONS-UI)', () => {
  describe('bowlNames', () => {
    it('extracts ingredient names from a BowlEntry[]', () => {
      const bowl = [makeBowlEntry('tomato'), makeBowlEntry('basil')];
      expect(bowlNames(bowl)).toEqual(['tomato', 'basil']);
    });

    it('coexists with legacy string[] entries (mixed shape tolerance)', () => {
      const bowl = [makeBowlEntry('tomato'), 'basil'];
      expect(bowlNames(bowl)).toEqual(['tomato', 'basil']);
    });

    it('returns [] for non-array / null / undefined', () => {
      expect(bowlNames(null)).toEqual([]);
      expect(bowlNames(undefined)).toEqual([]);
      expect(bowlNames('not an array')).toEqual([]);
    });

    it('filters out empty / malformed entries', () => {
      const bowl = [makeBowlEntry('tomato'), { foo: 'bar' }, null, 'basil'];
      expect(bowlNames(bowl)).toEqual(['tomato', 'basil']);
    });
  });

  describe('bowlFromIngredients', () => {
    it('coerces a legacy string[] to BowlEntry[]', () => {
      const bowl = bowlFromIngredients(['tomato', 'basil']);
      expect(bowl).toHaveLength(2);
      expect(bowl[0]).toEqual({ ingredient: 'tomato', amount: null });
      expect(bowl[1]).toEqual({ ingredient: 'basil', amount: null });
    });

    it('preserves an already-BowlEntry[] payload', () => {
      const input = [
        { ingredient: 'tomato', amount: { raw: '2 medium', qty: 2, unit: 'medium', inferred: false } },
        { ingredient: 'basil', amount: null },
      ];
      const bowl = bowlFromIngredients(input);
      expect(bowl).toHaveLength(2);
      expect(bowl[0].amount?.qty).toBe(2);
      expect(bowl[1].amount).toBeNull();
    });

    it('dedupes by ingredient name (first-seen wins)', () => {
      const bowl = bowlFromIngredients(['tomato', 'basil', 'tomato']);
      expect(bowl).toHaveLength(2);
      expect(bowlNames(bowl)).toEqual(['tomato', 'basil']);
    });

    it('returns [] for empty / non-array input', () => {
      expect(bowlFromIngredients([])).toEqual([]);
      expect(bowlFromIngredients(null)).toEqual([]);
    });
  });

  describe('bowlIncludes', () => {
    it('returns true when the name matches an entry', () => {
      const bowl = [makeBowlEntry('tomato'), makeBowlEntry('basil')];
      expect(bowlIncludes(bowl, 'tomato')).toBe(true);
      expect(bowlIncludes(bowl, 'garlic')).toBe(false);
    });

    it('returns false for empty / null inputs', () => {
      expect(bowlIncludes([], 'tomato')).toBe(false);
      expect(bowlIncludes(null, 'tomato')).toBe(false);
      expect(bowlIncludes([makeBowlEntry('x')], null)).toBe(false);
    });
  });

  describe('bowlAddIngredient', () => {
    it('appends a new entry', () => {
      const bowl = [makeBowlEntry('tomato')];
      const next = bowlAddIngredient(bowl, 'basil');
      expect(bowlNames(next)).toEqual(['tomato', 'basil']);
    });

    it('is idempotent when the name already exists', () => {
      const bowl = [makeBowlEntry('tomato')];
      const next = bowlAddIngredient(bowl, 'tomato');
      expect(next).toBe(bowl);
    });

    it('does nothing when name is empty', () => {
      const bowl = [makeBowlEntry('tomato')];
      expect(bowlAddIngredient(bowl, null)).toBe(bowl);
      expect(bowlAddIngredient(bowl, '')).toBe(bowl);
    });
  });

  describe('bowlRemoveIngredient', () => {
    it('removes the matching entry', () => {
      const bowl = [makeBowlEntry('tomato'), makeBowlEntry('basil')];
      const next = bowlRemoveIngredient(bowl, 'tomato');
      expect(bowlNames(next)).toEqual(['basil']);
    });

    it('returns bowl unchanged when name is missing', () => {
      const bowl = [makeBowlEntry('tomato')];
      const next = bowlRemoveIngredient(bowl, 'garlic');
      expect(next).toHaveLength(1);
    });
  });

  describe('bowlSwapIngredient', () => {
    it('replaces oldName with newName in place, preserving position', () => {
      const bowl = [makeBowlEntry('tomato'), makeBowlEntry('basil'), makeBowlEntry('garlic')];
      const next = bowlSwapIngredient(bowl, 'basil', 'oregano');
      expect(bowlNames(next)).toEqual(['tomato', 'oregano', 'garlic']);
    });

    it('preserves amount when swapping in place', () => {
      const bowl = [
        makeBowlEntry('tomato'),
        makeBowlEntry('basil', { raw: '5 sprigs', qty: 5, unit: 'sprig', inferred: false }),
      ];
      const next = bowlSwapIngredient(bowl, 'basil', 'oregano');
      expect(next[1].amount?.qty).toBe(5);
      expect(next[1].amount?.unit).toBe('sprig');
    });

    it('drops the old slot when newName already exists (no duplicates)', () => {
      const bowl = [makeBowlEntry('tomato'), makeBowlEntry('basil')];
      const next = bowlSwapIngredient(bowl, 'tomato', 'basil');
      expect(bowlNames(next)).toEqual(['basil']);
    });

    it('appends newName when oldName is absent', () => {
      const bowl = [makeBowlEntry('tomato')];
      const next = bowlSwapIngredient(bowl, 'missing', 'basil');
      expect(bowlNames(next)).toEqual(['tomato', 'basil']);
    });
  });

  describe('bowlSetAmount', () => {
    it('parses raw text and writes structured amount', () => {
      const bowl = [makeBowlEntry('tomato'), makeBowlEntry('basil')];
      const next = bowlSetAmount(bowl, 'tomato', '2 medium');
      expect(next[0].amount).toEqual({ raw: '2 medium', qty: 2, unit: 'medium', inferred: false });
      expect(next[1].amount).toBeNull();
    });

    it('preserves raw text when parsing fails (qty/unit null)', () => {
      const bowl = [makeBowlEntry('tomato')];
      const next = bowlSetAmount(bowl, 'tomato', 'nonsense');
      expect(next[0].amount).toEqual({ raw: 'nonsense', qty: null, unit: null, inferred: false });
    });

    it('clears amount when raw text is empty', () => {
      const bowl = [makeBowlEntry('tomato', { raw: '1 tbsp', qty: 1, unit: 'tbsp', inferred: false })];
      const next = bowlSetAmount(bowl, 'tomato', '');
      expect(next[0].amount).toBeNull();
    });

    it('sets inferred=true when called with inferred option', () => {
      const bowl = [makeBowlEntry('tomato')];
      const next = bowlSetAmount(bowl, 'tomato', '1 tbsp', { inferred: true });
      expect(next[0].amount?.inferred).toBe(true);
    });

    it('returns bowl unchanged when name is missing', () => {
      const bowl = [makeBowlEntry('tomato')];
      const next = bowlSetAmount(bowl, 'missing', '1 tbsp');
      expect(next).toBe(bowl);
    });
  });

  describe('bowlGetAmount', () => {
    it('returns the amount object for a known entry', () => {
      const bowl = [
        makeBowlEntry('tomato', { raw: '2 medium', qty: 2, unit: 'medium', inferred: false }),
      ];
      const amount = bowlGetAmount(bowl, 'tomato');
      expect(amount?.qty).toBe(2);
    });

    it('returns null for missing entry or entry with no amount', () => {
      const bowl = [makeBowlEntry('tomato')];
      expect(bowlGetAmount(bowl, 'tomato')).toBeNull();
      expect(bowlGetAmount(bowl, 'missing')).toBeNull();
    });
  });

  describe('emptyAmount', () => {
    it('returns a blank, non-inferred amount stub', () => {
      expect(emptyAmount()).toEqual({ raw: '', qty: null, unit: null, inferred: false });
    });
  });
});
