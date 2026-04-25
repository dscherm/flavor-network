/**
 * sauceCodex.js — Sauce Lab data layer that mirrors the Cocktail Codex
 * pattern: each NODE in the 3D scene is a sauce, grouped into 10
 * mother-sauce families (5 French + 5 global, per `sauceScoring.js`).
 *
 * Source: `public/data/sauce_augment.json` — 77 curated sauces with
 * structured `ingredients: [{name, measure}]` fields. The 27 sauces
 * tagged `motherSauce: "Independent"` get reassigned to the closest
 * family at load time (see REASSIGN below).
 *
 * Output shape mirrors `cocktailCodex.js` so NodeMesh / EdgeMesh /
 * NetworkScene + SauceDetailPanel can consume it without changes:
 *   {
 *     nodes:   Map<sauceName, { ...sauce, id, family_id, isRoot,
 *                               clusterColor, clusterLabel,
 *                               ingredients: string[], _kws }>
 *     edges:   Array<{ source, target, strength, kind }>
 *     ingredientList: string[]
 *     ingredientToSauces: Map<ingredient, sauceName[]>
 *     codex:  { clusters, sauces }
 *   }
 */

// 10 mother-sauce families with display colors. Order matches the
// circular layout — French roux/emulsion sauces first, then global.
const FAMILIES = [
  { id: 0, name: 'Béchamel',     color: '#f5f0d6' },  // cream
  { id: 1, name: 'Velouté',      color: '#e8c989' },  // pale gold
  { id: 2, name: 'Espagnole',    color: '#a05a2c' },  // dark amber
  { id: 3, name: 'Hollandaise',  color: '#f3d44e' },  // yellow
  { id: 4, name: 'Tomato',       color: '#d94a3d' },  // red
  { id: 5, name: 'Curry',        color: '#e8804a' },  // orange
  { id: 6, name: 'Stir-fry',     color: '#7dba5e' },  // green
  { id: 7, name: 'Mole',         color: '#7a2d1a' },  // dark brown-red
  { id: 8, name: 'Salsa',        color: '#e75555' },  // bright coral
  { id: 9, name: 'Nut Sauce',    color: '#c8a165' },  // tan
];

// Best-guess reassignment for the 27 "Independent" sauces. Tweak as
// taxonomy preferences shift — kept in code (not the JSON) so reverts
// are trivial.
const REASSIGN = {
  // Asian soy/sesame condiments → Stir-fry
  'Ponzu': 'Stir-fry',
  'Gochujang Sauce': 'Stir-fry',
  'Tonkatsu Sauce': 'Stir-fry',
  'Tare': 'Stir-fry',
  // Raw herb/chili/acid blends → Salsa
  'Mango Chutney': 'Salsa',
  'Mint Chutney': 'Salsa',
  'Chimichurri': 'Salsa',
  'Ají Amarillo Sauce': 'Salsa',
  'Zhug': 'Salsa',
  'Chermoula': 'Salsa',
  'Peri Peri': 'Salsa',
  'Nuoc Cham': 'Salsa',
  // Tomato-based simmered → Tomato
  'Sofrito': 'Tomato',
  'BBQ Sauce': 'Tomato',
  // Chili paste with spices → Mole
  'Adobo Sauce': 'Mole',
  'Harissa': 'Mole',
  // Emulsions → Hollandaise
  'Toum': 'Hollandaise',
  'Buffalo Sauce': 'Hollandaise',
  'Remoulade': 'Hollandaise',
  'Beurre Noisette': 'Hollandaise',
  // Spice-driven simmered → Curry
  'Shito': 'Curry',
  'Berbere Sauce': 'Curry',
  // Yogurt / tahini blends → Nut Sauce
  'Raita': 'Nut Sauce',
  'Tahini Sauce': 'Nut Sauce',
  // Roux + dairy → Béchamel
  'Gravy (Southern)': 'Béchamel',
  // French reduction → Espagnole
  'Gastrique': 'Espagnole',
  // Stock-base → Velouté
  'Dashi': 'Velouté',
};

// Words that contribute zero signal for ingredient-set similarity.
// Borrowed from cocktailCodex but trimmed to what shows up in sauce
// recipes. Salt/water/oil/etc are intentionally NOT here so they DO
// participate in keyword overlap (they're meaningful in saucework).
const STOP_KW = new Set([
  'fresh','dried','ground','whole','small','large','medium','to','taste',
  'a','an','and','or','of','the','for','with',
]);

function tokensOf(name) {
  if (!name) return [];
  return String(name)
    .toLowerCase()
    .split(/[\s/,()-]+/)
    .filter(t => t.length > 2 && !STOP_KW.has(t));
}

function sauceKeywordSet(ingredients) {
  const set = new Set();
  for (const ing of ingredients) {
    const name = typeof ing === 'string' ? ing : (ing.name || '');
    for (const t of tokensOf(name)) set.add(t);
  }
  return set;
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Load the sauce codex JSON and shape it into the graph contract.
 *
 * @param {string} basePath - default '/data'
 * @returns {Promise<Object>}
 */
export async function loadSauceCodex(basePath = '/data') {
  const res = await fetch(`${basePath}/sauce_augment.json`);
  if (!res.ok) throw new Error(`Failed to load sauce_augment.json: ${res.status}`);
  const augment = await res.json();

  const familyByName = new Map(FAMILIES.map(f => [f.name, f]));

  // Build nodes ----------------------------------------------------------
  const nodes = new Map();
  let id = 0;
  for (const sauce of augment.sauces || []) {
    // Resolve family: explicit motherSauce → reassignment table → drop
    let famName = sauce.motherSauce;
    if (famName === 'Independent') famName = REASSIGN[sauce.name] || null;
    if (!famName || !familyByName.has(famName)) continue; // drop the unclassifiable

    const fam = familyByName.get(famName);

    // Normalize ingredients to plain strings for downstream consumers
    // (Recipe Lab handoff, Jaccard similarity, badges).
    const ingredients = (sauce.ingredients || []).map(i =>
      typeof i === 'string' ? i : (i.name || '')
    ).filter(Boolean);

    // Roots: a sauce is the "root" of its family iff its name matches
    // the family name (Béchamel→Béchamel, Hollandaise→Hollandaise, ...).
    // Curry/Stir-fry/Salsa/Mole/Nut Sauce have no eponymous root —
    // we'll synthesize a centroid position for those families.
    const isRoot = sauce.name === famName;

    nodes.set(sauce.name, {
      ...sauce,
      ingredients,                 // string[] (overrides original {name, measure} array)
      ingredientsDetailed: sauce.ingredients || [], // keep original for the panel display
      id: id++,
      family_id: fam.id,
      family: fam.name,
      isRoot,
      clusterColor: fam.color,
      clusterId: fam.id,
      clusterLabel: fam.name,
      // Suppress taste/cuisine color overrides in NodeMesh.
      taste: '',
      cuisines: [],
      pairingCount: ingredients.length,
      _kws: sauceKeywordSet(ingredients),
    });
  }

  // Build edges ----------------------------------------------------------
  const edges = [];

  // Tree edges: each non-root sauce → family root (when one exists).
  // Strength=1.0 so the renderer paints them prominently.
  const rootByFamily = new Map();
  for (const [name, n] of nodes) {
    if (n.isRoot) rootByFamily.set(n.family_id, name);
  }
  for (const [name, n] of nodes) {
    if (n.isRoot) continue;
    const root = rootByFamily.get(n.family_id);
    if (!root) continue;
    edges.push({ source: name, target: root, strength: 1.0, kind: 'tree' });
  }

  // Jaccard edges within each family. N is small per family (≤16) so
  // pairwise is fine. Floor of 0.18 matches the cocktail codex.
  const saucesByFamily = new Map();
  for (const [name, n] of nodes) {
    if (!saucesByFamily.has(n.family_id)) saucesByFamily.set(n.family_id, []);
    saucesByFamily.get(n.family_id).push(name);
  }
  const JACCARD_FLOOR = 0.18;
  for (const list of saucesByFamily.values()) {
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

  // Strip the cached keyword set so it doesn't leak downstream.
  for (const n of nodes.values()) delete n._kws;

  // Inverted index: ingredient → sauces containing it
  const ingredientToSauces = new Map();
  for (const [name, n] of nodes) {
    for (const ing of n.ingredients) {
      const key = String(ing).toLowerCase().trim();
      if (!key) continue;
      if (!ingredientToSauces.has(key)) ingredientToSauces.set(key, []);
      ingredientToSauces.get(key).push(name);
    }
  }

  const ingredientList = [...nodes.keys()].sort();

  return {
    nodes,
    edges,
    ingredientList,
    ingredientToSauces,
    codex: { clusters: FAMILIES, sauces: augment.sauces || [] },
  };
}

/**
 * Position sauces in 3D: family centroids ride a circle in the X-Z
 * plane; within each family, sauces are sub-grouped by cuisine and
 * each cuisine sits at its own offset around the family centroid.
 * Roots (eponymous mother sauces) sit AT the family centroid.
 *
 * Mirrors `computeCodexPositions` from cocktailCodex.js but uses
 * cuisine instead of explicit subcluster_id since sauce_augment.json
 * doesn't ship a subcluster taxonomy.
 *
 * @param {Map} nodes - sauce nodes
 * @param {Array} clusters - codex.clusters [{id, name, color}]
 * @returns {Object} { positions: { [name]: [x, y, z] } }
 */
export function computeSauceCodexPositions(nodes, clusters) {
  // Tightened layout — was 60/6, families read as too far apart with
  // no useful detail in between. New numbers cluster the families
  // closer together so the codex reads as one body, not 10 islands.
  const FAMILY_RADIUS = 36;
  const SUBCLUSTER_RADIUS = 7;  // distance from family centroid to cuisine sub-centroid
  const BASE_SCATTER = 3.5;     // jitter inside each cuisine pod

  // Scatter scales with cuisine size — a single-sauce cuisine sits
  // exactly on its sub-centroid; an 8-sauce cuisine fans out a bit.
  function scatterFor(k) {
    return BASE_SCATTER + Math.max(0, Math.sqrt(k - 1)) * 1.5;
  }

  // Family centroids on a circle, evenly spaced.
  const familyCenter = new Map();
  for (let i = 0; i < clusters.length; i++) {
    const angle = (i / clusters.length) * Math.PI * 2 - Math.PI / 2;
    familyCenter.set(clusters[i].id, [
      Math.cos(angle) * FAMILY_RADIUS,
      0,
      Math.sin(angle) * FAMILY_RADIUS,
    ]);
  }

  // Group sauces by family → cuisine. Build cuisine sub-centroids
  // for each family — they ring the family centroid in the X-Z
  // plane with a slight Y wobble so the cuisines feel layered.
  const cuisineGroups = new Map(); // famId → Map<cuisine, sauceNames[]>
  for (const [name, n] of nodes) {
    const cuisine = n.cuisine || 'Other';
    if (!cuisineGroups.has(n.family_id)) cuisineGroups.set(n.family_id, new Map());
    const fam = cuisineGroups.get(n.family_id);
    if (!fam.has(cuisine)) fam.set(cuisine, []);
    fam.get(cuisine).push(name);
  }

  // Compute sub-centroids: { famId, cuisine } → [x, y, z].
  const subCenter = new Map();
  for (const [famId, cuisineMap] of cuisineGroups) {
    const fc = familyCenter.get(famId);
    if (!fc) continue;
    const cuisines = [...cuisineMap.keys()];
    if (cuisines.length === 1) {
      // Single cuisine — sub-centroid IS the family centroid (no offset).
      subCenter.set(`${famId}|${cuisines[0]}`, [...fc]);
      continue;
    }
    for (let i = 0; i < cuisines.length; i++) {
      const angle = (i / cuisines.length) * Math.PI * 2;
      subCenter.set(`${famId}|${cuisines[i]}`, [
        fc[0] + Math.cos(angle) * SUBCLUSTER_RADIUS,
        fc[1] + Math.sin(i * 1.7) * 2.5,  // gentle Y wobble per cuisine
        fc[2] + Math.sin(angle) * SUBCLUSTER_RADIUS,
      ]);
    }
  }

  function hash(s) {
    let h = 2166136261;
    for (const c of s) h = (h ^ c.charCodeAt(0)) * 16777619;
    return (h >>> 0) / 2 ** 32;
  }

  const positions = {};
  for (const [name, n] of nodes) {
    const fc = familyCenter.get(n.family_id) || [0, 0, 0];
    if (n.isRoot) {
      // Mother sauce sits AT the family centroid regardless of cuisine.
      positions[name] = [...fc];
      continue;
    }
    const cuisine = n.cuisine || 'Other';
    const sc = subCenter.get(`${n.family_id}|${cuisine}`) || fc;
    const k = cuisineGroups.get(n.family_id)?.get(cuisine)?.length || 1;
    const s = scatterFor(k);
    const h1 = hash(name);
    const h2 = hash(name + 'y');
    const h3 = hash(name + 'z');
    positions[name] = [
      sc[0] + (h1 - 0.5) * s * 2,
      sc[1] + (h2 - 0.5) * s * 2,
      sc[2] + (h3 - 0.5) * s * 2,
    ];
  }

  return { positions };
}
