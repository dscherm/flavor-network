/**
 * clusterBucketOverlap.js — cross-tabulation of ML cluster × axis bucket.
 *
 * R19 Phase 4 (Tier E). For each ML cluster (via `node.clusterId`),
 * counts how many of its ingredients fall into each bucket of the
 * given axis. Drives the cluster overlap matrix in InsightDrawer —
 * lets the chef see which cooccurrence clusters align with which
 * categorical buckets and which span buckets evenly.
 *
 * Pure / one-shot. Returns a stable shape sorted by numeric cluster
 * id ascending so the consumer can render directly without re-sorting.
 *
 * @typedef {{
 *   id: number | string,
 *   label: string,
 *   total: number,
 *   counts: Record<string, number>,
 * }} ClusterRow
 *
 * @param {{
 *   nodes: Map<string, object>,
 *   bucketOf: Map<string, string>,
 *   bucketOrder?: string[],     // optional axis order; missing labels appended
 * }} ctx
 * @returns {{
 *   clusters: ClusterRow[],
 *   buckets: string[],
 *   counts: Record<string, Record<string, number>>,
 * }}
 */
export function computeClusterBucketOverlap(ctx) {
  if (!ctx || !ctx.nodes || !ctx.bucketOf) {
    return { clusters: [], buckets: [], counts: {} };
  }
  const { nodes, bucketOf } = ctx;
  const bucketsInOrder = Array.isArray(ctx.bucketOrder) ? ctx.bucketOrder.slice() : [];
  const bucketSet = new Set(bucketsInOrder);
  const byId = new Map();
  for (const [name, node] of nodes) {
    const cid = node?.clusterId;
    if (cid === null || cid === undefined) continue;
    const bucket = bucketOf.get(name);
    if (!bucket) continue;
    if (!bucketSet.has(bucket)) {
      bucketsInOrder.push(bucket);
      bucketSet.add(bucket);
    }
    let row = byId.get(cid);
    if (!row) {
      row = {
        id: cid,
        label: node.clusterLabel || `Cluster ${cid}`,
        total: 0,
        counts: {},
      };
      byId.set(cid, row);
    }
    row.total += 1;
    row.counts[bucket] = (row.counts[bucket] || 0) + 1;
  }
  const clusters = Array.from(byId.values()).sort((a, b) => {
    if (typeof a.id === 'number' && typeof b.id === 'number') return a.id - b.id;
    return String(a.id).localeCompare(String(b.id));
  });
  const counts = {};
  for (const row of clusters) counts[row.id] = row.counts;
  return { clusters, buckets: bucketsInOrder, counts };
}
