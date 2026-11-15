/**
 * shareCardData.js — what the share-card images need besides the recipe: the flavor chart bars, worked
 * out with the same code as the shared recipe page. Pure.
 */
import { buildFlavorProfile } from './inventProfile.js';
import { resolveIngredientName } from './recipePairingMatch.js';
import { SHARE_CHARTS_ENABLED } from './shareTargets.js';

const NOUN = { cocktail: 'drink', sauce: 'sauce', dish: 'dish' };

/** [{ label, color, score }] strongest first; [] when there is no flavor data or SHARE_CHARTS_ENABLED is off (the card then has no chart). */
export function barsFor(recipe, nodes) {
  if (!SHARE_CHARTS_ENABLED || !recipe || !(nodes instanceof Map) || !nodes.size) return [];
  try {
    const names = new Set(nodes.keys());
    const keys = (recipe.lines || []).map((l) => resolveIngredientName(l.label || l.key, names) || l.key);
    return buildFlavorProfile(keys, nodes, { noun: NOUN[recipe.kind] || 'recipe' }).bars
      .map((b) => ({ label: b.label, color: b.color, score: b.score }));
  } catch {
    return [];
  }
}
