# Deep Interview Spec: Cluster Focus — Isolate + Spread

## Metadata
- Interview ID: `cluster-focus-isolate-spread-2026-05-24`
- Rounds: 6 (+ Round 0 topology gate)
- Final Ambiguity Score: ~12% (under 20% threshold)
- Type: **brownfield**
- Generated: 2026-05-24
- Threshold: 0.20
- Initial Context Summarized: no (initial idea was already concise)
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

| Component | Status | Description | Coverage / Deferral Note |
|---|---|---|---|
| **Isolate** | active | When a joystick cluster pill is active, hide all other clusters, their ingredients, their label sprites, and all corpus edges (except intra-focused-cluster edges). Other joystick pills also hide while a cluster is focused. | Covered by §Goal, §Constraints, §Acceptance Criteria |
| **Spread** | active | Members of the focused cluster fan out radially from the cluster centroid so that no two members sit within `1.5 × node-sphere-diameter` of each other. Camera re-fits to the new bounding sphere. | Covered by §Goal, §Constraints, §Acceptance Criteria |
| Procedural: canon-doc update | wrapper | Both components require editing `docs/NETWORK-AND-AFFINITY-SPEC.md` as the first implementation step. Not a separable user-facing outcome. | Not a topology component; called out in Implementation Plan §D1. |

---

## Goal

When the user taps a fly-to joystick pill cluster selector in the Explore →
Network 3D view, two things happen together:

1. **Isolate** — every non-focused cluster's nodes, label sprites, edges, and
   joystick pills disappear from the scene. Only the focused cluster's
   members, the focused pill, and (newly) the intra-cluster edges between
   focused-cluster members remain visible.
2. **Spread** — the focused cluster's member positions fan radially outward
   from the cluster centroid by an adaptive per-cluster factor sized so
   that the resulting nearest-neighbor distance is at least
   `1.5 × node-sphere-diameter`. Camera flies to the cluster centroid and
   re-fits its distance so the now-spread cluster fills ~60% of the
   viewport.

Both transforms ease over 600ms (spread) / 1200ms (camera) in parallel.
On exit (re-tap, different pill, ESC, or background click), both reverse
smoothly back to canonical v3 UMAP positions and the prior camera framing.

This collapses a single high-density cluster (e.g., **c17 Baking & Nuts at
510 nodes**, **c11 All Proteins at 445**) into a legible, identifiable
neighborhood the user can read at a glance — without losing reversibility
or replacing α-mode.

---

## Defined Variables

### Adaptive spread factor (per cluster)

```
node_radius          = NodeMesh sphere radius at default size (≈ 1.0u)
target_min_spacing   = 1.5 × (2 × node_radius)     # = 3.0u floor
current_min_spacing  = min nearest-neighbor distance in the cluster
spread_factor        = max(1.0, target_min_spacing / current_min_spacing)

# Apply radial fan-out around the cluster centroid
for member in focused_cluster.members:
    new_pos = centroid + (member.pos - centroid) * spread_factor
```

Mirrors the inverse of `flavor-gnn/scripts/dynamic_cluster_compaction.py`
(which contracts toward centroid); same math, expansion instead. Aliased
members travel with their canonical (the deterministic SHA1 post-jitter
already keeps aliases from co-locating exactly).

### Camera re-fit distance

```
spread_radius     = max(|new_pos - centroid|) for all focused members
viewport_fill     = 0.60      # target fraction of viewport height
fov_rad           = camera.fov * PI / 180
fit_distance      = spread_radius / tan(fov_rad / 2 * viewport_fill)
```

CameraAnimator flies to `centroid` and ends at `fit_distance` from it
along the current view vector, eased over 1200ms.

---

## Constraints

### Behavior

- **3D mode only.** When `MODE_CYCLE` is `2D`, pill click flies to centroid
  as today (existing onFlyTo) but does **not** isolate or spread. 2D
  support is explicitly deferred (see Non-Goals).
- **Cluster-focus and α-mode are mutually exclusive.** Engaging α-mode
  (double-click / long-press on a member, or a search-bar selection) exits
  cluster-focus first — other clusters fade back, members snap to canonical
  positions, camera reverts, then α-mode engages normally.
- **Single-click on a focused-cluster member opens the IngredientPanel
  (peek) without exiting cluster-focus.** Panel closes when cluster-focus
  exits or when the user clicks empty space.
- **Edges within the focused cluster render** with the §4.3 edge color
  rules (gold/silver/bronze by native tier). All cross-cluster edges are
  hidden.

### Exit triggers (any one exits)

- Re-tap the focused cluster's pill (current toggle behavior preserved)
- Tap a **different** cluster pill (exit + immediate re-enter on the new one)
- **ESC** key
- Click / double-click on background (empty 3D scene space)

### Animation

- Spread eases over **600ms** (`easeInOutCubic`)
- Camera fly + re-fit runs over **1200ms** in parallel (matches existing
  `flyToFocalMs` on CameraAnimator)
- Exit reverses both transforms with the same durations
- `prefers-reduced-motion: reduce` → both transforms snap (instant
  reposition, instant camera cut) — same accessibility contract as §8.6

### Interactions with existing features

- **Cluster tour (§8.1)** pauses on cluster-pill tap (same as any other
  user interaction per §8.5). Resumes after `idleResumeMs` (60s) idle from
  the cluster nearest the current camera position.
- **Filter pills (§7)** remain active under cluster-focus. The
  visibility predicate composes: a focused-cluster member must also pass
  the active filter intersection to render. Empty-intersection overlay
  (§7.4) takes priority.
- **Search-bar selection** of an ingredient OUTSIDE the focused cluster
  exits cluster-focus and engages α-mode on the searched ingredient.
- **Mode switch (3D ↔ 2D)** exits cluster-focus (cluster-focus is
  3D-only).

### Color / visibility precedence (extends §3.1)

A new top-priority layer is inserted above the existing filter-bucket /
cluster-color stack:

```
0. Cluster-focus visibility: if cluster-focus active AND node.clusterId ≠ focusedId
     → hide (instanceColor.a = 0 OR move outside draw range)
1. Filter-bucket color  (existing)
2. v3 cluster color     (existing)
3. Primary Tier-1 aroma (existing)
4. Taste blending       (existing)
5. Neutral gray         (existing)
```

The hide-write is exclusive: cluster-focus owns the per-node visibility
buffer while engaged, similar to AffinityMode's exclusive write authority
(§6 hidden ring meshes pattern). Filter/cluster color writes are paused
for non-focused nodes (they're hidden anyway).

### Performance

- Spread math runs **once per focus-enter** (not per frame). Stored as a
  `spreadOffset` array; the actual per-frame transform is just
  `pos = canonical + (spreadOffset * t)` where `t` eases 0 → 1.
- Hide is implemented by writing `dimColor` with alpha 0 OR by toggling
  the instance count via `mesh.setMatrixAt` to an off-screen position.
  Whichever is faster — implementer choice (snapshotted in §AC).
- Target 60fps on desktop / 30fps on mobile during the spread animation.

---

## Non-Goals (deferred / out of scope)

- **2D mode cluster-focus** — `flavor2D` layout is not in Phase 1. Pill
  click in 2D continues today's fly-to-centroid behavior.
- **Cluster sprite click** — §5.4's "future: cluster label sprite click
  engages focal flight + auto-select" is still out of scope. Only the
  joystick pills trigger cluster-focus.
- **User-adjustable spread slider** — the spread factor is fully derived
  from `target_min_spacing`. No UI control.
- **Spread retained across pill switches** — switching clusters reverts
  the prior spread before applying the new one (no "spreads accumulate").
- **α-mode layering** — cluster-focus and α-mode never coexist.
- **Edge color recompute** — intra-cluster edges use the existing §4.3
  rules unchanged.

---

## Acceptance Criteria

### Canon doc update (procedural)

- [ ] `docs/NETWORK-AND-AFFINITY-SPEC.md` §5 (Cluster behavior) gains a
      new subsection §5.6 documenting cluster-focus isolate + spread,
      with exit triggers + interaction-matrix bullets.
- [ ] §3.1 (Color precedence) gains the "Cluster-focus visibility"
      priority-0 entry.
- [ ] §4.2 (Edge visibility rules) is amended to note intra-focused-cluster
      edges render when cluster-focus is active.
- [ ] §8 (Camera animator) gains §8.4 documenting cluster-focus camera
      fly + re-fit (re-purposing the "currently inert" §8.4 stub).
- [ ] §13.2 (Resolved amendments) gains a new row #10 referencing this
      spec.
- [ ] "Last revised" date at top bumped to 2026-05-24.

### Isolate

- [ ] Tapping a joystick cluster pill while no cluster is focused
      hides every non-focused cluster's nodes within one animation frame
      and the focused cluster's nodes remain visible.
- [ ] All cluster label sprites except the focused cluster's hide.
- [ ] All non-joystick edges hide; intra-focused-cluster edges render.
- [ ] All non-focused joystick pills hide; the focused pill remains
      visible with its glow/border focused state.
- [ ] ESC key exits cluster-focus → all hidden items fade back in
      within 1200ms and member positions revert.
- [ ] Background click (3D scene empty space) also exits.
- [ ] Tapping a DIFFERENT cluster pill swaps focus (prior cluster
      reverts, new cluster spreads in).
- [ ] Engaging α-mode (double-click / long-press a member, OR searching
      a non-focused ingredient) exits cluster-focus first.
- [ ] In 2D mode, pill click does NOT trigger isolate/spread (only fly-to).

### Spread

- [ ] After focus engages, the minimum nearest-neighbor distance among
      focused-cluster members is ≥ `1.5 × (2 × node_radius)`.
- [ ] Cluster centroid position is unchanged (members move; centroid
      stays put).
- [ ] Aliased members travel with their canonical (preserved
      co-location via SHA1 jitter is unchanged).
- [ ] Spread eases over 600ms (`easeInOutCubic`).
- [ ] Exit reverses the spread over 600ms; members land back at
      canonical v3 UMAP positions exactly (no drift).
- [ ] `prefers-reduced-motion: reduce` → spread snaps (no animation).
- [ ] No console errors; existing 783 tests still pass.

### Camera

- [ ] Camera flies to cluster centroid over 1200ms.
- [ ] Final camera distance fills ~60% of viewport height with the
      spread cluster's bounding sphere.
- [ ] Exit reverses to the pre-focus camera position/target over 1200ms.

### Cross-cutting

- [ ] `npx vitest run` — all tests pass.
- [ ] `npm run build` — succeeds.
- [ ] `npm run ios:sync` — succeeds, no new native dependencies.
- [ ] No visual regression in α-mode, filter morphs, or cluster tour.
- [ ] Performance: ≥ 60fps desktop / ≥ 30fps mobile during animations.

---

## Implementation Plan

### Phase 1 (single ship — 3-4 days estimated)

| Day | Phase | Effort |
|---|---|---|
| **D1** | Update `docs/NETWORK-AND-AFFINITY-SPEC.md` — §3.1 priority-0 row, §4.2 edge note, new §5.6 cluster-focus subsection, §8.4 camera contract, §13.2 amendment row #10, "Last revised" bump | 0.5d |
| **D2** | Spread math in a new `src/three/ClusterFocusMode.js` (or extend `AffinityMode.js` pattern) — adaptive factor, centroid math, position interpolation buffer | 1d |
| **D3** | Hide path in `NodeMesh.js` (priority-0 visibility), `EdgeMesh.js` (intra-cluster filter), `LivingArchView.jsx` (orchestration + ESC/background handlers); other-pill hide in `ClusterJoystick.jsx` | 1d |
| **D4** | Camera re-fit math in `CameraAnimator.js` (new `engageClusterFit(centroid, spread_radius)` method); animation timing pass; tests; visual QA across all 14 clusters | 1d |

### Touched files (planned)

- `docs/NETWORK-AND-AFFINITY-SPEC.md` — canon doc update
- `src/three/ClusterFocusMode.js` — **new** mode class (mirrors
  `AffinityMode.js`)
- `src/three/CameraAnimator.js` — new `engageClusterFit()` method
- `src/three/NodeMesh.js` — priority-0 hide path in `_setColorAtGlobal`
- `src/three/EdgeMesh.js` — intra-cluster edge filter when focused
- `src/components/LivingArchView.jsx` — orchestration; ESC/background
  handlers; α-mode mutex; spread-reset on mode switch
- `src/components/ClusterJoystick.jsx` — hide non-focused pills when a
  cluster is focused (small CSS / render guard)
- `src/data/networkModes.js` — possibly a `clusterFocusEnabled(mode)`
  guard (3D only)

### Untouched

- `BRISCIONE_TASTE`, `BRISCIONE_AROMA` palettes — unchanged
- `V3_CLUSTER_HEX` — unchanged
- `flavor_positions_v3.json` / `cluster_labels_v3.json` — read-only
- α-mode rendering pipeline — unchanged (just sequenced with cluster-focus)
- Search bar, IngredientPanel content — unchanged

---

## Ontology (10 entities)

| Entity | Type | Fields | Relationships |
|---|---|---|---|
| ClusterFocusMode | core scene-state | `focusedClusterId`, `spreadProgress`, `cameraSnapshot` | mutex with AffinityMode; consumes cluster_labels_v3 |
| Spread Factor | derived value | `currentMinSpacing`, `targetMinSpacing`, `factor` | computed per focus-enter per cluster |
| Cluster Centroid | derived value | `[x,y,z]` from cluster_labels_v3.clusters[].centroid_3d | fixed point of radial transform |
| Spread Offset Array | derived buffer | `Float32Array` of `(member.pos - centroid) * factor` | applied via lerp by `spreadProgress` 0→1 |
| Focused Cluster | scene partition | nodes where `clusterId === focusedClusterId` | spread + remain visible |
| Hidden Set | scene partition | nodes where `clusterId !== focusedClusterId` | hidden via priority-0 color/draw-range |
| Intra-cluster Edges | edge subset | edges where both endpoints in focused cluster | render with §4.3 tier colors |
| Camera Snapshot | reversible state | pre-focus position + target + distance | restored on exit |
| Cluster Pill (joystick) | UI control | rendered/hidden based on focus state | tap fires onClusterFocus + onFlyTo |
| Exit Trigger | event source | ESC, background, re-tap, different-pill, α-mode engage, mode switch | all converge to `exitClusterFocus()` |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability |
|---|---|---|---|---|---|
| 1 | 4 | 4 | 0 | 0 | N/A |
| 2 | 6 | 2 | 0 | 4 | 67% |
| 3 | 7 | 1 | 1 (Factor: fixed → adaptive) | 5 | 86% |
| 4 | 8 | 1 (mutex with AffinityMode) | 0 | 7 | 88% |
| 5 | 10 | 2 (Exit Trigger, Camera Snapshot) | 0 | 8 | 80% |
| 6 | 10 | 0 | 0 | 10 | 100% (converged) |

---

## Assumptions Exposed & Resolved

| Assumption | Round | Resolution |
|---|---|---|
| Spread = uniform sphere-pack | R1 | False — radial fan-out preserves intra-cluster topology |
| Hide = dim (current behavior) | R2 | False — flip to true hide for cluster-focus; existing dim-to-#111118 path stays for non-focus filter behaviors |
| Edges entirely off when cluster-focused | R2 | Partial — intra-cluster edges render; cross-cluster edges off |
| Fixed global spread factor | R3 | False — per-cluster adaptive sizing keyed to nearest-neighbor distance floor |
| α-mode and cluster-focus can layer | R4 | False — mutually exclusive; α-mode engage exits cluster-focus |
| Camera stays at fixed distance | R5 | False — camera re-fits to new spread bounding sphere |
| 2D mode must also work Phase 1 | R6 | False — deferred; 3D only ships first |
| Animation could be a snap to ship faster | R6 | False — eased 600/1200ms is the chosen UX |

---

## Technical Context

### Brownfield surfaces touched

- `src/three/NodeMesh.js` (lines 400–526) — per-instance color/visibility
- `src/three/EdgeMesh.js` (lines 1–80) — edge LineSegments
- `src/three/CameraAnimator.js` (lines 74–100) — state machine + flight
- `src/components/LivingArchView.jsx` (lines 97, 165, 2477–2535) —
  `focusedClusterId` already wired but currently dim-only
- `src/components/ClusterJoystick.jsx` (lines 95–115) — already fires
  `onClusterFocus(cluster.id)` toggle
- `docs/NETWORK-AND-AFFINITY-SPEC.md` — canon doc

### Brownfield surfaces NOT touched

- Affinity tier scoring (§6.7) — unchanged
- Filter pill morph (§7) — unchanged; composes with cluster-focus
- IngredientPanel content (§9) — unchanged
- v3 data pipeline / flavor_positions_v3.json — read-only

---

## Interview Transcript

<details>
<summary>6 rounds of Q&A + Round 0</summary>

### Round 0 — Topology gate
**Q:** Isolate + Spread + procedural canon-doc wrapper — right topology?
**A:** Looks right — 2 components.

### Round 1 — Goal Clarity (Spread)
**Q:** What spread shape?
**A:** Radial fan-out from centroid.

### Round 2 — Constraint Clarity (Isolate)
**Q:** Which scene elements stay vs disappear?
**A:** Hide other label sprites + edges entirely (except intra-focused-cluster edges) + other joystick pills hide.

### Round 3 — Constraint Clarity (Spread)
**Q:** How is the fan-out scale determined?
**A:** Per-cluster adaptive, target min nearest-neighbor distance ≥ 1.5 × node-sphere diameter.

### Round 4 — Constraint Clarity, Contrarian Mode (Isolate × α-mode)
**Q:** Cluster-focus ↔ α-mode interaction?
**A:** Mutually exclusive — α-mode engage exits cluster-focus.

### Round 5 — Constraint Clarity (exit + camera)
**Q:** Exit triggers + camera fit?
**A:** All 4 exit triggers (re-tap, different-pill, ESC, background) + fly-to-centroid with re-fit to spread bounding sphere.

### Round 6 — Simplifier Mode (scope)
**Q:** Animation timing, 2D scope, alias handling?
**A:** Eased 600/1200ms; 3D only Phase 1; aliases travel with canonical.

</details>

---

## Pipeline next step

Per the deep-interview chain, three execution paths are available:

1. **`/oh-my-claudecode:omc-plan --consensus --direct`** — Planner/Architect/Critic consensus
2. **`/oh-my-claudecode:autopilot`** — direct execution
3. **`/oh-my-claudecode:ralph`** — persistence loop

Given the small file fan-out (~7 files) and clear AC, **direct executor
implementation** is also viable.
