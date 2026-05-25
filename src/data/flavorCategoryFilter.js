/**
 * flavorCategoryFilter — visibility predicate for the v3 P-C4
 * `flavor-category` scope pill.
 *
 * The scope pill restricts the network to the 89 chef-verified
 * flavor-graph ingredients (those with a non-null `node.flavorGraph`
 * after useProData decoration). Long-tail GNN-only ingredients are
 * hidden while the pill is active. Mirrors the `cocktail-scope` /
 * `sauce-scope` behavior: axis === null, visibility-only, no morph.
 *
 * `matchesFlavorCategory(node, term?)` optionally accepts a term and
 * matches against any of T1/T2/T3/leaves arrays — surfaced for a
 * future term-selector UI but defaults to the chef-curated scope
 * (term === undefined → "ingredient is chef-curated").
 */

export function matchesFlavorCategory(node, term) {
  if (!node?.flavorGraph) return false;
  if (term === undefined || term === null || term === '') return true;
  const fg = node.flavorGraph;
  const t = String(term).toLowerCase();
  for (const arr of [fg.tier1, fg.tier2, fg.tier3, fg.leaves]) {
    if (Array.isArray(arr) && arr.some(v => String(v).toLowerCase() === t)) {
      return true;
    }
  }
  return false;
}

/**
 * Build a visibility map keyed by node.name. Returns null when the
 * filter is inactive so the renderer can short-circuit.
 */
export function buildFlavorCategoryMask(nodes, active, term) {
  if (!active) return null;
  const mask = new Map();
  for (const [name, node] of nodes) {
    mask.set(name, matchesFlavorCategory(node, term));
  }
  return mask;
}
