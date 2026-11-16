/**
 * cocktailSubclusters.js — human names for the data-driven sub-groups in
 * the cocktail codex v2 data. The clustering emits numeric ids
 * ("2.3"); naming was deferred in docs/cocktail-codex-v2/v2.5-impl-spec.md
 * §1.2. Names are read off the members (2026-11-06, revised in DATA-6 after the cream and egg
 * drinks moved to their own family).
 *
 * Kept out of the generated JSON so a re-run of the emit script does not
 * overwrite them: they live in src/data/curation/cocktailOverrides.json ("subgroups"),
 * with the two sub-groups of the Flips & Cream Drinks family (DATA-6). Unknown ids fall back to the caller's own label.
 */
import COCKTAIL_OVERRIDES from './curation/cocktailOverrides.json' with { type: 'json' };

export const SUBCLUSTER_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(COCKTAIL_OVERRIDES.subgroups || {}).map(([id, d]) => [id, d.name])),
);

/** Name for a sub-group id, or `fallback` when the id is not known. */
export function subclusterName(id, fallback = null) {
  return SUBCLUSTER_NAMES[String(id)] || fallback;
}
