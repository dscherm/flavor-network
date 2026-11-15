/**
 * sharedLoaders.js — the default data loaders for a built-in recipe page and the share-card images:
 * the recipe's own source file and the per-ingredient flavor data (curated taste labels, model aroma values). Nothing here loads the pairing data.
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

const LABELS_URL = '/proDataset/taste_labels.json';

/** The curated taste labels (name -> label), about 20 KB gzipped. A failure gives {} and the taste half draws nothing. */
async function fetchLabels(init) {
  try {
    const res = await fetch(LABELS_URL, init);
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

/** Map name -> { taste, gnnProbs? }: TASTE from the label file, AROMA from the model's values. */
function mergeNodes(labels, raw) {
  const nodes = new Map();
  for (const [name, taste] of Object.entries(labels || {})) nodes.set(name, { taste });
  for (const [name, info] of Object.entries(raw || {})) {
    if (name.startsWith('_') || !info?.probs) continue;
    nodes.set(name, { ...(nodes.get(name) || {}), gnnProbs: info.probs });
  }
  return nodes;
}

export async function defaultLoadNodes() {
  const [res, labels] = await Promise.all([fetch('/proDataset/gnn_entropy.json'), fetchLabels()]);
  if (!res.ok) throw new Error(`flavor data ${res.status}`);
  return mergeNodes(labels, await res.json());
}

/**
 * The flavor values only if the browser already has the files (the app loads them for every lab), never
 * a new download: the share card is then drawn without a chart rather than fetching 1.4 MB for a picture.
 */
export async function loadCachedNodes() {
  try {
    const cached = { cache: 'only-if-cached', mode: 'same-origin' };
    const [res, labels] = await Promise.all([fetch('/proDataset/gnn_entropy.json', cached), fetchLabels(cached)]);
    if (!res.ok) return null;
    return mergeNodes(labels, await res.json());
  } catch {
    return null;
  }
}
