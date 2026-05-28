/**
 * tier1Overrides.js — chef-eye corrections for GNN-derived primary
 * Tier-1 picks, plus the alliaceous_green sub-axis introduced 2026-05-26.
 *
 * Why this exists
 * ---------------
 * After N2-AGG-RECAL re-balanced the GNN picker, a chef audit of the
 * 74 GNN-picked greens revealed two classes of false positives the
 * model can't fix on its own:
 *
 *  1. Cross-category mis-classifications. Truffle (geosmin-driven
 *     earthy/musky), beetroot (geosmin), rhubarb (tart/fruity),
 *     cranberry products (fruity-tart), chardonnay wine (fruity),
 *     goat's milk (lactic/fatty) all surface as "green" because the
 *     odor_green head fires on shared aldehyde / C6-volatile signal
 *     that doesn't carry the chef's "fresh-cut-grass" semantic. The
 *     override map below pins these to their chef-correct Tier-1.
 *
 *  2. Alliaceous → green. Onion / garlic / leek / chive / shallot /
 *     scallion / ramp / asafoetida all share allyl-sulfide chemistry
 *     that produces pungent-green aroma analogous to crushed plant
 *     tissue. The chef CSV separates "alliaceous green" from plain
 *     "green," but the BRISCIONE 5-axis palette doesn't carry that
 *     distinction — both render with the same emerald hue. The
 *     allium override below forces these ingredients to 'green'
 *     whenever the odor_green head fires at all, preventing the
 *     surplus-ratio tie-break from leaking them into woody/fatty
 *     where the chemistry isn't a clean fit either.
 *
 * Integration
 * -----------
 * `resolvePrimaryTier1(name, probs, thresholds)` runs in useProData
 * AFTER the chef-graph layer (so chef-tagged ingredients are untouched)
 * and replaces the bare `gnnPrimaryTier1` call. Order of operations:
 *   1. Hard override (TIER1_OVERRIDES) — pinned chef correction
 *   2. Allium detection — if name has an allium token AND green fires,
 *      force the pick to 'green' (preventing leakage to woody/fatty
 *      when an unrelated head out-scores green on the surplus tie-break)
 *   3. Standard gnnPrimaryTier1 fallback
 */

import { gnnPrimaryTier1 } from './primaryTier1.js';

/**
 * Hard-pinned Tier-1 corrections for ingredients the GNN mis-classifies.
 * Keys are normalized: lowercase, single-space-collapsed.
 *
 * Each entry should be a chef-audited correction. The override applies
 * ONLY when the chef-graph layer doesn't already supply a tier1 — these
 * are exclusively GNN-path corrections.
 */
export const TIER1_OVERRIDES = {
  // Geosmin-driven earthy / musky — GNN reads green on shared aldehyde signal
  'truffle':       'woody',
  'truffle oil':   'woody',
  'beetroot':      'woody',

  // Tart/fruity foods the GNN mis-reads as green
  'rhubarb':                'fruity',
  'cranberry':              'fruity',
  'cranberry sauce':        'fruity',
  'cranberry jelly':        'fruity',
  'cranberry juice':        'fruity',
  'cranberry juice cocktail':       'fruity',
  'cranberry juice concentrate':    'fruity',
  'cranberry-orange relish':        'fruity',
  'cranberry-raspberry juice':      'fruity',
  'cranberry-apple juice':          'fruity',
  'cranberry cocktail':             'fruity',
  'fluid cranberry juice':          'fruity',
  'cranberry bean':                 'fruity',  // legume but mapped to fruity over green per chef
  'chardonnay wine':       'fruity',

  // Lactic / dairy — was 'fatty' before the 2026-05-27 chef-vocab
  // expansion renamed the display key to 'creamy'.
  "goat's milk": 'creamy',
};

/**
 * Allium tokens that trigger the alliaceous_green sub-axis. Word-boundary
 * matched against the lowercase normalized name so "onion powder" hits
 * but "onion-grass" (not a real ingredient) wouldn't false-positive on
 * partial overlap. Order-sensitive: longer first to avoid 'ramp' picking
 * up 'ramped'.
 */
export const ALLIUM_TOKENS = [
  'shallot', 'scallion', 'chive', 'garlic', 'onion', 'leek',
  'asafoetida', 'ramp',
];

const ALLIUM_RE = new RegExp(`\\b(${ALLIUM_TOKENS.join('|')})\\b`, 'i');

/**
 * @returns true when name contains an allium token (word-boundary match).
 */
export function isAlliaceous(name) {
  if (!name || typeof name !== 'string') return false;
  return ALLIUM_RE.test(name);
}

/**
 * Resolve the primary Tier-1 for a GNN-path ingredient (chef-graph
 * misses or null entry). Layers:
 *
 *  1. TIER1_OVERRIDES — chef-pinned correction wins (still respects
 *     "spicy" exclusion — overrides target the 5 BRISCIONE heads only).
 *  2. Alliaceous detection — if name has an allium token AND the GNN's
 *     green head fires above its threshold, force the pick to 'green'.
 *     The "green head fires" gate ensures we don't tag e.g.
 *     "onion-glazed donut" as green when its chemistry isn't really
 *     green/sulfurous. Without this layer the surplus-ratio tie-break
 *     would let woody/fatty win on many onion variants that fire
 *     marginally above green's threshold.
 *  3. gnnPrimaryTier1 fallback (surplus-ratio tie-break per N2-AGG-RECAL).
 *
 * @param {string} name — normalized ingredient name
 * @param {object|null} probs — gnnProbs object with odor_<head> keys
 * @param {object} tier1Thresholds — output of buildTier1Thresholds
 * @returns {string|null} one of the 5 GNN-pickable chef-vocab labels
 *   (fruity, floral, green, woody, creamy) — or one of the 13 chef
 *   labels when TIER1_OVERRIDES pins a chef-only category — or null
 *   when no head can be resolved.
 */
export function resolvePrimaryTier1(name, probs, tier1Thresholds) {
  const norm = (name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (norm && TIER1_OVERRIDES[norm]) {
    return TIER1_OVERRIDES[norm];
  }
  if (isAlliaceous(norm)) {
    const greenP = probs?.odor_green;
    const greenT = tier1Thresholds?.green;
    if (typeof greenP === 'number' && typeof greenT === 'number'
        && greenT > 0 && greenP >= greenT) {
      return 'green';
    }
  }
  return gnnPrimaryTier1(probs, tier1Thresholds);
}
