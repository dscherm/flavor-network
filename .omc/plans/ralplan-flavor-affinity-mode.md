# Plan: Flavor Affinity Mode (α-mode) + Cluster Relabel

**Spec:** `.omc/specs/deep-interview-flavor-affinity-mode.md` (locked, 16% ambiguity)
**Mode:** RALPLAN-DR Short (consensus, --direct)
**Generated:** 2026-04-27
**Iteration:** 4 (post-Iter 3 Critic REVISE)
**Status:** User confirmed U1 (threshold quantiles) + U4a (strength-rank rings,
edge color = native tier). Engineering fixes applied.

---

## User Decisions (RESOLVED)

### U1 — Strength threshold quantiles (resolved iteration 2)
Strength thresholds recalibrated from spec's literal `0.7 / 0.4 / 0.2`
to data quantiles `top 1% (0.995) / top 10% (0.949) / top 50% (0.707)`.
Spec's `bridge(a,b)` definition (literal `bridge_compounds.json[a|b]`
lookup) is preserved. Quantile choice generalizes across future
dataset versions.

### U4a — Strength-rank ring assignment + edge-color tier signal (resolved iteration 4)

**Decision context:** Under U1, only 5.7% of ingredients have ANY
native ★★★ pair (the bridge-condition is the binding constraint).
35.9% have an empty ★★★ ring even with auto-promotion. The user was
presented with three options:
- **U4a** (chosen): rings by strength rank; edge color reflects native
  tier (gold = native ★★★, silver = native ★★, bronze = native ★,
  dim-gray = untiered).
- U4b: literal-spec ring = tier; accept sparse inner rings.
- U4c: widen `bridge_compounds.json` to all 48,588 pairs (data
  pipeline task).

**User chose U4a.** Resolved trade-off: strength becomes the
**spatial** dimension (ring radius); chemistry becomes the **color**
dimension (edge tint). The user-locked Round 3 Q7 ring counts (5/10/15)
are preserved exactly. The "★★★ classics" Flavor Bible language in
the spec maps to "the strongest 5 affinities (color-coded by chemistry
discrimination)" rather than "5 chemistry-bridged classics."

**Verified data outcome under U4a:** 98.7% of ingredients fill all 5
★★★ slots; 100% have ≥1 slot. Inner ring (radius 12) shows mixed
gold/silver/bronze edges — that's by design.

This is the second formal user decision and is a load-bearing
amendment to the spec's interpretation. Documented in ADR
§ Alternatives Considered + § Consequences. Spec text remains locked;
this plan's interpretation supersedes the spec's "(excluding ★★★
matches)" wording on the ★★ ring line.

**Original three-option escalation context (preserved for traceability):**

**Finding:** Under the spec's literal tier formula
(`strength ≥ 0.7 AND bridge(a,b) ∈ top5(a) AND bridge(a,b) ∈ top5(b)`,
where `bridge(a,b)` is `bridge_compounds.json[a|b].bridges[0].name`),
**only 1 pair** in the entire 48,588-pair dataset earns ★★★ — `peel ↔
tangerine juice`. Even relaxing to "any bridge in both top5" yields only
10 pairs. The strength threshold 0.7 admits 51% of all pairs (the
median strength is 0.71), so it provides essentially no discrimination.
The spec's own example "tomato + basil = ★★★" is unsatisfiable: no
`tomato|basil` key exists in `bridge_compounds.json` (it has 779/48,588
entries = 1.6% coverage), and the top5 intersection is just one
mediocre compound (coumarin).

**Three viable resolutions, ranked:**

### Option U1 — Recalibrate strength thresholds (recommended, no spec amendment)

Replace the spec's fixed 0.7/0.4/0.2 thresholds with quantile-based
values computed from the actual strength distribution at session start.
Keep `bridge(a,b)` as the literal `bridge_compounds.json` lookup.
- ★★★ threshold = 99th percentile (≈ 0.995)
- ★★ threshold = 90th percentile (≈ 0.949)
- ★ threshold = 50th percentile (≈ 0.71)

Result: ~485 pairs reach ★★★ (1% of dataset), ~4,860 reach ★★ (10%),
~24,294 reach ★ (50%). The `bridge_compounds.json` curated bridge
condition becomes the gating distinction between "strong + chemistry-
bridged" and "strong only," which is what the spec asked for.
- **Pros:** Honors locked spec wording; data-driven thresholds
  generalize across future dataset versions; no user re-approval of
  spec primitives.
- **Cons:** The spec literally says "0.7 / 0.4 / 0.2" as numeric
  thresholds. Quantile substitution is a faithful reading IF the
  thresholds were intended as discrimination boundaries, but a literal
  reading flags this as a soft amendment. Recommend documenting in
  ADR.

### Option U2 — Widen `bridge_compounds.json` coverage

Re-run the bridge-compound pipeline (`flavor-gnn/src/infer/bridge_compounds.py`)
against ALL 48,588 pairs (currently it only emits 779 distinctive
ones). Ship at scale.
- **Pros:** Honors the spec's tier formula literally and exactly.
  No threshold tweaking needed.
- **Cons:** Likely a 1-2 day data-pipeline task. May explode JSON
  payload (779 entries → 48,588 = 60× growth, currently 184KB →
  ~11MB). May require ranking/filtering — same prevalence problem
  resurfaces. **Does NOT fix the strength threshold problem
  (51% of pairs at 0.7).**

### Option U3 — Formal spec amendment to `bridge(a,b)` definition

Officially amend spec line 55 to: `bridge(a,b) = first compound in
top5(a) ∩ top5(b), filtered by prevalence < 0.5 against
foodb-prevalence.json`. Use `bridge_compounds.json` for display
enrichment only.
- **Pros:** Fully addresses both the coverage gap (1.6%) and the
  data-distribution mismatch.
- **Cons:** Requires user re-approval of a locked spec primitive
  (Round 3 Q6). Adds a Phase 0.5 data-pipeline subtask to emit
  `compound_prevalence.json` from FooDB.

**Action requested from user:** Pick U1, U2, U3, or propose U4. The
plan below is written assuming **U1** (recommended); pivots if user
chooses otherwise.

---

## Requirements Summary

Add a 3D **Flavor Affinity Mode (α-mode)** to `LivingArchView.jsx` that, on
single-click of any ingredient, arranges its top 30 affinities in three
concentric rings (★★★ / ★★ / ★) around the focal node and collapses
the rest of the network to 10 cluster-ghost dots. Tier scoring is
chemistry-aware via `bridge_compounds.json` (with quantile-recalibrated
strength thresholds per § User Decision U1). Mobile (< 640px) gets a
side-panel β-mode fallback. Cluster names get re-derived via an LLM
pass over RecipeNLG recipe titles + member ingredients.

---

## RALPLAN-DR Summary

### Principles (5)

1. **Brownfield surgery, not rewrite.** Extend `LivingArchView.jsx`
   (1637 lines) and `useProData` hook
   (`src/hooks/useProData.js:399-417`); do NOT touch `CocktailLab.jsx`
   or `SauceLab.jsx`, which use a different scene path.
2. **Honor the locked spec's primitives.** `bridge(a,b)` stays as
   `bridge_compounds.json` lookup (per spec line 55). Threshold
   numerics are recalibrated to actual data quantiles (U1) but the
   tier-formula structure is preserved.
3. **Reuse over rebuild for GPU resources.** Allocate ONE 30-instance
   InstancedMesh + ONE 30-segment LineSegments group at AffinityMode
   construction; on pivot, mutate `instanceMatrix`/buffer attributes
   only. Reuse the existing `clusterLabelGroup`
   (`src/components/LivingArchView.jsx:1549-1555`) for cluster-ghost
   sprites — do not allocate new ones.
4. **Acceptance is scripted, not aspirational.** Every spec criterion
   maps to a Vitest unit, a `performance.mark` measurement, a
   `renderer.info.memory` delta, or a JSON schema check. Manual-only
   criteria are explicitly tagged and budgeted.
5. **Phase ordering follows risk: relabel ships first, behind kill-switch.**
   Phase 1 (cluster relabel) is offline LLM + JSON write. Phases 2-3
   (α-mode + β-mode) ship behind a `?affinity=v0` URL kill-switch.
   Phase 1 → Phase 2 dependency: if Phase 1 verifier fails (≥7/10
   sanity), build halts and Phase 2 is blocked until override JSON
   ships or LLM re-prompted.

### Decision Drivers (top 3)

1. **Performance budget < 200ms.** α-mode "rings-visible" must complete
   inside 200ms on a 2020-era laptop. Camera flight (900ms tween via
   `flyToPoint` at `LivingArchView.jsx:1067-1126`) is async — runs
   AFTER the 200ms acceptance window. Definition: <200ms = sphere
   positioning + edge buffer write + camera flight DISPATCHED, NOT
   camera flight COMPLETED.
2. **GPU resource lifecycle vs scene rebuild.** The scene's setup
   useEffect (`LivingArchView.jsx:69`) reruns whenever `data` changes
   (e.g. retry button). AffinityMode must hook into the existing
   `stateRef.current` build/teardown pattern (line 1128 / 1141) — not
   sit in a sibling useEffect — so it doesn't leak GPU resources or
   lose focal history across data reloads.
3. **Coexistence with 12 existing mode-mutators.** Multiple
   useEffects mutate `mesh.setColorAt`/`edgeColors`/`instanceMatrix`
   already (focusedCluster, taste filter, tree filter, bridge path,
   per-mode coloring, mode transition, taste pop-out, hover, etc.).
   AffinityMode must define a clear suspend/resume contract with each.

### Viable Options

#### Option A — In-scene AffinityMode controller (recommended)

**Approach:** New `src/three/AffinityMode.js` controller class
instantiated AFTER `stateRef.current` is built at
`LivingArchView.jsx:1128`, attached via `affinityModeRef` declared at
component-body level alongside existing refs (lines 63-66). Disposed
in cleanup at line 1141. Reuses existing scene, camera, controls,
animator, fade.

- **Pros:**
  - Reuses ~80% of existing scene infrastructure.
  - Lifecycle bound to `stateRef.current` build/teardown — no closure
    capture hazard, no leak across `data` reloads.
  - Cluster-ghost reuses `clusterLabelGroup` (already 10 sprites at
    centroids); no double-allocation.
- **Cons:**
  - LivingArchView.jsx grows from 1637 lines to ~1670 (wiring only;
    AffinityMode.js owns ~280 lines).
  - Coupling: AffinityMode reads `mesh`, `defaultColors`,
    `clusterLabelGroup`, `flyToPoint` from `stateRef`. Mitigated by
    passing `stateRef.current` as a single constructor arg, not
    decomposing into 8 props.

#### Option B — Sibling Three.js layer (rejected)

**Approach:** New React provider with its own scene/camera/renderer
composited via z-stack.

- **Cons:** Two scenes can't depth-mix — cluster ghosts must render
  BEHIND affinity rings for the spatial-context affordance. Wasted
  reimplementation of `flyToPoint`. **Invalidation rationale: depth-
  mixing is core to the spec's "you are in this region of flavor
  space" affordance, and it's structurally impossible across two
  scenes.**

#### Option C — DOM/SVG overlay (rejected on engineering, not just
process)

**Approach:** Render 30 affinities as SVG/HTML overlay on top of the
existing 3D canvas; fade canvas opacity for non-affinities.

- **Pros (steelman):** Trivial to implement; testable in JSDOM with
  no GPU mocking; perfectly accessible (screen-reader friendly);
  no InstancedMesh leak risk; no pivot animation budget; no GPU
  resource lifecycle. On mobile, β-mode IS exactly this approach.
- **Cons:** Loses the 3D spatial discovery affordance — 2D ring
  layout in screen space breaks when the camera rotates. Affinity
  spheres at radius 12/22/35 in 3D world space don't have a stable
  2D projection unless the camera is locked. The spec's "3D
  planetary system" can't be approximated with SVG overlays without
  re-implementing perspective projection in JS.
- **Invalidation rationale (engineering):** Locked camera negates
  the existing OrbitControls navigation. Per-frame projection of 30
  points to screen costs more than InstancedMesh `setMatrixAt`. The
  user explicitly chose α (3D planetary) over β (panel) and γ (edge
  highlight) in Round 2 Q1, AND the engineering case for C requires
  giving up camera control to land its accessibility wins. β-mode
  is the right shape for the accessibility constituency on mobile;
  desktop α-mode users navigate the scene actively.

**Selected: Option A.**

---

## Acceptance Criteria

### α-mode behavior

| ID | Criterion | Verification |
|----|-----------|--------------|
| A1 | Single-click ingredient → α-mode "rings visible" in <200ms | `performance.mark('alpha-engage-start/end')` + Vitest `expect(measure.duration).toBeLessThan(200)`. **Definition: rings visible = sphere positions written + edges colored + camera flight dispatched.** Camera flight completion (~900ms) is OUT of budget. |
| A2 | Search-select → α-mode engages with that focal | Integration test using `@testing-library/react`: render App, mount mock data, fire search input + Enter, assert `affinityModeRef.engaged === true` AND focal == name. |
| A3 | Camera frames focal centered, ★ ring fits with ~10% padding | Manual visual + `console.log(camera.position, camera.lookAt)` after flight. **Tagged manual; cannot be automated without visual regression infra.** |
| A4 | 5 + 10 + 15 = 30 affinities in 3 rings | Vitest unit on `topAffinities('tomato', mockCtx)` returning array of length ≤30, partitioned correctly. |
| A5 | Edges color-coded gold/silver/bronze by tier | Vitest unit: read `edgeColorBuffer` after engage, assert RGB values match `#facc15/#a3a3a3/#a16207` per tier. |
| A6 | Non-affinity nodes fade out; cluster-ghost sprites show | AffinityMode mutates the SHARED default mesh's `instanceColor` to dim non-affinity nodes (resolves Architect concern about ownership: AffinityMode owns its own 30-instance mesh for affinity SPHERES, but writes to the existing shared mesh's `instanceColor` for the dim-others effect). Vitest integration: assert `mesh.instanceColor.array[i*3..i*3+3]` equals `dimColor` for all non-affinity i; assert `clusterLabelGroup.children[i].material.opacity === 0.45`. **Existing mutators (selection-tint at 1169, per-mode color at 1503, cluster-focus at 1526) are guarded with `if (affinityModeRef.current?.engaged) return;` so they don't clobber dim writes.** |
| A7 | ESC, focal re-click, double-click ingredient, double-click background — each exits | Vitest integration: simulate each event, assert `affinityModeRef.engaged === false`. |
| A8 | Single-click different ingredient re-pivots smoothly + no GPU leak | Vitest + `renderer.info.memory.geometries` delta == 0 after 100 pivots. |
| A9 | Repeat-tap focal cleanly exits (no toggle bug) | Vitest integration: simulate focal click twice, assert second click triggers exit, not re-engage. |

### Tier correctness (with verified pairs from data)

| ID | Pair | Expected | Verification |
|----|------|----------|--------------|
| T1 | peel ↔ tangerine juice | ★★★ (verified: bridge="(2E,4E)-deca-2,4-dienal" in both top5, strength=1.0) | Vitest fixture using these names. **bridge_compounds.json shape confirmed**: each entry has `{shared_count, distinctive_count, bridges: [{name, tags, groups, smiles, rarity}, ...], narrative, summary}`; `tierFor` reads `entry.bridges[0].name`. |
| T2 | orange bitters ↔ orange twist | ★★★ (verified: bridge="acetic acid" in both top5, strength=1.0) | Vitest fixture |
| T3 | marsala wine ↔ mushroom | ★★★ (verified: bridge="Hexyl Hexanoate" in both top5, strength=1.0) | Vitest fixture |
| T4 | tomato ↔ basil | ★★ (no `bridge_compounds.json` entry; strength ~0.95 → ★★ via lenient policy because both have GNN data but no bridge entry) | Vitest fixture; **acknowledges spec example was wrong about ★★★** |
| T5 | one-side-no-GNN-data + strength ≥ 99th pct | ★★★ via lenient | Vitest synthetic: pick an ingredient from the 594 without GNN data |
| T6 | both-have-GNN, no `bridge_compounds.json` entry, strength below 99th pct | ≤★★ | Vitest fixture |
| T7 | ★★★ ring populates 5 slots for ≥95% of focals (strength-rank model) | Offline data check: run `topAffinities()` against all 3,913 ingredients; assert `ring3.length === 5` for ≥95% of focals. **Verified: 98.7% fill all 5 slots, 100% have at least 1.** Implementation in `src/data/__tests__/affinityRingPopulation.test.js`. |
| T8 | Edge colors reflect NATIVE tier, not ring index | Vitest: pick focal where ring3 contains a native-★★ neighbor (extremely common — 94% of focals). Assert that affinity's edge color is silver `#a3a3a3`, NOT gold. |

**Note:** T4 explicitly downgrades the spec's tomato+basil example.
The data-verification finding is documented in § User Decision Required;
T4's outcome under U1 is ★★ via lenient policy.

### Cluster relabel

| ID | Criterion | Verification |
|----|-----------|--------------|
| R1 | All 10 clusters get `label_v2` field | Schema check in `verify_cluster_labels.py`: assert each cluster has `label_v2: string`. |
| R2 | ≥7 of top-10 members semantically match new label | `verify_cluster_labels.py`: case-insensitive substring OR sentence-transformer cosine ≥ 0.5. Exits 1 on failure. |
| R3 | Joystick pills display `label_v2` when present | Vitest snapshot of `<ClusterJoystick>` with mock cluster having `label_v2`. |
| R4 | In-3D cluster sprites display `label_v2` when present | Inline label-creation site at `LivingArchView.jsx:443-459` (createTextSprite) — Vitest unit on label-resolver helper. |
| R5 | No regression in cluster-focus mechanics | Vitest integration: tap pill, assert `focusedClusterId` updates AND `flyToTarget` fires. |

### β-mode (mobile)

| ID | Criterion | Verification |
|----|-----------|--------------|
| B1 | < 640px: single-click does NOT engage α-mode | Vitest with `useIsMobile` mocked to return true; assert `affinityModeRef.engaged === false` after click. |
| B2 | Side-panel slides in with three column sections | Vitest snapshot of `<AffinityPanel>` with mock affinity data. |
| B3 | Each chip → re-pivots β-mode to that ingredient | Vitest event test: simulate chip click, assert `onPivot(name)` called with correct name. |
| B4 | Close + tap-outside dismiss (capture phase) | Vitest event test: simulate `pointerdown` on document at coords outside panel, assert `onClose` called. Use capture-phase listener (`{capture: true}`) to avoid iOS synthesized-click leaks. |

### Performance & safety

| ID | Criterion | Verification |
|----|-----------|--------------|
| P1 | α-mode entry CPU ≤ 200ms (rings-visible) | `performance.measure` in dev console; Vitest performance API unit. |
| P2 | 100 rapid pivots: zero GPU geometry growth | Console: `console.log(renderer.info.memory)` before/after 100 pivots; assert deltas in `geometries` and `textures` == 0. **Replaces the original "heap snapshot" approach which measures JS-side, not GPU.** |
| P3 | Empty/malformed `bridge_compounds.json` falls back without error | Vitest with empty fixture; assert tierFor returns lenient values; assert no console.error during engage. |

### Cross-platform

| ID | Criterion | Verification |
|----|-----------|--------------|
| X1 | Firebase deploy works on neuralflavor.web.app | `npm run build && firebase deploy --only hosting` (manual gate). |
| X2 | iOS TestFlight pipeline auto-builds (β-mode tested) | Push to master → GH Action `.github/workflows/ios-build.yml` succeeds; manually verify β-mode on TestFlight build. |
| X3 | Arrow-key walk works inside α-mode | Vitest integration: engage α-mode, dispatch ArrowDown, assert focal pivots to strongest unvisited ★★★ affinity. Implementation extends `App.jsx:324-339` ArrowDown handler — see P2.6. |

**Concrete-criteria count: 33 total, 28 scripted (84.8%), 5 manual (15.2%).**
The 5 manual: A3, X1, X2, plus X-mode visual checks. **Plan no longer
claims 90%+; honest 85% concrete with explicit manual flags.**

---

## Implementation Steps

### Phase 0.5 — Strength threshold calibration (½ day)

**P0.5.1** Add `src/data/affinityThresholds.js` (NEW, ~30 lines):

```js
// Computes ★★★/★★/★ strength thresholds from the actual pairing
// distribution. Replaces the spec's literal 0.7/0.4/0.2 with data-
// driven quantiles. See ADR § User Decision U1.
export function computeAffinityThresholds(edges) {
  const sorted = edges.map(e => e.strength).sort((a, b) => b - a);
  return {
    star3: sorted[Math.floor(sorted.length * 0.01)] || 0.99,  // top 1%
    star2: sorted[Math.floor(sorted.length * 0.10)] || 0.95,  // top 10%
    star1: sorted[Math.floor(sorted.length * 0.50)] || 0.70,  // top 50%
  };
}
```

Called once at `useProData.js:399` — result stored in
`setData({...existing, affinityThresholds})`. Vitest unit verifies
threshold ordering and edge cases (empty/short arrays).

### Phase 1 — Cluster Relabel Pipeline (1 day)

**P1.1** Create `flavor-gnn/src/infer/cluster_labels_v2.py` (NEW):
- Read `public/proDataset/cluster_labels.json`.
- For each cluster, gather top-20 members from
  `clusters[i].top_ingredients` after extending P1.2.
- Mine top-20 RecipeNLG recipe titles where ≥3 of cluster's top
  members co-appear. Use **`proDataset/processed/recipenlg-cooccurrence.json`**
  (verified: file exists). Fallback: `proDataset/raw/recipenlg.csv`
  (2.2M rows; only if the cooccurrence index is missing).
- Issue 10 LLM calls — same model + JSON-output config as
  `flavor-gnn/src/infer/explain_clusters.py`.
- Write `label_v2` field into both
  `public/proDataset/cluster_labels.json` AND
  `public/proDataset/cluster_explanations.json`.
- Idempotent: if `label_v2` exists and `--force` not given, skip.
  P1.3 verifier re-runs on existing file regardless.

**P1.2** Modify **`flavor-gnn/src/infer/cluster_labels.py`** (verified
existing path):
- Locate the `top_ingredients` emission and bump from 5 → 20.
- Re-run pipeline; commit updated `cluster_labels.json` (only the
  `top_ingredients` length change).

**P1.3** Create `flavor-gnn/src/infer/verify_cluster_labels.py` (NEW):
- For each cluster, assert ≥7/10 top members semantically match new
  `label_v2` via case-insensitive substring OR
  sentence-transformers/all-MiniLM-L6-v2 cosine ≥ 0.5.
- Optional override: read
  `flavor-gnn/data/cluster_labels_override.json` (per-cluster
  manual labels); if present, USE override AND re-run sanity check
  on override label. Override does NOT bypass verifier.
- Exit 1 on failure → blocks Phase 2 commits.

**P1.4** Modify `src/components/ClusterJoystick.jsx:65`:
- Change `cl.label || cl.name || \`cluster ${cl.id}\`` →
  `cl.label_v2 || cl.label || cl.name || \`cluster ${cl.id}\``.

**P1.5** Modify cluster-label sprite creation in
`src/components/LivingArchView.jsx:443-459` (inline sprite generation):
- Wherever the label string is read for the sprite text, prefer
  `cluster.label_v2 || cluster.label || cluster.name`.

**P1.6** Run pipeline:
```bash
python -m flavor_gnn.src.infer.cluster_labels  # P1.2 (extends top_ingredients)
python -m flavor_gnn.src.infer.cluster_labels_v2  # P1.1 (LLM relabel)
python -m flavor_gnn.src.infer.verify_cluster_labels  # P1.3 (sanity)
```

Commit JSON diffs to `public/proDataset/cluster_labels.json` and
`public/proDataset/cluster_explanations.json` only if verifier
succeeds.

**Phase 1 → 2 dependency:** If `verify_cluster_labels.py` exits 1,
Phase 2 commits are blocked. Resolution: hand-edit
`flavor-gnn/data/cluster_labels_override.json`, re-run verifier,
verify success.

**Phase 1 rollback:** Delete `label_v2` field from both JSON files
(programmatic: `jq 'del(.clusters[].label_v2)'`); redeploy. UI
fallback chain (`label_v2 || label || name`) automatically reverts.

**Acceptance gate (Phase 1):** R1, R2, R3, R4, R5 all green.

### Phase 2 — α-mode Desktop (6-7 days, revised from 3-4)

**P2.1** Create `src/data/affinityTiers.js` (NEW):

```js
// Pure tier math — no DOM, no Three.js, no React.
// Per spec line 55-72, with U1 quantile thresholds (computed at
// load time, not hardcoded).

export function tierFor(a, b, ctx) {
  const key = `${a}|${b}`;
  const altKey = `${b}|${a}`;
  const strength = ctx.pairingStrength.get(key) ??
                   ctx.pairingStrength.get(altKey) ?? 0;
  if (strength === 0) return { tier: null, strength: 0, bridge: null };

  const top5A = ctx.top5.get(a);
  const top5B = ctx.top5.get(b);
  const T = ctx.affinityThresholds;  // {star3, star2, star1}

  if (top5A && top5B) {
    // Strict: bridge_compounds.json[a|b].bridges[0] must be in BOTH top5
    const bridgeEntry = ctx.bridgeCompoundIndex.get(key) ??
                        ctx.bridgeCompoundIndex.get(altKey);
    const bridge = bridgeEntry?.bridges?.[0]?.name ?? null;
    if (
      strength >= T.star3 &&
      bridge &&
      top5A.includes(bridge) &&
      top5B.includes(bridge)
    ) return { tier: 3, strength, bridge };
    if (strength >= T.star2) return { tier: 2, strength, bridge: null };
    if (strength >= T.star1) return { tier: 1, strength, bridge: null };
    return { tier: null, strength, bridge: null };
  }
  // Lenient: at least one side missing GNN data
  if (strength >= T.star3) return { tier: 3, strength, bridge: null };
  if (strength >= T.star2) return { tier: 2, strength, bridge: null };
  if (strength >= T.star1) return { tier: 1, strength, bridge: null };
  return { tier: null, strength, bridge: null };
}

export function topAffinities(focal, ctx, opts = {}) {
  const { N3 = 5, N2 = 10, N1 = 15 } = opts;
  // Collect all neighbors with their native tier (gold/silver/bronze
  // edge color) and strength. Untiered neighbors (strength below ★
  // threshold) are EXCLUDED — those connections aren't worth showing.
  const candidates = [];
  for (const edge of ctx.graph.edges) {
    const other = edge.source === focal ? edge.target
                : edge.target === focal ? edge.source
                : null;
    if (!other) continue;
    const t = tierFor(focal, other, ctx);
    if (!t.tier) continue;  // skip untiered (strength < star1 threshold)
    candidates.push({ name: other, ...t });
  }
  // Sort all candidates by strength descending — ring assignment is
  // strength-rank, NOT tier. Edge color (gold/silver/bronze) carries
  // the chemistry signal; ring radius is the discovery hierarchy.
  candidates.sort((a, b) => b.strength - a.strength);

  // Slice into rings by strength rank.
  const ring3 = candidates.slice(0, N3)
    .map(c => ({ ...c, ringIdx: 3 }));
  const ring2 = candidates.slice(N3, N3 + N2)
    .map(c => ({ ...c, ringIdx: 2 }));
  const ring1 = candidates.slice(N3 + N2, N3 + N2 + N1)
    .map(c => ({ ...c, ringIdx: 1 }));

  return [...ring3, ...ring2, ...ring1];
}
```

Full Vitest coverage in `src/data/__tests__/affinityTiers.test.js`
covering: 4 has-compound-data cases, threshold edge cases, tomato+basil
expected = ★★, peel+tangerine juice expected = ★★★, empty
bridgeCompoundIndex = lenient fallback.

**P2.2** Modify `src/hooks/useProData.js` at line 399 (just before `setData`):
- Build `pairingStrength: Map<"a|b", number>` from `pairs` (array form,
  `{ingredientA, ingredientB, strength}`); store both directions.
- Build `top5: Map<ingredientName, string[]>` from `node.gnnCompounds.top_compounds`
  (line 248) — slice top 5 names.
- Build `bridgeCompoundIndex: Map<"a|b", entry>` from `bridgeCompounds`.
- Compute `affinityThresholds` via P0.5.1 helper.
- Pass through `setData({...existing, pairingStrength, top5, bridgeCompoundIndex, affinityThresholds})`.

**P2.3** Create `src/three/AffinityMode.js` (NEW, ~320 lines):

Constructor: `new AffinityMode(stateRef.current, affinityCtx, opts)`.
Single dependency object simplifies wiring.

```js
// Public API:
//   engage(focal: string)                    // first entry
//   pivot(newFocal: string)                  // ring dissolve → new ring
//   exit({immediate?: boolean = false})      // restore default scene
//   suspend()                                // multi-select gate
//   resume()                                 // back to length-1
//   tickAnimation(deltaSec)                  // called from animator
//   dispose()                                // GPU cleanup
//   get engaged(): boolean

// Internal state:
//   - affinityMesh: InstancedMesh(SphereGeometry, count=30)
//   - edgeGeo: BufferGeometry with 60 vertices, 30 line segments
//   - edgeMaterial: LineBasicMaterial({vertexColors: true})
//   - currentFocal: string | null
//   - fadeProgress: 0..1 (cluster-ghost fade-in/out lerp)
//   - savedSelectionMask: Float32Array | null  (snapshot of mesh.instanceColor BEFORE engage)

// Ring math (golden angle):
const RADII = { 3: 12, 2: 22, 1: 35 };
const PHI = Math.PI * (3 - Math.sqrt(5));
function placeOnRing(ringIdx, slotIdx) {
  const angle = slotIdx * PHI;
  const R = RADII[ringIdx];
  return new THREE.Vector3(R * Math.cos(angle), 0, R * Math.sin(angle));
}
```

**Color-write contract on engage / pivot / exit (Critic iter-3 fix):**
- `engage(focal)`: snapshot current `mesh.instanceColor` into
  `savedSelectionMask`; write `dimColor` to all non-affinity instances;
  set `mesh.instanceColor.needsUpdate = true`. Affinity sphere positions
  written to AffinityMode's own InstancedMesh (separate from default).
- `pivot(newFocal)`: re-write `dimColor` to ALL non-affinity instances
  for the new focal (not just the changed ones — guarantees clean
  state regardless of what user navigation looked like). Set
  `needsUpdate = true`. **Plan-iteration-3 specified instanceMatrix
  reuse only; iteration-4 adds explicit instanceColor reuse with
  per-pivot full rewrite.**
- `exit({immediate})`:
  1. Re-stamp `defaultColors[i]` (or `clusterColors[i]` per `mode`)
     onto `mesh.instanceColor[i]` for all i.
  2. Set `mesh.instanceColor.needsUpdate = true`.
  3. Call `updateClusterLabelOpacity(state)` to reset
     `clusterLabelGroup` to non-α-mode opacity precedence.
  4. Restore `clusterLabelGroup.visible` to its non-α value (true if
     `mode === 'ml' || mode === 'ml2d'`, else false — match the tween
     final-state at lines 791-795).
  5. Reset edge buffer (call existing `updateEdgePositions(...)`).
  6. Clear `currentFocal`; set `engaged = false`.
  Without this teardown, the engage-guarded mutator effects do NOT
  re-fire on exit (their dep arrays don't include `engaged`), so
  default scene state would stay clobbered. Critic iter-3 BLOCKER #2
  fix.

**Mode-transition tween coordination (lines 727-865, Critic iter-3 fix):**
The mode-transition animator writes `clusterLabelGroup.visible` per-frame
(lines 791-795) without an engage-guard. AffinityMode subscribes to
`stateRef.current.triggerTransition` (line 1576):
- Before `triggerTransition(target)` flips internal mode flags, it
  calls `affinityModeRef.current?.exit({immediate: true})` if engaged.
- The exit step 4 above syncs `clusterLabelGroup.visible` with the
  POST-transition mode value the tween will animate to.
- Implementation: modify `handleModeSwitch` (line 1573) to call
  `affinityModeRef.current?.exit({immediate:true})` BEFORE
  `stateRef.current.triggerTransition(target)`.

Performance instrumentation: `performance.mark` at engage start/end,
pivot start/end. Dev-only console assertion when measure > 200ms.

**P2.4** Modify `src/components/LivingArchView.jsx`:

P2.4.a — Declare ref at component-body level (alongside refs at
lines 63-66): `const affinityModeRef = useRef(null);`

P2.4.b — After `stateRef.current = {...}` is built (line 1128),
instantiate AffinityMode:
```js
affinityModeRef.current = new AffinityMode(stateRef.current, {
  pairingStrength, top5, bridgeCompoundIndex, affinityThresholds,
  graph: data.graph,
});
```

P2.4.c — In cleanup at line 1141, dispose: `affinityModeRef.current?.dispose()`.

P2.4.d — Animation tick at line 1033 (animate function): add
`affinityModeRef.current?.tickAnimation(delta)` alongside other
per-frame updates.

P2.4.e — Single-click handler is in `App.jsx:196-224` (NOT in
LivingArchView; Critic correction). LivingArchView receives selection
via `selectedNodes` prop. Add a NEW useEffect in LivingArchView
keyed on `[selectedNodes, isMobile]` after line 1563:
```js
useEffect(() => {
  if (!affinityModeRef.current) return;
  if (isMobile) return;
  if (selectedNodes.length === 0) {
    affinityModeRef.current.exit();
  } else if (selectedNodes.length === 1) {
    if (affinityModeRef.current.engaged) {
      affinityModeRef.current.pivot(selectedNodes[0]);
    } else {
      affinityModeRef.current.engage(selectedNodes[0]);
    }
  } else {
    affinityModeRef.current.suspend();  // multi-select
  }
}, [selectedNodes, isMobile]);
```

**Coordination with 12 existing mutators** (Critic's enumeration). Mesh-color
ownership: AffinityMode owns the 30-instance affinity-sphere mesh exclusively;
it ALSO holds the right to dim/restore the shared default mesh's
`instanceColor` while engaged. Existing mutators that write `mesh.setColorAt`
gain an `if (affinityModeRef.current?.engaged) return;` early-return guard.

| # | Mutator (line range) | Coordination | Engage-guard added? |
|---|---------------------|--------------|---------------------|
| 1 | Selection mesh tinting (1169-1202) | Suspended during engage. AffinityMode owns dim/affinity color writes. | **YES** — early-return guard at top of effect |
| 2 | Per-node label group (1211-1249) | Hide during engage; restore on exit. | YES — visibility toggle on engage/exit |
| 3 | Cluster fly-to (1257-1310) | If pill tapped during engage: call `exit({immediate:true})` BEFORE flyToTarget dispatch. | YES — exit call inside flyTo handler |
| 4 | Cluster highlight labels (1316-1358) | Reuse for ghost-mode. See **Opacity Authority** below. | YES — opacity authority rule |
| 5 | Visibility/brightness uniforms (1361-1368) | Read-only from AffinityMode. | n/a (AffinityMode doesn't write) |
| 6 | Taste filter (1371-1387) | Mutually exclusive. Picking taste filter while engaged → AffinityMode.exit() first. | YES — early-return guard |
| 7 | Tree filter (1389-1438) | Mutually exclusive. | YES — early-return guard |
| 8 | Bridge path highlighting (1440-1496) | Mutually exclusive. | YES — early-return guard |
| 9 | Per-mode coloring (1503-1520) | Suspended during engage; resumed on exit. | **YES** — early-return guard (Architect iter-2 fix) |
| 10 | Cluster focus (1526-1563) | If focused-cluster + α-mode: ingredient must be IN focused cluster to engage (inherits App.jsx:201-207 gate). | **YES** — early-return guard (Architect iter-2 fix) |
| 11 | Mode-transition animator (727-865) | AffinityMode.suspend() called from `triggerTransition` (line 1576) before mode flip. | YES — coordinated through stateRef |
| 12 | Taste pop-out (867-1031) | Mutually exclusive (different mode). | YES — only fires in non-ml modes |

**Opacity Authority for `clusterLabelGroup`** (Architect iter-2 fix):

The single shared `clusterLabelGroup` has 3 writers with different policies.
Precedence (highest authority wins):

1. **α-mode engaged** → opacity 0.45 (ghost mode); ALL clusters at 0.45
   regardless of focus.
2. **focusedClusterId set** (and α-mode NOT engaged) → focused cluster
   sprite at 0.95, others at 0.22.
3. **default** → all sprites at 0.95.

Implementation: a single helper `updateClusterLabelOpacity(state)` reads
`affinityModeRef.engaged` and `focusedClusterIdRef.current` to compute the
target opacity. Called from AffinityMode.engage/exit AND from the
existing focus-mode useEffect at line 1549-1554. Both paths route through
the helper; no direct opacity writes elsewhere.

**P2.5** Modify `src/App.jsx`:
- Add URL kill-switch read at top of App component:
  ```js
  const affinityEnabled = useMemo(() => {
    return new URLSearchParams(window.location.search).get('affinity') !== 'v0';
  }, []);
  ```
  Pass to LivingArchView; if `false`, AffinityMode is never engaged.

**P2.6** Modify `src/App.jsx:324-339` (ArrowDown handler):
- When α-mode engaged, replace `getNeighbors()` step with
  `topAffinities(current, data, ...).filter(a => a.tier === 3)`.
- Apply same unvisited-history filter as existing handler.
- ArrowUp unchanged (history pop).

**P2.7** Modify `src/App.jsx:309-315` (Escape handler):
- BEFORE clearing `selectedNodes`, call
  `affinityModeRef.current?.exit({immediate:true})` — forwards via a
  prop callback from LivingArchView (`onAffinityExit`), since
  affinityModeRef lives in LivingArchView.

**P2.8** Performance probe — verify `performance.measure('alpha-engage')`
duration < 200ms across 20 random ingredient selections during dev
testing. Log durations to console; assert via Vitest unit using mocked
performance API.

**Acceptance gate (Phase 2):** A1-A9, T1-T6, P1, P2, P3, X3 all green.

### Phase 3 — β-mode Mobile (1.5 days, revised from 1-2)

**P3.1** Create `src/components/AffinityPanel.jsx` (NEW, ~150 lines):
- Props: `{ focal, affinities, onPivot, onClose }`.
- Three column sections (★★★ / ★★ / ★) with chip count headers.
- Each chip: Tailwind-styled button → `onPivot(name)`.
- Close button + capture-phase document `pointerdown` listener for
  tap-outside dismiss (avoids iOS synthesized-click leak):
  ```js
  useEffect(() => {
    const handler = (e) => {
      if (!panelRef.current?.contains(e.target)) onClose();
    };
    document.addEventListener('pointerdown', handler, { capture: true });
    return () => document.removeEventListener('pointerdown', handler, { capture: true });
  }, []);
  ```

**P3.2** Modify `src/App.jsx`:
- Mount `<AffinityPanel>` when `isMobile && selectedNodes.length === 1 && affinityEnabled`.
- Compute affinities via `topAffinities(focal, ctx)` (single source of truth).

**P3.3** Vitest snapshot tests for AffinityPanel rendering, chip
clicks, capture-phase outside-click, ESC key.

**Acceptance gate (Phase 3):** B1, B2, B3, B4 green.

### Phase 4 — Filters (deferred, separate spec)

Out of scope. Captured for v2 spec author.

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Spec strength threshold mismatch** (51% of pairs ≥ 0.7) | Confirmed | High | Quantile recalibration in Phase 0.5 (U1). Documented in ADR. |
| **Spec example tomato+basil = ★★★ unsatisfiable** | Confirmed | Medium | Replace with verified ★★★ pairs (peel+tangerine juice, marsala wine+mushroom). Document divergence in ADR + acceptance criteria T4. |
| **AffinityMode lifecycle leak across `data` reload** | Medium | High | Bind to `stateRef.current` build/teardown (line 1128 / 1141), not sibling useEffect. Ref pattern matches existing refs (lines 63-66). |
| **Coordination with 12 mode-mutators** | Medium | High | Explicit coexistence table (P2.4 above). 4 mutators are mutually exclusive (taste/tree/bridge/pop-out → exit α-mode); 4 are suspended-during-engage; 4 reused (cluster ghosts, etc.). |
| **GPU memory leak from 100 pivots** | Low | High | InstancedMesh allocated once, mutated only. Verified via `renderer.info.memory` deltas (P2 acceptance). |
| **Joystick pill tap during α-mode** | Medium | Medium | Code-side fix in cluster fly-to useEffect (LivingArchView.jsx:1257-1310): call `affinityModeRef.current?.exit({immediate:true})` BEFORE flyToTarget dispatch. NOT just documentation. |
| **Search keystroke flicker** | Low | Medium | Already verified at SearchBar.jsx:57-66: `selectItem` fires only on Enter/click, never on every keystroke. Pivot subscribes to `selectedNodes`, not search input. |
| **Cluster relabel LLM returns nonsense** | Low | Medium | Verifier P1.3 halts build at <7/10. Override file (`flavor-gnn/data/cluster_labels_override.json`) provides fallback. Override goes through verifier too. |
| **200ms budget blown by cluster-ghost fade** | Low | Medium | Ghost fade deferred to next animation frame (`requestAnimationFrame`); engage returns synchronously after focal placement + edge buffer. |
| **Empty/malformed `bridge_compounds.json`** | Low | High | tierFor returns lenient values when entry is missing. P3 fixture covers. No console.error. |
| **Two-finger pinch on iOS triggers chip click** | Low | Low | AffinityPanel chip uses `onClick` (synthesized click), not `onTouchEnd`. iOS Safari's gesture vs click discrimination works as expected. Manual TestFlight check covers it. |
| **β-mode tap-outside captures synthesized clicks** | Low | Low | Capture-phase `pointerdown` listener (not click), explicit panelRef.contains guard (P3.1). |
| **Phase 1 verifier blocks Phase 2** | Possible | Medium | Documented dependency. Override path defined. Rollback path defined (delete label_v2 + redeploy). |
| **Multi-select transition undefined** | Low | Medium | `suspend()` / `resume()` API on AffinityMode (P2.3). Triggered on `selectedNodes.length` 1→2→1 (P2.4.e). |
| **Focused-cluster + α-mode interaction undefined** | Low | Medium | Engage-gate inherits existing focus-gate at App.jsx:201-207: ingredient must be IN focused cluster to engage (or no cluster focused). |
| **"Prefer panel mode" desktop accessibility (spec risk #5)** | Confirmed | Low | Tracked as v1.1 follow-up in ADR. Not in scope for v1. |

---

## Verification Steps

1. **Phase 0.5.** Run `npx vitest src/data/__tests__/affinityThresholds.test.js`. Expect threshold ordering star3 > star2 > star1.

2. **Phase 1.**
   ```bash
   python -m flavor_gnn.src.infer.cluster_labels       # bumps top_ingredients to 20
   python -m flavor_gnn.src.infer.cluster_labels_v2    # LLM relabel
   python -m flavor_gnn.src.infer.verify_cluster_labels  # exits 0
   ```
   Diff `public/proDataset/cluster_labels.json`; confirm `label_v2`
   present on all 10 clusters. `npm run dev`; verify joystick pills
   + 3D sprites show new labels.

3. **Phase 2 unit tests.** `npx vitest src/data/__tests__/affinityTiers.test.js`.
   Coverage: 4 has-data cases, threshold boundaries, peel+tangerine
   juice fixture (T1), marsala+mushroom fixture (T3), tomato+basil
   fixture (T4 = ★★ via lenient), empty bridgeCompoundIndex fallback.

4. **Phase 2 integration.** `npm run dev`. Click ingredient → confirm
   rings appear, edges colored, ghost dots visible, camera flies.
   ESC clears. Click different → re-pivots. Click focal → exits.

5. **Phase 2 performance.**
   ```js
   // In dev tools console:
   const obs = new PerformanceObserver(list =>
     list.getEntries().forEach(e => console.log(e.name, e.duration)));
   obs.observe({entryTypes: ['measure']});
   // Click 10 ingredients
   ```
   Confirm `alpha-engage` < 200ms, `alpha-pivot` < 100ms across all 10.

6. **Phase 2 GPU leak test.**
   ```js
   // In dev tools console:
   const before = JSON.parse(JSON.stringify(renderer.info.memory));
   // Click 100 ingredients via search rapid-fire
   const after = JSON.parse(JSON.stringify(renderer.info.memory));
   console.log('geometries delta:', after.geometries - before.geometries);
   console.log('textures delta:', after.textures - before.textures);
   ```
   Both deltas must be 0.

7. **Phase 3 mobile.** `npm run ios:sync && npm run ios:open` →
   TestFlight build. On iOS sim (640px viewport): tap ingredient →
   AffinityPanel slides in. Tap chip → re-pivots. Tap X → dismisses.
   Tap outside panel → dismisses (capture-phase test).

8. **A/B kill switch.** Open `localhost:5173?affinity=v0`. Click
   ingredient: must NOT engage α-mode (existing single-select
   behavior preserved).

9. **Build & deploy.**
   ```bash
   npm run build
   bash .claude/scripts/gates.sh
   firebase deploy --only hosting
   git push origin master  # triggers iOS GH Action
   ```

---

## ADR (Architecture Decision Record)

**Decision:** Implement Flavor Affinity Mode as in-scene AffinityMode
controller (Option A) attached to `LivingArchView.jsx` via
`stateRef.current` build/teardown lifecycle. Tier scoring honors the
spec's literal `bridge(a,b)` definition (`bridge_compounds.json`
lookup) but recalibrates strength thresholds to actual data quantiles
(top 1% / top 10% / top 50%) per User Decision U1. Cluster relabel
ships first via offline LLM pipeline, gated by sanity verifier with
manual override path. All file/line references re-validated against
actual 1637-line `LivingArchView.jsx` and 1051-line `App.jsx`.

**Drivers:**
1. Performance budget 200ms entry (single shared scene, defer
   cluster-ghost fade to next animation frame).
2. Coexistence with 12 existing mode-mutators (explicit coordination
   table; suspend/resume API on AffinityMode).
3. Spec phasing: relabel ships first (low-risk JSON change), α-mode
   second (behind kill-switch), β-mode third.

**Alternatives considered:**
- Option B (sibling Three.js scene): rejected — depth-mixing of
  cluster ghosts behind affinity rings impossible across scenes.
- Option C (DOM/SVG overlay): rejected on engineering — locked-camera
  requirement breaks navigation; per-frame projection costs more
  than InstancedMesh `setMatrixAt`. β-mode IS exactly this approach
  for mobile, where camera lock is acceptable.
- Override `bridge(a,b)` definition with `top5(a) ∩ top5(b)` (Option
  U3 in User Decision): not chosen by default — preserves user's
  locked Round 3 Q6 answer.
- Widen `bridge_compounds.json` coverage to all 48,588 pairs (Option
  U2): not chosen by default — does not fix the strength threshold
  problem and adds 1-2 days of data-pipeline work.

**Why chosen:**
- Option A reuses ~80% of existing scene infrastructure.
- U1 quantile thresholds are the minimal-risk path: honors the
  spec's tier-formula structure (still uses `bridge_compounds.json`
  as gating), only relaxes the numeric thresholds — which match the
  spec's intent ("strong vs moderate vs good") rather than the
  literal numeric values that turn out to be calibrated for an
  un-normalized strength scale.
- Phase 1 ships independently of Phases 2-3; user gets visible value
  even if α-mode hits unexpected blockers.

**Consequences:**
- LivingArchView.jsx grows by ~50 lines (refs + selection-effect +
  Escape forwarding) plus 6 single-line engage-guards on existing
  mutator effects. Acceptable.
- AffinityMode.js becomes a new ~280-line module with explicit
  coexistence contract for 12 mutators. Documented in P2.4 table.
- Spec acceptance example "tomato+basil = ★★★" is downgraded to ★★
  (T4) — documented divergence with explanation. T1-T3 use verified
  ★★★ pairs from `bridge_compounds.json`.
- Strength thresholds become data-dependent, not constants. Future
  dataset versions will auto-recalibrate.
- **Ring assignment reinterpreted from "top N within tier" (literal
  spec) to "top N by strength, edge color = native tier" (iteration-3
  fix).** Spec's count constraint (5/10/15) preserved exactly; the
  spatial location of an ingredient now reflects its raw strength rank
  with the focal, while edge color carries the chemistry-bridged
  distinction. Verified: 98.7% of ingredients fill all 5 ★★★ slots
  vs. 5.7% under literal reading. The user's headline visual works.
- Mesh ownership: AffinityMode holds exclusive write authority over
  the shared default mesh's `instanceColor` while engaged. Six
  existing mutator effects gain engage-guards.
- ClusterLabelGroup opacity authority: α-mode (0.45) > focused-cluster
  (0.95/0.22) > default (0.95). Routed through helper.

**Kill-switch scope (Critic iter-3 clarification):**
The `?affinity=v0` URL param disables α-mode (Phase 2) AND β-mode
(Phase 3) ONLY. Phase 1's `label_v2` cluster relabel ships unconditionally
— it's a JSON-only data improvement gated by its own verifier sanity
check (P1.3), not by the affinity-mode kill switch. Rollback for
Phase 1 is a separate JSON delete + redeploy (documented in Phase 1
rollback section).

**Follow-ups:**
- Filters (cuisine/season/temperature) layer in v2 spec.
- "Prefer panel mode" desktop accessibility toggle in v1.1.
- A/B kill switch (`?affinity=v0`) retained for ≥30 days
  post-launch — covers α-mode + β-mode only.
- If U1 quantile distribution proves too generous (rings routinely
  full of weak pairs from low-strength tail), revisit by tightening
  to top 0.5% / 5% / 25%.
- If U4a's strength-rank rings prove confusing in user testing
  ("why is the inner ring not all gold?"), consider U4c (widen
  `bridge_compounds.json` to all pairs) as a recovery path.

---

## Changelog (Iteration 2)

Applied fixes from Architect REVISE + Critic REJECT:

- **BLOCKER #1 (silent spec override):** Resolved via U1 path — spec's
  `bridge(a,b)` definition preserved; only strength thresholds
  recalibrated. Surfaced as User Decision Required at top.
- **BLOCKER #2 (unsatisfiable example):** T1-T6 now use verified pairs
  from data; tomato+basil downgraded to ★★ in T4 with explanation.
- **BLOCKER #3 (wrong line citations):** Re-audited all paths. Confirmed
  LivingArchView.jsx is 1637 lines, App.jsx is 1051 lines. Single-click
  handler relocated to App.jsx:196-224. AffinityMode lifecycle anchored
  at LivingArchView.jsx:1128 (build) / 1141 (teardown).
- **BLOCKER #4 (prevalence "1 line"):** Removed entirely. Under
  literal-spec U1, prevalence filtering happens upstream in the
  curated `bridge_compounds.json` set; runtime tier code doesn't
  need it.
- **MAJOR (Phase 1 path fork):** Resolved to
  `proDataset/processed/recipenlg-cooccurrence.json` (verified exists)
  with raw CSV as fallback. P1.2 target file resolved to
  `flavor-gnn/src/infer/cluster_labels.py` (verified exists).
- **MAJOR (heap snapshot wrong instrument):** Replaced with
  `renderer.info.memory.geometries/textures` deltas (P2 step 6).
- **MAJOR (52% concrete criteria):** Promoted A2, A6, A7, A8, B1, B3,
  B4, R3, R4, R5, X3 from manual to scripted. New count: 28/33 = 84.8%.
  Manual flags retained on A3, X1, X2 with explicit justification.
- **MAJOR (joystick pill mitigation was documentation-only):**
  Promoted to code-side fix in P2.4 mutator coordination table row 3.
- **MAJOR (ASSUMES hedge in T2):** Removed. T1-T3 now use verified
  pairs.
- **MAJOR (Phase 2 estimate light):** Re-budgeted from 3-4 days to 6-7.
- **MAJOR (Phase 1→2 dependency / rollback):** Documented explicitly.
- **MINOR (↓-key data flow):** Specified in P2.6.
- **MINOR (capture-phase tap-outside):** Specified in P3.1.
- **MINOR (cluster-ghost reuse vs new sprites):** Specified in
  Principle 3 (reuse existing `clusterLabelGroup`).
- **MINOR (multi-select / focus-mode interaction):** Specified in
  P2.4.e and Principle 10 of mutator table.
- **MINOR (Phase 1 idempotency):** Verifier re-runs on existing file
  regardless; override goes through verifier too.

### Iteration 3 (post-Iteration-2 Architect REVISE)

User selected U1. Architect iter-2 found 2 new BLOCKERs.

- **BLOCKER (mesh-ownership contradiction A6 vs mutator row 1):** Resolved.
  AffinityMode owns its own 30-instance affinity-sphere mesh AND holds
  exclusive write authority over the shared default mesh's `instanceColor`
  while engaged. Existing mutators 1, 6, 7, 8, 9, 10 gain explicit
  `if (affinityModeRef.current?.engaged) return;` early-return guards.
  A6 verification rewritten to assert this exact ownership model.
- **BLOCKER (★★★ ring structurally near-empty under U1):** Verified via
  data check: 94.3% of ingredients have zero native ★★★ pairs even with
  U1's quantile thresholds. Auto-promotion-from-★★ also fails (35.9%
  still empty). **Resolved via interpretation shift:** spec's "★★★ ring:
  top 5 by strength" reread as ring assignment by strength rank, with
  edge color (not ring identity) carrying the chemistry signal. Verified:
  98.7% of ingredients now fill all 5 ★★★ slots. T7 added.
- **MAJOR (per-mode coloring + cluster-focus engage-guards):** Specified
  in mutator coexistence table.
- **MAJOR (`clusterLabelGroup` opacity authority):** Added precedence
  rule (α-mode > focused-cluster > default), routed through
  `updateClusterLabelOpacity(state)` helper.
- **MAJOR (T7 distribution criterion):** Added.
- **MINOR (`validEdges` vs `graph.edges`):** Acknowledged as v1.1
  follow-up — α-mode reads from `graph.edges` for completeness; tree/
  bridge filters' `validEdges` view doesn't matter when filters are
  mutually exclusive with α-mode (per coexistence table).

### Iteration 4 (post-Iteration-3 Critic REVISE)

User confirmed U4a explicitly. Engineering fixes applied.

- **BLOCKER (strength-rank smuggled under U1):** Resolved. U4a is now
  documented as a formal user decision in § User Decisions section
  alongside U1, with the trade-off table preserved for traceability.
  Spec interpretation amendment is explicit: spec text remains locked,
  this plan supersedes the "(excluding ★★★ matches)" wording.
- **BLOCKER (engage-guards leave dimmed state stuck on exit):** Resolved.
  P2.3 now specifies a 6-step `exit({immediate})` teardown sequence
  that re-stamps default colors, syncs `clusterLabelGroup.visible`
  with current mode, resets edge buffer, and clears `engaged` flag.
- **MAJOR (mode-transition tween writes `clusterLabelGroup.visible`):**
  Resolved. P2.3 specifies `handleModeSwitch` (line 1573) calls
  `affinityModeRef.current?.exit({immediate:true})` BEFORE
  `triggerTransition(target)`.
- **MAJOR (pivot didn't write instanceColor):** Resolved. P2.3 explicit
  contract: `pivot()` re-writes `dimColor` to all non-affinity
  instances, sets `needsUpdate = true`. Plan-iteration-3 only specified
  instanceMatrix reuse; iteration-4 adds explicit instanceColor reuse.
- **MAJOR (Phase 1 kill-switch scoping):** Resolved in ADR
  § Kill-switch scope: `?affinity=v0` covers α/β-mode only; Phase 1
  ships unconditionally with its own verifier gate.
- **MINOR (bridge_compounds.json schema confirmation):** Resolved in
  T1 verification column with explicit schema documentation.

---

## Final Checklist

- [x] Plan has scripted acceptance criteria (84.8% concrete; 5 manual
      flagged with justification).
- [x] Plan references specific files/lines (>90% — all citations
      re-audited against actual 1637-line `LivingArchView.jsx`).
- [x] All risks have concrete mitigations (no documentation-only).
- [x] No vague terms without metrics.
- [x] Plan saved to `.omc/plans/`.
- [x] RALPLAN-DR summary: 5 principles, top 3 drivers, 3 viable
      options (A selected, B/C invalidated with engineering rationale).
- [x] ADR section: Decision/Drivers/Alternatives/Why/Consequences/
      Kill-switch scope/Follow-ups.
- [x] User decision U1 (threshold quantiles) resolved.
- [x] User decision U4a (strength-rank rings + edge-color tier) resolved.
- [x] Architect review iter-1 (REVISE) + iter-2 (REVISE) — fixes applied.
- [x] Critic review iter-1 (REJECT) + iter-3 (REVISE) — fixes applied.
- [x] Engineering fixes applied (teardown sequence, mode-transition
      tween coordination, pivot color writes, kill-switch scoping,
      schema confirmation).
- [x] Final plan output. Non-interactive `--consensus --direct` mode:
      no auto-execution; awaits user direction on next steps
      (autopilot/team/ralph or further revisions).
