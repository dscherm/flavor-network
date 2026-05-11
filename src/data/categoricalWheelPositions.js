/**
 * categoricalWheelPositions.js — generate 2D wheel positions for the
 * categorical Network modes (aromas2d / cuisine2d / season2d /
 * family2d).
 *
 * Layout:
 *   - N buckets evenly spaced on a circle of radius R around the
 *     origin (each bucket's "centroid" angle).
 *   - Members of each bucket arranged on a phyllotaxis (sunflower)
 *     spiral inside a sub-disc centered at that centroid. Phyllotaxis
 *     packs uneven counts neatly without overlap.
 *
 * Returns positions in the SAME [x, y, z] shape that the existing
 * `taste2d` mode uses (Y=0 flat plane), so the renderer can drop
 * them straight into the existing 2D dispatch.
 */

import { bucketAllNodes } from './categoricalAxes.js';

// Tuned so the largest bucket (Family/"Other" ≈ 1,365 ingredients)
// stays inside its slot at radius 90 from origin without bleeding
// into adjacent buckets (~50-unit gap on the centroid ring).
const RING_RADIUS = 90;
const SUB_DISC_BASE = 4;
const SUB_DISC_SCALE = 0.6;
const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // ≈ 137.5° (sunflower angle)

/**
 * Compute wheel positions for one categorical axis.
 *
 * @param {string} axisKey  one of 'aromas' | 'cuisine' | 'season' | 'family'
 * @param {Map<string, object>} nodes  graph node map
 * @param {object} ctx  data context: { gnnEntropy, cuisineMap, seasonMap }
 * @returns {object}  { positions: Record<name, [x, y, z]>, bucketCentroids: Map<label, [x,y,z]>, bucketColor: Map<label, hex> }
 */
export function computeCategoricalWheelPositions(axisKey, nodes, ctx = {}) {
  const { bucketOf, byBucket, axis } = bucketAllNodes(axisKey, nodes, ctx);
  if (!axis) return { positions: {}, bucketCentroids: new Map(), bucketColor: new Map(), bucketOf: new Map() };

  const labels = axis.labels;
  const colors = axis.colors;
  const N = labels.length;
  const positions = {};
  const bucketCentroids = new Map();
  const bucketColor = new Map();

  for (let k = 0; k < N; k++) {
    const label = labels[k];
    const color = colors[k];
    const angle = (2 * Math.PI * k) / N - Math.PI / 2;   // start at top
    const cx = Math.cos(angle) * RING_RADIUS;
    const cz = Math.sin(angle) * RING_RADIUS;
    bucketCentroids.set(label, [cx, 0, cz]);
    bucketColor.set(label, color);

    const members = byBucket.get(label) || [];
    if (members.length === 0) continue;
    const subDiscR = SUB_DISC_BASE + Math.sqrt(members.length) * SUB_DISC_SCALE;
    // Phyllotaxis radius scaling: r_i = subDiscR * sqrt((i + 0.5) / count)
    // gives uniform-density packing.
    const denom = members.length;
    for (let i = 0; i < denom; i++) {
      const r = subDiscR * Math.sqrt((i + 0.5) / denom);
      const t = i * GOLDEN;
      const dx = Math.cos(t) * r;
      const dz = Math.sin(t) * r;
      positions[members[i]] = [cx + dx, 0, cz + dz];
    }
  }

  // Unbucketed nodes get a sentinel position well outside the camera
  // frame so they don't pile at the wheel center. Without this every
  // ingredient that fails to bucket clusters at [0,0,0], producing a
  // dense blob at the wheel hub.
  const OFFSCREEN = [9999, 0, 9999];
  for (const node of nodes.values()) {
    if (!positions[node.name]) positions[node.name] = OFFSCREEN;
  }

  return { positions, bucketCentroids, bucketColor, bucketOf };
}
