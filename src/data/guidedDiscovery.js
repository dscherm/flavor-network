/**
 * guidedDiscovery.js — bubble registry + bubble-to-primitive mapping for
 * Guided Discovery Screen 1 (Phase 3).
 *
 * Each bubble is a self-contained "thought" the user can stack. The
 * registry declares:
 *   - which existing primitive renders inside the disclosure (subUI),
 *   - which morph axis the bubble corresponds to (axisHint), and
 *   - the human-readable label.
 *
 * The bubbleStack lives LOCAL to GuidedDiscoveryStart (per Executor
 * Handoff Constraint #4). When the user hits "Show me pairings", the
 * stack is forwarded to GuidedDiscoveryResults; when they then choose
 * "Explore in the network", `deriveFilterStackFromBubbles()` is the
 * ONLY translation into App.jsx's network filterStack.
 */

// Bubble registry — the canonical 8 thoughts surfaced on Screen 1.
// Each `subUI` is a key the renderer (GuidedDiscoveryStart) maps to
// an existing primitive (SearchBar, FilterPillRow, inline chips, …).
export const BUBBLE_REGISTRY = [
  {
    key: 'ingredient',
    label: 'Starts with a specific ingredient',
    subUI: 'ingredient-search',
    axisHint: null,
  },
  {
    key: 'season',
    label: 'Goes with a season',
    subUI: 'season-chips',
    axisHint: 'season',
  },
  {
    key: 'cuisine',
    label: 'Goes with a cuisine',
    subUI: 'cuisine-pills',
    axisHint: 'cuisine',
  },
  {
    key: 'meat',
    label: 'Is for a meat or protein',
    subUI: 'meat-chips',
    axisHint: 'family',
  },
  {
    key: 'aroma',
    label: 'Has a specific aroma family',
    subUI: 'aroma-pills',
    axisHint: 'aroma',
  },
  {
    key: 'cocktail',
    label: 'Is for a cocktail',
    subUI: 'scope-toggle',
    axisHint: 'cocktail-scope',
  },
  {
    key: 'sauce',
    label: 'Is for a sauce',
    subUI: 'scope-toggle',
    axisHint: 'sauce-scope',
  },
  {
    key: 'dessert',
    label: 'Is for a dessert',
    subUI: 'flag-toggle',
    axisHint: null,
  },
  {
    key: 'dietary',
    label: 'Has dietary restrictions',
    subUI: 'dietary-chips',
    // No axis hint — dietary restrictions filter the candidate pool
    // before scoring; they don't shape the network morph.
    axisHint: null,
  },
];

// Inline season values rendered as chips by the season bubble.
export const SEASON_VALUES = ['spring', 'summer', 'fall', 'winter'];

// Inline meat / protein values rendered as chips by the meat bubble.
export const MEAT_VALUES = ['beef', 'pork', 'chicken', 'fish', 'lamb', 'game'];

/**
 * Lookup a bubble config by key. O(N) over the 8-entry registry which
 * is fine — callers tend to hit one bubble per render.
 */
export function getBubble(key) {
  return BUBBLE_REGISTRY.find((b) => b.key === key) || null;
}

/**
 * Translate the LOCAL bubbleStack into a Filter[] suitable for
 * App.jsx's `setFilterStack`. Drops bubbles whose axisHint is null
 * (ingredient / dessert have no direct network-filter analog yet —
 * they shape the curated wheel in Phase 4 instead).
 *
 * Per Constraint #4 this is the ONLY bridge between local
 * bubbleFilterStack and App.jsx's network filter stack. Called from
 * the explicit "Explore in the network" CTA handler in App.jsx.
 *
 * Order is preserved: the most-recent bubble becomes the most-recent
 * filter, which determines the morph axis in LivingArchView.
 */
export function deriveFilterStackFromBubbles(bubbleStack) {
  if (!Array.isArray(bubbleStack)) return [];
  const out = [];
  const seen = new Set();
  for (const item of bubbleStack) {
    const axis = item?.axisHint;
    if (!axis) continue;
    if (seen.has(axis)) continue;
    seen.add(axis);
    out.push(axis);
  }
  return out;
}
