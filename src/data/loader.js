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
 * Handles both directions: "creole cuisine,garlic" and "garlic,creole cuisine"
 */
export async function loadCuisines(basePath = '/data') {
  const res = await fetch(`${basePath}/cuisines.csv`);
  const text = await res.text();
  const pairs = parseCsvPairs(text);

  const cuisines = new Map();
  for (const [col1, col2] of pairs) {
    // Determine which column is the cuisine and which is the ingredient
    let cuisine, ingredient;
    const col2Lower = col2.toLowerCase();
    if (col1.includes('cuisine')) {
      cuisine = col1;
      ingredient = col2Lower;
    } else if (col2Lower.includes('cuisine')) {
      cuisine = col2Lower;
      ingredient = col1;
    } else {
      // Fallback: treat col1 as cuisine
      cuisine = col1;
      ingredient = col2Lower;
    }

    if (!cuisines.has(cuisine)) {
      cuisines.set(cuisine, []);
    }
    if (!cuisines.get(cuisine).includes(ingredient)) {
      cuisines.get(cuisine).push(ingredient);
    }
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
 * Build a reverse lookup: ingredient → cuisines it belongs to.
 * If knownIngredients is provided, attempts to match cuisine ingredient names
 * to actual graph node names (handles "cayenne" → "cayenne, ground", etc.)
 */
export function buildIngredientCuisineMap(cuisines, knownIngredients = null) {
  const map = new Map();

  // Build a lookup for fuzzy matching: base name → full node name
  let nameIndex = null;
  if (knownIngredients) {
    nameIndex = new Map();
    for (const name of knownIngredients) {
      // Index by full name
      nameIndex.set(name, name);
      // Index by base name (before comma), e.g. "cayenne, ground" → "cayenne"
      const commaIdx = name.indexOf(',');
      if (commaIdx > 0) {
        const base = name.slice(0, commaIdx).trim();
        if (!nameIndex.has(base)) {
          nameIndex.set(base, name);
        }
      }
    }
    // Common spelling variants
    const variants = [
      ['crawfish', 'crayfish'],
    ];
    for (const [a, b] of variants) {
      if (!nameIndex.has(a) && nameIndex.has(b)) nameIndex.set(a, nameIndex.get(b));
      if (!nameIndex.has(b) && nameIndex.has(a)) nameIndex.set(b, nameIndex.get(a));
    }
  }

  function resolveName(ing) {
    if (!nameIndex) return ing;
    // Exact match first
    if (nameIndex.has(ing)) return nameIndex.get(ing);
    // Try base name (before colon for multi-value refs like "pepper: black, white")
    if (ing.includes(':')) {
      const parts = ing.split(':');
      const base = parts[0].trim();
      const values = parts[1].split(',').map(s => s.trim());
      // Return all resolved individual entries
      const resolved = [];
      for (const val of values) {
        const combined = `${base}, ${val}`;
        if (nameIndex.has(combined)) resolved.push(nameIndex.get(combined));
        else if (nameIndex.has(val)) resolved.push(nameIndex.get(val));
      }
      return resolved.length > 0 ? resolved : null;
    }
    return null; // No match found — ingredient doesn't exist as a node
  }

  for (const [cuisine, ingredients] of cuisines) {
    for (const ing of ingredients) {
      const resolved = resolveName(ing);
      if (!resolved) continue; // Skip ingredients that don't exist as nodes

      const names = Array.isArray(resolved) ? resolved : [resolved];
      for (const name of names) {
        if (!map.has(name)) {
          map.set(name, []);
        }
        if (!map.get(name).includes(cuisine)) {
          map.get(name).push(cuisine);
        }
      }
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

  // Collect all known ingredient names from pairings (both sides)
  const knownIngredients = new Set();
  for (const [ingredient, targets] of pairings) {
    knownIngredients.add(ingredient);
    for (const target of targets) {
      knownIngredients.add(target);
    }
  }

  const ingredientCuisines = buildIngredientCuisineMap(cuisines, knownIngredients);

  return {
    pairings,
    cuisines,
    metadata,
    affinities,
    ingredientCuisines,
  };
}
