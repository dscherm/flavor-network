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

/**
 * Surprising affinities — molecularly-bridged pairings whose
 * cooccurrence strength sits BELOW the ★ threshold. The chemistry
 * says these belong together (the bridge compound appears in both
 * ingredients' top-5 GNN predictions) but the recipe corpus hasn't
 * validated them yet, so they're ungraded by `tierFor`. Surface
 * them as a "Surprising" 4th tier so users can explore unexpected
 * pairings backed by molecular evidence rather than corpus
 * frequency.
 *
 * Returns ringIdx=0 candidates so callers (AffinityPanel) can
 * place them in a 4th column without disturbing the existing
 * ring 3/2/1 placements consumed by AffinityMode 3D rendering.
 *
 * @param {string} focal
 * @param {AffinityCtx} ctx
 * @param {{N?: number}} [opts]
 * @returns {Array<{name: string, tier: null, strength: number, bridge: string|null, ringIdx: 0}>}
 */
// Compound doc-frequency cache — keyed by the top5 Map reference so
// it gets rebuilt iff the underlying data swaps. Universal-bio
// compounds (Ethanol 72%, L-Histidine 70%, Caffeine 68%) appear in
// almost every ingredient's GNN top-5 and are useless as "surprise"
// bridges; the cache lets us cheaply drop them.
let _docFreqCache = null;
let _docFreqCacheKey = null;
function getCompoundDocFrequency(top5) {
  if (_docFreqCacheKey === top5 && _docFreqCache) return _docFreqCache;
  const df = new Map();
  for (const list of top5.values()) {
    if (!Array.isArray(list)) continue;
    const seen = new Set();
    for (const c of list) {
      if (seen.has(c)) continue;
      seen.add(c);
      df.set(c, (df.get(c) || 0) + 1);
    }
  }
  _docFreqCache = df;
  _docFreqCacheKey = top5;
  return df;
}

export function surprisingAffinities(focal, ctx, opts = {}) {
  const { N = 12, strict = false } = opts;
  const idx = ctx?.bridgeCompoundIndex;
  if (!idx) return [];
  const top5 = ctx?.top5;
  const top5Focal = top5?.get(focal) ?? null;
  const T = ctx.affinityThresholds || {};
  const star1 = T.star1 ?? 0;
  const ps = ctx.pairingStrength;
  // Doc-frequency-based surprise budget. A "surprising" bridge must
  // be a compound that's rare across the corpus — drop bridges
  // appearing in >10% of GNN top-5 lists (Ethanol/Caffeine/etc.).
  const docFreq = top5 ? getCompoundDocFrequency(top5) : null;
  const totalIngredients = top5 ? top5.size : 0;
  const MAX_BRIDGE_DF = totalIngredients > 0 ? Math.ceil(totalIngredients * 0.10) : Infinity;
  const isCommonCompound = (compound) => {
    if (!docFreq || !compound) return false;
    return (docFreq.get(compound) ?? 0) > MAX_BRIDGE_DF;
  };
  // Cluster-distance bias — same-cluster pairs aren't surprising
  // (they share the cluster's defining compounds by construction).
  // Cross-cluster gets ranked first; same-cluster only fills if we
  // run out of cross-cluster candidates.
  const nodes = ctx?.graph?.nodes;
  const focalCluster = nodes?.get?.(focal)?.clusterId;

  // Three passes. All apply the rarity gate (drop bridges with
  // DF > 10% of corpus) so universal-bio compounds (Ethanol 72%,
  // Caffeine 68%, etc.) never surface as "surprising" bridges.
  //
  //   Pass 1: strict — bridge_compounds entry whose curated bridge
  //           is in BOTH ingredients' GNN top-5. Highest-confidence
  //           "your tongue would be surprised."
  //   Pass 2: permissive bridge_compounds — any curated entry
  //           involving the focal, even when top-5 doesn't confirm.
  //           Covers GNN-less ingredients.
  //   Pass 3: GNN top-5 overlap — for ingredients without curated
  //           bridge entries (like bourbon, 0 entries), find
  //           candidates whose GNN top-5 shares ≥1 RARE compound
  //           with the focal's. Pick the rarest as the bridge.
  //
  // Ranking: cross-cluster candidates first (truly surprising — the
  // ingredients are in different flavor neighborhoods), then by
  // inverse-DF (rarer bridge = higher rank).
  const candidates = [];
  const seen = new Set();
  const otherCluster = (other) => nodes?.get?.(other)?.clusterId;

  const consider = (other, bridge, strength, source) => {
    if (!other || seen.has(other) || other === focal) return;
    // Curated bridge_compounds entries (source='strict' or 'curated') keep
    // canonical high-strength non-Western pairings — lemongrass+makrut lime
    // leave, fish sauce+lemongrass, mirin+sake, paella rice+saffron. These
    // are corpus-frequent within their cuisine but absent from classical
    // Anglo-French books, so they ARE surprising to a Western user even
    // though strength saturates. The strength gate only applies to the
    // weaker gnn-overlap heuristic pass.
    const isCurated = source === 'strict' || source === 'curated';
    if (!isCurated && strength >= star1) return;
    if (isCommonCompound(bridge)) return; // hub-noise compound; useless as surprise signal
    seen.add(other);
    const oc = otherCluster(other);
    const crossCluster =
      focalCluster !== undefined && oc !== undefined && focalCluster !== oc;
    const bridgeDF = docFreq?.get?.(bridge) ?? Infinity;
    candidates.push({
      name: other,
      tier: null,
      strength,
      bridge,
      bridgeDF,
      crossCluster,
      source,
      ringIdx: 0,
    });
  };

  // Pass 1: strict — both ingredients have the curated bridge in
  // their top-5.
  if (top5Focal && top5Focal.length > 0) {
    for (const [key, val] of idx.entries()) {
      if (typeof key !== 'string') continue;
      const sep = key.indexOf('|');
      if (sep < 0) continue;
      const a = key.slice(0, sep);
      const b = key.slice(sep + 1);
      const other = a === focal ? b : (b === focal ? a : null);
      if (!other) continue;
      const bridge = val?.bridges?.[0]?.name ?? null;
      if (!bridge) continue;
      const top5Other = top5.get(other);
      if (!top5Other || !top5Focal.includes(bridge) || !top5Other.includes(bridge)) continue;
      const strength =
        (ps && (ps.get(`${focal}|${other}`) ?? ps.get(`${other}|${focal}`))) ?? 0;
      consider(other, bridge, strength, 'strict');
    }
  }

  // Pass 2: permissive — any bridge_compounds entry mentioning focal.
  // Also matches PREFIX variants ("butter|cream" matches focal='butter';
  // "powdered coffee|powdered cocoa" matches focal='coffee') so
  // ingredients with multi-word entries in the curated dictionary
  // still surface their bridges.
  if (!strict) {
    const focalToken = ` ${focal} `;
    const focalPrefix = `${focal} `;
    const focalSuffix = ` ${focal}`;
    const matchesFocal = (s) =>
      s === focal ||
      s.startsWith(focalPrefix) ||
      s.endsWith(focalSuffix) ||
      s.includes(focalToken);
    for (const [key, val] of idx.entries()) {
      if (typeof key !== 'string') continue;
      const sep = key.indexOf('|');
      if (sep < 0) continue;
      const a = key.slice(0, sep);
      const b = key.slice(sep + 1);
      let other = null;
      if (matchesFocal(a)) other = b;
      else if (matchesFocal(b)) other = a;
      if (!other) continue;
      const bridge = val?.bridges?.[0]?.name ?? null;
      if (!bridge) continue;
      const strength =
        (ps && (ps.get(`${focal}|${other}`) ?? ps.get(`${other}|${focal}`))) ?? 0;
      consider(other, bridge, strength, 'curated');
    }
  }

  // Pass 3: GNN top-5 overlap. For each candidate, find ALL shared
  // compounds and pick the RAREST as the bridge — that's the most
  // surprising flavor link. Common compounds are filtered by the
  // isCommonCompound guard inside consider(). Candidates whose top-5
  // overlaps too heavily with focal's are flavor-twins, not
  // surprising — those get dropped (tomato vs tomato sauce, basil
  // vs basil leaf).
  if (!strict && top5Focal && top5Focal.length > 0 && top5) {
    const focalSet = new Set(top5Focal);
    const MAX_TOP5_OVERLAP = 3; // 4+ shared = flavor-twin, not surprise
    // Two-pass DF gate: 10% first, then relax to 25% if we found
    // nothing (some focals have universal-bio top-5 only — coffee,
    // butter, etc. — and would otherwise return zero results).
    const cutoffs = [MAX_BRIDGE_DF, Math.max(MAX_BRIDGE_DF, Math.ceil(totalIngredients * 0.25))];
    let prevCount = candidates.length;
    for (const cutoff of cutoffs) {
      for (const [other, otherTop5] of top5.entries()) {
        if (other === focal || seen.has(other)) continue;
        if (!Array.isArray(otherTop5) || otherTop5.length === 0) continue;
        // Count shared compounds; drop near-duplicates.
        let sharedCount = 0;
        let bestBridge = null;
        let bestDF = Infinity;
        for (const c of otherTop5) {
          if (!focalSet.has(c)) continue;
          sharedCount += 1;
          const cdf = docFreq?.get?.(c) ?? Infinity;
          if (cdf > cutoff) continue;
          if (cdf < bestDF) { bestDF = cdf; bestBridge = c; }
        }
        if (sharedCount > MAX_TOP5_OVERLAP) continue;
        if (!bestBridge) continue;
        const strength =
          (ps && (ps.get(`${focal}|${other}`) ?? ps.get(`${other}|${focal}`))) ?? 0;
        consider(other, bestBridge, strength, 'gnn-overlap');
      }
      // Stop at the first cutoff that yields any results.
      if (candidates.length > prevCount) break;
    }
  }

  // Pass 4: cuisine-anchored pairings (Stage 4 ingestion). Pulls in
  // pairs from cuisine_pairings.json where the focal appears and the
  // cuisine signal is dominant (primary >= 1.5× secondary recipePct).
  // These are real chef-validated combos the chemistry model missed —
  // they belong in "Surprising" because the model under-weighted them
  // even though a specific tradition uses them routinely.
  const cuiLookup = ctx?.cuisinePairLookup;
  if (cuiLookup) {
    // Match keys of the form "focal|other" or "other|focal". The
    // lookup keys are already canonical-sorted-lowercase so we test
    // both shapes by iterating the focal's two-prefix slice. Without
    // a secondary index, iterate the entire map once — it's ~120k
    // entries, fine for a one-shot lookup.
    const focalLower = String(focal).toLowerCase();
    for (const [key, rec] of cuiLookup.entries()) {
      const sep = key.indexOf('|');
      if (sep < 0) continue;
      const a = key.slice(0, sep);
      const b = key.slice(sep + 1);
      const other = a === focalLower ? b : (b === focalLower ? a : null);
      if (!other || seen.has(other) || other === focal) continue;
      const ev = rec?.evidence;
      if (!Array.isArray(ev) || ev.length === 0) continue;
      const primary = ev[0];
      if (primary.count < 5) continue;
      // Same dominance test as displayableCuisine — keep the boost
      // for clearly-attributable pairs.
      if (ev.length > 1 && primary.recipePct < 1.5 * ev[1].recipePct) continue;
      // Skip if already in candidates from earlier passes.
      seen.add(other);
      const oc = otherCluster(other);
      const crossCluster =
        focalCluster !== undefined && oc !== undefined && focalCluster !== oc;
      const strength =
        (ps && (ps.get(`${focal}|${other}`) ?? ps.get(`${other}|${focal}`))) ?? 0;
      candidates.push({
        name: other,
        tier: null,
        strength,
        bridge: null,
        bridgeDF: 0,            // cuisine-anchored: top-rank slot
        crossCluster,
        source: 'cuisine',
        cuisineAnchor: {
          primary: primary.cuisine,
          primaryCount: primary.count,
          primaryPct: primary.recipePct,
          secondary: ev.slice(1).map((e) => e.cuisine),
          totalEvidence: ev.reduce((s, e) => s + e.count, 0),
        },
        ringIdx: 0,
      });
    }
  }

  // Final ranking: cross-cluster first (different flavor neighbor-
  // hoods = genuinely surprising), then by inverse-DF (rarer
  // bridge = higher rank). Cuisine-anchored entries land at DF=0 so
  // they outrank GNN-bridge candidates of equal cluster-distance.
  candidates.sort((a, b) => {
    if (a.crossCluster !== b.crossCluster) return a.crossCluster ? -1 : 1;
    return a.bridgeDF - b.bridgeDF;
  });

  return candidates.slice(0, N).map((c) => ({
    name: c.name,
    tier: c.tier,
    strength: c.strength,
    bridge: c.bridge,
    ringIdx: c.ringIdx,
    cuisineAnchor: c.cuisineAnchor || null,
    source: c.source,
  }));
}
