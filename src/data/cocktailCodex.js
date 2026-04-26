/**
 * cocktailCodex.js — load + shape the curated Cocktail Codex dataset
 * for the new Cocktail Lab where each cocktail is a node.
 *
 * Output shape mirrors the existing graph contract enough that
 * NodeMesh + EdgeMesh + NetworkScene can render it without changes:
 *   {
 *     nodes: Map<name, {
 *       name, id, family_id, subcluster_id, isRoot,
 *       clusterColor, clusterLabel, ingredients[], garnishes[],
 *       pairingCount, taste, cuisines, ...
 *     }>,
 *     edges: Array<{ source, target, strength, kind }>,
 *     ingredientList: string[],         // for SearchBar
 *     ingredientToCocktails: Map<ingredient, cocktailNames[]>,
 *     codex: <raw codex JSON>,
 *   }
 */

// STOP only strips MEASUREMENT, GLUE, and METHOD words — never ingredient
// nouns. "Simple syrup", "Egg white", "Heavy cream", "Sweet vermouth"
// must survive normalization with both tokens intact, so words like
// `syrup`/`liqueur`/`vermouth`/`cream`/`egg`/`sugar` are deliberately
// NOT in the stop list. Similarly we keep color/character qualifiers
// (`white`, `dark`, `sweet`, `dry`, `aged`) so that "White rum" stays
// "white rum" — the SuggestionDrawer's fallback chain (graph.js
// lookupNeighbors) handles the strip-to-head-noun retry.
const STOP = new Set([
  // units
  'oz','ounce','ounces','cl','ml','dash','dashes','drop','drops','tsp','tbsp','teaspoon','teaspoons',
  'tablespoon','tablespoons','parts','part','cube','cubes','splash','splashes','sprays','spray',
  'pinch','jigger','jiggers','cup','cups','liter','liters','pony','tin','batch',
  // glue
  'to','taste','of','the','a','an','and','or','with','no','none','about','around',
  'approximately','very','if','needed','for','optional','our','ideal','recipe','classic',
  'signature','specifically','typically','standard','wet',
  // pure qualifiers (safe to strip without changing identity)
  'fresh','cold','hot','chilled',
  // method / preparation
  'small','large','whole','half','thin','sliced','crushed','grated','muddled','expressed',
  'discarded','served','rim','garnish','blended','reserve',
]);

// Ingredient-name normalization: strip leading measurement, parenthetical
// asides, and trailing qualifier words to get a canonical lower-case
// ingredient label that we can match against the ProData pairings graph.
export function normalizeIngredient(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  // remove leading measurement (number, fraction, units)
  // Long alternatives first so `dashes` matches before `dash` (regex
  // alternation is left-priority, not longest-match).
  s = s.replace(/^[¼½¾⅓⅔⅛⅜⅝⅞0-9]+[¼½¾⅓⅔⅛⅜⅝⅞0-9.\s/()-]*\s*(ounces|ounce|oz|dashes|dash|drops|drop|teaspoons?|tablespoons?|tsp|tbsp|parts?|cubes?|splashes|splash|sprays?|to taste|pinch|jiggers?|cups?|cl|ml)?\s*/i, '');
  // strip parenthetical
  s = s.replace(/\([^)]*\)/g, '');
  // remove trailing qualifiers like "(infused)" residue / commas
  s = s.replace(/[,;].*$/, '');
  // remove "Garnish:" prefix if any
  s = s.replace(/^(Garnish|Rim):\s*/i, '');
  // collapse spaces
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  // strip leading qualifier words ("fresh", "cold", etc.)
  const tokens = s.split(' ').filter(t => !STOP.has(t));
  return tokens.join(' ').trim();
}

// Pull keyword tokens from an ingredient line for Jaccard similarity
// (e.g. "Fresh lemon juice" → ["lemon","juice"], "Aged rhum agricole"
// → ["rhum","agricole"]). Punctuation/measurements stripped.
function tokensOf(raw) {
  const norm = normalizeIngredient(raw);
  if (!norm) return [];
  return norm.split(' ').filter(t => t.length > 2 && !STOP.has(t));
}

function cocktailKeywordSet(ingredients) {
  const set = new Set();
  for (const ing of ingredients) {
    for (const t of tokensOf(ing)) set.add(t);
  }
  return set;
}

// Jaccard similarity between two cocktails' ingredient keyword sets.
function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Load the codex JSON and build the graph in one pass.
 *
 * @param {string} basePath - default '/data'
 * @returns {Promise<Object>}
 */
export async function loadCocktailCodex(basePath = '/data') {
  const res = await fetch(`${basePath}/cocktail_codex.json`);
  if (!res.ok) throw new Error(`Failed to load cocktail_codex.json: ${res.status}`);
  const codex = await res.json();

  const familyById = new Map(codex.clusters.map(c => [c.id, c]));
  const subclusterById = new Map(codex.subclusters.map(s => [s.id, s]));

  // --- Build nodes ---
  const nodes = new Map();
  let id = 0;
  for (const c of codex.cocktails) {
    const fam = familyById.get(c.family_id);
    const sub = subclusterById.get(c.subcluster_id);
    nodes.set(c.name, {
      ...c,
      id: id++,
      // visual hooks for NodeMesh / IngredientPanel
      clusterColor: fam ? fam.color : '#888',
      clusterId: c.family_id,
      clusterLabel: fam ? fam.name : 'Unclustered',
      subclusterLabel: sub ? sub.name : null,
      // taste/cuisines empty so the existing color/legend logic doesn't
      // try to override our cluster color
      taste: '',
      cuisines: [],
      pairingCount: c.ingredients ? c.ingredients.length : 0,
      // keyword set for Jaccard, computed once
      _kws: cocktailKeywordSet(c.ingredients || []),
    });
  }

  // --- Build edges ---
  const edges = [];

  // Tree edges: each non-root cocktail links to its family root.
  // Strength=1.0 so the existing renderer highlights them.
  const rootByFamily = new Map();
  for (const [name, n] of nodes) {
    if (n.isRoot) rootByFamily.set(n.family_id, name);
  }
  for (const [name, n] of nodes) {
    if (n.isRoot) continue;
    if (n.family_id === 6) continue; // syrups have no root
    const root = rootByFamily.get(n.family_id);
    if (!root) continue;
    edges.push({ source: name, target: root, strength: 1.0, kind: 'tree' });
  }

  // Jaccard edges between cocktails in the SAME family with sufficient
  // ingredient overlap. Pairwise across the family — N is small per
  // family (~25), so N² is fine.
  const cocktailsByFamily = new Map();
  for (const [name, n] of nodes) {
    if (n.family_id === 6) continue;
    if (!cocktailsByFamily.has(n.family_id)) cocktailsByFamily.set(n.family_id, []);
    cocktailsByFamily.get(n.family_id).push(name);
  }
  const JACCARD_FLOOR = 0.18;
  for (const list of cocktailsByFamily.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = nodes.get(list[i]);
        const b = nodes.get(list[j]);
        const sim = jaccard(a._kws, b._kws);
        if (sim >= JACCARD_FLOOR) {
          edges.push({ source: list[i], target: list[j], strength: sim, kind: 'jaccard' });
        }
      }
    }
  }

  // strip the keyword set from nodes so it doesn't leak into other code
  for (const n of nodes.values()) delete n._kws;

  // --- Inverted index: ingredient → cocktails containing it ---
  const ingredientToCocktails = new Map();
  for (const [name, n] of nodes) {
    for (const ing of n.ingredients || []) {
      const key = normalizeIngredient(ing);
      if (!key) continue;
      if (!ingredientToCocktails.has(key)) ingredientToCocktails.set(key, []);
      ingredientToCocktails.get(key).push(name);
    }
  }

  const ingredientList = [...nodes.keys()].sort();

  return { nodes, edges, ingredientList, ingredientToCocktails, codex };
}

/**
 * Position cocktails in 3D: family centroids are distributed on a
 * sphere via a Fibonacci-spiral lattice (≈evenly-spaced points on a
 * sphere — gives a polyhedron-feeling layout instead of a flat ring).
 * Subclusters splay around their family in a small disc PERPENDICULAR
 * to the radial direction, so each family reads as its own little
 * planet rather than a stack of rings on the X-Z plane.
 *
 * Roots are placed AT the family centroid so they read as the hub.
 *
 * @param {Map} nodes - cocktail nodes
 * @param {Array} clusters - codex.clusters [{id, name, color}]
 * @returns {Object} { positions: { [name]: [x, y, z] } }
 */
export function computeCodexPositions(nodes, clusters) {
  const FAMILY_RADIUS = 36;
  const SUBCLUSTER_RADIUS = 8;
  const SCATTER = 3;

  // Fibonacci-sphere distribution for family centroids. Gives the
  // visual feel of a polyhedron — points are roughly evenly-spaced
  // across the sphere surface, with no obvious axis bias.
  const familyCenter = new Map();
  const N = clusters.length;
  const phi = Math.PI * (Math.sqrt(5) - 1); // golden angle
  for (let i = 0; i < N; i++) {
    const y = N === 1 ? 0 : 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    familyCenter.set(clusters[i].id, [
      Math.cos(theta) * r * FAMILY_RADIUS,
      y * FAMILY_RADIUS,
      Math.sin(theta) * r * FAMILY_RADIUS,
    ]);
  }

  // Build a basis (u, v) perpendicular to the radial vector from the
  // origin to the family centroid. Subclusters ride in this u,v plane
  // so each family's "disc" of variations faces outward, not stacked
  // along the global Y axis.
  function radialBasis(center) {
    const len = Math.hypot(center[0], center[1], center[2]) || 1;
    const radial = [center[0] / len, center[1] / len, center[2] / len];
    const upRef = Math.abs(radial[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let u = [
      upRef[1] * radial[2] - upRef[2] * radial[1],
      upRef[2] * radial[0] - upRef[0] * radial[2],
      upRef[0] * radial[1] - upRef[1] * radial[0],
    ];
    const ul = Math.hypot(u[0], u[1], u[2]) || 1;
    u = [u[0] / ul, u[1] / ul, u[2] / ul];
    const v = [
      radial[1] * u[2] - radial[2] * u[1],
      radial[2] * u[0] - radial[0] * u[2],
      radial[0] * u[1] - radial[1] * u[0],
    ];
    return { u, v };
  }

  // Group cocktails by subcluster_id.
  const subGroups = new Map();
  for (const [name, n] of nodes) {
    const key = n.subcluster_id || `${n.family_id}-misc`;
    if (!subGroups.has(key)) subGroups.set(key, { family_id: n.family_id, names: [] });
    subGroups.get(key).names.push(name);
  }

  // Per family, splay its subclusters around the centroid in the
  // radial-perpendicular disc.
  const familySubs = new Map();
  for (const [subId, group] of subGroups) {
    if (!familySubs.has(group.family_id)) familySubs.set(group.family_id, []);
    familySubs.get(group.family_id).push({ subId, group });
  }
  const subCenter = new Map();
  for (const [famId, list] of familySubs) {
    const fc = familyCenter.get(famId);
    if (!fc) continue;
    const { u, v } = radialBasis(fc);
    for (let i = 0; i < list.length; i++) {
      const angle = (i / Math.max(1, list.length)) * Math.PI * 2;
      const ca = Math.cos(angle) * SUBCLUSTER_RADIUS;
      const sa = Math.sin(angle) * SUBCLUSTER_RADIUS;
      subCenter.set(list[i].subId, [
        fc[0] + u[0] * ca + v[0] * sa,
        fc[1] + u[1] * ca + v[1] * sa,
        fc[2] + u[2] * ca + v[2] * sa,
      ]);
    }
  }

  const positions = {};
  // Pseudo-random scatter via a deterministic hash of the cocktail name
  function hash(s) { let h = 2166136261; for (const c of s) h = (h ^ c.charCodeAt(0)) * 16777619; return (h >>> 0) / 2 ** 32; }

  for (const [name, n] of nodes) {
    if (n.isRoot) {
      const fc = familyCenter.get(n.family_id);
      positions[name] = fc ? [...fc] : [0, 0, 0];
      continue;
    }
    const center = subCenter.get(n.subcluster_id) || familyCenter.get(n.family_id) || [0, 0, 0];
    const h1 = hash(name);
    const h2 = hash(name + 'y');
    const h3 = hash(name + 'z');
    positions[name] = [
      center[0] + (h1 - 0.5) * SCATTER * 2,
      center[1] + (h2 - 0.5) * SCATTER * 2,
      center[2] + (h3 - 0.5) * SCATTER * 2,
    ];
  }

  return { positions };
}
