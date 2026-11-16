/**
 * sharedLoaders.js — the default data loaders for a built-in recipe page and the share-card images:
 * the recipe's own source file and the curated taste labels (one small file). Nothing here loads the pairing data
 * or the model's per-ingredient values.
 */

import { curateCodexRaw } from './cocktailCodexV2.js';

export async function defaultLoadData(kind) {
  if (kind === 'cocktail') {
    const res = await fetch('/data/cocktail_codex_v2.json');
    if (!res.ok) throw new Error(`cocktail data ${res.status}`);
    const raw = curateCodexRaw(await res.json());
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

/** The curated taste labels (name -> label), about 20 KB gzipped. A failure gives {}. */
async function fetchLabels(init) {
  try {
    const res = await fetch(LABELS_URL, init);
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

/** Map name -> { taste } from the label file. The aroma half is a table in the code and needs no download. */
function toNodes(labels) {
  const nodes = new Map();
  for (const [name, taste] of Object.entries(labels || {})) nodes.set(name, { taste });
  return nodes;
}

export async function defaultLoadNodes() {
  const labels = await fetchLabels();
  if (!Object.keys(labels).length) throw new Error('flavor labels unavailable');
  return toNodes(labels);
}

/** The label nodes for a share card: the same 20 KB file, null on any failure (the card is then drawn without a chart). */
export async function loadLabelNodes() {
  try {
    const labels = await fetchLabels();
    return Object.keys(labels).length ? toNodes(labels) : null;
  } catch {
    return null;
  }
}
