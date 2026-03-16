/**
 * tastePositioning.js — Compute 3D positions for ingredients based on
 * a 7-dimensional taste space projected into 3D.
 *
 * Taste dimensions: Sweet, Salty, Sour, Bitter, Umami, Spicy, Pungent, Astringent
 *
 * Each ingredient is scored on all 8 channels (0–1), then multiplied by
 * a projection matrix that maps 8D → 3D.  The projection vectors are
 * the vertices of a square antiprism — the Thomson-optimal placement of
 * 8 points on a unit sphere, giving 71.7° minimum angular separation.
 * No two tastes share an axis.
 *
 * Ingredients without taste metadata are inferred from pairing neighbors.
 */

import { TASTE_HIERARCHY } from './tasteTree.js';

// ---------------------------------------------------------------------------
// 8-dimensional taste projection vectors — square antiprism on the unit sphere
// Thomson-optimal placement: 71.7° minimum angular separation between any pair.
// ---------------------------------------------------------------------------

export const TASTE_AXES = {
  //                 X       Y       Z
  sweet:      [  0.83,   0.56,   0.00],
  salty:      [  0.00,   0.56,   0.83],
  sour:       [ -0.83,   0.56,   0.00],
  bitter:     [  0.00,   0.56,  -0.83],
  umami:      [  0.59,  -0.56,   0.59],
  spicy:      [ -0.59,  -0.56,   0.59],
  pungent:    [ -0.59,  -0.56,  -0.59],
  astringent: [  0.59,  -0.56,  -0.59],
};

// Normalize each projection vector to unit length
for (const key of Object.keys(TASTE_AXES)) {
  const v = TASTE_AXES[key];
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  v[0] /= len;
  v[1] /= len;
  v[2] /= len;
}

// ---------------------------------------------------------------------------
// Taste keyword matchers — map taste metadata strings to channel scores
// ---------------------------------------------------------------------------

const TASTE_CHANNEL_KEYWORDS = {
  sweet:      ['sweet'],
  salty:      ['salty'],
  sour:       ['sour', 'tart', 'acidic'],
  bitter:     ['bitter'],
  umami:      ['umami'],
  spicy:      ['spicy', 'hot'],
  pungent:    ['pungent'],
  astringent: ['astringent'],
};

// ---------------------------------------------------------------------------
// Name-based hints for ingredients without explicit taste metadata
// Each hint maps to one or more taste channels with a score
// ---------------------------------------------------------------------------

const NAME_HINTS = [
  { keywords: ['sugar', 'honey', 'maple', 'vanilla', 'caramel', 'chocolate', 'fruit', 'berry', 'jam', 'syrup', 'candy', 'dessert', 'sweet potato', 'date', 'fig', 'molasses', 'agave'],
    channels: { sweet: 0.8 } },
  { keywords: ['soy', 'miso', 'fish sauce', 'anchovy', 'parmesan', 'bacon', 'ham', 'prosciutto', 'olive', 'caper', 'seaweed', 'mushroom', 'worcestershire'],
    channels: { umami: 0.8, salty: 0.4 } },
  { keywords: ['salt'],
    channels: { salty: 0.9 } },
  { keywords: ['chile', 'pepper', 'cayenne', 'jalapeño', 'habanero', 'sriracha', 'tabasco', 'chipotle', 'serrano'],
    channels: { spicy: 0.8 } },
  { keywords: ['ginger'],
    channels: { spicy: 0.5, pungent: 0.4, sweet: 0.2 } },
  { keywords: ['lemon', 'lime', 'grapefruit', 'vinegar', 'citrus', 'yuzu', 'tamarind', 'cranberry', 'rhubarb'],
    channels: { sour: 0.8 } },
  { keywords: ['orange'],
    channels: { sour: 0.4, sweet: 0.5 } },
  { keywords: ['coffee', 'espresso', 'cocoa', 'dark chocolate', 'arugula', 'radicchio', 'endive', 'kale'],
    channels: { bitter: 0.8 } },
  { keywords: ['beer'],
    channels: { bitter: 0.4 } },
  { keywords: ['wine', 'tea', 'pomegranate', 'persimmon'],
    channels: { astringent: 0.7, bitter: 0.3 } },
  { keywords: ['corn', 'lettuce', 'broccoli', 'cabbage', 'squash', 'bean', 'pea', 'celery', 'cucumber', 'eggplant', 'asparagus', 'cauliflower', 'artichoke'],
    channels: { astringent: 0.6, sweet: 0.2 } },
  { keywords: ['basil', 'mint', 'cilantro', 'parsley', 'dill', 'chervil', 'tarragon', 'chive'],
    channels: { sour: 0.2 } },
  { keywords: ['cinnamon', 'clove', 'nutmeg', 'cardamom', 'allspice', 'star anise', 'cumin', 'coriander', 'turmeric', 'saffron', 'curry'],
    channels: { spicy: 0.5, pungent: 0.3 } },
  { keywords: ['cream', 'butter', 'cheese', 'milk', 'yogurt', 'mascarpone', 'ricotta', 'brie'],
    channels: { sweet: 0.2, umami: 0.3 } },
  { keywords: ['garlic', 'onion', 'shallot', 'leek', 'scallion'],
    channels: { pungent: 0.9, umami: 0.4 } },
  { keywords: ['mustard', 'horseradish', 'wasabi', 'radish', 'turnip'],
    channels: { pungent: 0.8, spicy: 0.3 } },
  { keywords: ['black pepper', 'white pepper', 'sichuan'],
    channels: { pungent: 0.5, spicy: 0.6 } },
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
// Score an ingredient on 7 taste channels (0–1 each)
// ---------------------------------------------------------------------------

function scoreIngredient(name, node) {
  const channels = { sweet: 0, salty: 0, sour: 0, bitter: 0, umami: 0, spicy: 0, pungent: 0, astringent: 0 };
  let signals = 0;

  // From taste metadata string (e.g. "sweet, sour")
  if (node.taste) {
    const tasteLower = node.taste.toLowerCase();
    for (const [channel, keywords] of Object.entries(TASTE_CHANNEL_KEYWORDS)) {
      for (const kw of keywords) {
        if (tasteLower.includes(kw)) {
          channels[channel] = Math.max(channels[channel], 0.9);
          signals++;
        }
      }
    }
  }

  // From ingredient name hints
  const nameLower = name.toLowerCase();
  for (const hint of NAME_HINTS) {
    for (const kw of hint.keywords) {
      if (nameLower.includes(kw) || kw.includes(nameLower)) {
        for (const [ch, score] of Object.entries(hint.channels)) {
          channels[ch] = Math.max(channels[ch], score * 0.6); // Slightly lower confidence for name hints
        }
        signals++;
        break;
      }
    }
  }

  return { channels, signals };
}

// ---------------------------------------------------------------------------
// Project a 7D taste vector to 3D using the projection matrix
// ---------------------------------------------------------------------------

function projectTo3D(channels) {
  let x = 0, y = 0, z = 0;
  for (const [taste, score] of Object.entries(channels)) {
    const axis = TASTE_AXES[taste];
    if (axis && score > 0) {
      x += axis[0] * score;
      y += axis[1] * score;
      z += axis[2] * score;
    }
  }
  return { x, y, z };
}

// ---------------------------------------------------------------------------
// Main positioning function
// ---------------------------------------------------------------------------

/**
 * Compute taste-based 3D positions for all nodes using 7D → 3D projection.
 *
 * @param {Map<string, Object>} nodes - Graph nodes with taste/weight metadata
 * @param {Array<Object>} edges - Graph edges with source/target/strength
 * @param {number} spread - Overall spatial spread (default 50)
 * @returns {Object} { positions: { [name]: [x, y, z] } }
 */
export function computeTastePositions(nodes, edges, spread = 50) {
  const positions = {};
  const scored = new Map(); // name → { x, y, z } raw projected vector

  // --- Phase 1: Score ingredients on 7 taste channels, project to 3D ---
  for (const [name, node] of nodes) {
    const { channels, signals } = scoreIngredient(name, node);

    if (signals > 0) {
      const vec = projectTo3D(channels);
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

    const hasScore = scored.has(name) && (vec.x !== 0 || vec.y !== 0 || vec.z !== 0);
    const jitterScale = hasScore ? spread * 0.15 : spread * 0.4;

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
  const minDist = spread * 0.06;
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
