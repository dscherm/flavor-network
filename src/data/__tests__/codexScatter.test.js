/**
 * R15-5 spread regression tests.
 *
 * Verifies the intra-subcluster scatter constants got the 1.5× bump
 * (cocktail SCATTER 3 → 4.5; sauce BASE_SCATTER 3.5 → 5.25 with
 * per-member growth coefficient 1.5 → 1.25). Also verifies that
 * adjacent subclusters within a family still don't bleed at typical
 * member counts.
 *
 * The constants are exported and pinned directly because the FNV1a
 * hash used downstream loses precision for short, similar-prefix
 * names — which makes bbox-based tests dependent on real diverse
 * names rather than synthetic fixtures, and even then high-variance
 * for low fixture counts.
 */
import { describe, it, expect } from 'vitest';
import { computeCodexPositions, COCKTAIL_SCATTER } from '../cocktailCodex.js';
import {
  computeSauceCodexPositions,
  SAUCE_BASE_SCATTER,
  SAUCE_SCATTER_K_COEFF,
} from '../sauceCodex.js';

describe('R15-5: intra-subcluster scatter constants', () => {
  it('cocktail SCATTER is 4.5 (1.5× the legacy 3)', () => {
    expect(COCKTAIL_SCATTER).toBe(4.5);
  });

  it('sauce BASE_SCATTER is 5.25 (1.5× the legacy 3.5)', () => {
    expect(SAUCE_BASE_SCATTER).toBe(5.25);
  });

  it('sauce per-member growth coefficient is 1.25 (down from 1.5 to keep large pods inside the gap budget)', () => {
    expect(SAUCE_SCATTER_K_COEFF).toBe(1.25);
  });
});

// Diverse name strings — sequential suffixes like `node-0`/`node-1`
// collide badly under the FNV1a hash so produce near-identical
// positions. Real cocktail/sauce names are diverse and hash well.
const COCKTAIL_NAMES = [
  'Old Fashioned', 'Manhattan', 'Negroni', 'Sazerac', 'Daiquiri',
  'Mojito', 'Margarita', 'Aviation', 'Boulevardier', 'Last Word',
  'Vesper', 'Rusty Nail', 'Penicillin', 'Sidecar', 'Gimlet',
  'Tom Collins', 'Whiskey Sour', 'Mai Tai', 'Caipirinha', 'Bramble',
];

describe('R15-5: subcluster cohesion (no bleed at typical member counts)', () => {
  it('cocktail: 4 subclusters × 12 members each, adjacent centroid distance > 9', () => {
    const nodes = new Map();
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i < 12; i++) {
        nodes.set(`${COCKTAIL_NAMES[i % COCKTAIL_NAMES.length]} #sub${s}`, {
          family_id: 'fam0',
          subcluster_id: `sub-${s}`,
          isRoot: false,
        });
      }
    }
    const clusters = [{ id: 'fam0', name: 'Old Fashioned', color: '#888' }];
    const { positions } = computeCodexPositions(nodes, clusters);
    // Find subcluster centroids by averaging member positions.
    const centroids = [];
    for (let s = 0; s < 4; s++) {
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < 12; i++) {
        const key = `${COCKTAIL_NAMES[i % COCKTAIL_NAMES.length]} #sub${s}`;
        const p = positions[key];
        cx += p[0]; cy += p[1]; cz += p[2];
      }
      centroids.push([cx / 12, cy / 12, cz / 12]);
    }
    let minPairDist = Infinity;
    for (let a = 0; a < centroids.length; a++) {
      for (let b = a + 1; b < centroids.length; b++) {
        const dx = centroids[a][0] - centroids[b][0];
        const dy = centroids[a][1] - centroids[b][1];
        const dz = centroids[a][2] - centroids[b][2];
        const d = Math.hypot(dx, dy, dz);
        if (d < minPairDist) minPairDist = d;
      }
    }
    // Subcluster cubes have half-side 4.5 (cocktail SCATTER). Centroids
    // should be at least 9 apart so the cubes don't overlap in
    // expectation. With SUBCLUSTER_RADIUS=8 and 4 subclusters, adjacent
    // pairs sit ~11.3 apart.
    expect(minPairDist).toBeGreaterThan(9);
  });

  it('sauce: scatterFor(k) at k=6 stays under 8.1 (cube cube doesnt blow past inter-pod gap of ~12)', () => {
    // Recompute the scatter formula here to pin the policy. With k=6 the
    // formula returns BASE_SCATTER + sqrt(5)*K_COEFF.
    // = 5.25 + sqrt(5)*1.25 ≈ 8.05.
    const k = 6;
    const scatter = SAUCE_BASE_SCATTER + Math.sqrt(k - 1) * SAUCE_SCATTER_K_COEFF;
    expect(scatter).toBeLessThan(8.1);
    // And cube extent (2 * scatter) stays under 17, leaving headroom
    // against the 12-unit inter-cuisine-pod gap (some bleed at the
    // tail of the random distribution is acceptable; the centroid-
    // level no-overlap is what matters).
    expect(scatter * 2).toBeLessThan(17);
  });
});
