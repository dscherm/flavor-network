import { describe, it, expect } from 'vitest';
import { getPredictedProfile } from './predictedProfile.js';

const gnnEntropy = {
  _meta: { tasks: ['sweet', 'bitter', 'umami', 'salty', 'sour',
                   'odor_fruity', 'odor_floral', 'odor_green',
                   'odor_woody', 'odor_spicy', 'odor_fatty'] },
  lemon: {
    probs: {
      sweet: 0.15, bitter: 0.40, umami: 0.05, salty: 0.02, sour: 0.92,
      odor_fruity: 0.75, odor_floral: 0.30, odor_green: 0.55,
      odor_woody: 0.10, odor_spicy: 0.05, odor_fatty: 0.05,
    },
  },
  plain: {
    probs: {
      sweet: 0.05, bitter: 0.04, umami: 0.05, salty: 0.05, sour: 0.05,
      odor_fruity: 0.05, odor_floral: 0.05, odor_green: 0.05,
      odor_woody: 0.05, odor_spicy: 0.05, odor_fatty: 0.05,
    },
  },
};

const ingredientThresholds = {
  per_task: [
    { task: 'sweet', ingredient_threshold: 0.20, molecule_f1: 0.56 },
    { task: 'bitter', ingredient_threshold: 0.07, molecule_f1: 0.81 },
    { task: 'umami', ingredient_threshold: 0.18, molecule_f1: 0.61 },
    { task: 'salty', ingredient_threshold: 0.35, molecule_f1: 0.40 },
    { task: 'sour', ingredient_threshold: 0.20, molecule_f1: 0.49 },
    { task: 'odor_fruity', ingredient_threshold: 0.27, molecule_f1: 0.62 },
    { task: 'odor_floral', ingredient_threshold: 0.19, molecule_f1: 0.46 },
    { task: 'odor_green', ingredient_threshold: 0.28, molecule_f1: 0.56 },
    { task: 'odor_woody', ingredient_threshold: 0.25, molecule_f1: 0.52 },
    { task: 'odor_spicy', ingredient_threshold: 0.22, molecule_f1: 0.30 }, // below MIN_F1
    { task: 'odor_fatty', ingredient_threshold: 0.21, molecule_f1: 0.52 },
  ],
};

describe('getPredictedProfile', () => {
  it('returns [] when any input is missing', () => {
    expect(getPredictedProfile(null, gnnEntropy, ingredientThresholds)).toEqual([]);
    expect(getPredictedProfile('lemon', null, ingredientThresholds)).toEqual([]);
    expect(getPredictedProfile('lemon', gnnEntropy, null)).toEqual([]);
  });

  it('returns [] for unknown ingredient', () => {
    expect(getPredictedProfile('unknown', gnnEntropy, ingredientThresholds)).toEqual([]);
  });

  it('returns [] for neutral profile (no task clears its threshold)', () => {
    expect(getPredictedProfile('plain', gnnEntropy, ingredientThresholds)).toEqual([]);
  });

  it('returns tags where prob exceeds threshold, sorted by confidence', () => {
    const tags = getPredictedProfile('lemon', gnnEntropy, ingredientThresholds);
    const taskOrder = tags.map(t => t.task);
    // sour 0.92 vs ingredient threshold 0.20 → easily clears
    expect(taskOrder).toContain('sour');
    // odor_fruity 0.75 vs 0.27 threshold → clears
    expect(taskOrder).toContain('odor_fruity');
    // umami 0.05 vs 0.18 threshold → below, excluded
    expect(taskOrder).not.toContain('umami');
    // most confident first
    expect(tags[0].confidence).toBeGreaterThanOrEqual(tags[tags.length - 1].confidence);
  });

  it('filters tasks whose calibrated F1 is below MIN_F1 (odor_spicy not published)', () => {
    const tags = getPredictedProfile('lemon', gnnEntropy, ingredientThresholds);
    expect(tags.map(t => t.task)).not.toContain('odor_spicy');
  });

  it('rounds prob/threshold/confidence to 3 decimal places', () => {
    const tags = getPredictedProfile('lemon', gnnEntropy, ingredientThresholds);
    for (const t of tags) {
      expect(Number.isFinite(t.prob)).toBe(true);
      expect(Number.isFinite(t.threshold)).toBe(true);
      expect(Number.isFinite(t.confidence)).toBe(true);
    }
  });
});
