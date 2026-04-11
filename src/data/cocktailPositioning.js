import { applySpatialHashRepulsion } from './spatialRepulsion.js';

/**
 * cocktailPositioning.js — Cocktail Codex-based 3D positioning.
 *
 * Axes:
 *   X: Spirit-forward / Dry (negative) ←→ Modified / Sweet (positive)
 *   Y: Short / Concentrated (negative) ←→ Long / Diluted (positive)
 *   Z: Simple / Classic (negative) ←→ Complex / Layered (positive)
 *
 * Each ingredient is positioned based on its Codex role (base, modifier,
 * sweetener, sour, seasoning, lengthener, texture, accent) and which of the
 * 6 Cocktail Codex templates it belongs to.
 *
 * The 6 templates:
 *   Old Fashioned: Spirit + Sugar + Bitters          → spirit-forward, short, simple
 *   Martini:       Spirit + Vermouth                 → spirit-forward, short, moderate
 *   Daiquiri:      Spirit + Citrus + Sugar            → balanced, short, moderate
 *   Sidecar:       Spirit + Citrus + Liqueur          → modified, short, complex
 *   Highball:      Spirit + Lengthener                → spirit-forward, long, simple
 *   Flip:          Spirit + Sugar + Dairy/Egg         → modified, short, complex
 */

// ---------------------------------------------------------------------------
// Codex role → base position vector
// ---------------------------------------------------------------------------

const ROLE_VECTORS = {
  base:       { x: -0.8, y: -0.3, z: -0.5 },   // Spirits: dry, short, simple
  modifier:   { x:  0.5, y: -0.2, z:  0.4 },    // Liqueurs/vermouth: sweet side, complex
  sweetener:  { x:  0.6, y: -0.4, z: -0.3 },    // Syrups: sweet, short, simple
  sour:       { x: -0.2, y: -0.3, z: -0.1 },    // Citrus: balanced, short
  seasoning:  { x: -0.3, y: -0.5, z:  0.6 },    // Bitters: dry, concentrated, complex
  lengthener: { x:  0.1, y:  1.0, z: -0.5 },    // Soda/tonic: long, simple
  texture:    { x:  0.4, y: -0.3, z:  0.8 },     // Cream/egg: modified, short, complex
  accent:     { x:  0.0, y:  0.0, z:  0.3 },     // Herbs/fruit: center, slight complexity
};

// ---------------------------------------------------------------------------
// Ingredient-specific overrides for key items
// ---------------------------------------------------------------------------

const INGREDIENT_OVERRIDES = {
  // Base spirits — spread along X to differentiate
  vodka:      { x: -1.0, y: -0.2, z: -0.8 },
  gin:        { x: -0.9, y: -0.3, z:  0.0 },   // More botanical = more complex
  rum:        { x: -0.6, y: -0.2, z: -0.3 },
  tequila:    { x: -0.7, y: -0.2, z: -0.1 },
  mezcal:     { x: -0.7, y: -0.3, z:  0.3 },   // Smokier = more complex
  whiskey:    { x: -0.8, y: -0.4, z:  0.1 },
  bourbon:    { x: -0.7, y: -0.4, z:  0.0 },
  brandy:     { x: -0.5, y: -0.3, z:  0.2 },
  cognac:     { x: -0.5, y: -0.4, z:  0.4 },   // Most refined spirit
  sake:       { x: -0.4, y: -0.1, z: -0.2 },

  // Vermouth — between spirit and modifier
  'dry vermouth':   { x: -0.3, y: -0.3, z:  0.2 },
  'sweet vermouth': { x:  0.2, y: -0.3, z:  0.3 },
  'lillet blanc':   { x:  0.0, y: -0.2, z:  0.2 },

  // Key liqueurs
  campari:             { x:  0.3, y: -0.3, z:  0.5 },
  aperol:              { x:  0.4, y:  0.2, z:  0.3 },  // Often in spritzes (longer)
  chartreuse:          { x:  0.5, y: -0.4, z:  0.9 },  // Most complex liqueur
  'maraschino liqueur':{ x:  0.4, y: -0.3, z:  0.6 },
  cointreau:           { x:  0.5, y: -0.2, z:  0.3 },
  'triple sec':        { x:  0.5, y: -0.2, z:  0.2 },
  kahlua:              { x:  0.6, y: -0.3, z:  0.5 },
  'st-germain':        { x:  0.5, y:  0.0, z:  0.4 },

  // Bitters — concentrated, complex corner
  'angostura bitters':  { x: -0.4, y: -0.6, z:  0.7 },
  'orange bitters':     { x: -0.3, y: -0.5, z:  0.6 },
  'peychaud\'s bitters':{ x: -0.3, y: -0.6, z:  0.7 },
  'chocolate bitters':  { x: -0.2, y: -0.5, z:  0.8 },

  // Lengtheners — tall drink territory
  'tonic water': { x:  0.0, y:  0.9, z: -0.4 },
  'soda water':  { x: -0.1, y:  1.0, z: -0.7 },
  'ginger beer': { x:  0.2, y:  0.8, z: -0.2 },
  'ginger ale':  { x:  0.1, y:  0.9, z: -0.4 },
  cola:          { x:  0.3, y:  0.8, z: -0.5 },
  prosecco:      { x:  0.1, y:  0.6, z: -0.1 },
  champagne:     { x:  0.0, y:  0.5, z:  0.1 },

  // Citrus — sour axis
  lemon:      { x: -0.3, y: -0.2, z: -0.3 },
  lime:       { x: -0.3, y: -0.3, z: -0.3 },
  orange:     { x:  0.0, y: -0.1, z: -0.2 },
  grapefruit: { x: -0.2, y: -0.1, z: -0.1 },
  yuzu:       { x: -0.2, y: -0.2, z:  0.2 },

  // Sweeteners
  'simple syrup':   { x:  0.5, y: -0.5, z: -0.6 },
  'demerara syrup': { x:  0.5, y: -0.5, z: -0.3 },
  'honey syrup':    { x:  0.5, y: -0.4, z: -0.2 },
  'agave syrup':    { x:  0.5, y: -0.4, z: -0.4 },
  grenadine:        { x:  0.6, y: -0.3, z: -0.2 },
  orgeat:           { x:  0.6, y: -0.4, z:  0.1 },
  sugar:            { x:  0.5, y: -0.5, z: -0.7 },
  honey:            { x:  0.5, y: -0.4, z: -0.3 },

  // Texture
  'egg white':     { x:  0.3, y: -0.4, z:  0.7 },
  'heavy cream':   { x:  0.5, y: -0.3, z:  0.8 },
  'coconut cream': { x:  0.6, y: -0.2, z:  0.6 },
};

// ---------------------------------------------------------------------------
// Deterministic jitter
// ---------------------------------------------------------------------------

function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function seededRandom(seed) {
  const a = 1664525, c = 1013904223, m = 2 ** 32;
  let state = seed >>> 0;
  return () => { state = (a * state + c) % m; return state / m; };
}

// ---------------------------------------------------------------------------
// Main positioning function
// ---------------------------------------------------------------------------

/**
 * Compute Cocktail Codex-based 3D positions for cocktail ingredients.
 *
 * @param {Map<string, Object>} nodes - Cocktail graph nodes with codexRole
 * @param {Array<Object>} edges - Cocktail graph edges
 * @param {number} spread - Spatial spread (default 45)
 * @returns {Object} { positions: { [name]: [x, y, z] } }
 */
export function computeCocktailPositions(nodes, edges, spread = 45) {
  const positions = {};
  const scored = new Map();

  // Phase 1: Assign base vectors from overrides or role defaults
  for (const [name, node] of nodes) {
    const lower = name.toLowerCase();
    let vec;

    if (INGREDIENT_OVERRIDES[lower]) {
      vec = { ...INGREDIENT_OVERRIDES[lower] };
    } else {
      const role = node.codexRole || 'accent';
      const rv = ROLE_VECTORS[role] || ROLE_VECTORS.accent;
      vec = { ...rv };
    }

    scored.set(name, vec);
  }

  // Phase 2: Pull unscored/generic nodes toward their neighbors
  const adj = new Map();
  for (const edge of edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    if (!adj.has(edge.target)) adj.set(edge.target, []);
    adj.get(edge.source).push({ name: edge.target, strength: edge.strength });
    adj.get(edge.target).push({ name: edge.source, strength: edge.strength });
  }

  // Only pull ingredients that don't have specific overrides
  for (let iter = 0; iter < 2; iter++) {
    for (const [name] of nodes) {
      if (INGREDIENT_OVERRIDES[name.toLowerCase()]) continue;
      const neighbors = adj.get(name) || [];
      if (neighbors.length === 0) continue;

      const vec = scored.get(name);
      let wx = 0, wy = 0, wz = 0, tw = 0;
      for (const { name: nName, strength } of neighbors) {
        const nv = scored.get(nName);
        if (nv) {
          wx += nv.x * strength;
          wy += nv.y * strength;
          wz += nv.z * strength;
          tw += strength;
        }
      }
      if (tw > 0) {
        // Blend: 60% role vector, 40% neighbor pull
        vec.x = vec.x * 0.6 + (wx / tw) * 0.4;
        vec.y = vec.y * 0.6 + (wy / tw) * 0.4;
        vec.z = vec.z * 0.6 + (wz / tw) * 0.4;
      }
    }
  }

  // Phase 3: Apply spread and deterministic jitter
  for (const [name] of nodes) {
    const vec = scored.get(name) || { x: 0, y: 0, z: 0 };
    const hash = hashString(name);
    const rng = seededRandom(hash);

    const hasOverride = !!INGREDIENT_OVERRIDES[name.toLowerCase()];
    const jitterScale = hasOverride ? spread * 0.08 : spread * 0.15;

    const ja1 = rng() * Math.PI * 2;
    const ja2 = rng() * Math.PI * 2;
    const jr = rng() * jitterScale;

    positions[name] = [
      vec.x * spread + jr * Math.sin(ja1) * Math.cos(ja2),
      vec.y * spread + jr * Math.sin(ja1) * Math.sin(ja2),
      vec.z * spread + jr * Math.cos(ja1),
    ];
  }

  // Phase 4: Repulsion pass (spatial hash, O(N) per iteration)
  applySpatialHashRepulsion(positions, Object.keys(positions), spread * 0.07, 4);

  return { positions };
}
