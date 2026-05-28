import { describe, it, expect } from 'vitest';
import { AROMA_AXES, buildTier1Thresholds, gnnPrimaryTier1 } from '../primaryTier1.js';

describe('AROMA_AXES (Q7)', () => {
  it('locks tier-1 vocabulary at 5 GNN-pickable terms; spicy excluded (2026-05-27: fatty renamed to creamy)', () => {
    expect(AROMA_AXES).toEqual(['fruity', 'floral', 'green', 'woody', 'creamy']);
    expect(AROMA_AXES).not.toContain('spicy');
    expect(AROMA_AXES).not.toContain('fatty');
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
  const thresholds = { fruity: 0.269, floral: 0.192, green: 0.285, woody: 0.252, creamy: 0.20 };

  it('returns the aroma head with the highest threshold-surplus ratio', () => {
    // woody at 0.50 (t=0.252) → surplus 0.984; fruity at 0.30 (t=0.269) → 0.115.
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

  it('surplus-ratio normalization beats raw-argmax across heads (N2-AGG-RECAL)', () => {
    // Five heads firing equally at raw 0.40. Under the old argmax tie-break
    // green would have won (raw 0.50 — but here we make them equal at 0.40).
    // Under surplus normalization, floral has the lowest threshold (0.192),
    // so its surplus ratio is highest: (0.40-0.192)/0.192 = 1.083, beating
    // creamy (1.000), green (0.754), woody (0.587), fruity (0.487).
    const probs = {
      odor_fruity: 0.40, odor_floral: 0.40, odor_green: 0.40, odor_woody: 0.40, odor_fatty: 0.40,
    };
    expect(gnnPrimaryTier1(probs, thresholds)).toBe('floral');
  });

  it('tie-breaks within ε=1e-4 on surplus by AROMA_AXES order', () => {
    // Hand-craft probs so all 5 heads have identical surplus = 0.10:
    // p = threshold * 1.10 for each. AROMA_AXES order is fruity first.
    const probs = {
      odor_fruity: thresholds.fruity * 1.10,
      odor_floral: thresholds.floral * 1.10,
      odor_green:  thresholds.green  * 1.10,
      odor_woody:  thresholds.woody  * 1.10,
      odor_fatty:  thresholds.creamy * 1.10,
    };
    expect(gnnPrimaryTier1(probs, thresholds)).toBe('fruity');
  });

  it('canonical fixture from v2 N1-ADR-3 spec — woody+fruity, picks fruity', () => {
    // fruity at 0.8 (t=0.269) → surplus 1.974; woody at 0.5 (t=0.252) → 0.984.
    const probs = { odor_woody: 0.5, odor_fruity: 0.8, odor_floral: 0.0, odor_green: 0.0, odor_fatty: 0.0 };
    expect(gnnPrimaryTier1(probs, { fruity: 0.269, woody: 0.252 })).toBe('fruity');
  });

  it('treats zero or negative threshold as disabled (avoids divide-by-zero)', () => {
    // After N2-AGG-RECAL, low-F1 heads get threshold = 1.01 (sentinel).
    // Even if a head had a stray threshold=0, the picker must skip it.
    const probs = { odor_fruity: 0.5, odor_floral: 0.5, odor_green: 0, odor_woody: 0, odor_fatty: 0 };
    const t = { fruity: 0.269, floral: 0, green: 0.285, woody: 0.252, creamy: 0.20 };
    // floral threshold=0 is treated as disabled; fruity at 0.5 (t=0.269) wins.
    expect(gnnPrimaryTier1(probs, t)).toBe('fruity');
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
