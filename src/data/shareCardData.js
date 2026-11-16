/**
 * shareCardData.js — what the share-card images need besides the recipe: the flavor chart bars, worked
 * out with the same code as the shared recipe page. Pure.
 */
import { buildFlavorProfile } from './inventProfile.js';
import { FLOOR } from './flavorDisplay.js';
import { resolveIngredientName } from './recipePairingMatch.js';
import { SHARE_CHARTS_ENABLED } from './shareTargets.js';

const NOUN = { cocktail: 'drink', sauce: 'sauce', dish: 'dish' };

/**
 * THE one place a recipe becomes a chart outside the Recipe Notebook and the invent panels: the recipe's lines
 * (names resolved against the label file), their amounts and the garnish text go to buildFlavorProfile. The
 * shared page, the browser share cards, the share index (server cards) and the measure script all call this.
 * `nodes` is the Map name -> { taste } of the curated labels (aroma needs no node).
 */
export function profileForRecipe(recipe, nodes) {
  const names = new Set(nodes instanceof Map ? nodes.keys() : []);
  const keys = [];
  const amounts = {};
  for (const l of recipe?.lines || []) {
    const key = resolveIngredientName(l.label || l.key, names) || l.key;
    keys.push(key);
    if (l.amount && amounts[key] === undefined) amounts[key] = l.amount;
  }
  return buildFlavorProfile(keys, nodes instanceof Map ? nodes : new Map(), { noun: NOUN[recipe?.kind] || 'recipe', amounts, garnish: recipe?.garnish || '' });
}

/**
 * [{ label, color, score }] strongest first (the display rule's ordering, flavorDisplay.js); [] when there is no flavor
 * data or SHARE_CHARTS_ENABLED is off (the card then has no chart). Every bar above the floor. `stored: true` is for the
 * bars saved on a user's published copy (CHART-4): the same list, kept to scores at or above the floor so that rounding to
 * three decimals cannot let a note in that the shared page leaves out. All of it is stored (firestore.rules allows 17 bars,
 * one per axis), because the tasting note needs the five strongest notes overall and the strips need every note for their
 * totals; the old 4 + 4 cut could change both.
 */
export function barsFor(recipe, nodes, { stored = false } = {}) {
  if (!SHARE_CHARTS_ENABLED || !recipe || !(nodes instanceof Map) || !nodes.size) return [];
  try {
    const bars = profileForRecipe(recipe, nodes).bars;
    return (stored ? bars.filter((b) => Number(b.score) >= FLOOR && Number(b.score) > 0) : bars).map((b) => ({ label: b.label, color: b.color, score: b.score }));
  } catch {
    return [];
  }
}
