/**
 * bridgeRanker.js — global cross-bucket bridge ranking for a categorical axis.
 *
 * R19 Phase 3 (Tier D) — feeds the bridge-pulse animation that fires
 * when pullStrength crosses 0.5 (cooccurrence ↔ bucket dominance).
 *
 * Same cross-bucket scoring as `bucketStats.computeBucketStats`, but
 * ranked GLOBALLY across the axis (top-N nodes overall) rather than
 * one per bucket. The pulse surfaces "which ingredients are resisting
 * the layout you just dialed in" — the boundary spanners between
 * cooccurrence neighbors and bucket members.
 *
 * Score:
 *   bridgeScore(node) =
 *     sum over (peer in edges of node) of:
 *       edgeWeight * (1 if bucketOf(peer) !== bucketOf(node) else 0)
 *
 * Tie-breaks alphabetically by node name so reloads / crossings
 * surface the same ranking deterministically.
 */

/**
 * @typedef {{
 *   name: string,
 *   score: number,
 *   bucket: string,
 *   otherBucket: string,
 *   topPeer: string,
 *   topPeerStrength: number,
 * }} BridgeRank
 *
 * @param {string} axisKey  one of 'taste' | 'aromas' | 'cuisine' | 'season' | 'family'
 * @param {{
 *   nodes: Map<string, object>,
 *   edges: Array<{ source: string, target: string, strength?: number }>,
 *   bucketOf: Map<string, string>,
 * }} ctx
 * @param {{ topN?: number }} [opts]
 * @returns {BridgeRank[]}
 */
export function rankBridges(axisKey, ctx, opts = {}) {
  const topN = Math.max(1, opts.topN ?? 20);
  if (!ctx || !ctx.nodes || !ctx.bucketOf) return [];
  const { nodes, edges, bucketOf } = ctx;

  const per = new Map();
  if (Array.isArray(edges)) {
    for (const e of edges) {
      if (!e || !e.source || !e.target) continue;
      const sB = bucketOf.get(e.source);
      const tB = bucketOf.get(e.target);
      if (!sB || !tB || sB === tB) continue;
      const w = e.strength || 0;
      let rs = per.get(e.source);
      if (!rs) {
        rs = { total: 0, topPeer: null, topPeerStrength: -1, otherBucket: null };
        per.set(e.source, rs);
      }
      rs.total += w;
      if (
        w > rs.topPeerStrength ||
        (w === rs.topPeerStrength && rs.topPeer !== null && String(e.target).localeCompare(rs.topPeer) < 0)
      ) {
        rs.topPeerStrength = w;
        rs.topPeer = e.target;
        rs.otherBucket = tB;
      }
      let rt = per.get(e.target);
      if (!rt) {
        rt = { total: 0, topPeer: null, topPeerStrength: -1, otherBucket: null };
        per.set(e.target, rt);
      }
      rt.total += w;
      if (
        w > rt.topPeerStrength ||
        (w === rt.topPeerStrength && rt.topPeer !== null && String(e.source).localeCompare(rt.topPeer) < 0)
      ) {
        rt.topPeerStrength = w;
        rt.topPeer = e.source;
        rt.otherBucket = sB;
      }
    }
  }

  const out = [];
  for (const [name, r] of per) {
    if (!r.topPeer) continue;
    if (!nodes.has(name)) continue;
    out.push({
      name,
      score: r.total,
      bucket: bucketOf.get(name),
      otherBucket: r.otherBucket,
      topPeer: r.topPeer,
      topPeerStrength: r.topPeerStrength,
    });
  }
  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.name).localeCompare(String(b.name));
  });
  return out.slice(0, topN);
}
