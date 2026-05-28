import { describe, it, expect } from 'vitest';
import {
  TIER1_OVERRIDES,
  ALLIUM_TOKENS,
  isAlliaceous,
  resolvePrimaryTier1,
} from '../tier1Overrides.js';

const T = { fruity: 0.133, floral: 0.054, green: 0.194, woody: 0.334, creamy: 0.125 };

describe('TIER1_OVERRIDES', () => {
  it('pins the chef-audited false positives to non-green Tier-1', () => {
    expect(TIER1_OVERRIDES['truffle']).toBe('woody');
    expect(TIER1_OVERRIDES['beetroot']).toBe('woody');
    expect(TIER1_OVERRIDES['cranberry']).toBe('fruity');
    expect(TIER1_OVERRIDES['chardonnay wine']).toBe('fruity');
    expect(TIER1_OVERRIDES["goat's milk"]).toBe('creamy');
  });

  it('covers every cranberry variant we found in the audit', () => {
    const cranberryKeys = Object.keys(TIER1_OVERRIDES).filter(k => k.includes('cranberry'));
    expect(cranberryKeys.length).toBeGreaterThanOrEqual(11);
    cranberryKeys.forEach(k => {
      expect(TIER1_OVERRIDES[k]).toBe('fruity');
    });
  });
});

describe('isAlliaceous', () => {
  it('matches every allium token as a word', () => {
    expect(isAlliaceous('onion')).toBe(true);
    expect(isAlliaceous('garlic clove')).toBe(true);
    expect(isAlliaceous('leek soup')).toBe(true);
    expect(isAlliaceous('green spring onion')).toBe(true);
    expect(isAlliaceous('shallot vinaigrette')).toBe(true);
    expect(isAlliaceous('fresh chive')).toBe(true);
    expect(isAlliaceous('scallion white')).toBe(true);
  });

  it('does not match partial tokens or non-allium ingredients', () => {
    expect(isAlliaceous('peony')).toBe(false);
    expect(isAlliaceous('honey')).toBe(false);
    expect(isAlliaceous('lemonade')).toBe(false);
    expect(isAlliaceous('beetroot')).toBe(false);
    expect(isAlliaceous('thyme')).toBe(false);
  });

  it('handles null/empty input gracefully', () => {
    expect(isAlliaceous(null)).toBe(false);
    expect(isAlliaceous(undefined)).toBe(false);
    expect(isAlliaceous('')).toBe(false);
    expect(isAlliaceous(42)).toBe(false);
  });

  it('exposes 8 allium tokens including ramp + asafoetida', () => {
    expect(ALLIUM_TOKENS).toContain('onion');
    expect(ALLIUM_TOKENS).toContain('garlic');
    expect(ALLIUM_TOKENS).toContain('leek');
    expect(ALLIUM_TOKENS).toContain('chive');
    expect(ALLIUM_TOKENS).toContain('shallot');
    expect(ALLIUM_TOKENS).toContain('scallion');
    expect(ALLIUM_TOKENS).toContain('ramp');
    expect(ALLIUM_TOKENS).toContain('asafoetida');
  });
});

describe('resolvePrimaryTier1', () => {
  it('hard-overrides take priority over both allium detection and GNN', () => {
    // beetroot is geosmin-driven earthy — chef-pinned to woody
    const probs = { odor_green: 0.5, odor_woody: 0.1 };  // GNN would say green
    expect(resolvePrimaryTier1('beetroot', probs, T)).toBe('woody');
  });

  it('allium override forces green when name has allium token AND green fires', () => {
    // Even if another head would win the surplus tie-break, the allium
    // detection pins this to plain green so the visual stays the BRISCIONE
    // emerald — chef intuition keeps onions in the green family.
    const probs = { odor_green: 0.25, odor_fatty: 0.40 };  // creamy surplus higher
    expect(resolvePrimaryTier1('onion powder', probs, T)).toBe('green');
    expect(resolvePrimaryTier1('vidalia onion', probs, T)).toBe('green');
    expect(resolvePrimaryTier1('garlic clove', probs, T)).toBe('green');
  });

  it('allium name without green firing falls through to GNN', () => {
    // Onion-named product where the GNN sees more woody than green
    const probs = {
      odor_green: 0.05,   // below threshold 0.194 → green does NOT fire
      odor_woody: 0.80,   // way above threshold 0.334
    };
    expect(resolvePrimaryTier1('onion gravy mix', probs, T)).toBe('woody');
  });

  it('non-allium ingredient with green firing returns plain green', () => {
    const probs = { odor_green: 0.5 };
    expect(resolvePrimaryTier1('thyme', probs, T)).toBe('green');
  });

  it('falls through to gnnPrimaryTier1 when no override or allium match', () => {
    const probs = {
      odor_fruity: 0.5, odor_floral: 0.05, odor_green: 0.05,
      odor_woody: 0.05, odor_fatty: 0.05,
    };
    expect(resolvePrimaryTier1('mango', probs, T)).toBe('fruity');
  });

  it('returns null when name+probs unresolvable', () => {
    expect(resolvePrimaryTier1('unknown thing', {}, T)).toBe(null);
    expect(resolvePrimaryTier1(null, null, T)).toBe(null);
  });

  it('normalizes case and whitespace before override lookup', () => {
    const probs = { odor_green: 0.5 };
    expect(resolvePrimaryTier1('  Beetroot  ', probs, T)).toBe('woody');
    expect(resolvePrimaryTier1('TRUFFLE', probs, T)).toBe('woody');
  });
});
