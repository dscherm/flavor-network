/**
 * Data loader — parses CSV data files into structured JS objects.
 * Designed to run in browser via fetch (files served from /data/).
 */

/**
 * Parse a simple two-column CSV (no header) into an array of [col1, col2] pairs.
 * Handles quoted fields with embedded commas.
 */
function parseCsvPairs(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let col1, col2;
    if (trimmed.startsWith('"')) {
      // Quoted first field
      const closingQuote = trimmed.indexOf('"', 1);
      if (closingQuote === -1) continue;
      col1 = trimmed.slice(1, closingQuote);
      col2 = trimmed.slice(closingQuote + 2); // skip ","
    } else {
      const commaIdx = trimmed.indexOf(',');
      if (commaIdx === -1) continue;
      col1 = trimmed.slice(0, commaIdx);
      col2 = trimmed.slice(commaIdx + 1);
    }

    // Strip surrounding quotes from col2
    col2 = col2.replace(/^"|"$/g, '').trim();
    col1 = col1.trim();

    if (col1 && col2) {
      rows.push([col1.toLowerCase(), col2]);
    }
  }
  return rows;
}

/**
 * Load and parse ingredients.csv → Map<ingredient, string[]> of pairings
 */
export async function loadIngredientPairings(basePath = '/data') {
  const res = await fetch(`${basePath}/ingredients.csv`);
  const text = await res.text();
  const pairs = parseCsvPairs(text);

  const pairings = new Map();
  for (const [ingredient, pairing] of pairs) {
    if (!pairings.has(ingredient)) {
      pairings.set(ingredient, []);
    }
    pairings.get(ingredient).push(pairing.toLowerCase());
  }
  return pairings;
}

/**
 * Load and parse cuisines.csv → Map<cuisine, string[]> of ingredients
 */
export async function loadCuisines(basePath = '/data') {
  const res = await fetch(`${basePath}/cuisines.csv`);
  const text = await res.text();
  const pairs = parseCsvPairs(text);

  const cuisines = new Map();
  for (const [cuisine, ingredient] of pairs) {
    if (!cuisines.has(cuisine)) {
      cuisines.set(cuisine, []);
    }
    cuisines.get(cuisine).push(ingredient.toLowerCase());
  }
  return cuisines;
}

/**
 * Load and parse ingredient_metadata.csv → Map<ingredient, {taste, weight, volume, season, tips[]}>
 */
export async function loadIngredientMetadata(basePath = '/data') {
  const res = await fetch(`${basePath}/ingredient_metadata.csv`);
  const text = await res.text();
  const pairs = parseCsvPairs(text);

  const metadata = new Map();
  for (const [ingredient, raw] of pairs) {
    if (!metadata.has(ingredient)) {
      metadata.set(ingredient, { taste: null, weight: null, volume: null, season: null, tips: [] });
    }
    const entry = metadata.get(ingredient);
    const lower = raw.toLowerCase();

    if (lower.startsWith('taste:')) {
      entry.taste = raw.slice(6).trim();
    } else if (lower.startsWith('weight:')) {
      entry.weight = raw.slice(7).trim();
    } else if (lower.startsWith('volume:')) {
      entry.volume = raw.slice(7).trim();
    } else if (lower.startsWith('season:')) {
      entry.season = raw.slice(7).trim();
    } else if (lower.startsWith('tips:')) {
      entry.tips.push(raw.slice(5).trim());
    }
  }
  return metadata;
}

/**
 * Load and parse affinities.csv → Map<ingredient, string[][]> of flavor combos
 * Each combo is an array of ingredients like ["garlic", "lemon", "olive oil"]
 */
export async function loadAffinities(basePath = '/data') {
  const res = await fetch(`${basePath}/affinities.csv`);
  const text = await res.text();
  const pairs = parseCsvPairs(text);

  const affinities = new Map();
  for (const [ingredient, comboStr] of pairs) {
    if (!affinities.has(ingredient)) {
      affinities.set(ingredient, []);
    }
    const combo = comboStr.split('+').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (combo.length > 0) {
      affinities.get(ingredient).push(combo);
    }
  }
  return affinities;
}

/**
 * Build a reverse lookup: ingredient → cuisines it belongs to
 */
export function buildIngredientCuisineMap(cuisines) {
  const map = new Map();
  for (const [cuisine, ingredients] of cuisines) {
    for (const ing of ingredients) {
      if (!map.has(ing)) {
        map.set(ing, []);
      }
      map.get(ing).push(cuisine);
    }
  }
  return map;
}

/**
 * Load all data sources and return a unified data object.
 */
export async function loadAllData(basePath = '/data') {
  const [pairings, cuisines, metadata, affinities] = await Promise.all([
    loadIngredientPairings(basePath),
    loadCuisines(basePath),
    loadIngredientMetadata(basePath),
    loadAffinities(basePath),
  ]);

  const ingredientCuisines = buildIngredientCuisineMap(cuisines);

  return {
    pairings,
    cuisines,
    metadata,
    affinities,
    ingredientCuisines,
  };
}
