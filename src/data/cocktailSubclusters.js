/**
 * cocktailSubclusters.js — human names for the 15 data-driven sub-groups in
 * `public/data/cocktail_codex_v2.json`. The clustering emits numeric ids
 * ("2.3"); naming was deferred in docs/cocktail-codex-v2/v2.5-impl-spec.md
 * §1.2. Names are read off the members (2026-11-06), e.g. 2.2 holds
 * Alexander, Grasshopper and Golden Cadillac, so it is "Dessert & cream".
 *
 * Kept out of the generated JSON so a re-run of the emit script does not
 * overwrite them. Unknown ids fall back to the caller's own label.
 */
export const SUBCLUSTER_NAMES = Object.freeze({
  '0.0': 'Creamy tropical',
  '0.1': 'Punches & frozen sours',
  '1.0': 'Juice highballs',
  '1.1': 'Fizzes & flips',
  '1.2': 'Collins & coolers',
  '2.0': 'Rich & savoury sours',
  '2.1': 'Citrus-liqueur sours',
  '2.2': 'Dessert & cream',
  '2.3': 'Classic sours',
  '3.0': 'Stirred originals',
  '3.1': 'Old-fashioned style',
  '4.0': 'Dry martinis',
  '4.1': 'Martinis & Manhattans',
  '5.0': 'Spritzes & aperitivi',
  '5.1': 'Brunch & long drinks',
});

/** Name for a sub-group id, or `fallback` when the id is not known. */
export function subclusterName(id, fallback = null) {
  return SUBCLUSTER_NAMES[String(id)] || fallback;
}
