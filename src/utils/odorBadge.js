/**
 * odorBadge — look up the dominant shared odor tag for a pairing.
 *
 * Data source: public/proDataset/bridge_compounds.json (FlavorDB molecule-
 * level tags, human-auditable). We DO NOT use gnn_entropy.json odor heads
 * yet — they have collapse issues (see .claude/.chemdataset-status.md).
 *
 * Returned shape: { tag: string, count: number, total: number } or null.
 *   - tag   — the most common bridge-compound tag across the pair's shared
 *             molecules (e.g. "citrus", "minty", "woody").
 *   - count — how many bridge compounds carried that tag.
 *   - total — how many bridge compounds the pair has in total.
 *
 * Returns null when:
 *   - bridgeCompounds is missing,
 *   - the pair has no entry in bridge_compounds.json,
 *   - no tag dominates ≥ 30% of the pair's bridges.
 */

const MIN_DOMINANCE = 0.3;
const MIN_COUNT = 2;

// Tags that aren't useful as "this is why they pair" labels.
const UNINFORMATIVE_TAGS = new Set(['odorless', 'tasteless', 'none', 'unknown']);

export function getOdorBadge(a, b, bridgeCompounds) {
  if (!a || !b || !bridgeCompounds) return null;
  const entry = bridgeCompounds[`${a}|${b}`] || bridgeCompounds[`${b}|${a}`];
  const bridges = entry?.bridges;
  if (!Array.isArray(bridges) || bridges.length === 0) return null;

  const counts = new Map();
  for (const bridge of bridges) {
    const tags = bridge.tags;
    if (!Array.isArray(tags)) continue;
    for (const t of tags) {
      if (UNINFORMATIVE_TAGS.has(t)) continue;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  if (counts.size === 0) return null;

  let bestTag = null;
  let bestCount = 0;
  for (const [tag, count] of counts) {
    if (count > bestCount) {
      bestTag = tag;
      bestCount = count;
    }
  }

  const total = bridges.length;
  if (bestCount < MIN_COUNT) return null;
  if (bestCount / total < MIN_DOMINANCE) return null;

  // Collect the specific compounds that carry the winning tag so the UI
  // can explain *why* the badge appears.
  const compoundNames = [];
  for (const bridge of bridges) {
    if (Array.isArray(bridge.tags) && bridge.tags.includes(bestTag) && bridge.name) {
      compoundNames.push(bridge.name);
    }
  }

  return { tag: bestTag, count: bestCount, total, compounds: compoundNames };
}
