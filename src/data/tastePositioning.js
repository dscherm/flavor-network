/**
 * tastePositioning.js — Compute 3D positions for ingredients based on taste axes.
 *
 * Axes:
 *   X: Sweet (negative) ←→ Salty/Umami (positive)
 *   Y: Mild/Neutral (negative) ←→ Spicy/Pungent (positive)
 *   Z: Light/Fresh (negative) ←→ Rich/Bitter (positive)
 *
 * Ingredients without taste metadata are placed using their pairing neighbors'
 * average position (gravity pull), with jitter to avoid overlap.
 *
 * The result is a spatial layout where the 3D axes carry semantic meaning.
 */

import { TASTE_HIERARCHY } from './tasteTree.js';

// ---------------------------------------------------------------------------
// Axis mappings — each taste contributes a signed vector along the 3 axes
// ---------------------------------------------------------------------------

const TASTE_VECTORS = {
  sweet:     { x: -1.0, y: -0.2, z: -0.3 },
  sour:      { x: -0.3, y:  0.0, z: -0.6 },
  bitter:    { x:  0.1, y:  0.0, z:  1.0 },
  salty:     { x:  1.0, y:  0.0, z:  0.3 },
  spicy:     { x:  0.0, y:  1.0, z:  0.2 },
  hot:       { x:  0.0, y:  1.0, z:  0.2 },
  pungent:   { x:  0.2, y:  0.8, z:  0.3 },
  astringent:{ x:  0.0, y:  0.1, z:  0.7 },
  umami:     { x:  0.8, y:  0.0, z:  0.5 },
  tart:      { x: -0.3, y:  0.0, z: -0.5 },
  acidic:    { x: -0.3, y:  0.0, z: -0.5 },
};

// Weight metadata maps to the Z-axis (light → negative, heavy → positive)
const WEIGHT_VECTORS = {
  light:       { x: 0, y: 0, z: -0.6 },
  'light-medium': { x: 0, y: 0, z: -0.3 },
  medium:      { x: 0, y: 0, z:  0.0 },
  'medium-heavy': { x: 0, y: 0, z:  0.3 },
  heavy:       { x: 0, y: 0, z:  0.6 },
};

// ---------------------------------------------------------------------------
// Keyword-based scoring for ingredients without explicit taste metadata
// ---------------------------------------------------------------------------

const KEYWORD_HINTS = [
  // Sweet indicators
  { keywords: ['sugar', 'honey', 'maple', 'vanilla', 'caramel', 'chocolate', 'fruit', 'berry', 'jam', 'syrup', 'candy', 'dessert', 'sweet potato', 'date', 'fig', 'molasses', 'agave'], vector: { x: -0.7, y: -0.1, z: -0.2 } },
  // Salty / umami indicators
  { keywords: ['soy', 'miso', 'fish sauce', 'anchovy', 'parmesan', 'bacon', 'ham', 'prosciutto', 'salt', 'olive', 'caper', 'seaweed', 'mushroom', 'worcestershire'], vector: { x: 0.7, y: 0.0, z: 0.4 } },
  // Spicy indicators
  { keywords: ['chile', 'pepper', 'cayenne', 'jalapeño', 'habanero', 'sriracha', 'tabasco', 'wasabi', 'horseradish', 'ginger', 'chipotle', 'serrano'], vector: { x: 0.0, y: 0.8, z: 0.1 } },
  // Citrus / sour indicators
  { keywords: ['lemon', 'lime', 'orange', 'grapefruit', 'vinegar', 'citrus', 'yuzu', 'tamarind', 'cranberry', 'rhubarb'], vector: { x: -0.3, y: 0.0, z: -0.5 } },
  // Bitter / rich indicators
  { keywords: ['coffee', 'cocoa', 'dark chocolate', 'beer', 'wine', 'espresso', 'arugula', 'radicchio', 'endive', 'kale'], vector: { x: 0.1, y: 0.0, z: 0.8 } },
  // Herb / fresh indicators
  { keywords: ['basil', 'mint', 'cilantro', 'parsley', 'dill', 'chervil', 'tarragon', 'chive'], vector: { x: -0.1, y: 0.2, z: -0.4 } },
  // Aromatic / warm spice indicators
  { keywords: ['cinnamon', 'clove', 'nutmeg', 'cardamom', 'allspice', 'star anise', 'cumin', 'coriander', 'turmeric', 'saffron', 'curry'], vector: { x: 0.1, y: 0.5, z: 0.3 } },
  // Dairy / cream indicators
  { keywords: ['cream', 'butter', 'cheese', 'milk', 'yogurt', 'mascarpone', 'ricotta', 'brie'], vector: { x: -0.2, y: -0.3, z: 0.2 } },
  // Allium indicators
  { keywords: ['garlic', 'onion', 'shallot', 'leek', 'scallion'], vector: { x: 0.3, y: 0.5, z: 0.1 } },
];

// ---------------------------------------------------------------------------
// Deterministic pseudo-random from string (for consistent jitter)
// ---------------------------------------------------------------------------

function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function seededRandom(seed) {
  // Simple LCG
  const a = 1664525;
  const c = 1013904223;
  const m = 2 ** 32;
  let state = seed >>> 0;
  return () => {
    state = (a * state + c) % m;
    return state / m;
  };
}

// ---------------------------------------------------------------------------
// Main positioning function
// ---------------------------------------------------------------------------

/**
 * Compute taste-based 3D positions for all nodes.
 *
 * @param {Map<string, Object>} nodes - Graph nodes with taste/weight metadata
 * @param {Array<Object>} edges - Graph edges with source/target/strength
 * @param {number} spread - Overall spatial spread (default 50)
 * @returns {Object} { positions: { [name]: [x, y, z] } }
 */
export function computeTastePositions(nodes, edges, spread = 50) {
  const positions = {};
  const scored = new Map(); // name → { x, y, z } raw vector before spread

  // --- Phase 1: Score ingredients that have taste/weight metadata ---
  for (const [name, node] of nodes) {
    const vec = { x: 0, y: 0, z: 0 };
    let signals = 0;

    // Score from taste metadata string (e.g. "sweet, sour")
    if (node.taste) {
      const tasteLower = node.taste.toLowerCase();
      for (const [keyword, tv] of Object.entries(TASTE_VECTORS)) {
        if (tasteLower.includes(keyword)) {
          vec.x += tv.x;
          vec.y += tv.y;
          vec.z += tv.z;
          signals++;
        }
      }
    }

    // Score from weight metadata
    if (node.weight) {
      const wLower = node.weight.toLowerCase().trim();
      const wv = WEIGHT_VECTORS[wLower];
      if (wv) {
        vec.x += wv.x;
        vec.y += wv.y;
        vec.z += wv.z;
        signals++;
      }
    }

    // Score from ingredient name keyword hints
    const nameLower = name.toLowerCase();
    for (const hint of KEYWORD_HINTS) {
      for (const kw of hint.keywords) {
        if (nameLower.includes(kw) || kw.includes(nameLower)) {
          vec.x += hint.vector.x * 0.5; // Half weight for name hints
          vec.y += hint.vector.y * 0.5;
          vec.z += hint.vector.z * 0.5;
          signals++;
          break; // Only count first keyword match per hint group
        }
      }
    }

    if (signals > 0) {
      // Normalize by number of signals to keep magnitudes comparable
      const norm = Math.max(1, signals * 0.5);
      vec.x /= norm;
      vec.y /= norm;
      vec.z /= norm;
      scored.set(name, vec);
    }
  }

  // --- Phase 2: Infer positions for unscored nodes from neighbor gravity ---
  const adj = new Map();
  for (const edge of edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    if (!adj.has(edge.target)) adj.set(edge.target, []);
    adj.get(edge.source).push({ name: edge.target, strength: edge.strength });
    adj.get(edge.target).push({ name: edge.source, strength: edge.strength });
  }

  // Iterate a few times to propagate positions
  for (let iter = 0; iter < 3; iter++) {
    for (const [name] of nodes) {
      if (scored.has(name)) continue;
      const neighbors = adj.get(name) || [];
      if (neighbors.length === 0) continue;

      let wx = 0, wy = 0, wz = 0, totalWeight = 0;
      for (const { name: nName, strength } of neighbors) {
        const nVec = scored.get(nName);
        if (nVec) {
          wx += nVec.x * strength;
          wy += nVec.y * strength;
          wz += nVec.z * strength;
          totalWeight += strength;
        }
      }
      if (totalWeight > 0) {
        scored.set(name, {
          x: wx / totalWeight,
          y: wy / totalWeight,
          z: wz / totalWeight,
        });
      }
    }
  }

  // --- Phase 3: Convert to final positions with spread and jitter ---
  for (const [name] of nodes) {
    const vec = scored.get(name) || { x: 0, y: 0, z: 0 };
    const hash = hashString(name);
    const rng = seededRandom(hash);

    // Jitter: more for unscored ingredients, less for scored ones
    const hasScore = scored.has(name) && (vec.x !== 0 || vec.y !== 0 || vec.z !== 0);
    const jitterScale = hasScore ? spread * 0.15 : spread * 0.4;

    // Spherical jitter for natural distribution
    const jitterAngle1 = rng() * Math.PI * 2;
    const jitterAngle2 = rng() * Math.PI * 2;
    const jitterR = rng() * jitterScale;

    positions[name] = [
      vec.x * spread + jitterR * Math.sin(jitterAngle1) * Math.cos(jitterAngle2),
      vec.y * spread + jitterR * Math.sin(jitterAngle1) * Math.sin(jitterAngle2),
      vec.z * spread + jitterR * Math.cos(jitterAngle1),
    ];
  }

  // --- Phase 4: Repulsion pass to reduce overlap ---
  const names = Object.keys(positions);
  const minDist = spread * 0.06; // Minimum distance between nodes
  for (let iter = 0; iter < 5; iter++) {
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = positions[names[i]];
        const b = positions[names[j]];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dz = b[2] - a[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < minDist && dist > 0.001) {
          const push = (minDist - dist) * 0.5 / dist;
          a[0] -= dx * push;
          a[1] -= dy * push;
          a[2] -= dz * push;
          b[0] += dx * push;
          b[1] += dy * push;
          b[2] += dz * push;
        }
      }
    }
  }

  return { positions };
}
