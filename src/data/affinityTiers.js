/**
 * Pure tier math for the Flavor Affinity Mode (α-mode).
 *
 * Two exports:
 *   - `tierFor(a, b, ctx)` — returns the native tier for a single
 *     ingredient pair (3 = ★★★ chemistry-bridged, 2 = ★★ strong,
 *     1 = ★ good, null = untiered). Strict branch when both
 *     ingredients have GNN compound data; lenient branch when at
 *     least one side does not.
 *   - `topAffinities(focal, ctx, opts)` — returns up to 30 ranked
 *     affinity candidates for a focal ingredient, sliced into rings
 *     [5, 10, 15] by strength rank. Per User Decision U4a, ring index
 *     is determined by strength rank (NOT native tier); edge color is
 *     determined by native tier. Both pieces of information ride along
 *     on each result so the renderer can place spheres at ring radii
 *     and color edges by tier.
 *
 * Strength thresholds come from `ctx.affinityThresholds` — recalibrated
 * per session by `affinityThresholds.js` (User Decision U1).
 *
 * `bridge(a, b)` is the literal `bridge_compounds.json[a|b].bridges[0].name`
 * lookup per the spec (line 55). U1 preserves this; only the strength
 * thresholds were tuned.
 *
 * See `.omc/plans/ralplan-flavor-affinity-mode.md` for the full plan.
 */

/**
 * @typedef {Object} AffinityCtx
 * @property {Map<string, number>} pairingStrength  "a|b" → strength in [0,1]
 * @property {Map<string, string[]>} top5            ingredient → top-5 compound names
 * @property {Map<string, {bridges: Array<{name: string}>}>} bridgeCompoundIndex
 * @property {{star3: number, star2: number, star1: number}} affinityThresholds
 * @property {{edges: Array<{source: string, target: string} | {ingredientA: string, ingredientB: string}>}} graph
 */

/**
 * @param {string} a
 * @param {string} b
 * @param {AffinityCtx} ctx
 * @returns {{tier: 3|2|1|null, strength: number, bridge: string|null}}
 */
export function tierFor(a, b, ctx) {
  const key = `${a}|${b}`;
  const altKey = `${b}|${a}`;
  const ps = ctx.pairingStrength;
  const strength =
    (ps && (ps.get(key) ?? ps.get(altKey))) ?? 0;
  if (strength <= 0) return { tier: null, strength: 0, bridge: null };

  const T = ctx.affinityThresholds;
  const top5A = ctx.top5?.get(a) ?? null;
  const top5B = ctx.top5?.get(b) ?? null;

  if (top5A && top5B) {
    // Strict branch: both ingredients have GNN compound predictions.
    // ★★★ requires the curated bridge_compounds entry's first bridge
    // to appear in BOTH top-5 lists.
    const bridgeEntry =
      ctx.bridgeCompoundIndex?.get(key) ??
      ctx.bridgeCompoundIndex?.get(altKey) ??
      null;
    const bridge =
      bridgeEntry?.bridges?.[0]?.name ?? null;
    if (
      strength >= T.star3 &&
      bridge &&
      top5A.includes(bridge) &&
      top5B.includes(bridge)
    ) {
      return { tier: 3, strength, bridge };
    }
    if (strength >= T.star2) return { tier: 2, strength, bridge: null };
    if (strength >= T.star1) return { tier: 1, strength, bridge: null };
    return { tier: null, strength, bridge: null };
  }

  // Lenient branch: at least one side has no GNN compound data.
  // The 1,123 ingredients without GNN coverage can still earn ★★★
  // when their pairing strength is exceptional (≥ star3 quantile).
  if (strength >= T.star3) return { tier: 3, strength, bridge: null };
  if (strength >= T.star2) return { tier: 2, strength, bridge: null };
  if (strength >= T.star1) return { tier: 1, strength, bridge: null };
  return { tier: null, strength, bridge: null };
}

/**
 * @param {string} focal
 * @param {AffinityCtx} ctx
 * @param {{N3?: number, N2?: number, N1?: number}} [opts]
 * @returns {Array<{name: string, tier: 3|2|1, strength: number, bridge: string|null, ringIdx: 3|2|1}>}
 */
export function topAffinities(focal, ctx, opts = {}) {
  const { N3 = 5, N2 = 10, N1 = 15 } = opts;
  const edges = ctx?.graph?.edges;
  if (!Array.isArray(edges) || edges.length === 0) return [];

  // Collect every neighbor of `focal` whose pair has a non-null tier.
  // Untiered candidates (strength below star1 quantile) are dropped —
  // those connections aren't worth showing.
  const candidates = [];
  const seen = new Set();
  for (const edge of edges) {
    // Support both shapes: graph-builder's {source,target} and the raw
    // pairings.json {ingredientA, ingredientB}.
    const a = edge.source ?? edge.ingredientA;
    const b = edge.target ?? edge.ingredientB;
    let other = null;
    if (a === focal) other = b;
    else if (b === focal) other = a;
    if (!other || seen.has(other)) continue;
    seen.add(other);

    const t = tierFor(focal, other, ctx);
    if (!t.tier) continue;
    candidates.push({ name: other, ...t });
  }

  // Per U4a: ring assignment is by strength rank, NOT by native tier.
  // Edge color (gold/silver/bronze) is carried on each candidate via
  // the `tier` field; the renderer uses `ringIdx` for radius and
  // `tier` for color. This produces a fully-populated visual where
  // 98.7% of ingredients fill all 5 ★★★ slots, vs. 5.7% under the
  // literal-spec ring-by-tier reading.
  candidates.sort((a, b) => b.strength - a.strength);

  const ring3 = candidates.slice(0, N3).map((c) => ({ ...c, ringIdx: 3 }));
  const ring2 = candidates
    .slice(N3, N3 + N2)
    .map((c) => ({ ...c, ringIdx: 2 }));
  const ring1 = candidates
    .slice(N3 + N2, N3 + N2 + N1)
    .map((c) => ({ ...c, ringIdx: 1 }));

  return [...ring3, ...ring2, ...ring1];
}
