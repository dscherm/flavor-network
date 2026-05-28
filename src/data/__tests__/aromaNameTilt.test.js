/**
 * aromaNameTilt — F0 trust override audit (2026-05-16).
 *
 * Smoke-checks the name-tilt heuristic that fixes compound-food
 * aroma mis-bucketing (raspberry sherbet → woody example from the
 * audit). The override should:
 *   - flip the bucket from molecular argmax → cued aroma WHEN
 *     the cued channel has positive delta over corpus mean
 *   - NOT flip when the cued channel is below-average (model is
 *     confident the cue word doesn't dominate)
 *   - NOT misfire on substring collisions (e.g., 'orangery' ≠ 'orange')
 *
 * Tests use the exported CATEGORICAL_AXES.aromas.bucketOf so we
 * exercise the public surface, not the private aromaBucket helper.
 */
import { describe, it, expect } from 'vitest';
import { CATEGORICAL_AXES } from '../categoricalAxes.js';

const bucketOfAroma = CATEGORICAL_AXES.aromas.bucketOf;

/**
 * Build a synthetic gnnEntropy map keyed by name. probsByName is a
 * map of name → 6-channel prob object using the odor_* keys.
 */
function buildCtx(probsByName) {
  const gnnEntropy = {};
  for (const [name, probs] of Object.entries(probsByName)) {
    gnnEntropy[name] = { probs };
  }
  return { gnnEntropy };
}

/** Convenience — full odor probs vector. */
function odorProbs({ fruity = 0.1, floral = 0.1, green = 0.1, woody = 0.1, spicy = 0.1, fatty = 0.1 } = {}) {
  return {
    odor_fruity: fruity,
    odor_floral: floral,
    odor_green:  green,
    odor_woody:  woody,
    odor_spicy:  spicy,
    odor_fatty:  fatty,
  };
}

describe('aromaBucket — F0 name-tilt override', () => {
  it('raspberry sherbet flips from Woody (argmax) to Fruity (name cue)', () => {
    // Construct a profile that mirrors the audit finding:
    //   woody +0.065, spicy +0.061, green +0.032, fruity +0.025,
    //   floral +0.005, fatty +0.003.
    // We model the corpus by stuffing equivalent "baseline" entries.
    const probsByName = {
      // Audit-target ingredient.
      'raspberry sherbet': odorProbs({
        woody: 0.165, spicy: 0.161, green: 0.132, fruity: 0.125, floral: 0.105, fatty: 0.103,
      }),
      // Two baseline entries to anchor the corpus mean near 0.1.
      'baseline_a': odorProbs(),
      'baseline_b': odorProbs(),
    };
    const ctx = buildCtx(probsByName);
    const node = { name: 'raspberry sherbet' };
    expect(bucketOfAroma(node, ctx)).toBe('Fruity');
  });

  it('cinnamon stays Woody (cue word + model AGREES → no flip needed)', () => {
    const probsByName = {
      'cinnamon': odorProbs({ woody: 0.5, fruity: 0.05 }),
      'baseline_a': odorProbs(),
    };
    const ctx = buildCtx(probsByName);
    expect(bucketOfAroma({ name: 'cinnamon' }, ctx)).toBe('Woody');
  });

  it('lemon meringue flips from Woody → Citrus (chef-vocab expansion 2026-05-27: lemon is now a Citrus cue, not Fruity)', () => {
    const probsByName = {
      'lemon meringue': odorProbs({
        woody: 0.18, fruity: 0.12, floral: 0.08, green: 0.05, spicy: 0.04, fatty: 0.04,
      }),
      'baseline_a': odorProbs(),
      'baseline_b': odorProbs(),
    };
    const ctx = buildCtx(probsByName);
    // Citrus is a chef-only category (no GNN head), so the name-tilt
    // path bypasses the delta-gate that protects the 5 GNN-pickable
    // labels — Citrus wins outright once the name cue fires.
    expect(bucketOfAroma({ name: 'lemon meringue' }, ctx)).toBe('Citrus');
  });

  it('does NOT misfire on substring collisions (orangery ≠ orange)', () => {
    // Hypothetical: a profile dominated by green that happens to
    // include 'orange' as a substring inside a longer word. Tilt
    // requires whole-word match so this should stay green.
    const probsByName = {
      'orangery garden': odorProbs({
        green: 0.4, fruity: 0.05, woody: 0.05,
      }),
      'baseline_a': odorProbs(),
    };
    const ctx = buildCtx(probsByName);
    expect(bucketOfAroma({ name: 'orangery garden' }, ctx)).toBe('Green');
  });

  it('does NOT flip when the cued channel is below baseline', () => {
    // 'apple' is a fruity cue. If the model is confident the
    // ingredient ISN'T fruity (delta ≤ 0), don't override the argmax.
    const probsByName = {
      'apple smoke essence': odorProbs({
        woody: 0.5, spicy: 0.3, fruity: 0.05,
      }),
      // Make the corpus mean for fruity HIGH so this 0.05 sample
      // ends up below baseline.
      'fruity_a': odorProbs({ fruity: 0.95 }),
      'fruity_b': odorProbs({ fruity: 0.95 }),
      'fruity_c': odorProbs({ fruity: 0.95 }),
    };
    const ctx = buildCtx(probsByName);
    // Corpus mean for fruity ≈ (0.05 + 0.95 + 0.95 + 0.95) / 4 ≈ 0.725
    // 'apple smoke essence' fruity = 0.05 → delta = 0.05 - 0.725 = -0.675 (negative).
    // Tilt should NOT fire. Expect Woody (the argmax for this ingredient).
    expect(bucketOfAroma({ name: 'apple smoke essence' }, ctx)).toBe('Woody');
  });

  it('returns null for an ingredient with no profile at all', () => {
    const ctx = buildCtx({ 'other': odorProbs() });
    expect(bucketOfAroma({ name: 'unknown-ingredient' }, ctx)).toBe(null);
  });
});
