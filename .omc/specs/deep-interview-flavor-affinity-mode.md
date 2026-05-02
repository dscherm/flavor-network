# Deep Interview Spec: Flavor Affinity Mode + Cluster Relabel

## Metadata
- Interview ID: flavor-affinity-mode
- Rounds: 3 (+ initial framing pass)
- Final Ambiguity Score: ~16% (under 20% threshold)
- Type: brownfield (extends existing 3D scene; modifies cluster labeling pipeline)
- Generated: 2026-04-27
- Status: PASSED
- Inspiration: *The Flavor Bible* by Karen Page & Andrew Dornenburg —
  local-first ingredient lookup with three-tier affinity ratings
  (★★★ classics / ★★ strong / ★ good).

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity      | 0.95 | 0.35 | 0.3325 |
| Constraint Clarity| 0.90 | 0.25 | 0.2250 |
| Success Criteria  | 0.60 | 0.25 | 0.1500 |
| Context Clarity   | 0.90 | 0.15 | 0.1350 |
| **Total Clarity** |      |      | **0.8425** |
| **Ambiguity**     |      |      | **0.1575 (~16%)** |

## Goal

Add a **Flavor Affinity Mode (α-mode)** to the network view that lets a
user click any ingredient and see its top 30 affinities arranged
spatially in three concentric tiers (★★★ / ★★ / ★) around it. The
rest of the network collapses to faint cluster-ghost dots so the user
keeps spatial context without visual noise. The mode is the headline
discovery surface — local-first, like *The Flavor Bible*, but spatial.

Two supporting moves ship alongside:
1. **Cluster relabel** — re-derive cluster names from an LLM applied
   to RecipeNLG recipe titles + ingredient lists, so a cluster's name
   actually maps to what it cooks. The current cluster_explanations
   pipeline produced labels that don't always contain their namesake
   (e.g., "Sugar" cluster doesn't contain the sugar ingredient).
   K=10 stays.
2. **Tier scoring** with chemistry-aware bridge-compound logic
   distinguishing "strong + chemistry-bridged" from "strong only" from
   "moderate."

The model's stated purpose — *"a visualized way of seeing the essence
of ingredients (affinities, taste, pairings)"* — is preserved.
Affinity becomes the load-bearing dimension; cluster regions stay as
secondary spatial context.

## Defined Variables

### Affinity tier per ingredient pair (a, b)

```
strength(a, b) ∈ [0, 1]   — existing NPMI + log-count hybrid pairing score
bridge(a, b)              — bridge_compounds.json entry: top compound bridging a↔b
top5(x)                   — top 5 GNN-predicted compounds for ingredient x

tier(a, b) =
  if has_compound_data(a) AND has_compound_data(b):
    if strength(a,b) ≥ 0.7 AND bridge(a,b) ∈ top5(a) AND bridge(a,b) ∈ top5(b):
      ★★★
    elif strength(a,b) ≥ 0.4:
      ★★
    elif strength(a,b) ≥ 0.2:
      ★
    else: untiered
  else (lenient fallback — at least one side has no GNN compound data):
    if strength(a,b) ≥ 0.85: ★★★
    elif strength(a,b) ≥ 0.4: ★★
    elif strength(a,b) ≥ 0.2: ★
    else: untiered
```

Lenient policy intentionally separates "we know they don't share
chemistry" (strict downgrade) from "we don't know the chemistry"
(generous fallback). The 1,123 ingredients with no GNN coverage can
still earn ★★★ when their pairing strength is exceptional.

### Affinity ranking & display per focal ingredient `f`

```
affinities(f) = [b for b in graph.neighbors(f) where tier(f, b) ≠ untiered]
displayed(f) =
  ★★★ ring: top 5 by strength
  ★★  ring: top 10 by strength (excluding ★★★ matches)
  ★   ring: top 15 by strength (excluding ★★ matches)
```

Total: 30 affinity nodes + 1 focal = 31 ingredient sprites visible in
α-mode. The rest of the 3,913-node graph collapses to 10 cluster-ghost
dots (one per cluster centroid).

## Constraints

### α-mode interaction model
- **Entry**: single click on any ingredient node OR selection from
  the search bar enters α-mode with that ingredient as focal. No
  separate toggle button — α-mode is engaged whenever a single
  ingredient is the active selection, and disengaged otherwise.
- **Background**: when α-mode is active, every non-displayed node
  fades out and the 10 cluster centroids fade in as **ghost dots**
  (small dim sprites at each cluster centroid, colored by cluster
  palette, label visible). The user keeps the "you are in this
  region of flavor space" awareness without ingredient-level noise.
  Edges only render between focal ↔ affinity, color-coded by tier
  (gold ★★★, silver ★★, bronze ★).
- **Exit (any of the following)**:
  - ESC key
  - Click the focal ingredient again
  - Double-click / double-tap another ingredient OR background
- **Re-pivot (single click on a different ingredient while in α-mode)**:
  scene smoothly re-centers on the new focal; old rings dissolve as
  new rings spawn. The user "walks the graph" through affinity space.
- **Mobile fallback (β-mode)**: viewports below the `sm` Tailwind
  breakpoint render a side-panel "Flavor Bible page" overlay
  instead of α-mode rings. Same data, different shape: three columns
  (★★★ / ★★ / ★) of clickable affinity chips. The 3D scene stays
  put underneath. Reason: the planetary rings cramp on phone
  viewports and the touch raycast on small spheres is unreliable.
- **Multi-select coexistence**: when 2+ ingredients are selected,
  α-mode is suspended and the existing common-pairings UX takes
  over (no rings; selection-shadow stays). α-mode resumes when the
  selection collapses back to a single ingredient.

### Cluster relabel pipeline
- **Source signal**: LLM-derived (option III from the interview).
  Extend the existing `cluster_explanations.py` pipeline with a
  second prompt that also produces a 1-2 word category-style label
  alongside the existing explanation text. Input per cluster: top
  20 member ingredients + top 20 recipe titles those ingredients
  appear in (mined from RecipeNLG).
- **K stays at 10**: cluster colors, joystick pills, focus mechanics
  are wired to K=10. Don't touch the embedding or k-means; only the
  human-readable label string changes.
- **Output**: new `label_v2` field on each cluster in
  `public/proDataset/cluster_labels.json` AND in
  `cluster_explanations.json`. The UI reads `label_v2` when present;
  rolls back to `label` if missing.
- **Acceptance check**: for each cluster, the new label should be a
  recognizable category for at least 7 of its top-10 ingredients.
  This is verified via a sanity script before commit.

### α-mode visual layout
- **Ring radii** (3D scene units): focal at scene origin (after camera
  re-pivot); ★★★ ring at radius 12; ★★ ring at 22; ★ ring at 35.
  Cluster-ghost dots stay at their full pre-α positions.
- **Sphere placement on rings**: distribute the N affinities on each
  ring evenly by golden angle (φ ≈ 137.5°) so adjacent slots aren't
  cluster-correlated. Within each ring, sort by descending strength
  going clockwise from the +x axis (deterministic).
- **Edge tier colors**:
  - ★★★ = `#facc15` (gold), opacity 0.9, width 2
  - ★★  = `#a3a3a3` (silver), opacity 0.7, width 1.5
  - ★   = `#a16207` (bronze), opacity 0.5, width 1
- **Camera animation**: 1200ms eased flight (mirrors existing
  `flyToPoint` from LivingArchView). After flight: camera framed so
  ★ ring fits viewport with ~10% padding.

### Performance budget
- α-mode entry must complete spatial reorganization (sphere
  positioning + edge build + camera flight start) in **< 200ms** of
  CPU time on the main thread. The 30-affinity computation is
  trivial; the bottleneck is recomputing `tier(focal, b)` per
  candidate. Cache `top5(x)` per ingredient at session-start (already
  done — `gnn_entropy.json` is loaded once).
- Re-pivot must not allocate new geometries; reuse the existing
  affinity-node InstancedMesh and just update its instanceMatrix.

### Implementation constraints
- **Brownfield** — extends `LivingArchView.jsx`. Do NOT touch the
  Cocktail Lab or Sauce Lab views (they use a different scene path
  with their own codex-position math).
- **No `memo()` wrap** on the new components if they close over
  later-declared consts (TDZ class — see `.claude/.ralph-lessons.md`).
- **Bundle budget**: no new heavy deps. The tiering math is pure JS
  loops over data we already ship.
- **Backwards-compat**: if `bridge_compounds.json` lookup fails for a
  pair, fall through to lenient policy (already in tier definition).
  The viewer should never hard-fail.

## Non-Goals
- **NOT replacing the cluster surface.** Clusters stay as secondary
  spatial context (visible as ghost dots in α-mode, full color in
  default mode).
- **NOT changing the GNN model or the Node2Vec layout.** Embeddings,
  position blending, and cluster k-means are unchanged.
- **NOT shipping dynamic filter-driven layout in v1.** Filters
  (cuisine, season, temperature) are a v2 layer that operates on
  TOP of α-mode (Italian filter → only Italian-relevant affinities
  glow). Out of scope here.
- **NOT building a separate Flavor Bible page UI.** β-mode mobile
  fallback is the closest thing; we don't ship a desktop "look up an
  ingredient" page that lives outside the network view.
- **NOT exposing tier scoring numerically to the end user.** The user
  sees ★★★ / ★★ / ★ as visual indicators only. The underlying
  pairing strength stays internal.

## Acceptance Criteria

### α-mode behavior
- [ ] Single-click any ingredient → α-mode engages in < 200ms.
- [ ] Search-select an ingredient → α-mode engages with that
  ingredient as focal.
- [ ] Camera animates to a frame where focal is centered and the
  ★ ring fits with ~10% padding around it.
- [ ] Affinity nodes appear in 3 concentric rings: 5 (★★★) + 10 (★★)
  + 15 (★) = 30 affinities visible.
- [ ] Edges from focal to each affinity, color-coded by tier
  (gold/silver/bronze).
- [ ] All non-affinity nodes fade out; 10 cluster-ghost dots fade in
  at cluster centroids.
- [ ] ESC key, click focal again, double-click another ingredient,
  AND double-click/tap background — each independently exit α-mode
  and restore the default scene.
- [ ] Single-click on a different ingredient (while in α-mode)
  re-pivots smoothly: old rings dissolve while new rings spawn.
- [ ] Repeat-tap on the focal does NOT bug-pop into the old "selection
  toggle" behavior — it cleanly exits α-mode.

### Tier correctness
- [ ] Manual spot check: caffeine in tea/coffee = ★★★ (high pairing
  + theobromine bridge present in both top-5).
- [ ] Manual spot check: tomato + basil = ★★★ (high pairing +
  shared β-caryophyllene/limonene bridges).
- [ ] Manual spot check: lemon + butter = ★★ (high pairing,
  no compound bridge).
- [ ] Lenient fallback verified: pick a high-pairing pair where
  one side has no GNN compound data; assert it earns ★★★ at
  strength ≥ 0.85.
- [ ] Strict downgrade verified: pick a moderate-pairing pair
  with full GNN data on both sides but no shared top-5 compound;
  assert it gets at most ★★.

### Cluster relabel
- [ ] All 10 clusters get a new `label_v2` field.
- [ ] Sanity script: for each cluster, ≥7 of top-10 members
  pattern-match the new label (case-insensitive substring or
  semantic neighbor — script ships with the spec).
- [ ] Joystick flywheel pills display `label_v2` when present.
- [ ] In-3D cluster sprites display `label_v2` when present.
- [ ] No regression in existing cluster-focus mechanics
  (clicking a pill still focuses the cluster).

### Mobile β-mode
- [ ] On viewports < 640px (Tailwind `sm` breakpoint), single-click
  an ingredient does NOT engage α-mode rings.
- [ ] Instead, a side-panel "Flavor Bible page" slides in with three
  column sections (★★★ / ★★ / ★) of affinity chips.
- [ ] Each chip is tappable → re-pivots β-mode to that ingredient.
- [ ] Close (X) button + tap outside both dismiss the panel.

### Performance & safety
- [ ] α-mode entry CPU ≤ 200ms on a 2020-era laptop (measure with
  `performance.mark`).
- [ ] α-mode does not leak: 100 rapid pivots between ingredients
  via search → memory does not climb (re-uses InstancedMesh,
  reuses sprites).
- [ ] If `bridge_compounds.json` is empty/malformed, the viewer
  falls back to lenient tiering with no console errors.

### Cross-platform
- [ ] Test on https://neuralflavor.web.app desktop (Chrome).
- [ ] Test on iOS via TestFlight (matches β-mode fallback).
- [ ] Keyboard nav (R6-37): arrow-key walk still works inside α-mode
  — pressing ↓ from focal pivots to the strongest unvisited ★★★
  affinity, ↑ rewinds via history.

## Implementation Plan (for executor)

### New files
1. `src/data/affinityTiers.js` — pure math primitives:
   `tierFor(a, b, ctx)` returning `{tier, pairingStrength, bridgeCompound}`.
   `topAffinities(focal, ctx, {N3, N2, N1})` returning the 30-element
   ranked list. Pure functions; full unit tests.
2. `src/three/AffinityMode.js` — manages the α-mode visual layer:
   `engage(focal, sceneState)`, `pivot(newFocal)`, `exit()`. Owns
   the affinity InstancedMesh, the edge LineSegments, and the
   cluster-ghost sprites. Does NOT own the camera flight (delegates
   to existing flyToPoint).
3. `src/components/AffinityPanel.jsx` — β-mode mobile fallback. Side
   panel with three columns of affinity chips, mirrors α-mode data.
4. `flavor-gnn/src/infer/cluster_labels_v2.py` — extends the existing
   cluster-explanations script with a second LLM prompt. Outputs
   `label_v2` field into both `cluster_labels.json` and
   `cluster_explanations.json`.
5. `flavor-gnn/src/infer/verify_cluster_labels.py` — sanity script:
   for each cluster, asserts ≥7/10 top members semantically match
   the new label. Fails the build if not.
6. `src/data/__tests__/affinityTiers.test.js` — vitest coverage.

### Files to modify
1. `src/components/LivingArchView.jsx`:
   - Detect `selectedNodes.length === 1` AND viewport-not-mobile →
     engage AffinityMode.
   - Wire ESC / focal re-click / double-click handlers to AffinityMode.exit.
   - On selection change in α-mode, call AffinityMode.pivot.
2. `src/components/SearchBar.jsx`: ensure search-select triggers the
   same single-selection state that α-mode listens for. Likely
   already works; verify.
3. `src/App.jsx`: add `useAffinityMode` flag wired to `isMobile`
   (existing hook). Pass to LivingArchView so it knows whether to
   engage α-mode or open AffinityPanel.
4. `src/components/ClusterJoystick.jsx`: read `label_v2` when
   present (line 65 — already accepts `cl.label || cl.name`; just
   prefer `cl.label_v2`).
5. `src/three/AxisLabels.js` (`createClusterLabels`): same — prefer
   `label_v2`.
6. `src/hooks/useProData.js`: hydrate `bridgeCompoundIndex` (Map
   from "a|b" → bridge compound name) at session start so
   `tierFor` is O(1). Build it once from `bridge_compounds.json`.

### Phasing
- **Phase 1 (1 day)**: Ship the cluster relabel offline pipeline +
  v2 labels in cluster_labels.json. UI just reads new labels. No
  new mode yet. Low-risk; user immediately sees better names.
- **Phase 2 (3-4 days)**: Ship α-mode for desktop. AffinityMode.js,
  affinityTiers.js, LivingArchView wiring. Mobile keeps the existing
  IngredientPanel until Phase 3.
- **Phase 3 (1-2 days)**: Ship β-mode mobile fallback and the
  isMobile gating logic.
- **Phase 4 (later, out of scope here)**: filter-driven dimming
  layered on top of α-mode (cuisine / season). New spec needed.

## Risks / Notes for executor

1. **InstancedMesh reuse on pivot.** The naive implementation would
   build a new mesh on every pivot; over 50 pivots in a session that
   leaks GPU memory. Allocate ONE 30-instance mesh at engage time,
   reuse across pivots. Hide via instanceMatrix scale=0 when fewer
   than 30 affinities exist.

2. **Lenient tier fallback boundary tests.** The transition between
   strict and lenient policies (when one side has compound data, the
   other doesn't) is the most error-prone surface. Unit tests must
   cover all four cases: (both have / a has / b has / neither has).

3. **Joystick fly-to + α-mode re-pivot interaction.** If the user
   taps a cluster pill while in α-mode, what happens? Proposed:
   tapping a cluster pill exits α-mode AND flies to the cluster
   (existing behavior). Document this in the LivingArchView
   keyboard / interaction comments.

4. **Search re-pivot timing.** If the user types in the search bar
   while α-mode is engaged, they shouldn't see the rings flicker on
   every keystroke. The pivot should fire only on explicit selection
   (Enter key or click), not on input change.

5. **β-mode for desktop accessibility.** Some keyboard-only desktop
   users may prefer the β-mode side-panel even on a wide viewport.
   Consider adding a "prefer panel mode" toggle in settings as a
   v1.1 follow-up. Out of scope for v1.

6. **Cluster relabel LLM cost.** The existing
   cluster_explanations pipeline already calls an LLM. The second
   prompt is essentially free (10 calls, ~500 tokens each). Use the
   same model + same JSON-output mode for consistency.

7. **Cluster relabel verification CAN fail.** If the LLM returns a
   label that fails the ≥7/10 sanity check, the build halts. The
   executor should add a manual-override path: a `cluster_labels_
   override.json` file the developer can hand-edit to force a label
   when the LLM picks something nonsensical.

8. **Filter idea (v2 follow-up).** The user explicitly raised
   cuisine / season / temperature filters operating on top of
   α-mode. Temperature data is NOT currently in the dataset and
   would require a new ingestion path. v2 scope; do not attempt
   in this round.

9. **A/B toggle.** Add a `?affinity=v0` URL param that disables
   α-mode and falls back to the existing single-select behavior.
   Used for offline benchmarking and field debugging. Default = on.

10. **Performance probe.** Before wiring AffinityMode to every
    selection, run `performance.mark` around engage/pivot to
    confirm <200ms budget. If we blow it, defer the cluster-ghost
    fade to a separate animation frame (don't block the main pivot).

## Interview Transcript

<details>
<summary>3 rounds of interactive Q&A</summary>

### Round 1 — Goal framing
**Q**: Which is the primary deliverable: (A) relabel only, (B) replace
cluster surface with affinity, (C) ADD affinity as new lens, (D)
filter-driven re-layout? And what is the model's purpose so we don't
break it?

**A**: Affinity layer is the right move. Purpose: visualized way of
seeing the essence of ingredients (affinities, taste, pairings).
But keep discussing.

### Round 2 — Mechanics
**Q1 (spatial form)**: α (3D planetary), β (side panel), or γ (edge highlight)?
**A1**: α (3D planetary).

**Q2 (cluster names)**: leave them as wallpaper, or re-derive?
**A2**: Re-derive (option ii).

**Q3 (tier definition)**: quantile-based, threshold-based, or
compound-bridged?
**A3**: Compound-bridged (option c).

**Side prompt**: defer filter-driven layout to v2; affinity layer
ships first. **Accepted.**

### Round 3 — Edge cases & data
**Q4 (interaction model)**:
- (a) entry: single-click node OR search-select. ✓
- (b) background: cluster-ghost mode (option iii). ✓
- (c) exit: ESC + re-click focal + double-click/tap another ingredient or background. ✓
- (d) mobile: β fallback. ✓

**Q5 (cluster relabel signal)**:
- LLM-derived (option III). ✓
- K=10 stays. ✓

**Q6 (tier compound rule)**:
- Bridge compound must be in BOTH top-5.
- Lenient fallback when ≥1 side lacks compound data
  (★★★ at strength ≥ 0.85). ✓

**Q7 (display counts)**:
- ★★★: top 5 / ★★: top 10 / ★: top 15. ✓

**Final ambiguity**: ~16% — under threshold. Spec written.

</details>

---

## Pipeline next step

Per the deep-interview skill chain, this spec hands off to
**`omc-plan --consensus --direct`** for multi-agent plan refinement,
then **`autopilot`** for execution. The executor sees:
- Phase 1 (cluster relabel) is the lowest-risk and highest-immediate-
  visible-impact change. Ship first.
- Phases 2-3 (α-mode + β-mode) are the headline UX. Ship next.
- Phase 4 (filters) is parked.
