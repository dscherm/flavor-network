/**
 * spatialRepulsion.js — Shared O(N) spatial-hash repulsion for 3D position layouts.
 *
 * Replaces the naive O(N²) repulsion pass used by tastePositioning,
 * cocktailPositioning, and saucePositioning. For ~6000 nodes the original
 * cost was ~18M sqrt ops per iteration; with a uniform grid keyed at
 * `cellSize = minDist`, only points in the same or adjacent cells can be
 * within minDist of each other, dropping per-iteration work to roughly
 * O(N · k) where k is the average bucket fanout (typically <10).
 *
 * Behavior is equivalent to the prior implementation:
 *   - Each pair (a, b) processed at most once per iteration (lex compare)
 *   - Same push formula: (minDist - dist) * 0.5 / dist
 *   - Same epsilon for skipping near-coincident points (dist > 0.001)
 *
 * Mutates `positions` in place.
 *
 * @param {Object<string, [number,number,number]>} positions
 * @param {string[]} names
 * @param {number} minDist
 * @param {number} iterations
 */
export function applySpatialHashRepulsion(positions, names, minDist, iterations) {
  if (!names.length || iterations <= 0 || minDist <= 0) return;
  const cellSize = minDist;

  for (let iter = 0; iter < iterations; iter++) {
    // Rebuild grid each iter — points have moved.
    const grid = new Map();
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const p = positions[name];
      const cx = Math.floor(p[0] / cellSize);
      const cy = Math.floor(p[1] / cellSize);
      const cz = Math.floor(p[2] / cellSize);
      const key = cx + ',' + cy + ',' + cz;
      let bucket = grid.get(key);
      if (!bucket) { bucket = []; grid.set(key, bucket); }
      bucket.push(name);
    }

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const a = positions[name];
      const cx = Math.floor(a[0] / cellSize);
      const cy = Math.floor(a[1] / cellSize);
      const cz = Math.floor(a[2] / cellSize);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const bucket = grid.get((cx + dx) + ',' + (cy + dy) + ',' + (cz + dz));
            if (!bucket) continue;
            for (let k = 0; k < bucket.length; k++) {
              const other = bucket[k];
              // Process each unordered pair at most once
              if (other <= name) continue;
              const b = positions[other];
              const ddx = b[0] - a[0];
              const ddy = b[1] - a[1];
              const ddz = b[2] - a[2];
              const dist = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
              if (dist < minDist && dist > 0.001) {
                const push = (minDist - dist) * 0.5 / dist;
                a[0] -= ddx * push; a[1] -= ddy * push; a[2] -= ddz * push;
                b[0] += ddx * push; b[1] += ddy * push; b[2] += ddz * push;
              }
            }
          }
        }
      }
    }
  }
}
