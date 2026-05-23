import { describe, it, expect } from 'vitest';
import { placeOnRing } from './AffinityMode.js';

describe('placeOnRing — golden-angle distribution', () => {
  it('places ring-3 slot 0 on the +x axis at radius 43', () => {
    // Canonical-spec (2026-05-22 user-iter): wheel radius lands at
    // 43 after iterations (48 → 28 was too small, +15 → 43 reads
    // well within the orbit-camera frame).
    const v = placeOnRing(3, 0);
    expect(v.x).toBeCloseTo(43, 5);
    expect(v.y).toBe(0);
    expect(v.z).toBeCloseTo(0, 5);
  });

  it('places ring-2 slot 0 on the +x axis at radius 22', () => {
    const v = placeOnRing(2, 0);
    expect(v.x).toBeCloseTo(22, 5);
    expect(v.z).toBeCloseTo(0, 5);
  });

  it('places ring-1 slot 0 on the +x axis at radius 35', () => {
    const v = placeOnRing(1, 0);
    expect(v.x).toBeCloseTo(35, 5);
    expect(v.z).toBeCloseTo(0, 5);
  });

  it('keeps every slot on its ring (radius preserved)', () => {
    for (const ringIdx of [3, 2, 1]) {
      const expectedR = { 3: 43, 2: 22, 1: 35 }[ringIdx];
      for (let slot = 0; slot < 15; slot++) {
        const v = placeOnRing(ringIdx, slot);
        const r = Math.hypot(v.x, v.z);
        expect(r).toBeCloseTo(expectedR, 5);
      }
    }
  });

  it('y component is always 0 (rings lie in the y=0 plane)', () => {
    for (const ringIdx of [3, 2, 1]) {
      for (let slot = 0; slot < 5; slot++) {
        expect(placeOnRing(ringIdx, slot).y).toBe(0);
      }
    }
  });

  it('adjacent slots are NOT cluster-correlated (golden-angle property)', () => {
    // Adjacent golden-angle slots differ by ~137.5° — never collinear.
    const a = placeOnRing(3, 0);
    const b = placeOnRing(3, 1);
    const dot = (a.x * b.x + a.z * b.z) / (a.length() * b.length());
    // cos(137.5°) ≈ -0.737. Should be far from ±1 (non-aligned).
    expect(dot).toBeCloseTo(-0.737, 2);
  });
});
