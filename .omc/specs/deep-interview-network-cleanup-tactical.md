# Deep Interview Spec: Network Cleanup Tactical Pack

## Metadata
- Interview ID: `network-cleanup-tactical-2026-05-18`
- Rounds: 6
- Final Ambiguity Score: **15.0%** (under 20% threshold)
- Type: **brownfield**
- Generated: 2026-05-18
- Threshold: 0.20
- Initial Context Summarized: yes (8-item brain-dump compressed; 3 deeper items deferred via Round 6 Simplifier scope cut)
- Status: **PASSED**

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.92 | 0.35 | 0.322 |
| Constraint Clarity | 0.85 | 0.25 | 0.213 |
| Success Criteria | 0.78 | 0.25 | 0.195 |
| Context Clarity (brownfield) | 0.80 | 0.15 | 0.120 |
| **Total Clarity** | | | **0.850** |
| **Ambiguity** | | | **0.150 (15.0%)** |

---

## Goal

Ship a tactical 5-item fix-pack against the **current** flavor model (8 taste + 6 aroma axes — no expansion this delivery) to clean up the Network and Affinity surfaces, hide the legacy Recipe Network mode from the user-facing mode cycle while preserving the byte-identical regression contract from the previous delivery (commit `42a8cb9`), and fix a visible iOS-specific rendering bug. The deeper flavor-codification expansion (3-tier hierarchical tree with Mosaic-style adjective leaves, ~2-week scope) is its own follow-up delivery and gets its own deep-interview spec.

### The 5 fixes (this delivery)

1. **Hide legacy from MODE_CYCLE.** Remove `'3D'` from `MODE_CYCLE` and `MODE_LABELS`; keep all rendering paths alive (posA Float32Array, CameraAnimator's `pivotAdvanceMs: null` path, legacy regression integration test). Bookmarked URLs and programmatic `setMode('3D')` calls continue to work. New `MODE_CYCLE = ['flavor3D', '2D']`.

2. **Fly-to lands AT the label.** Today's cluster fly-through (commit `42a8cb9`, `CameraAnimator.setPivotConfig`) pivots the orbit camera to each cluster's `centroid_3d`. But the cluster's text LABEL sprite sits at the centroid plus a fixed Y-offset (see `LivingArchView.jsx` label-sprite mount). The camera arrives at the centroid, NOT at the label position — labels appear above/below the camera's natural focal point. Fix: pivot to `label_position` (centroid + offset) instead of bare `centroid_3d` so the chosen cluster's label is the visual anchor when the camera arrives.

3. **Hide 3D model labels when in Affinity view.** When `AffinityMode` is engaged (focal ingredient selected, affinity wheel mounted), the flavor-cluster label sprites should hide. They currently render through the Affinity wheel overlay, creating visual noise. Implementation: gate `flavorClusterLabelGroup.visible = false` while AffinityMode is active.

4. **Affinity starting wedge → flavor categories.** The Affinity view's initial WedgeGridFlavorWheel state today shows 6 aroma sectors × 4 filter rings with cells driven by neighbor placement. The "starting" state before the user interacts should display the focal's own flavor-category membership (which aroma sector, which taste, etc.) — a visual primer of "here's what this ingredient IS" before the wheel transitions to "here's what it pairs with." Implementation: add a `startingState` mode to `WedgeGridFlavorWheel` that shades the focal's dominant aroma sector + taste ring with the focal's own GNN/curated values, before pairing data renders.

5. **iOS cone rendering bug.** In Affinity view on iOS (Capacitor build), the cone-shaped lines that extend from the center (focal hub) outward to each accent ingredient cell do not render. They render correctly on the web build. Likely cause: a WebKit-specific SVG/Three.js line rendering quirk, OR a CSS transform that breaks on iOS, OR a missing material flag (`linewidth` ignored on most iOS WebGL contexts). Diagnose first; fix to make cones visible on iOS at parity with web.

---

## Defined Variables

### Fix 1 — Hide legacy from MODE_CYCLE

```js
// src/data/networkModes.js
export const MODE_CYCLE = ['flavor3D', '2D'];   // was ['flavor3D', '3D', '2D']

export const DEFAULT_MODE = 'flavor3D';          // unchanged

export const MODE_LABELS = {
  'flavor3D': 'Flavor Network',                  // unchanged from prior delivery
  '2D': '2D Pairings',
  // '3D' label stays defined for programmatic setMode('3D') / bookmark
  // URL support, but the entry is removed from MODE_CYCLE so the
  // dropdown / cycle UI does not show it.
  '3D': 'Recipe Network (legacy)',
};
```

**Critical preservation:** keep posA recipe-coocc Float32Array allocation in LivingArchView, keep CameraAnimator's `pivotAdvanceMs: null` branch, keep the legacy regression integration test (`LivingArchView.legacyRegression.test.jsx`). These all still need to fire when `mode === '3D'` is set programmatically.

### Fix 2 — Fly-to lands at label

**Status:** mechanism TBD — pending diagnostic spike at P2 head.

**User-confirmed:** the label-vs-FOV misalignment occurs in **flavor3D mode** (Flavor Network primary), where `flavorClusterLabelGroup` sprites mount AT `centroid_3d` with **no Y-offset** (`LivingArchView.jsx:765`). The earlier hypothesis ("pivot targets centroid; label sits at centroid + Y-offset") is **FALSE** — there is no Y-offset to apply. The misalignment cause is elsewhere.

**Three candidate causes (diagnostic spike must select one):**

- **(a) Sprite text-anchor mismatch.** `THREE.Sprite` y-centers at `position.y`, but the rendered text glyph inside the sprite's canvas material may not be vertically centered (canvas baseline vs midline metrics, padding from `makeLabel`). The label position renders above or below the centroid by sprite-canvas units, not world coords. Fix: adjust the sprite material's canvas text positioning OR set `sprite.center = (0.5, 0.6)` (or whatever offset makes the glyph optically centered).
- **(b) Camera pitch on pivot land.** When `CameraAnimator`'s orbit pivot lerps to `centroid_3d`, the camera's elevation angle leaves the pivot projected high/low in the viewport rather than at viewport center — the continuous-orbit math computes a horizontal target via `controls.target.copy(_tourPivot)` but Three.js `OrbitControls` plus `PerspectiveCamera` does not guarantee the target is at screen-space Y = 0.5 viewport for non-zero elevation. Fix: extend `CameraAnimator` orbit math to align the label's projected screen Y with viewport center, OR adjust the elevation contribution to the pivot target's vertical land.
- **(c) Cluster `centroid_3d` ≠ visual center of dots.** Centroid is the arithmetic mean of UMAP positions; a sparse cluster with one outlier inflates the centroid away from where the eye reads the cluster. Fix: change `pivotTargets` to use a `visual_center` per cluster (median / trimmed-mean of member positions) instead of `centroid_3d`. May require an offline-data-side change OR a one-time compute in `useProData`.

**Implementation contract:** `CameraAnimator.setPivotConfig`'s `pivotTargets[]` schema may extend with one new optional field whose name + semantics are picked post-spike (e.g., `sprite_center_y` for (a), `viewport_align_y` for (b), or `visual_center: [x,y,z]` for (c)). Default behavior is **byte-identical** to today regardless of which mechanism is chosen — legacy mode (`pivotAdvanceMs: null`) must not exercise the new path.

### Fix 3 — Hide 3D labels in Affinity view

```jsx
// LivingArchView.jsx
const inAffinityMode = !!focalAffinityIngredient;     // existing predicate
flavorClusterLabelGroup.visible = !inAffinityMode &&
                                   (mode === 'mlflavor');
```

### Fix 4 — Affinity starting wedge → flavor categories

```jsx
// WedgeGridFlavorWheel.jsx accepts new optional prop:
// `startingState: 'primer' | 'pairings'` (default 'pairings').
// When 'primer': shade the focal's dominant aroma sector(s) with
// BRISCIONE_AROMA color + the focal's dominant taste ring with
// BRISCIONE_TASTE color, using the focal's own GNN/curated values.
// No accent ingredients are placed — this is "here is what this
// ingredient IS" before "here is what it pairs with".
//
// AffinityMode initial mount sets startingState='primer'. After the
// user interacts (clicks a filter pill, clicks a neighbor cell, etc.)
// startingState transitions to 'pairings'.
```

### Fix 5 — iOS cone rendering bug

**Diagnosis path** (executor):

1. Find the cone/line code in Affinity view: likely `AffinityMode.js` or `AffinityCone.js` in `src/three/`. Search for "cone", "Line", "LineSegments", or "linewidth".
2. Compare web (works) vs iOS Capacitor (doesn't) — likely culprits:
   - `Line` with `linewidth > 1`: iOS Mobile Safari WebGL ignores linewidth >1 silently. Switch to `LineSegments` with thickness via `MeshLine` library OR `TubeGeometry` (true 3D tube).
   - SVG-based lines: WebKit may have a `vector-effect: non-scaling-stroke` issue.
   - Transform inheritance: check parent group transforms for `matrix3d()` that iOS clips.
3. Fix to match iOS native parity. If `linewidth` is the cause, the project may need a `MeshLine` shim or migration to `Tube`/`Cone` geometry.

**iOS test surface:** verify on a Capacitor iOS build (`npm run ios:sync` + Xcode device run). Web parity is the regression contract.

---

## Constraints

### Visual
- Hidden legacy mode does NOT appear in any user-facing dropdown / cycle UI; programmatic access (setMode, URL params) preserved
- Camera fly-to dwell timing unchanged (`FLAVOR3D_PIVOT_ADVANCE_MS = 3500`); only the pivot TARGET changes
- Affinity view in `startingState='primer'` shows ONLY focal's category shading; no pairing dots, no accent lines
- iOS cone fix maintains web visual fidelity (no degradation on web to make iOS work)

### Brownfield reuse
- `MODE_CYCLE` + `DEFAULT_MODE` already exported from prior delivery — only MODE_CYCLE entries change
- `CameraAnimator.setPivotConfig` already exists — extend `pivotTargets` schema to include label offset
- `WedgeGridFlavorWheel` already exists — add prop, don't fork
- iOS-specific code lives in Capacitor's Webview; no new native plugins required

### Performance
- No GNN retraining, no new offline build, no schema changes to JSON
- iOS cone fix must not regress web FPS

### A11y
- Hidden legacy mode unchanged for screen reader announcements (it's no longer in the cycle, so the announce list shrinks naturally)
- Primer-state Affinity wheel announces via `aria-live="polite"`: "Showing {focal name}'s flavor profile"

---

## Non-Goals (deferred to follow-up deliveries)

### Deferred to **Delivery N+1** (Flavor Model Expansion) — separate spec needed

- **3-tier hierarchical flavor tree** (Aroma Tier 1 → Taste Tier 2 → Mouthfeel/Texture Tier 3 → Mosaic-style adjective leaves). ~2 weeks. Round 3 chose hybrid classification: Tier 1+2 data-derived from existing GNN, Tier 3 manual curation for top-500 + rule-derived from `gnn_compounds.json` tags for the long-tail 3,400+.
- **Re-color nodes by flavor category** in 3D network. Depends on the flavor-model tree existing. ~3 days post-tree.
- **2D-from-3D unification.** Extend `flavor_layout_v2.py` to dump `flavor_positions_2d.json` at `n_components=2`. ~3 days. Slipped this delivery for coherence with re-color.

### Out of scope entirely

- **Adopting Mosaic's 99-term lexicon verbatim** — confirmed during interview that Mosaic itself lacks cooling/menthol; their lexicon inspires but doesn't dictate.
- **GNN retraining** — Round 3 selected hybrid path that does NOT require retraining.
- **Track 3 (Guided overhaul)** — separate spec at `.omc/specs/deep-interview-track-3-guided-overhaul.md`, mid-ralplan-consensus. Currently parked.

---

## Acceptance Criteria

### Fix 1 — Hide legacy
- [ ] `MODE_CYCLE` equals `['flavor3D', '2D']` (length 2, no `'3D'`)
- [ ] `setMode('3D')` programmatically still mounts the recipe-coocc layout (regression contract preserved)
- [ ] `MODE_LABELS['3D']` still resolves to `'Recipe Network (legacy)'` for backwards compatibility
- [ ] Existing `LivingArchView.legacyRegression.test.jsx` continues to pass (verifies `pivotAdvanceMs: null` in '3D' mode)
- [ ] Manual: dropdown / mode cycle in production UI shows 2 entries (Flavor Network, 2D Pairings)

### Fix 2 — Fly-to lands at label
- [ ] **Diagnostic spike** at P2 head produces a written finding: which of (a) sprite-anchor / (b) camera-pitch / (c) visual-center is the misalignment cause. Finding posted to PR body and `.omc/notepad.md`.
- [ ] After fix, in flavor3D mode, after pivot-advance lerp completes, the cluster label's **screen-space Y position is within ±5% of viewport center** for each of the configured `pivotTargets`. Asserted via vitest with a mock camera + scene (`CameraAnimator.labelAlignment.test.jsx`).
- [ ] If sprite-anchor (a) is the chosen mechanism: glyph centroid of the sprite material canvas aligns with `sprite.position` within ±0.05 sprite-units (auxiliary predicate).
- [ ] `CameraAnimator.setPivotConfig` extension (whichever field is picked post-spike) defaults to a **no-op** value — legacy mode (`pivotAdvanceMs: null`) is byte-identical and `LivingArchView.legacyRegression.test.jsx` continues to pass.
- [ ] AC marked-passed ONLY AFTER: (i) spike output is reviewed, (ii) mechanism (a/b/c) is selected and recorded in ADR-2, (iii) post-fix vitest predicate passes.

### Fix 3 — Hide 3D labels in Affinity
- [ ] Engaging Affinity mode hides `flavorClusterLabelGroup` (`.visible = false`)
- [ ] Exiting Affinity mode restores `.visible = true` when `mode === 'mlflavor'`
- [ ] No console errors during transition
- [ ] Integration test: mount in flavor3D, engage focal → assert flavorClusterLabelGroup.visible === false

### Fix 4 — Affinity starting wedge → flavor categories
- [ ] When Affinity mode is engaged, the WedgeGridFlavorWheel renders `startingState='primer'`
- [ ] Primer state shades the focal's dominant aroma sector (highest GNN aroma prob above its odor_threshold) with BRISCIONE_AROMA color
- [ ] Primer state shades the focal's dominant taste ring (curated taste OR highest GNN taste prob above threshold) with BRISCIONE_TASTE color
- [ ] Primer state renders ZERO accent ingredient cells (no pairing dots, no accent lines)
- [ ] First user interaction (filter pill click, neighbor cell click, scroll/zoom) transitions startingState to `'pairings'` and the wheel renders normally
- [ ] aria-live announces: "Showing {focal name}'s flavor profile"

### Fix 5 — iOS cone bug
- [ ] In Affinity view on iOS Capacitor build, cones from center to each accent ingredient render visibly
- [ ] Web build continues to render cones identically to current behavior (no regression)
- [ ] Diagnosis documented (root cause + fix mechanism)

### Cross-cutting
- [ ] All existing tests still pass (`npx vitest run`); current baseline 657
- [ ] Build succeeds (`npm run build`)
- [ ] iOS sync (`npm run ios:sync`) succeeds with no new native dependencies
- [ ] No console errors loading flavor3D mode, engaging Affinity, switching to programmatic '3D' mode

---

## Implementation Plan

### Phasing
| Phase | Scope | Effort |
|---|---|---|
| **P1** | networkModes.js: drop `'3D'` from MODE_CYCLE; update test; verify legacy still reachable | 0.5d |
| **P2** | CameraAnimator: extend pivotTargets schema with label_offset_y; LivingArchView wires offsets | 0.5d |
| **P3** | LivingArchView: gate flavorClusterLabelGroup.visible by inAffinityMode | 0.25d |
| **P4** | WedgeGridFlavorWheel: add startingState prop; primer-state rendering | 1.5d |
| **P5** | AffinityMode glue: initial startingState='primer' on engage, transition on first interaction | 0.5d |
| **P6** | iOS cone bug diagnosis + fix (highest variance — bench at 1d, could be 0.5d if linewidth, 2d if requires Tube/MeshLine swap) | 1d |
| **P7** | Test pass + visual QA on web + iOS sync verification | 0.5d |

**Total: ~5d (range 4.5-6d depending on iOS variance).**

### Files to modify
| File | Change |
|---|---|
| `src/data/networkModes.js` | MODE_CYCLE drops `'3D'` |
| `src/data/__tests__/networkModes.test.js` | Update MODE_CYCLE assertion to length 2 |
| `src/three/CameraAnimator.js` | pivotTargets schema accepts label_offset_y |
| `src/three/CameraAnimator.test.js` | New test: pivot lands at centroid + offset |
| `src/components/LivingArchView.jsx` | label-offset wiring; flavorClusterLabelGroup.visible gating |
| `src/components/WedgeGridFlavorWheel.jsx` | startingState prop, primer rendering |
| `src/components/__tests__/WedgeGridFlavorWheel.test.jsx` | New test for primer state |
| `src/three/AffinityMode.js` (or similar) | iOS cone fix |
| `src/components/__tests__/LivingArchView.legacyRegression.test.jsx` | Verify legacy regression still holds |

### Files NOT touched (preservation guard)
| File | Why |
|---|---|
| `public/proDataset/flavor_cluster_labels.json` | No data changes this delivery |
| `public/proDataset/flavor_positions.json` | No layout changes |
| `flavor-gnn/scripts/flavor_layout_v2.py` | No new offline build |
| `src/data/recipeAromaSimilarity.js` | Prior delivery; untouched |

---

## Risks / Notes for Executor

1. **iOS cone diagnosis is the variance driver.** Effort range 0.5d - 2d. If diagnosis lands on `linewidth>1 ignored by iOS WebGL`, the fix is library-level (MeshLine shim or geometry swap to TubeGeometry / ConeGeometry). Budget the upper range.

2. **Label-offset extraction.** The Y-offset between centroid and label sprite is currently hard-coded in `LivingArchView.jsx` somewhere (likely `+ 12` or similar near the label sprite creation). Find the exact value before P2 starts — pivotTargets need the SAME value to land the camera correctly.

3. **Primer state is a new state machine.** WedgeGridFlavorWheel today has one rendering path (pairings). Adding `startingState` adds a second path + a transition trigger (first user interaction). Use a single `useEffect` listening for any of: filter-pill click, cell click, wheel-zoom, wheel-pan. The first event sets startingState='pairings' permanently for that session.

4. **Mode='3D' is now "hidden but reachable".** Document this in `networkModes.js` JSDoc. Users with bookmarks pointing at `?mode=3D` (if such bookmarks exist) continue to work. Programmatic setMode('3D') from tests / debug paths continues to work.

5. **Legacy regression integration test.** Must continue to pass — it's the binding gate per the prior delivery's Architect requirement. If it fails after Fix 1, that's a sign the hide-without-delete contract was violated.

6. **Affinity starting wedge: "flavor categories" interpretation.** The user said "starting wheel wedge in affinity view should be of the flavor categories". This spec interprets that as: show the focal's OWN category shading (aroma sector + taste ring) as a primer. If the user meant something else — e.g., show the 6 aroma sectors as label-only ghost cells, no fill — confirm at executor-time before P4 starts (the executor should ping the user with a quick visual mock if confused).

7. **iOS test environment.** Requires Capacitor + Xcode device or simulator. If the executor lacks iOS test hardware, the fix can still ship to web (Fixes 1-4) and the iOS cone fix becomes a separate hand-off requiring iOS-equipped follow-up.

---

## Ontology (Final Entities — must-ship scope only)

| Entity | Type | Fields | Relationships |
|---|---|---|---|
| LegacyRecipeNetwork | runtime mode (HIDDEN) | key='3D', visible-from-cycle=false, code-mounted=true | preserved regression contract |
| ModeCycle | data | ['flavor3D', '2D'] (length 2) | excludes '3D' |
| FlyToWheel | animation | pivotTargets[], label_offset_y per target | pivots to label position not centroid |
| ClusterLabelSprite | 3D object | position = centroid + offset_y | hidden in Affinity mode |
| AffinityMode | runtime state | active when focal selected | hides clusterLabelSprite, sets primer state |
| WedgeGridFlavorWheel | UI component | startingState='primer'\|'pairings' | new prop, dual rendering |
| PrimerState | visual state | focal-only shading, no accents | initial on Affinity engage |
| FocalCategoryProfile | derived | dominant aroma + taste from focal's GNN/curated values | rendered as primer shading |
| AffinityCone | 3D geometry | center-to-cell lines | broken on iOS, must fix |
| iOSWebGLLine | platform constraint | linewidth>1 ignored | drives the cone fix mechanism |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability |
|---|---|---|---|---|---|
| 1 | 12 | 12 | 0 | 0 | N/A |
| 2 | 15 | 3 | 0 | 12 | 100% |
| 3 | 15 | 0 | 0 | 15 | 100% |
| 4 | 15 | 0 | 0 | 15 | 100% |
| 5 | 16 | 1 | 0 | 15 | 100% |
| 6 | 10 | 0 | 0 | 10 | 100% (pruned to must-ship scope; 6 entities deferred with the 3 slipped items) |

Round 6 Simplifier was the only structural prune — slipping 3 items dropped 6 entities (FlavorTreeOntology, AromaLevel1, TasteLevel2, MouthfeelLevel3, LeafAdjective, FlavorPositions2D, CategoryPalette) to the deferred spec.

---

## Assumptions Exposed & Resolved

| Assumption | Round | Resolution |
|---|---|---|
| Everything ships together as one delivery | 1 | True at the time (user picked Option A) — overturned in Round 6 by Simplifier |
| Flavor model expansion is in scope this delivery | 1 | True at Round 1 — overturned Round 6; deferred to N+1 spec |
| New model = add 3-5 axes flat | 2 | False — user wants 3-tier hierarchical tree (Aroma→Taste→Mouthfeel→Adjective leaves) |
| Tree gets fully manual curation | 3 | False — hybrid: Tier 1+2 data-derived, Tier 3 manual for top-500 + rule-derived for long-tail (deferred but documented) |
| "Get rid of legacy" = full deletion | 4 | False — hide from MODE_CYCLE but keep code mounted; bookmarks/programmatic access preserved |
| 2D is independent of 3D today | 5 | True — and user wants UMAP-2D from same GNN vectors (deferred to N+1) |
| All 8 items same effort/priority | 6 | False — flavor model + re-color + 2D-from-3D slip together; 5-item tactical pack ships now |

---

## Interview Transcript

<details>
<summary>6 rounds of Q&A</summary>

### Round 1 — Goal Clarity
**Q:** Slicing — one bundled delivery vs. research-spike vs. fixes-first?
**A:** ONE bundled delivery (~1-2 weeks). [Overturned in R6.]

### Round 2 — Goal Clarity
**Q:** Level of flavor model expansion (axes vs. tags vs. molecules vs. hybrid)?
**A:** 3-tier hierarchical tree: Aroma → Taste → Mouthfeel/Texture, with Mosaic-style adjective leaves shared many-to-many.

### Round 3 — Goal Clarity
**Q:** How do 3,913 ingredients get classified into the tree?
**A:** Hybrid — Tier 1+2 data-derived from GNN, Tier 3 manual for top-500 + rule-derived from gnn_compounds.json for the long-tail.

### Round 4 — Goal Clarity — Contrarian Mode
**Q:** What does "get rid of legacy" actually mean given the regression contract from 6 days ago?
**A:** Hide from MODE_CYCLE, keep code mounted; programmatic setMode('3D') still works.

### Round 5 — Goal Clarity
**Q:** How should '2D be based on 3D'?
**A:** Re-run UMAP at n_components=2 (separate JSON). [Deferred in R6.]

### Round 6 — Success Criteria — Simplifier Mode
**Q:** If pressure forced shipping 5 of 8 items now and slipping 3, which slip?
**A:** Slip the flavor model expansion + re-color + 2D-from-3D (coupled triple). Ship the 5 tactical fixes (~5d).

</details>

---

## Pipeline next step

Per the deep-interview skill chain:

- **`/oh-my-claudecode:omc-plan --consensus --direct`** — recommended given iOS cone bug has implementation variance worth Architect pressure-test (Risk #1, #6).
- **`/oh-my-claudecode:autopilot`** — direct execution.
- **`/oh-my-claudecode:ralph`** — persistence loop.

**Follow-up delivery spec to author after this one ships:** `.omc/specs/deep-interview-flavor-model-expansion.md` — covers the 3-tier hierarchical tree, hybrid classification, re-color, and 2D-from-3D. Estimated ~2.5 weeks once started. **Track 3 (Guided overhaul) status:** parked, ralplan-consensus iteration 2 complete; resume separately when this delivery lands.
