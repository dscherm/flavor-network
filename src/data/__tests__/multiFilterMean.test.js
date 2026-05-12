/**
 * R17 US-04 — multi-filter mean-of-poles composition.
 *
 * The renderer's visibility-predicate effect aggregates per-filter
 * pole positions for each node into a mean target before lerping.
 * Scope filters (cocktail-scope, sauce-scope) participate in the
 * visibility AND but contribute NO pole, so they shouldn't show up
 * in the mean. Nodes missing a bucket assignment under one filter
 * shouldn't drag the mean toward NaN.
 *
 * We test the math directly here (not through React/Three) since
 * the renderer's per-instance loop runs over 3,913 nodes per filter
 * change — too heavy for vitest. The math is a pure operation on
 * the bucket-pole tables.
 */
import { describe, it, expect } from 'vitest';
import { computeBucketPoles3D } from '../bucketPoles.js';
import { FILTER_TO_AXIS } from '../networkModes.js';

function makeNodes(specs) {
  const m = new Map();
  for (const s of specs) m.set(s.name, { name: s.name, ...s });
  return m;
}

/**
 * Mirror of the renderer's mean-of-poles computation for one node.
 * Identical to LivingArchView's per-instance loop (R17 USR-04).
 */
function meanPole(filterStack, node, polesByAxis) {
  const axisFilters = filterStack.filter((f) => FILTER_TO_AXIS[f]);
  let sx = 0, sy = 0, sz = 0, n = 0;
  for (const f of axisFilters) {
    const axisKey = FILTER_TO_AXIS[f];
    const tbl = polesByAxis[axisKey];
    const p = tbl?.positions?.[node.name];
    if (p) { sx += p[0]; sy += p[1]; sz += p[2]; n++; }
  }
  if (n === 0) return null;
  return [sx / n, sy / n, sz / n];
}

describe('R17 — multi-filter mean-of-poles composition', () => {
  it('scope-only stack → no pole, no pull contribution', () => {
    const nodes = makeNodes([{ name: 'apple', taste: 'sweet' }]);
    const polesByAxis = {
      taste: computeBucketPoles3D('taste', nodes),
    };
    const node = nodes.get('apple');
    // Just cocktail-scope active — no axis filter → null mean.
    expect(meanPole(['cocktail-scope'], node, polesByAxis)).toBe(null);
    expect(meanPole(['cocktail-scope', 'sauce-scope'], node, polesByAxis)).toBe(null);
  });

  it('single axis filter returns that nodes pole', () => {
    const nodes = makeNodes([{ name: 'apple', taste: 'sweet' }]);
    const polesByAxis = {
      taste: computeBucketPoles3D('taste', nodes),
    };
    const node = nodes.get('apple');
    const result = meanPole(['taste'], node, polesByAxis);
    const sweetPole = polesByAxis.taste.polePositions.get('Sweet');
    expect(result).toEqual(sweetPole);
  });

  it('two axis filters → mean of both poles', () => {
    // Build a node bucketed by both taste AND family. Apple is sweet
    // (taste 'Sweet') and a fruit (family 'Fruit').
    const nodes = makeNodes([
      { name: 'apple', taste: 'sweet', category: 'fruit' },
    ]);
    const polesByAxis = {
      taste:  computeBucketPoles3D('taste',  nodes),
      family: computeBucketPoles3D('family', nodes),
    };
    const node = nodes.get('apple');
    const sweetPole = polesByAxis.taste.polePositions.get('Sweet');
    const fruitPole = polesByAxis.family.polePositions.get('Fruit');
    const expected = [
      (sweetPole[0] + fruitPole[0]) / 2,
      (sweetPole[1] + fruitPole[1]) / 2,
      (sweetPole[2] + fruitPole[2]) / 2,
    ];
    const result = meanPole(['taste', 'family'], node, polesByAxis);
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(result[i] - expected[i])).toBeLessThan(0.0001);
    }
  });

  it('axis filter + scope filter → only the axis contributes', () => {
    const nodes = makeNodes([{ name: 'apple', taste: 'sweet' }]);
    const polesByAxis = { taste: computeBucketPoles3D('taste', nodes) };
    const node = nodes.get('apple');
    const expected = polesByAxis.taste.polePositions.get('Sweet');
    const result = meanPole(['taste', 'cocktail-scope', 'sauce-scope'], node, polesByAxis);
    expect(result).toEqual(expected);
  });

  it('node missing from one filter still contributes from the other', () => {
    // Node has a taste but no category → only taste filter resolves
    // a pole. mean reduces to that single pole, no NaN.
    const nodes = makeNodes([{ name: 'orphan', taste: 'sweet' }]);
    const polesByAxis = {
      taste:  computeBucketPoles3D('taste',  nodes),
      family: computeBucketPoles3D('family', nodes),
    };
    const node = nodes.get('orphan');
    const sweetPole = polesByAxis.taste.polePositions.get('Sweet');
    const result = meanPole(['taste', 'family'], node, polesByAxis);
    expect(result).toEqual(sweetPole);
    for (const v of result) expect(Number.isFinite(v)).toBe(true);
  });
});
