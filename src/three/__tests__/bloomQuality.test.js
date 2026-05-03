/**
 * Unit tests for the Phase 5 bloom-strength policy.
 *
 * Covers AC-MA-1: when `window.innerWidth < 640`, the bloom pass
 * `strength` is 0.6× the desktop default. The pure helper lives in
 * `bloomQuality.js` so this test runs without any WebGL surface.
 */
import { describe, it, expect } from 'vitest';
import { computeBloomStrength } from '../bloomQuality.js';

describe('computeBloomStrength (Phase 5 AC-MA-1)', () => {
  it('returns the base strength on desktop-width viewports', () => {
    expect(computeBloomStrength(1.5, 1280)).toBe(1.5);
    expect(computeBloomStrength(1.5, 640)).toBe(1.5); // boundary: 640 is NOT mobile
  });

  it('downscales to 0.6× on viewports narrower than 640px', () => {
    expect(computeBloomStrength(1.5, 639)).toBeCloseTo(0.9, 6);
    expect(computeBloomStrength(1.5, 375)).toBeCloseTo(0.9, 6); // iPhone 13 width
    expect(computeBloomStrength(1.5, 414)).toBeCloseTo(0.9, 6); // iPhone Pro width
  });

  it('falls back to 1.5 when baseStrength is not numeric', () => {
    expect(computeBloomStrength(undefined, 1280)).toBe(1.5);
    expect(computeBloomStrength(null, 1280)).toBe(1.5);
    expect(computeBloomStrength('high', 1280)).toBe(1.5);
  });

  it('returns the unscaled base when viewportWidth is unknown (SSR / non-numeric)', () => {
    expect(computeBloomStrength(1.5, null)).toBe(1.5);
    expect(computeBloomStrength(1.5, undefined)).toBe(1.5);
  });

  it('scales any base strength, not just 1.5', () => {
    expect(computeBloomStrength(2.0, 375)).toBeCloseTo(1.2, 6);
    expect(computeBloomStrength(0.5, 375)).toBeCloseTo(0.3, 6);
  });
});
