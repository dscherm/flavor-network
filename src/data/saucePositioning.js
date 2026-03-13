/**
 * saucePositioning.js — Mother Sauce-based 3D positioning.
 *
 * Axes:
 *   X: Light / Thin (negative) ←→ Rich / Heavy (positive)
 *   Y: Mild / Subtle (negative) ←→ Bold / Intense (positive)
 *   Z: Simple / Quick (negative) ←→ Complex / Layered (positive)
 *
 * Each ingredient is positioned based on its sauce role and the
 * mother sauce family it typically belongs to.
 */

// ---------------------------------------------------------------------------
// Sauce role → base position vector
// ---------------------------------------------------------------------------

const ROLE_VECTORS = {
  base:      { x:  0.6, y: -0.2, z: -0.3 },   // Fats: rich, mild, simple
  liquid:    { x: -0.5, y: -0.3, z: -0.2 },    // Stocks/liquids: thin, mild
  thickener: { x:  0.4, y: -0.4, z: -0.5 },    // Flour/starch: body-adding, simple
  aromatic:  { x:  0.0, y:  0.3, z:  0.2 },     // Onion/garlic: center, bold
  acid:      { x: -0.3, y:  0.5, z: -0.1 },     // Citrus/vinegar: light, bright
  seasoning: { x:  0.0, y:  0.6, z:  0.3 },     // Spices: bold, complex
  accent:    { x: -0.1, y:  0.2, z:  0.1 },     // Herbs: center, mild complexity
  umami:     { x:  0.3, y:  0.8, z:  0.5 },     // Fish sauce/miso: rich, intense, complex
  heat:      { x:  0.0, y:  1.0, z:  0.3 },     // Chilies: intensely bold
  other:     { x:  0.0, y:  0.0, z:  0.0 },     // Center
};

// ---------------------------------------------------------------------------
// Ingredient-specific overrides
// ---------------------------------------------------------------------------

const INGREDIENT_OVERRIDES = {
  // === FATS ===
  butter:           { x:  0.7, y: -0.3, z: -0.4 },
  'clarified butter': { x:  0.8, y: -0.2, z: -0.2 },
  ghee:             { x:  0.8, y:  0.0, z: -0.1 },
  'olive oil':      { x:  0.3, y: -0.1, z: -0.5 },
  'sesame oil':     { x:  0.4, y:  0.3, z:  0.0 },
  'coconut oil':    { x:  0.5, y: -0.1, z: -0.2 },
  lard:             { x:  0.9, y: -0.2, z: -0.3 },
  'palm oil':       { x:  0.7, y:  0.0, z: -0.1 },
  'peanut oil':     { x:  0.3, y: -0.1, z: -0.4 },
  'vegetable oil':  { x:  0.2, y: -0.3, z: -0.6 },

  // === LIQUIDS ===
  'chicken stock':  { x: -0.4, y: -0.2, z: -0.3 },
  'veal stock':     { x: -0.2, y:  0.0, z:  0.1 },
  'beef stock':     { x:  0.0, y:  0.1, z:  0.0 },
  'fish stock':     { x: -0.5, y:  0.1, z: -0.1 },
  dashi:            { x: -0.4, y:  0.3, z:  0.1 },
  milk:             { x: -0.3, y: -0.5, z: -0.6 },
  cream:            { x:  0.8, y: -0.3, z: -0.2 },
  'coconut milk':   { x:  0.5, y:  0.0, z:  0.1 },
  'white wine':     { x: -0.4, y:  0.1, z:  0.0 },
  'red wine':       { x: -0.2, y:  0.3, z:  0.3 },
  'madeira wine':   { x:  0.0, y:  0.4, z:  0.5 },
  water:            { x: -0.8, y: -0.6, z: -0.8 },

  // === THICKENERS ===
  flour:            { x:  0.3, y: -0.5, z: -0.6 },
  cornstarch:       { x:  0.2, y: -0.5, z: -0.7 },
  'egg yolk':       { x:  0.7, y: -0.1, z:  0.2 },
  'tapioca starch': { x:  0.2, y: -0.4, z: -0.5 },
  arrowroot:        { x:  0.2, y: -0.4, z: -0.5 },

  // === AROMATICS ===
  onion:            { x:  0.0, y:  0.2, z: -0.2 },
  garlic:           { x:  0.1, y:  0.5, z:  0.0 },
  shallot:          { x: -0.1, y:  0.2, z:  0.1 },
  ginger:           { x: -0.1, y:  0.6, z:  0.2 },
  lemongrass:       { x: -0.3, y:  0.4, z:  0.3 },
  galangal:         { x: -0.2, y:  0.5, z:  0.4 },
  celery:           { x: -0.2, y:  0.0, z: -0.3 },
  carrot:           { x:  0.1, y: -0.1, z: -0.3 },
  scallion:         { x: -0.2, y:  0.2, z: -0.2 },
  leek:             { x:  0.0, y:  0.1, z: -0.1 },

  // === ACIDS ===
  'lemon juice':    { x: -0.5, y:  0.4, z: -0.3 },
  'lime juice':     { x: -0.5, y:  0.5, z: -0.2 },
  tomato:           { x:  0.1, y:  0.3, z: -0.1 },
  'tomato paste':   { x:  0.3, y:  0.5, z:  0.1 },
  tamarind:         { x:  0.1, y:  0.6, z:  0.4 },
  yuzu:             { x: -0.4, y:  0.3, z:  0.3 },
  tomatillo:        { x: -0.2, y:  0.3, z:  0.0 },

  // === KEY SEASONINGS ===
  salt:             { x:  0.0, y:  0.1, z: -0.7 },
  'black pepper':   { x:  0.0, y:  0.3, z: -0.4 },
  'white pepper':   { x:  0.0, y:  0.2, z: -0.5 },
  cumin:            { x:  0.1, y:  0.6, z:  0.3 },
  turmeric:         { x:  0.1, y:  0.5, z:  0.2 },
  paprika:          { x:  0.1, y:  0.4, z:  0.1 },
  'smoked paprika': { x:  0.2, y:  0.6, z:  0.4 },
  cinnamon:         { x:  0.2, y:  0.4, z:  0.5 },
  nutmeg:           { x:  0.3, y:  0.1, z: -0.2 },
  'star anise':     { x:  0.2, y:  0.5, z:  0.5 },
  fenugreek:        { x:  0.2, y:  0.6, z:  0.4 },
  cardamom:         { x:  0.1, y:  0.5, z:  0.5 },
  clove:            { x:  0.2, y:  0.6, z:  0.5 },
  allspice:         { x:  0.2, y:  0.5, z:  0.4 },
  mustard:          { x: -0.1, y:  0.5, z:  0.0 },

  // === HERBS ===
  parsley:          { x: -0.3, y:  0.0, z: -0.3 },
  thyme:            { x: -0.1, y:  0.2, z:  0.0 },
  'bay leaf':       { x:  0.0, y:  0.1, z:  0.1 },
  tarragon:         { x: -0.2, y:  0.3, z:  0.2 },
  basil:            { x: -0.2, y:  0.2, z: -0.1 },
  oregano:          { x: -0.1, y:  0.3, z:  0.0 },
  cilantro:         { x: -0.3, y:  0.3, z:  0.1 },
  mint:             { x: -0.4, y:  0.2, z:  0.0 },
  chervil:          { x: -0.3, y:  0.1, z:  0.1 },
  rosemary:         { x:  0.0, y:  0.3, z:  0.1 },
  sage:             { x:  0.0, y:  0.3, z:  0.2 },
  dill:             { x: -0.3, y:  0.1, z: -0.1 },
  'kaffir lime leaf': { x: -0.2, y:  0.4, z:  0.4 },
  'curry leaf':     { x: -0.1, y:  0.5, z:  0.3 },
  epazote:          { x: -0.1, y:  0.4, z:  0.3 },

  // === UMAMI / PROTEIN ===
  anchovy:          { x:  0.3, y:  0.8, z:  0.3 },
  'fish sauce':     { x:  0.2, y:  0.9, z:  0.4 },
  'soy sauce':      { x:  0.1, y:  0.7, z:  0.2 },
  'oyster sauce':   { x:  0.3, y:  0.6, z:  0.2 },
  miso:             { x:  0.4, y:  0.7, z:  0.5 },
  'shrimp paste':   { x:  0.3, y:  0.9, z:  0.6 },
  'bonito flakes':  { x:  0.1, y:  0.5, z:  0.3 },
  'meat glaze':     { x:  0.6, y:  0.8, z:  0.7 },
  parmesan:         { x:  0.5, y:  0.5, z:  0.2 },
  gruyere:          { x:  0.6, y:  0.3, z:  0.1 },
  cheddar:          { x:  0.5, y:  0.3, z: -0.1 },

  // === CHILIES ===
  gochugaru:        { x:  0.1, y:  0.8, z:  0.4 },
  gochujang:        { x:  0.3, y:  0.8, z:  0.5 },
  chipotle:         { x:  0.2, y:  0.7, z:  0.4 },
  'ancho chili':    { x:  0.2, y:  0.5, z:  0.5 },
  'guajillo chili': { x:  0.1, y:  0.6, z:  0.4 },
  habanero:         { x: -0.1, y:  1.0, z:  0.2 },
  'thai chili':     { x: -0.1, y:  0.9, z:  0.2 },
  'scotch bonnet':  { x:  0.0, y:  1.0, z:  0.3 },
  'chili flake':    { x:  0.0, y:  0.6, z: -0.1 },
  harissa:          { x:  0.2, y:  0.8, z:  0.5 },

  // === KEY "OTHER" items ===
  chocolate:        { x:  0.5, y:  0.5, z:  0.9 },   // Mole
  peanut:           { x:  0.4, y:  0.4, z:  0.3 },
  tahini:           { x:  0.4, y:  0.3, z:  0.2 },
  honey:            { x:  0.3, y: -0.1, z: -0.3 },
  sugar:            { x:  0.1, y: -0.2, z: -0.5 },
  'palm sugar':     { x:  0.2, y:  0.0, z:  0.1 },
  jaggery:          { x:  0.3, y:  0.1, z:  0.2 },
  capers:           { x: -0.2, y:  0.5, z:  0.2 },
  olive:            { x:  0.1, y:  0.3, z:  0.1 },
  coconut:          { x:  0.5, y:  0.0, z:  0.2 },
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
 * Compute sauce-based 3D positions for sauce ingredients.
 *
 * @param {Map<string, Object>} nodes - Sauce graph nodes with codexRole
 * @param {Array<Object>} edges - Sauce graph edges
 * @param {number} spread - Spatial spread (default 45)
 * @returns {Object} { positions: { [name]: [x, y, z] } }
 */
export function computeSaucePositions(nodes, edges, spread = 45) {
  const positions = {};
  const scored = new Map();

  // Phase 1: Assign base vectors from overrides or role defaults
  for (const [name, node] of nodes) {
    const lower = name.toLowerCase();
    let vec;

    if (INGREDIENT_OVERRIDES[lower]) {
      vec = { ...INGREDIENT_OVERRIDES[lower] };
    } else {
      const role = node.codexRole || 'other';
      const rv = ROLE_VECTORS[role] || ROLE_VECTORS.other;
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

  // Phase 4: Repulsion pass
  const names = Object.keys(positions);
  const minDist = spread * 0.07;
  for (let iter = 0; iter < 4; iter++) {
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = positions[names[i]];
        const b = positions[names[j]];
        const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < minDist && dist > 0.001) {
          const push = (minDist - dist) * 0.5 / dist;
          a[0] -= dx * push; a[1] -= dy * push; a[2] -= dz * push;
          b[0] += dx * push; b[1] += dy * push; b[2] += dz * push;
        }
      }
    }
  }

  return { positions };
}
