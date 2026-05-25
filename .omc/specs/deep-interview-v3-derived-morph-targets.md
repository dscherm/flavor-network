# Deep Interview Spec: v3-Derived Morph Targets (Interpretation B)

## Metadata
- Interview ID: `v3-derived-morph-targets-2026-05-24`
- Rounds: 5 (+ Round 0 topology gate)
- Final Ambiguity Score: ~12% (under 20% threshold)
- Type: **brownfield**
- Generated: 2026-05-24
- Threshold: 0.20
- Initial Context Summarized: no
- Status: **PASSED**

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity        | 0.92 | 0.35 | 0.322 |
| Constraint Clarity  | 0.90 | 0.25 | 0.225 |
| Success Criteria    | 0.85 | 0.25 | 0.213 |
| Context Clarity     | 0.95 | 0.15 | 0.143 |
| **Total Clarity**   |      |      | **0.903** |
| **Ambiguity**       |      |      | **0.097 (~10%)** |

## Topology

| Component | Status | Description | Coverage |
|---|---|---|---|
| **Compute** | active | New v3-derived morph-target math. Hybrid centroid (GNN-weighted mean for strong buckets, synthetic pole fallback for sparse); blended weighted-average node positioning; tail-filter selection for multi-filter; runtime compute. | §Goal, §Constraints, §AC |
| **Purge** | active | Delete all 8 legacy mode keys (`ml`, `ml2d`, `neural`, `taste2d`, `aromas2d`, `cuisine2d`, `season2d`, `family2d`) + their position files (`pca_positions.json`, `gnn_positions.json`, per-axis position files) + `posForMode` tables in `useProData.js` and `networkModes.js`. | §Goal, §Constraints, §AC |
| **Cluster-tour adapter update** | active | Rewire the cluster-tour camera adapter at `LivingArchView.jsx:1906-1919` from `ml`/`ml2d` mode centroid arrays to `cluster_labels_v3.json` `centroid_3d` field. Required because ml/ml2d die in the Purge. | §Goal, §Constraints, §AC |
| **Spec rewrite** | active | §2.2, §7.3, §8.1 (adapter note), §13.2 amendment row #11. Procedural; happens alongside code. | §AC §Spec |

---

## Goal

Replace the legacy categorical position tables (loaded from
`pca_positions.json`, `gnn_positions.json`, and the per-axis position
files for taste/aroma/cuisine/season/family) with **morph targets
derived from v3 embeddings at runtime**, so every filter-pill morph
traces back to the v3 chemistry-grounded layout.

When a layout-driving filter pill activates (aroma / cuisine / season /
family / taste — per §7.3), the 3D scene morphs node positions from
the current `flavor3D` / `flavor2D` layout to **bucket centroids
computed from v3 embeddings**, weighted by each node's GNN-derived
probabilities for the active axis. Each node's morph target is a
**blended weighted average** of all bucket centroids on the active
axis. Nodes outside the active axis's scoring distribution stay at
their canonical v3 position.

Multi-filter: per §7.5 breadcrumb tail-only convention, the most-recent
filter (the breadcrumb tail) drives the morph; earlier-active filters
only affect visibility, not position.

Compute is **runtime, no offline bake** — sub-50ms on the worst-case
~230k float multiplies (4814 nodes × 6 axes × ~8 buckets).

Animation timing reuses the existing ~900ms filter-morph easing — only
the morph TARGET changes. Visually, the morph cadence and feel are
identical to today; the spatial endpoint is now v3-grounded.

The 8 legacy mode keys (`ml`, `ml2d`, `neural`, `taste2d`, `aromas2d`,
`cuisine2d`, `season2d`, `family2d`) are removed entirely from
`networkModes.js` + `useProData.js`. Their position files
(`pca_positions.json`, `gnn_positions.json`, per-axis files) are
deleted. The cluster-tour adapter at `LivingArchView.jsx:1906-1919`
rewires from `ml`/`ml2d` centroid arrays to `cluster_labels_v3.json`
`centroid_3d` field (mode-agnostic).

---

## Defined Variables

### Bucket centroid (hybrid)

```python
# For an active axis (e.g., taste) and bucket b (e.g., 'sour'):
def bucket_centroid(axis, b):
    members = [
        i for i in all_nodes
        if v3_position(i) is not None
        and gnn_prob(i, axis, b) >= MIN_BUCKET_PROB   # 0.20
    ]
    if len(members) >= MIN_BUCKET_MEMBERS:           # 5
        # GNN-weighted mean over v3 positions
        total_weight = sum(gnn_prob(i, axis, b) for i in members)
        return sum(v3_position(i) * gnn_prob(i, axis, b) for i in members) / total_weight
    else:
        # Synthetic pole fallback — mirrors current TASTE_TARGETS pattern
        # at the v3 spatial scale (Fibonacci-distributed if no canonical
        # pole; falls back to fixed cardinal directions for known axes).
        return synthetic_pole(axis, b)
```

Constants:
- `MIN_BUCKET_PROB = 0.20` (probability floor for a node to count as a member)
- `MIN_BUCKET_MEMBERS = 5` (below this, fall back to synthetic pole)
- Synthetic-pole scale = 0.65 × v3 bounding-sphere radius

### Node morph target (blended weighted-average)

```python
def node_morph_target(node, axis):
    weights = {b: gnn_prob(node, axis, b) for b in axis_buckets(axis)}
    total_weight = sum(weights.values())
    if total_weight < MIN_NODE_TOTAL_PROB:           # 0.10
        return v3_position(node)                     # unscored — stay put
    return sum(
        bucket_centroid(axis, b) * (w / total_weight)
        for b, w in weights.items()
    )
```

Constants:
- `MIN_NODE_TOTAL_PROB = 0.10` (below this total, treat node as unscored on this axis)

### Tail-filter selection (multi-filter)

```python
def active_morph_axis(filter_stack):
    # Tail filter wins per §7.5 breadcrumb convention.
    # Scope filters (cocktail-scope, sauce-scope, flavor-category) don't drive morph.
    layout_driving = [f for f in filter_stack if f in LAYOUT_DRIVING_FILTERS]
    return layout_driving[-1] if layout_driving else None
```

---

## Constraints

### Compute

- Runtime, no offline bake. Cached per (axis, gnn-data-version) in memory.
- `gnn_entropy.json` is the GNN probability source (already loaded in `useProData`).
- `v3_position(node)` = node's position in `flavor_positions_v3.json` (or the 2D variant in 2D mode).
- Worst case: ~230k float multiplies on filter activation. Target: < 50ms on a mid-tier laptop.

### Purge — full removal of legacy mode keys

The following are **deleted entirely**:

- From `src/data/networkModes.js`:
  - `'ml'`, `'ml2d'`, `'neural'`, `'taste2d'`, `'aromas2d'`,
    `'cuisine2d'`, `'season2d'`, `'family2d'` entries from any internal
    mode-set / lookup
  - `MODE_TO_AXIS` entries for the above
  - `effectiveLegacyMode()` cases that resolved human labels to these keys
- From `src/hooks/useProData.js`:
  - Position-file loaders for `pca_positions.json`, `gnn_positions.json`,
    and any per-axis files (e.g., `taste_positions.json`,
    `aroma_positions.json`)
  - `posForMode` map construction
  - `categoricalColorByMode` map entries keyed by deleted mode names
- From `src/components/LivingArchView.jsx`:
  - The filter-morph path that reads from `posForMode[axis]` is
    rewritten to call the new compute path
- From `public/proDataset/`:
  - `pca_positions.json`, `gnn_positions.json`, per-axis position
    files (whatever exists today and is no longer read)

The user-facing `MODE_CYCLE = ['flavor3D', '2D']` (post-H1) is
unchanged. Internal callers that pass `mode='3D'` or `mode='2D'` still
resolve via `effectiveLegacyMode()`, which now collapses any remaining
legacy aliases to `flavor3D` / `flavor2D` only.

### Cluster-tour adapter

The `networkCentroidAdapter()` at `LivingArchView.jsx:1906-1919`
currently has branches:

```js
if (m === 'ml')   { for (const [id, pos] of centroidByCluster3d) ... }
else if (m === 'ml2d') { for (const [id, c2] of centroidByCluster2d) ... }
```

Rewire to read directly from `cluster_labels_v3.json`'s
`clusters[].centroid_3d` (3D mode) or its 2D projection (2D mode),
mode-agnostically. The adapter returns the same shape
(`Array<{id, position}>`); the camera animator consumes it unchanged.

### Spec rewrite

- §2.2 — full rewrite: no more legacy keys. Filter morph is computed
  from v3 at runtime; no `posForMode` reference.
- §7.3 — pill-behavior table updates the "Layout-driving filters"
  branch to reference the new compute path instead of
  `posForMode[axis]`.
- §8.1 — adapter note: cluster-tour reads centroids from
  `cluster_labels_v3.json`, not from per-mode centroid arrays.
- §13.2 — add amendment row #11: "Filter-morph targets are v3-derived
  at runtime; legacy `posForMode` and the 8 legacy mode keys are
  removed. Cluster-tour adapter uses `cluster_labels_v3.json` centroids."

### Animation

- Reuse existing ~900ms easing (no UX change).
- `prefers-reduced-motion: reduce` → snap to morph target, no animation.

### Performance + accessibility

- Compute path must complete in < 50ms on filter activation
  (measured on a mid-tier laptop).
- Memory: bucket-centroid cache per (axis, gnn-data-version). Cache
  invalidates on data reload (rare). Cache size: ~6 axes × ~10
  buckets × 3 floats = ~180 floats max. Negligible.

### Mutex / interaction

- α-mode and cluster-focus engagement during a filter morph: the new
  morph target is the v3-derived target for `node.clusterId` of the
  focused cluster (no change — these features compose with the active
  filter the same way they do today; only the underlying numbers
  change).

---

## Non-Goals (out of scope)

- **Offline-bake the morph targets** — runtime is the chosen path.
  Bake can land as a follow-up if profiling shows runtime cost is real.
- **Re-introduce slider-driven morph (per §7.3 wording)** — the
  joystick-pulled morph is preserved if it currently works; if it's
  vestigial, no new UX surface is added.
- **Algorithmic re-derivation of synthetic-pole positions** — sparse
  buckets fall back to the existing TASTE_TARGETS-style fixed poles
  at the v3 bounding-sphere scale. No new pole-placement algorithm.
- **Changing the 8 user-facing filter pills** — pill row stays at 8 +
  None per H5 / §7.1.
- **Migrating the visual A/B fixture set into permanent regression
  tests** — fixture A/B is for Phase-1 chef-eye approval, not for the
  test suite.
- **Modifying chef-curated tier1/tier2/tier3 vocabulary** — locked.

---

## Acceptance Criteria

### Compute

- [ ] `src/data/morphTargets.js` (or similar) exposes `bucketCentroid(axis, bucket, ctx)` and `nodeMorphTarget(node, axis, ctx)` pure functions.
- [ ] `bucketCentroid` returns the GNN-weighted mean over v3 positions when ≥ 5 members have GNN prob ≥ 0.20; otherwise returns the synthetic pole for that (axis, bucket) at 0.65 × v3 bounding-sphere radius.
- [ ] `nodeMorphTarget` returns the blended weighted-average across all buckets on the active axis; returns the node's canonical v3 position when the node's total weight is < 0.10.
- [ ] Multi-filter: `activeMorphAxis(filterStack)` returns the tail layout-driving filter (last in stack that's not a scope filter). Returns null if no layout-driving filter is active.
- [ ] Runtime compute completes in < 50ms on a mid-tier laptop for the worst case (4814 nodes, taste axis, 8 buckets).
- [ ] Bucket-centroid cache keyed by axis, invalidated on data reload.

### Purge

- [ ] All 8 legacy mode keys (`ml`, `ml2d`, `neural`, `taste2d`, `aromas2d`, `cuisine2d`, `season2d`, `family2d`) removed from `networkModes.js`.
- [ ] `posForMode` map and its construction removed from `useProData.js`.
- [ ] Position files `pca_positions.json`, `gnn_positions.json`, and any per-axis position files are deleted from `public/proDataset/` and from any build scripts that produced them.
- [ ] `categoricalColorByMode` entries for the 8 deleted keys removed (the bucket palette tables themselves stay — they're still used for color-by-bucket).
- [ ] `effectiveLegacyMode()` resolves any remaining human aliases to `flavor3D` / `flavor2D` only.
- [ ] No grep hit for the 8 legacy keys remains in `src/` (except in comments tagged with "removed 2026-05-24").

### Cluster-tour adapter

- [ ] `networkCentroidAdapter()` at `LivingArchView.jsx:1906-1919` no longer branches on `m === 'ml'` / `m === 'ml2d'`.
- [ ] The adapter reads `cluster_labels_v3.json`'s `clusters[].centroid_3d` directly (3D mode) or projects to XZ for 2D mode.
- [ ] Cluster tour still engages on first load + pauses on input + resumes after 60s idle (regression check).

### Spec

- [ ] §2.2 rewritten with no `posForMode` reference + no 8-key list.
- [ ] §7.3 layout-driving-filter branch references the new compute path.
- [ ] §8.1 adapter note added.
- [ ] §13.2 amendment row #11 added with this spec's path as source.

### Cross-cutting

- [ ] All 797 existing tests pass.
- [ ] New unit tests cover: `bucketCentroid` (GNN-weighted + synthetic fallback), `nodeMorphTarget` (blended + unscored), `activeMorphAxis` (tail selection + scope-filter exclusion).
- [ ] Algorithmic AC: for Taste=sour, ≥ 80% of ingredients with `taste` containing 'sour' and `gnn_probs.sour ≥ 0.5` have post-morph positions within 1.5 × node-sphere-diameter of the sour-bucket centroid.
- [ ] Visual A/B fixture: chef-user spot-checks 5 filter axes × 3 buckets = 15 morph snapshots side-by-side against the legacy posForMode behavior. Chef sign-off required before commit.
- [ ] `npm run build` succeeds.
- [ ] `npm run ios:sync` succeeds.

---

## Implementation Plan

### Phase 1 (single ship — 3-4 days estimated)

| Day | Phase | Effort |
|---|---|---|
| **D1** | New `src/data/morphTargets.js` module — pure functions for `bucketCentroid`, `nodeMorphTarget`, `activeMorphAxis`. Unit tests as you go. | 1d |
| **D2** | Rewire `LivingArchView.jsx` filter-morph path to call the new compute. Rewire cluster-tour adapter to use `cluster_labels_v3.json` centroids. | 1d |
| **D3** | Purge — delete the 8 legacy keys from `networkModes.js` + `useProData.js`. Delete position files. Run test suite; fix any broken consumers. | 1d |
| **D4** | Spec rewrite (§2.2, §7.3, §8.1, §13.2 amendment row #11). Visual A/B fixture pass + chef sign-off. | 1d |

### Touched files (planned)

- `src/data/morphTargets.js` — **new**
- `src/data/__tests__/morphTargets.test.js` — **new**
- `src/data/networkModes.js` — purge 8 mode keys + their lookups
- `src/hooks/useProData.js` — remove `posForMode` + position-file loaders
- `src/components/LivingArchView.jsx` — rewire filter-morph + cluster-tour adapter
- `docs/NETWORK-AND-AFFINITY-SPEC.md` — §2.2, §7.3, §8.1, §13.2
- `public/proDataset/` — delete legacy position files
- Build scripts that produced the legacy position files — identify + remove

### Untouched

- v3 corpus artifacts (`flavor_positions_v3.json`, `cluster_labels_v3.json`, `gnn_entropy.json`) — read-only consumers
- BRISCIONE palettes — unchanged
- α-mode (`AffinityMode.js`), cluster-focus (`ClusterFocusMode.js`) — compose with the new morph the same way they did with the old
- IngredientPanel, filter pill row UI — unchanged

---

## Ontology (10 entities)

| Entity | Type | Fields | Relationships |
|---|---|---|---|
| Bucket Centroid | derived value | `[x,y,z]` per (axis, bucket); hybrid GNN-weighted-mean or synthetic-pole | computed from `gnn_entropy.json` + v3 positions per filter activation |
| Node Morph Target | derived value | `[x,y,z]` per node per active axis | blended weighted-average of bucket centroids; falls back to v3 position when unscored |
| Active Morph Axis | derived value | string (axis key) or null | tail layout-driving filter in filterStack; scope filters excluded |
| Layout-Driving Filter | filter category | aroma / cuisine / season / family / taste | drives morph; computed in `activeMorphAxis` |
| Scope Filter | filter category | cocktail-scope / sauce-scope / flavor-category | visibility-only; never drives morph |
| Synthetic Pole | fallback | fixed position per (axis, bucket); 0.65 × v3 bounding-sphere radius | used when bucket has < 5 GNN-weighted members |
| Centroid Cache | runtime state | Map<(axis, gnn-data-version), Map<bucket, [x,y,z]>> | invalidates on data reload |
| Cluster-Tour Adapter | scene helper | reads `cluster_labels_v3.json` `centroid_3d` | replaces ml/ml2d-keyed centroid arrays |
| Legacy Mode Key | scheduled for deletion | 8 keys (`ml`, `ml2d`, `neural`, taste2d, aromas2d, cuisine2d, season2d, family2d) | purged from `networkModes.js` |
| `posForMode` Map | scheduled for deletion | per-mode position lookup | purged from `useProData.js` |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability |
|---|---|---|---|---|---|
| 1 | 4 | 4 | 0 | 0 | N/A |
| 2 | 5 | 1 (Node Morph Target) | 0 | 4 | 80% |
| 3 | 8 | 3 (Synthetic Pole, Centroid Cache, Active Morph Axis) | 0 | 5 | 62% |
| 4 | 10 | 2 (Cluster-Tour Adapter, Legacy Mode Key) | 0 | 8 | 80% |
| 5 | 10 | 0 | 0 | 10 | 100% (converged) |

---

## Assumptions Exposed & Resolved

| Assumption | Round | Resolution |
|---|---|---|
| Bucket centroid = mean of all bucket members | R1 | False — hybrid: GNN-weighted mean for strong buckets, synthetic pole for sparse (< 5 members) |
| Each node snaps to its primary bucket centroid | R2 | False — blended weighted-average across all buckets on active axis |
| Unscored nodes need imputation | R3 | False — stay at v3 position (honest split-screen) |
| Multi-filter intersects mathematically | R3 | False — tail filter wins, matches §7.5 breadcrumb convention |
| Pre-compute morph targets offline | R3 | False — runtime, < 50ms worst case |
| Some legacy mode keys are load-bearing for non-filter paths | R4 (contrarian) | False — all 8 die; cluster-tour adapter rewires to v3-cluster-centroids |
| Filter morph needs new animation timing | R5 | False — reuse existing ~900ms easing |
| Ship in phases | R5 (simplifier) | False — single ship; smaller diffs riskier here than larger one |

---

## Technical Context

### Brownfield surfaces touched

- `src/data/networkModes.js` — purge 8 mode keys, MODE_TO_AXIS, effectiveLegacyMode cleanup
- `src/hooks/useProData.js` — remove `posForMode`, remove position-file loaders, keep `gnn_entropy.json` loader (load is independent)
- `src/components/LivingArchView.jsx` — filter-morph path (lines around 2640-2700) calls new compute; cluster-tour adapter (lines 1906-1919) rewires to v3 centroids
- `src/data/morphTargets.js` — **new** pure-functions module
- `docs/NETWORK-AND-AFFINITY-SPEC.md` — §2.2, §7.3, §8.1, §13.2

### Brownfield surfaces NOT touched

- α-mode (`AffinityMode.js`) — composes with whatever morph is active
- Cluster-focus (`ClusterFocusMode.js`, just shipped) — same
- IngredientPanel, filter pill row UI — unchanged
- v3 data pipeline / flavor_positions_v3.json — read-only

---

## Risks / Notes for Executor

1. **Centroid math correctness.** The synthetic-pole fallback for sparse buckets ('salty', 'odor_spicy') must NOT visually pull the whole morph off-balance — the pole position should be far enough from the GNN-weighted centroids that the visual hierarchy reads "this bucket is a synthetic pole, not derived." Spot-check the salty pole position relative to sweet/sour/bitter centroids in the visual A/B fixture.

2. **Cache invalidation.** `gnn_entropy.json` is loaded once at useProData init. Cache key can be a single version stamp (just `data.version` or similar). If the data ever hot-reloads in the same session (rare), the cache must invalidate. Add a smoke test for this.

3. **Position-file deletion in `public/proDataset/`.** Don't accidentally delete files still consumed by other surfaces. Sauce Lab / Cocktail Lab consume their own data files — verify the legacy network position files aren't shared.

4. **Build script cleanup.** Any chemDataset script that produces `pca_positions.json` or similar needs to be deleted too, or marked as dead. Find them via grep on the file names.

5. **Cluster-tour adapter regression.** The adapter currently has special-case branches for `ml` and `ml2d` (lines 1906-1919). The rewire reads from `cluster_labels_v3.json` which is already loaded. Test that the orbit pivot still lands on the cluster cloud center (not at origin) for the default mode.

6. **Algorithmic AC tolerance.** The 80% / within-1.5×-node-diameter target for 'sour' members is a soft guideline. If it fails for a specific bucket, debug whether the prob floor (0.20) or the member-count floor (5) is the culprit before changing the math.

---

## Pipeline next step

Per the deep-interview chain, three execution paths:

1. **`/oh-my-claudecode:omc-plan --consensus --direct`** — Planner/Architect/Critic consensus on the math + sequencing
2. **`/oh-my-claudecode:autopilot`** — direct execution
3. **`/oh-my-claudecode:ralph`** — persistence loop

Given the small file fan-out (~5 files), the clear math, and the
algorithmic AC, **direct executor implementation** is viable. The
visual A/B fixture step needs you (the chef-user) in the loop before
the commit lands.
