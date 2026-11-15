/**
 * flavorPlaceholders.js — which per-ingredient flavor values are placeholders, not data.
 *
 * The model gave thousands of ingredients one identical taste vector and one identical aroma vector
 * (sugar, salt, coffee, gin and lemon all read the same). scripts/buildFlavorPlaceholders.mjs finds them
 * by value at build time into flavorPlaceholders.json. Taste and aroma are judged SEPARATELY: an
 * ingredient can have real values for one and placeholders for the other. Pure.
 */
import list from './flavorPlaceholders.json' with { type: 'json' };

const TASTE_AXES = ['sweet', 'sour', 'bitter', 'salty', 'umami'];
const AROMA_AXES = ['odor_fruity', 'odor_floral', 'odor_green', 'odor_woody', 'odor_spicy', 'odor_fatty'];

const key = (p, axes) => axes.map((a) => (typeof p?.[a] === 'number' ? p[a].toFixed(4) : '')).join(',');
const hasAny = (p, axes) => !!p && axes.some((a) => typeof p[a] === 'number');
const hasAll = (p, axes) => !!p && axes.every((a) => typeof p[a] === 'number');

/** True when the 5 taste values are a placeholder vector. */
export function isPlaceholderTaste(probs) {
  return hasAll(probs, TASTE_AXES) && Object.prototype.hasOwnProperty.call(list.taste, key(probs, TASTE_AXES));
}

/** True when the 6 aroma values are a placeholder vector. */
export function isPlaceholderAroma(probs) {
  return hasAll(probs, AROMA_AXES) && Object.prototype.hasOwnProperty.call(list.aroma, key(probs, AROMA_AXES));
}

/** Taste values present and not a placeholder? */
export const hasRealTaste = (probs) => hasAny(probs, TASTE_AXES) && !isPlaceholderTaste(probs);
/** Aroma values present and not a placeholder? */
export const hasRealAroma = (probs) => hasAny(probs, AROMA_AXES) && !isPlaceholderAroma(probs);
