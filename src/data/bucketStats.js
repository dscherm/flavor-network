/**
 * bucketStats.js — per-bucket descriptive stats for a categorical axis.
 *
 * R19 Phase 2 (Tier B) — feeds the enriched pole-hover tooltip in
 * LivingArchView. For every bucket of the given axis, compute:
 *   - count       : number of nodes in the bucket
 *   - topMembers  : up to `topN` member names, sorted by pairingCount desc
 *   - bridge      : the bucket member with the strongest cumulative
 *                   cross-bucket cooccurrence weight, plus its
 *                   strongest cross-bucket peer (the "connector"
 *                   between this bucket and a neighbor bucket). null
 *                   when no edges land in a different bucket.
 *
 * Computation is pure / one-shot — safe to call once at scene-setup
 * per categorical axis. Runtime is O(N) over nodes + O(E) over edges
 * per call. For the current corpus (3,913 nodes × 48,588 edges × 5
 * axes ≈ 250k operations), this stays well under a frame budget.
 *
 * Bridge score (from the Phase 1 brainstorm):
 *   bridgeScore(node) =
 *     sum over (peer in edges of node) of:
 *       edgeWeight * (1 if bucketOf(peer) !== bucketOf(node) else 0)
 * The bridge per bucket = argmax(bridgeScore) restricted to the bucket
 * members. Tie-breaks by alphabetical name so the surfaced bridge is
 * deterministic across reloads.
 */

/**
 * @typedef {{
 *   name: string,
 *   otherBucket: string,
 *   topPeer: string,
 *   strength: number,
 * }} Bridge
 *
 * @typedef {{
 *   label: string,
 *   count: number,
 *   topMembers: string[],
 *   bridge: Bridge | null,
 * }} BucketStat
 */

/**
 * @param {string} axisKey  one of 'taste' | 'aromas' | 'cuisine' | 'season' | 'family'
 * @param {{
 *   nodes: Map<string, object>,
 *   edges: Array<{ source: string, target: string, strength?: number }>,
 *   bucketOf: Map<string, string>,
 * }} ctx
 * @param {{ topN?: number }} [opts]
 * @returns {Map<string, BucketStat>}
 */
export function computeBucketStats(axisKey, ctx, opts = {}) {
  const topN = Math.max(1, opts.topN ?? 3);
  const result = new Map();
  if (!ctx || !ctx.nodes || !ctx.bucketOf) return result;
  const { nodes, edges, bucketOf } = ctx;

  // Group nodes by bucket.
  const byBucket = new Map();
  for (const [name, node] of nodes) {
    const label = bucketOf.get(name);
    if (!label) continue;
    if (!byBucket.has(label)) byBucket.set(label, []);
    byBucket.get(label).push(node);
  }

  // Single O(E) pass building per-node cross-bucket edge lists.
  const crossEdgesByNode = new Map();
  if (Array.isArray(edges)) {
    for (const e of edges) {
      if (!e || !e.source || !e.target) continue;
      const sBucket = bucketOf.get(e.source);
      const tBucket = bucketOf.get(e.target);
      if (!sBucket || !tBucket || sBucket === tBucket) continue;
      const strength = e.strength || 0;
      if (!crossEdgesByNode.has(e.source)) crossEdgesByNode.set(e.source, []);
      crossEdgesByNode.get(e.source).push({ peer: e.target, otherBucket: tBucket, strength });
      if (!crossEdgesByNode.has(e.target)) crossEdgesByNode.set(e.target, []);
      crossEdgesByNode.get(e.target).push({ peer: e.source, otherBucket: sBucket, strength });
    }
  }

  for (const [label, members] of byBucket) {
    const topMembers = members
      .slice()
      .sort((a, b) => {
        const dp = (b.pairingCount || 0) - (a.pairingCount || 0);
        if (dp !== 0) return dp;
        return String(a.name).localeCompare(String(b.name));
      })
      .slice(0, topN)
      .map((n) => n.name);

    let bridge = null;
    let bestScore = 0;
    let bestName = null;
    for (const node of members) {
      const cross = crossEdgesByNode.get(node.name);
      if (!cross || cross.length === 0) continue;
      let total = 0;
      let topPeer = null;
      let topPeerStrength = -1;
      let topPeerBucket = null;
      for (const c of cross) {
        total += c.strength;
        if (
          c.strength > topPeerStrength ||
          (c.strength === topPeerStrength && (topPeer === null || String(c.peer).localeCompare(String(topPeer)) < 0))
        ) {
          topPeerStrength = c.strength;
          topPeer = c.peer;
          topPeerBucket = c.otherBucket;
        }
      }
      if (!topPeer) continue;
      const better =
        total > bestScore ||
        (total === bestScore && bestName !== null && String(node.name).localeCompare(bestName) < 0);
      if (better) {
        bestScore = total;
        bestName = node.name;
        bridge = {
          name: node.name,
          otherBucket: topPeerBucket,
          topPeer,
          strength: topPeerStrength,
        };
      }
    }

    result.set(label, {
      label,
      count: members.length,
      topMembers,
      bridge,
    });
  }
  return result;
}
