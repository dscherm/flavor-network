import { describe, it, expect } from 'vitest';
import { AROMA_AXES, buildTier1Thresholds, gnnPrimaryTier1 } from '../primaryTier1.js';

describe('AROMA_AXES (Q7)', () => {
  it('locks tier-1 vocabulary at 5 terms; spicy excluded', () => {
    expect(AROMA_AXES).toEqual(['fruity', 'floral', 'green', 'woody', 'fatty']);
    expect(AROMA_AXES).not.toContain('spicy');
  });
});

describe('buildTier1Thresholds', () => {
  it('picks per_task entries, projects odor_<aroma> → aroma key, filters non-canonical', () => {
    const raw = {
      per_task: [
        { task: 'sweet', ingredient_threshold: 0.213 },
        { task: 'salty', ingredient_threshold: 0.357 },
        { task: 'odor_fruity', ingredient_threshold: 0.269 },
        { task: 'odor_woody', ingredient_threshold: 0.252 },
        { task: 'odor_spicy', ingredient_threshold: 0.30 },
        { task: 'odor_floral', ingredient_threshold: 0.192 },
      ],
    };
    const out = buildTier1Thresholds(raw);
    expect(out).toEqual({
      fruity: 0.269,
      woody: 0.252,
      floral: 0.192,
    });
    expect(out).not.toHaveProperty('spicy');
    expect(out).not.toHaveProperty('sweet');
  });

  it('returns empty object for missing or malformed input', () => {
    expect(buildTier1Thresholds(null)).toEqual({});
    expect(buildTier1Thresholds({})).toEqual({});
    expect(buildTier1Thresholds({ per_task: 'nope' })).toEqual({});
  });
});

describe('gnnPrimaryTier1', () => {
  const thresholds = { fruity: 0.269, floral: 0.192, green: 0.285, woody: 0.252, fatty: 0.20 };

  it('returns the aroma head with the highest above-threshold prob', () => {
    const probs = {
      odor_fruity: 0.30, odor_floral: 0.05, odor_green: 0.10, odor_woody: 0.50, odor_fatty: 0.18,
    };
    expect(gnnPrimaryTier1(probs, thresholds)).toBe('woody');
  });

  it('drops heads below their calibrated threshold', () => {
    const probs = {
      odor_fruity: 0.10, odor_floral: 0.05, odor_green: 0.10, odor_woody: 0.10, odor_fatty: 0.10,
    };
    expect(gnnPrimaryTier1(probs, thresholds)).toBe(null);
  });

  it('tie-breaks within ε=0.01 by AROMA_AXES order (fruity first)', () => {
    const probs = {
      odor_fruity: 0.40, odor_floral: 0.40, odor_green: 0.50, odor_woody: 0.40, odor_fatty: 0.40,
    };
    expect(gnnPrimaryTier1(probs, thresholds)).toBe('green');
  });

  it('canonical fixture from v2 N1-ADR-3 spec — woody+fruity, picks fruity', () => {
    const probs = { odor_woody: 0.5, odor_fruity: 0.8, odor_floral: 0.0, odor_green: 0.0, odor_fatty: 0.0 };
    expect(gnnPrimaryTier1(probs, { fruity: 0.269, woody: 0.252 })).toBe('fruity');
  });

  it('ignores odor_spicy even when above threshold (Q7)', () => {
    const probs = {
      odor_fruity: 0.0, odor_floral: 0.0, odor_green: 0.0, odor_woody: 0.0, odor_fatty: 0.0,
      odor_spicy: 0.95,
    };
    expect(gnnPrimaryTier1(probs, { ...thresholds, spicy: 0.30 })).toBe(null);
  });

  it('handles null/missing probs gracefully', () => {
    expect(gnnPrimaryTier1(null, thresholds)).toBe(null);
    expect(gnnPrimaryTier1(undefined, thresholds)).toBe(null);
    expect(gnnPrimaryTier1({}, thresholds)).toBe(null);
  });
});
