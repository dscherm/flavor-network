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
      sweet: 0.1, bitter: 0.1, umami: 0.1, salty: 0.1, sour: 0.1,
      odor_fruity: 0.1, odor_floral: 0.1, odor_green: 0.1,
      odor_woody: 0.1, odor_spicy: 0.1, odor_fatty: 0.1,
    },
  },
};

const odorThresholds = {
  per_task: [
    { task: 'sweet', calibrated_threshold: 0.50, calibrated_f1: 0.56 },
    { task: 'bitter', calibrated_threshold: 0.45, calibrated_f1: 0.81 },
    { task: 'umami', calibrated_threshold: 0.95, calibrated_f1: 0.61 },
    { task: 'salty', calibrated_threshold: 0.90, calibrated_f1: 0.40 },
    { task: 'sour', calibrated_threshold: 0.95, calibrated_f1: 0.49 },
    { task: 'odor_fruity', calibrated_threshold: 0.60, calibrated_f1: 0.62 },
    { task: 'odor_floral', calibrated_threshold: 0.75, calibrated_f1: 0.46 },
    { task: 'odor_green', calibrated_threshold: 0.70, calibrated_f1: 0.56 },
    { task: 'odor_woody', calibrated_threshold: 0.60, calibrated_f1: 0.52 },
    { task: 'odor_spicy', calibrated_threshold: 0.75, calibrated_f1: 0.30 }, // below MIN_F1
    { task: 'odor_fatty', calibrated_threshold: 0.80, calibrated_f1: 0.52 },
  ],
};

describe('getPredictedProfile', () => {
  it('returns [] when any input is missing', () => {
    expect(getPredictedProfile(null, gnnEntropy, odorThresholds)).toEqual([]);
    expect(getPredictedProfile('lemon', null, odorThresholds)).toEqual([]);
    expect(getPredictedProfile('lemon', gnnEntropy, null)).toEqual([]);
  });

  it('returns [] for unknown ingredient', () => {
    expect(getPredictedProfile('unknown', gnnEntropy, odorThresholds)).toEqual([]);
  });

  it('returns [] for neutral profile (no task clears its threshold)', () => {
    expect(getPredictedProfile('plain', gnnEntropy, odorThresholds)).toEqual([]);
  });

  it('returns tags where prob exceeds threshold, sorted by confidence', () => {
    const tags = getPredictedProfile('lemon', gnnEntropy, odorThresholds);
    const taskOrder = tags.map(t => t.task);
    // 'sour' 0.92 - 0.95 = -0.03 → excluded (below MIN_CONFIDENCE margin)
    expect(taskOrder).not.toContain('sour');
    // 'odor_fruity' 0.75 > 0.60 threshold → included
    expect(taskOrder).toContain('odor_fruity');
    // most confident first
    expect(tags[0].confidence).toBeGreaterThanOrEqual(tags[tags.length - 1].confidence);
  });

  it('filters tasks whose calibrated F1 is below MIN_F1 (odor_spicy not published)', () => {
    const tags = getPredictedProfile('lemon', gnnEntropy, odorThresholds);
    expect(tags.map(t => t.task)).not.toContain('odor_spicy');
  });

  it('rounds prob/threshold/confidence to 3 decimal places', () => {
    const tags = getPredictedProfile('lemon', gnnEntropy, odorThresholds);
    for (const t of tags) {
      expect(Number.isFinite(t.prob)).toBe(true);
      expect(Number.isFinite(t.threshold)).toBe(true);
      expect(Number.isFinite(t.confidence)).toBe(true);
    }
  });
});
