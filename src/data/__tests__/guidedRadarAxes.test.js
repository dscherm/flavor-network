/**
 * guidedRadarAxes.test.js — Track 3 / P2 helper-module specs.
 *
 * Locks the P2 algorithm contract:
 *   - 8/6/4/8 axis counts per filter type
 *   - Exact-reference equality for cuisine (ADR-2)
 *   - Exact-reference equality for aroma color map
 *   - pairingMatchesAxis semantics for taste / aroma / season / cuisine
 *   - coordsForPairing returns null on missing data and finite coords
 *     when at least one axis matches
 */

import { describe, it, expect } from 'vitest';
import {
  getAxesFor,
  getColorMapFor,
  pairingMatchesAxis,
  coordsForPairing,
} from '../guidedRadarAxes.js';
import { CATEGORICAL_AXES } from '../categoricalAxes.js';
import { BRISCIONE_AROMA } from '../briscionePalette.js';

describe('guidedRadarAxes — P2 helper module', () => {
  // ----- getAxesFor (counts + cuisine exact-ref) -------------------

  it("getAxesFor('cuisine') is exact-reference equal to CATEGORICAL_AXES.cuisine.labels (locks ADR-2)", () => {
    expect(getAxesFor('cuisine')).toBe(CATEGORICAL_AXES.cuisine.labels);
  });

  it("getAxesFor('cuisine').length === 8", () => {
    expect(getAxesFor('cuisine')).toHaveLength(8);
  });

  it("getAxesFor('taste').length === 8", () => {
    expect(getAxesFor('taste')).toHaveLength(8);
  });

  it("getAxesFor('aroma').length === 13 (chef-vocab expansion 2026-05-27)", () => {
    expect(getAxesFor('aroma')).toHaveLength(13);
  });

  it("getAxesFor('season').length === 4", () => {
    expect(getAxesFor('season')).toHaveLength(4);
  });

  it("getAxesFor('unknown') === [] (empty fallback)", () => {
    expect(getAxesFor('unknown')).toEqual([]);
    expect(getAxesFor(undefined)).toEqual([]);
  });

  // ----- getColorMapFor (exact-ref) --------------------------------

  it("getColorMapFor('aroma') is exact-reference equal to BRISCIONE_AROMA", () => {
    expect(getColorMapFor('aroma')).toBe(BRISCIONE_AROMA);
  });

  // ----- pairingMatchesAxis ----------------------------------------

  it("pairingMatchesAxis taste 'sweet,sour' includes 'sweet' → true", () => {
    expect(pairingMatchesAxis({ taste: 'sweet,sour' }, 'taste', 'sweet')).toBe(true);
  });

  it("pairingMatchesAxis taste 'sweet' does NOT include 'bitter' → false", () => {
    expect(pairingMatchesAxis({ taste: 'sweet' }, 'taste', 'bitter')).toBe(false);
  });

  it("pairingMatchesAxis aroma with odor_fruity=0.71 matches 'fruity' under default threshold 0.5", () => {
    expect(
      pairingMatchesAxis({ gnnProbs: { odor_fruity: 0.71 } }, 'aroma', 'fruity'),
    ).toBe(true);
  });

  it('pairingMatchesAxis aroma below threshold → false', () => {
    expect(
      pairingMatchesAxis({ gnnProbs: { odor_fruity: 0.3 } }, 'aroma', 'fruity'),
    ).toBe(false);
  });

  it('pairingMatchesAxis aroma honors per-task odorThresholds when supplied', () => {
    const thresholds = { odor_fruity: 0.8 };
    expect(
      pairingMatchesAxis({ gnnProbs: { odor_fruity: 0.71 } }, 'aroma', 'fruity', thresholds),
    ).toBe(false);
    expect(
      pairingMatchesAxis({ gnnProbs: { odor_fruity: 0.85 } }, 'aroma', 'fruity', thresholds),
    ).toBe(true);
  });

  it('pairingMatchesAxis season tokenizes the season string', () => {
    expect(pairingMatchesAxis({ season: 'spring,summer' }, 'season', 'spring')).toBe(true);
    expect(pairingMatchesAxis({ season: 'winter' }, 'season', 'fall')).toBe(false);
  });

  it('pairingMatchesAxis cuisine matches by case-insensitive array membership', () => {
    expect(
      pairingMatchesAxis({ cuisines: ['East Asian', 'European'] }, 'cuisine', 'East Asian'),
    ).toBe(true);
    expect(
      pairingMatchesAxis({ cuisines: ['european'] }, 'cuisine', 'European'),
    ).toBe(true);
    expect(
      pairingMatchesAxis({ cuisines: ['Americas'] }, 'cuisine', 'African'),
    ).toBe(false);
  });

  // ----- coordsForPairing ------------------------------------------

  it('coordsForPairing returns null when filterType=aroma and gnnProbs is missing', () => {
    const axes = getAxesFor('aroma');
    expect(coordsForPairing({ taste: 'sweet' }, 'aroma', axes, 100)).toBeNull();
  });

  it('coordsForPairing returns finite x,y when at least one axis matches', () => {
    const axes = getAxesFor('taste');
    const result = coordsForPairing({ taste: 'sweet,sour' }, 'taste', axes, 100);
    expect(result).not.toBeNull();
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
  });

  it('coordsForPairing returns null when nothing matches', () => {
    const axes = getAxesFor('taste');
    expect(coordsForPairing({ taste: 'unrecognized-tag' }, 'taste', axes, 100)).toBeNull();
  });
});
