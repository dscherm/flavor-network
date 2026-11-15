/**
 * sharedLoaders.js — the default data loaders for a built-in recipe page and the share-card images:
 * the recipe's own source file and the per-ingredient flavor values. Nothing here loads the pairing data.
 */

export async function defaultLoadData(kind) {
  if (kind === 'cocktail') {
    const res = await fetch('/data/cocktail_codex_v2.json');
    if (!res.ok) throw new Error(`cocktail data ${res.status}`);
    const raw = await res.json();
    return { cocktails: raw.cocktails || [], families: raw.families || [] };
  }
  if (kind === 'sauce') {
    const res = await fetch('/data/sauce_augment.json');
    if (!res.ok) throw new Error(`sauce data ${res.status}`);
    const raw = await res.json();
    return { sauces: raw.sauces || [] };
  }
  if (kind === 'dish') {
    const [{ SEED_RECIPES }, { RECIPE_DETAILS }] = await Promise.all([
      import('../data/seedRecipes.js'),
      import('../data/seedRecipeDetails.js'),
    ]);
    return { dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
  }
  return {};
}

export async function defaultLoadNodes() {
  const res = await fetch('/proDataset/gnn_entropy.json');
  if (!res.ok) throw new Error(`flavor data ${res.status}`);
  const raw = await res.json();
  const nodes = new Map();
  for (const [name, info] of Object.entries(raw)) {
    if (name.startsWith('_') || !info?.probs) continue;
    nodes.set(name, { gnnProbs: info.probs });
  }
  return nodes;
}

/**
 * The flavor values only if the browser already has the file (the app loads it for every lab), never
 * a new download: the share card is then drawn without a chart rather than fetching 1.4 MB for a picture.
 */
export async function loadCachedNodes() {
  try {
    const res = await fetch('/proDataset/gnn_entropy.json', { cache: 'only-if-cached', mode: 'same-origin' });
    if (!res.ok) return null;
    const raw = await res.json();
    const nodes = new Map();
    for (const [name, info] of Object.entries(raw)) {
      if (name.startsWith('_') || !info?.probs) continue;
      nodes.set(name, { gnnProbs: info.probs });
    }
    return nodes;
  } catch {
    return null;
  }
}
