/**
 * livingArchUtils — pure-helper unit tests.
 *
 * Currently covers `flavorLabelsVisibleFor` (P3 affinity-gate round-trip
 * predicate). Other utilities in this module (`makeLabel`,
 * `computeWheelPositions`, `easeInOutCubic`, `hashStr`, `seededRng`,
 * `ingredientHasTaste`) are exercised indirectly by component tests;
 * add coverage here when a regression is found.
 */
import { describe, it, expect } from 'vitest';
import { flavorLabelsVisibleFor } from '../livingArchUtils.js';

describe('flavorLabelsVisibleFor — P3 affinity-gate round-trip', () => {
  it('visible when mlflavor + unfiltered + affinity disengaged', () => {
    expect(flavorLabelsVisibleFor({
      mode: 'mlflavor', filterActive: false, affinityEngaged: false,
    })).toBe(true);
  });

  it('hidden when affinity is engaged (the P3 gate)', () => {
    expect(flavorLabelsVisibleFor({
      mode: 'mlflavor', filterActive: false, affinityEngaged: true,
    })).toBe(false);
  });

  it('hidden when an axis filter is active', () => {
    expect(flavorLabelsVisibleFor({
      mode: 'mlflavor', filterActive: true, affinityEngaged: false,
    })).toBe(false);
  });

  it('hidden when mode is not mlflavor', () => {
    expect(flavorLabelsVisibleFor({
      mode: '2D', filterActive: false, affinityEngaged: false,
    })).toBe(false);
    expect(flavorLabelsVisibleFor({
      mode: '3D', filterActive: false, affinityEngaged: false,
    })).toBe(false);
    expect(flavorLabelsVisibleFor({
      mode: 'taste2d', filterActive: false, affinityEngaged: false,
    })).toBe(false);
  });

  it('round-trip — engage hides, disengage restores', () => {
    const base = { mode: 'mlflavor', filterActive: false };
    expect(flavorLabelsVisibleFor({ ...base, affinityEngaged: false })).toBe(true);
    expect(flavorLabelsVisibleFor({ ...base, affinityEngaged: true })).toBe(false);
    expect(flavorLabelsVisibleFor({ ...base, affinityEngaged: false })).toBe(true);
  });

  it('every "hide" condition independently suppresses visibility', () => {
    // Three independent hide axes — each one alone must hide labels.
    const matrix = [
      { mode: 'ml',       filterActive: false, affinityEngaged: false, expected: false }, // mode-mismatch
      { mode: 'mlflavor', filterActive: true,  affinityEngaged: false, expected: false }, // filter-active
      { mode: 'mlflavor', filterActive: false, affinityEngaged: true,  expected: false }, // affinity-engaged
      { mode: 'mlflavor', filterActive: false, affinityEngaged: false, expected: true  }, // all-clear
    ];
    for (const row of matrix) {
      const { expected, ...input } = row;
      expect(flavorLabelsVisibleFor(input)).toBe(expected);
    }
  });
});
