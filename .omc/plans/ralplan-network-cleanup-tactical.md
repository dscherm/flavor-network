# RALPLAN — Network Cleanup Tactical Pack (Iteration 2)

**Spec:** `.omc/specs/deep-interview-network-cleanup-tactical.md` (ambiguity 15.0%, PASSED; spec patched for R8 user-confirmation in Iteration 2).
**Mode:** `--consensus --direct` (SHORT — not `--deliberate`). Iteration 2 addresses ARCHITECT-CONCERNS + CRITIC-ITERATE feedback.
**Scope:** 5 must-ship fixes, ~5d (range 4.75–6.25d after P0/P2 rebudget). No GNN retraining, no JSON schema changes, no new offline build.

**Iteration-2 banner:** R8 (label-offset hypothesis) was USER-CONFIRMED FALSE. Misalignment IS in flavor3D mode; Y-offset is NOT the cause. ADR-2 has been rewritten to commit to a P2-head diagnostic spike between three candidate mechanisms before picking the fix. P0 + P2 effort up; ADR-3 raycast override promoted to hard requirement.

---

## 1. RALPLAN-DR Summary

### 1.1 Principles (non-negotiable)

1. **Legacy regression contract holds byte-identical.** `LivingArchView.legacyRegression.test.jsx` (commit `42a8cb9`) is the binding gate. Every mode ≠ `mlflavor` MUST receive `pivotAdvanceMs: null` (or never be called); whatever schema extension ADR-2 picks post-spike MUST default to a no-op so legacy modes never exercise the new code path.
2. **Hide-without-delete contract for `'3D'` legacy mode.** Removing `'3D'` from `MODE_CYCLE` is a UI cycle change only. `setMode('3D')`, `?mode=3D` URL params, and `effectiveLegacyMode('3D', null) → 'ml'` MUST continue to work. Renderer paths stay alive; only the dropdown entry disappears.
3. **iOS web parity is the binding gate for Fix 5.** Capacitor iOS build is the source-of-truth surface. Web parity is preserved (no degradation); iOS rendering correctness is the acceptance criterion. Web-only verification is insufficient.
4. **Primer state is purely additive.** Fix 4 (`startingState='primer'`) cannot alter the pairings-render path. With `startingState='pairings'` (default), the DOM is byte-identical to today — locked by a snapshot assertion.
5. **Affinity label-hide must round-trip cleanly.** All three `flavorClusterLabelGroup.visible` write sites (mount line 782, transition lerp lines 1389/1393/1451, filter-active update lines 2506-2507) must be gated by `inAffinityMode` consistently. Partial gating leaves the label visible during transitions.

### 1.2 Decision Drivers (top 3)

1. **iOS cone variance dominates total-effort uncertainty.** P6 = 1d ± 1d.
2. **P2 mechanism is now unknown.** R8 user-confirmation invalidated the Y-offset hypothesis; the diagnostic spike at P2 head is a NEW variance source. Bounded by 0.25d, but the chosen mechanism (sprite-anchor / camera-pitch / visual-center) drives downstream file touch surface.
3. **The legacy regression contract is invisible-but-load-bearing.** P1 `MODE_CYCLE` change + P2 `setPivotConfig` extension both risk silent revert of byte-identity. Grep gates + a NEW preservation test mitigate.

### 1.3 Viable Options (≥2 each for decision points)

#### Option Set A — iOS cone fix mechanism

The cones live at `AffinityMode.js:1224-1234`: `THREE.Line` over `LineBasicMaterial({linewidth: 1})` with the inline comment "most WebGL backends ignore >1; bloom carries the visual weight". On Capacitor iOS, bloom + thin lines render effectively invisible.

- **(A1) TubeGeometry / ConeGeometry swap.** Replace `THREE.Line` with a thin `THREE.Mesh(TubeGeometry, MeshBasicMaterial)`. Pros: zero new deps, works on every WebGL backend, scales with bloom-layer assignment. Cons: per-cone geometry cost (30 cones × 2 buffers); geometry must regenerate when focal pivots. **Recommended.**
- **(A2) MeshLine shim** (~12 KB dep, maintenance mode last 2021). Pros: drop-in API, true variable thickness. Cons: new dep, Capacitor sync rebuild, shader-bloom integration risk.
- **(A3) Diagnostic spike first.** 0.25d on Capacitor iOS to confirm `linewidth>1` + bloom is the cause before committing to A1 vs A2.

**Recommendation:** A1 after a 0.25d A3 spike at P6 head. Iteration-2: ADR-3 also promotes the cone Mesh's `raycast = () => {}` override to a HARD requirement (was follow-up).

#### Option Set B — Primer-state transition trigger

- **(B1) Any-interaction trigger.** Cell click OR pill click OR wheel-zoom OR scroll. Pros: graceful. Cons: false-trigger risk on mount, requires gesture-detection.
- **(B2) Explicit-only trigger.** ONLY filter-pill click or cell click. Pros: deterministic, no new listeners. Cons: pinch-zoom user stays in primer.

**Recommendation:** B2. Confirmed in iteration 2.

#### Option Set C — P2 misalignment mechanism (NEW — replaces prior C)

User has confirmed the misalignment IS in flavor3D mode. Three candidates:

- **(C-a) Sprite text-anchor.** `THREE.Sprite.center` defaults to `(0.5, 0.5)`; the canvas-material glyph may not be vertically centered (baseline metrics, `makeLabel` padding). Fix: adjust `sprite.center = (0.5, 0.6)` or the canvas glyph y-position. Touch surface: `LivingArchView.jsx` `makeLabel` helper + `flavorClusterLabelGroup` sprite construction. **Smallest blast radius.**
- **(C-b) Camera pitch on pivot land.** `controls.target.copy(_tourPivot)` lands the orbit target at `centroid_3d`, but at non-zero elevation the target's projected screen-space Y is not 0.5 viewport. Fix: extend `CameraAnimator._tickTourOrbit` math so the projected screen-Y of `_tourPivot` is at 0.5, OR introduce a `viewport_align_y` field in `pivotTargets[]`. Touch surface: `CameraAnimator.js` orbit math.
- **(C-c) `centroid_3d` ≠ visual center.** Centroid is arithmetic mean; sparse-cluster outliers inflate it. Fix: introduce `visual_center` (median or trimmed-mean) on each `pivotTargets[]` item, computed either in `useProData` or offline. Touch surface: `useProData` hook + possibly `flavor_layout_v2.py` (offline) — but the spec's "no new offline build" constraint argues for client-side compute.

**Recommendation:** **Diagnostic spike first** (0.25d at P2 head); commit post-spike. Pre-spike, ADR-2 reads "MECHANISM TBD". A vitest diagnostic harness (`CameraAnimator.labelAlignment.test.jsx`) renders flavor3D with a mock camera + scene, queries each cluster sprite's world-position vs. the camera-projected viewport-Y after pivot lerp, and logs the delta. The chosen mechanism is the one whose fix makes the screen-space Y delta < ±5% of viewport.

---

## 2. Implementation Plan

### Dependency-ordered phases (Iteration-2 efforts)

| Phase | Scope | Parallel-eligible? | Depends on | Effort |
|---|---|---|---|---|
| **P0** | Pre-flight audit (4 named artifacts — see §2.0) | — | nothing | **0.5d** |
| **P1** | `networkModes.js` — `MODE_CYCLE = ['flavor3D', '2D']`; preserve `MODE_LABELS['3D']`, `effectiveLegacyMode`, `LEGACY_MODE_TO_FILTER` | yes (with P3, P6) | P0 | 0.5d |
| **P2** | **Diagnostic spike (0.25d)** → commit to mechanism (C-a / C-b / C-c) → implement (0.5d) → test + buffer (0.25d) | partial (spike sequential; downstream parallel with P3) | P0 | **1.0d** |
| **P3** | `LivingArchView` — gate `flavorClusterLabelGroup.visible` by `!inAffinityMode` at all 3 write sites | yes (with P1, P2-impl, P6) | P0 | 0.25d |
| **P4** | `WedgeGridFlavorWheel` — add `startingState='primer'\|'pairings'` prop; primer-state render branch; aria-live region rendered ONLY in primer | no | P0 | 1.5d |
| **P5** | AffinityMode glue — initial `startingState='primer'` on engage; explicit-only trigger to `'pairings'`; new focal resets via `key={focal.id}` remount | no | P4 | 0.5d |
| **P6** | iOS cone fix — 0.25d diagnostic spike → 0.75d TubeGeometry swap with `raycast = () => {}` override (HARD requirement) | yes (with P1, P3) | P0 | 1d (range 0.5-2d) |
| **P7** | Test pass + visual QA + `npm run ios:sync` + Capacitor device/simulator | no | P1-P6 | 0.5d |

**Total: ~5d, range 4.75–6.25d.** Parallel lanes: P1/P3/P6 after P0; P2 spike sequential, then P2-impl parallel with P3; P4→P5 sequential; P7 final.

### 2.0 — P0 exit criteria (4 named artifacts, all required)

1. **P2 diagnostic harness in place.** A vitest test file (`src/three/__tests__/CameraAnimator.labelAlignment.test.jsx` or `.test.js`) that renders flavor3D scene fixtures with a mock camera + `THREE.Scene`, queries each `flavorClusterLabels.clusters` sprite's world position vs. the camera-projected viewport-Y after the pivot-advance lerp completes, and logs `{ clusterId, spriteWorld, pivotTarget, cameraPos, projectedScreenY, deltaPercent }`. **Initial measurement for 3 clusters minimum** (concrete values, e.g., "cluster 0: spriteWorld=(12.3,4.5,-8.1), pivotTarget=(12.3,4.5,-8.1), projectedScreenY=0.38, deltaPercent=-12%"). The harness is the spike-output substrate for ADR-2.
2. **iOS hardware availability check.** Executor confirms whether a Capacitor build can run on device or simulator. If no, P6 ships to a follow-up branch with the iOS portion marked `needs-ios-verify` (per Principle #3).
3. **657-test baseline snapshot** to `.omc/notepad.md`. Format: `network-cleanup-tactical iter-2 baseline: <count> passing, <count> total, <date>, <commit-sha>`. P7 verifies count ≥ baseline + new tests added.
4. **Sprite-anchor + camera-pitch initial measurements on 3 cluster labels** — concrete values written to PR draft body. Form: `cluster_id, sprite world pos (X,Y,Z), camera pivot target (X,Y,Z), viewport-space pixel delta (dx, dy) when fly-to lands`. Drives the spike's mechanism selection.

### 2.1 — P1: Hide legacy from MODE_CYCLE

**Files:**
- `src/data/networkModes.js` — `MODE_CYCLE = ['flavor3D', '2D']`
- `src/data/__tests__/networkModes.test.js` — assertions: length 2, no `'3D'`, `MODE_LABELS['3D']` preserved, `effectiveLegacyMode('3D', null) === 'ml'`, `LEGACY_MODE_TO_FILTER` unchanged

**~LOC:** ~5 source + ~15 test.

**Grep gate:** `grep -E "MODE_CYCLE.*['\"]3D['\"]" src/data/networkModes.js` → 0 matches; `grep "MODE_LABELS\['3D'\]" src/data/networkModes.js` → 1 match.

### 2.2 — P2: Fly-to lands at label (REVISED — spike-first)

**Sub-phase P2-spike (0.25d) — sequential, blocks P2-impl:**

- Run the diagnostic harness (built in P0) against flavor3D with the current data fixture. Capture screen-space deltas per cluster.
- Pick mechanism (C-a / C-b / C-c) by which fix-form makes the screen-space delta < ±5% with the smallest blast radius. Record selection + supporting numbers in ADR-2 (see §4).
- Output: written finding in PR body + `.omc/notepad.md`.

**Sub-phase P2-impl (0.5d) — files vary by chosen mechanism:**

- **If (C-a) sprite-anchor:** modify `LivingArchView.jsx` `makeLabel` helper OR the `flavorClusterLabelGroup` sprite construction (line 763+) to set `sprite.center = (0.5, 0.6)` (or measured value). NO `CameraAnimator` change. NO `pivotTargets` schema change. Legacy regression test untouched (mechanism is sprite-side, not animator-side).
- **If (C-b) camera-pitch:** extend `CameraAnimator.setPivotConfig` with an optional `viewport_align_y?: boolean | number` per pivotTarget (or globally); `_advancePivot` adjusts `_pivotTo.y` post-lerp so the projected screen-Y of the pivot target lands at the configured fraction. Default `null` / `undefined` = no-op = byte-identical for legacy. LivingArchView passes the flag only for `mlflavor`-derived `pivotTargets`.
- **If (C-c) visual-center:** compute `visual_center = trimmedMean(memberPositions, 0.1)` for each cluster in `useProData` (NOT offline — spec forbids new offline build); pass `pivotTargets[].visual_center` to `setPivotConfig`. `CameraAnimator` reads `target.visual_center ?? target.centroid_3d` when seeding `_pivotTo`. Default fallback = `centroid_3d` = byte-identical for legacy.

**Sub-phase P2-test (0.25d):**

- `src/three/__tests__/CameraAnimator.labelAlignment.test.jsx` (the diagnostic harness, hardened into a regression test): asserts that for the current fixture, every cluster's projected screen-Y is within ±5% of viewport center after pivot-advance lerp completes.
- If (C-a) chosen: auxiliary predicate — sprite material canvas glyph centroid aligns with `sprite.position` within ±0.05 sprite-units.
- Existing `LivingArchView.legacyRegression.test.jsx` unmodified; passes byte-identically.

**~LOC:** ~30 source + ~80 test (the harness is most of the test surface).

**Grep gate:** mechanism-dependent; documented in ADR-2 post-spike. Legacy regression test path NEVER touches the new field (verified by grep on the test file showing no new references).

### 2.3 — P3: Hide 3D labels in Affinity

**Files:**
- `src/components/LivingArchView.jsx` — gate 3 sites by `!inAffinityMode`:
  - **Mount (line 782):** `flavorClusterLabelGroup.visible = !inAffinityMode && (modeRef.current === 'mlflavor')`
  - **Transition lerp (lines 1389-1394, 1451):** AND-gate with `!inAffinityMode`
  - **Filter-active update (lines 2506-2507):** `flavorGrp.visible = !inAffinityMode && !filterActive && mode === 'mlflavor'`
- `src/components/__tests__/LivingArchView.affinityLabelHide.test.jsx` (NEW) — mount visible → engage focal → assert hidden → exit focal → assert restored (round-trip per Principle #5)

**~LOC:** ~10 source + ~50 test.

**Grep gate:** `grep -n "flavorClusterLabelGroup.visible\|flavorGrp.visible" src/components/LivingArchView.jsx` → exactly 3 matches, each line references `inAffinityMode`.

### 2.4 — P4: WedgeGridFlavorWheel primer state (revised aria-live)

**Files:**
- `src/components/WedgeGridFlavorWheel.jsx` — add `startingState: 'primer' | 'pairings' = 'pairings'` prop; when `'primer'`:
  - Shade focal's dominant aroma sector (highest `gnnProbs.odor_*` above threshold) with `BRISCIONE_AROMA[sector]` opacity 0.55
  - Shade focal's dominant taste ring (curated taste OR highest `gnnProbs[taste]` above threshold) with `BRISCIONE_TASTE[taste]` opacity 0.55
  - SKIP `computeAccentPlacement` entirely (no cells, no lines, no chips)
  - Hub label as today
  - **Iteration-2 pin:** render `<div aria-live="polite">Showing {focal name}'s flavor profile</div>` ONLY when `startingState === 'primer'` (conditional element, NOT always-rendered with conditional content). When `startingState === 'pairings'`, the aria-live element is absent from the DOM.
- `src/components/__tests__/WedgeGridFlavorWheel.primerState.test.jsx` (NEW):
  - Primer: zero `<g data-cell>`; exactly one `data-activated='true'` sector; exactly one `data-ring-shaded='true'` ring; one `[aria-live="polite"]` region present with the focal-name text.
  - **Iteration-2 pin:** pairings snapshot — `render(<WedgeGridFlavorWheel ...defaultProps />)` vs. `render(<WedgeGridFlavorWheel ...defaultProps startingState="pairings" />)` produce **byte-identical DOM** (snapshot assertion). And: the default-prop render must equal the current production snapshot byte-for-byte (Principle #4 lock).

**~LOC:** ~80 source + ~140 test.

**Grep gate:** `grep -c "aria-live" src/components/WedgeGridFlavorWheel.jsx` → 1 match, on a conditionally-mounted element (line inspection confirms it's inside `startingState === 'primer'` branch).

### 2.5 — P5: AffinityMode glue (revised — `key={focal.id}` remount)

**Files:**
- The React mount in `LivingArchView.jsx` that owns `WedgeGridFlavorWheel`:
  - Add `useState` for `startingState`, initial `'primer'` on engage.
  - **Iteration-2 pin:** parent passes `key={focalAffinityIngredient?.id ?? 'noop'}` to `WedgeGridFlavorWheel` so a new focal triggers a fresh component instance (full remount), guaranteeing primer reset without `useEffect([focal.id], ...)` indirection. Rationale: clearest expression of "new focal = fresh state"; avoids stale-state bugs in the transition trigger. The wheel re-builds SVG on focal change anyway, so remount cost is bounded.
  - `onSelectIngredient` and `onFilterBucket` handlers set local state to `'pairings'`; useState persists for the lifetime of this focal's component instance.
  - **NO new event listeners** (no scroll/wheel/zoom — Option B2 explicit-only).
- `src/components/__tests__/LivingArchView.affinityPrimer.test.jsx` (NEW or extend) — engage → primer; explicit click → pairings; new focal → primer again (via key remount).

**~LOC:** ~25 source + ~70 test.

**Grep gate:** `grep -n "addEventListener.*scroll\|addEventListener.*wheel" src/components/LivingArchView.jsx` → 0 new matches (proves B2); `grep "key={focal" src/components/LivingArchView.jsx` → matches the WedgeGridFlavorWheel mount.

### 2.6 — P6: iOS cone bug (revised — raycast override is HARD requirement)

**Files (post-diagnostic):**
- `src/three/AffinityMode.js` lines 1224-1234 — swap `new THREE.Line(geo, mat)` for `new THREE.Mesh(tubeGeo, basicMat)` over `THREE.TubeGeometry` from a `CatmullRomCurve3` of the two endpoints, radius ≈ 0.4 scene units, radial-segments 6. Preserve bloom-layer assignment.
- **Iteration-2 HARD requirement:** the new cone Mesh MUST set `mesh.raycast = () => {}` (override to no-op) to avoid intercepting clicks on underlying ingredient nodes. Verified by manual click-through QA: click directly on a node hidden behind a cone in the affinity wheel; the click MUST register on the node, not the cone. This is no longer a follow-up — it ships as part of P6.
- Possibly `src/three/AffinityMode.js` lines 267-272 (the `LineSegments` edge group) — same swap IF the diagnostic confirms it's also broken on iOS. Default assumption: edges are `visible = false` by default (line 274) so they may be untouched.

**~LOC:** ~30 source. ~0 new unit tests (visual QA + manual click-through).

**Iteration-2 verification artifacts (now required for P6 sign-off):**
- **R6 (web parity):** before/after screenshot pair in PR body for `npm run dev` web build, showing affinity cones on Chrome desktop. Visual identity required.
- **R7 (iOS render):** iOS Capacitor device/simulator screenshot in PR body confirming cones render visibly.

**Grep gate:** `grep -nE "new THREE.Line\(|new THREE.LineSegments\(" src/three/AffinityMode.js` count after ≤ count before; `grep "raycast.*=>.*{}" src/three/AffinityMode.js` → ≥1 match for the new Mesh; `grep "linewidth" src/three/AffinityMode.js` → 0 (misleading comment removed).

### 2.7 — P7: Test pass + visual QA + iOS sync

- `npx vitest run` — baseline 657 passing → target ≥ 660 (P2-test + P3-test + P4-test + P5-test).
- `npm run build` — clean production build.
- `npm run ios:sync` — no new native deps.
- Visual QA checklist (see §3.4).
- Capacitor device/simulator run (or `needs-ios-verify` follow-up branch per P0 artifact #2).

---

## 3. Test Plan (SHORT mode)

### 3.1 Unit (per phase)

| Phase | Test file | Assertions |
|---|---|---|
| P1 | `src/data/__tests__/networkModes.test.js` | `MODE_CYCLE.length === 2`, no `'3D'`; `MODE_LABELS['3D']` preserved; `effectiveLegacyMode('3D', null) === 'ml'` |
| P2-spike | `src/three/__tests__/CameraAnimator.labelAlignment.test.jsx` (NEW — built in P0 as harness, hardened in P2-test) | Per-cluster screen-space Y after pivot-lerp within ±5% of viewport center; logs deltas for ADR-2 selection (pre-fix) and asserts the predicate (post-fix) |
| P2-impl | mechanism-dependent (see §2.2) — default-value byte-identity for legacy mode | mechanism field default = no-op = legacy regression unchanged |
| P3 | `src/components/__tests__/LivingArchView.affinityLabelHide.test.jsx` (NEW) | Mount visible → engage hidden → exit visible (round-trip); no console errors |
| P4 | `src/components/__tests__/WedgeGridFlavorWheel.primerState.test.jsx` (NEW) | Primer: 0 cells, 1 shaded sector, 1 shaded ring, 1 aria-live region. **Pairings: byte-identical DOM to current snapshot** (Principle #4 lock) |
| P5 | `src/components/__tests__/LivingArchView.affinityPrimer.test.jsx` (NEW or extend) | Engage → primer; click → pairings; new focal (key change) → primer again |

### 3.2 Integration

- `src/components/__tests__/LivingArchView.legacyRegression.test.jsx` (existing) — must pass for `mode='ml'` and `mode='ml2d'`. **Iteration-2 addition (only when P2 mechanism = C-b or C-c):** add a fourth case asserting that legacy mode never exercises the new schema field (e.g., the field is absent from `setPivotConfigCalls` cfgs OR is the no-op default).

### 3.3 iOS validation

- `npm run ios:sync` succeeds with zero new Capacitor plugins.
- Capacitor build on simulator OR device.
- **Iteration-2 hard artifact:** screenshot in PR body (R7) confirming cones render.
- No iOS hardware → P6 marked `needs-ios-verify`; Fixes 1-4 still ship.

### 3.4 Visual QA checklist

- [ ] Mode dropdown shows exactly "Flavor Network" + "2D Pairings".
- [ ] `?mode=3D` URL still loads recipe-coocc layout.
- [ ] In flavor3D, cluster fly-through arrives with the label sprite within ±5% viewport-Y of center (per chosen P2 mechanism).
- [ ] Engaging a focal in flavor3D removes flavor cluster labels; exiting restores them.
- [ ] First mount of Affinity shows the wheel with focal's sector + ring shaded, NO accent cells.
- [ ] Clicking any cell or filter pill transitions to pairings render; persists until focal change.
- [ ] iOS Capacitor: bucket cones visible from focal hub to each cell.
- [ ] Web cones visually identical to current (before/after screenshot in PR — R6 artifact).
- [ ] Click directly on a node behind a cone in affinity → click registers on the node (raycast override works — ADR-3 hard requirement).

---

## 4. ADR Skeletons

### ADR-1 — `MODE_CYCLE` is hide-without-delete for `'3D'`

(Unchanged from iteration 1.)

- **Decision:** Drop `'3D'` from `MODE_CYCLE`; preserve `MODE_LABELS['3D']`, `effectiveLegacyMode('3D', _) → 'ml'`, full renderer mount.
- **Drivers:** user wants legacy invisible in cycle; binding regression contract from `42a8cb9`; potential bookmark / URL-param callers.
- **Alternatives:** full deletion (breaks contract); CSS-hide (leaves cycle-traversal stale).
- **Why chosen:** cleanest UI/runtime separation.
- **Consequences:** `MODE_LABELS['3D']` exists indefinitely; JSDoc explains.
- **Follow-ups:** revisit at next major delivery.

### ADR-2 — **REWRITTEN (post-P0-spike + Architect re-review, 2026-05-18)** — flavor3D label alignment via camera-pitch mechanism (C-b), implemented as `camera.lookAt(_tourPivot)` per Architect

- **Decision:** **MECHANISM = C-b (camera-pitch / orbit-target alignment), implemented as a single `camera.lookAt(_tourPivot)` call per tick.** Architect re-review (2026-05-18) verified that `_tickTourOrbit` (CameraAnimator.js:640-660) writes `controls.target.copy(_tourPivot)` but never rotates the camera quaternion (because `controls.enabled = false` at CameraAnimator.js:584-586, so `controls.update()` never runs during tour). The fix is therefore a 1-line addition: after the existing target copy, if any pivotTarget carries the alignment flag, call `camera.lookAt(this._tourPivot); camera.updateMatrixWorld(true);`. This makes the projected viewport-Y of the pivot mathematically 0.5 by construction (target projects to NDC origin) — proven by harness `projectionFresh` (CameraAnimator.labelAlignment.test.js:320-325) showing deltaFromCenter ≈ 0. Implementation surface: `src/three/CameraAnimator.js` orbit-tick + LivingArchView call-site wiring. New schema field on each `pivotTargets[]` item: `align_to_pivot?: boolean` (default `false`/omit → no-op; `true` → call `camera.lookAt`). Legacy `pivotAdvanceMs: null` path is structurally unreachable per Architect verification — legacy passes `pivotTargets: []`, so no item exists to carry the field; alignment branch is dead in legacy mode without any new gate. Byte-identity preserved per Principle #1.
- **Drivers:** (1) P0 diagnostic spike (`src/three/__tests__/CameraAnimator.labelAlignment.test.js`, 2026-05-18) produced unambiguous numerical evidence; (2) Principle #1 binding regression contract from commit `42a8cb9` requires the chosen field default to a no-op for legacy; (3) the smallest fix that satisfies the ±5% predicate across all 3 mock cluster topologies is the camera-pitch fix; (4) the schema extension is additive-only and bounded.
- **Empirical evidence (P0 spike output):**
  ```json
  {
    "mean_c_a_score": 0.080,   // sprite-anchor — negligible
    "mean_c_b_score": 1.323,   // camera-pitch — DOMINANT, 5-16x
    "mean_c_c_score": 0.247,   // centroid vs visual — situational
    "dominant": "C-b camera-pitch"
  }
  ```
  Cluster 2 sparse-outlier detail: stale viewportY=0.645 (14.5% off center); C-b fix → 0.500 (0% off); C-c fix → 0.510 (1% off). C-b alone hits the ±5% predicate on every cluster; C-a does not move the predicate; C-c only fixes the outlier case.
- **Alternatives considered (now empirically ranked):**
  - (C-a) Sprite anchor — REJECTED. Mean score 0.080 — sprite-center adjustment does not address the dominant mechanism. Would leave the user-visible misalignment unresolved on most clusters.
  - (C-b) Camera-pitch / `viewport_align_y` — **CHOSEN.** Mean score 1.323, ~5x next-closest. Reduces delta to 0% on compact and sparse-outlier clusters in the harness.
  - (C-c) `visual_center` (trimmed-mean) — REJECTED as primary. Mean score 0.247; only matters for the sparse-outlier topology (cluster 2). Costlier schema (new derived data field, `useProData` extension). Filed as a P+1 follow-up if real-world sparse clusters surface residual delta after C-b ships.
  - **Rejected pre-spike:** "label_offset_y default 0" (iteration-1 ADR-2). Empirically falsified by user.
- **Why chosen:** C-b dominates by 5-16x across all 3 mock cluster topologies (compact, medium, sparse-outlier) and is the only candidate that satisfies the ±5% predicate without combinatorial layering. Touch surface is the smallest among the predicate-satisfying mechanisms (CameraAnimator orbit math + 1 wiring site). Legacy regression contract is preserved because the new field is opt-in via the `pivotAdvanceMs ≠ null` branch that already exists for `mlflavor` mode.
- **Implementation contract (Architect-bound):**
  1. **Schema:** `pivotTargets[].align_to_pivot?: boolean` — optional, default `false`/omit. `true` → call `camera.lookAt(this._tourPivot); camera.updateMatrixWorld(true);` once per tick after `controls.target.copy(_tourPivot)`. No numeric range; binary semantic only. (Architect non-blocking improvement #1 adopted: narrower surface than `viewport_align_y: number` — admitting fractional values invites future callers to set 0.4 "for design" without solving a real problem. A numeric variant can ship later if a non-center alignment use case appears.)
  2. **Animator math:** in `_tickTourOrbit`, immediately after the existing `controls.target.copy(_tourPivot)` line, check whether any active pivotTarget carries `align_to_pivot === true`. If yes, call `this._camera.lookAt(this._tourPivot); this._camera.updateMatrixWorld(true);`. No iterative correction; no pitch math; no oscillation risk. The harness's `projectionFresh` already proves this gives deltaFromCenter ≈ 0 by construction (CameraAnimator.labelAlignment.test.js:320-325).
  3. **LivingArchView wiring:** only `mlflavor`-derived `pivotTargets` carry `align_to_pivot: true`. Legacy modes pass `pivotAdvanceMs: null` and `pivotTargets: []` (verified at LivingArchView.jsx:170-181, 1849-1862 — Architect citation), so the field is structurally unreachable from legacy and no extra gate is required in `_tickTourOrbit`.
  4. **Test predicates (asserted in `CameraAnimator.labelAlignment.test.js`, P2-test sub-phase):**
     - (a) **Post-fix:** for every cluster in the harness, `viewportY` of `_tourPivot` after `camera.lookAt` is within `[0.45, 0.55]`. Graduates from log-only (P0) to assertion mode.
     - (b) **Pre-fix sanity (Architect-bound):** parameterized `it.each([{fixActive: false, expectFail: true}, {fixActive: true, expectFail: false}])`. The pre-fix branch must show `viewportY` drifting outside `[0.45, 0.55]` for at least one fixture (cluster 2 sparse-outlier is the natural witness — notepad records stale `viewportY = 0.645`). Without this branch the predicate could pass even if the fix code path is dead.
  5. **Legacy-regression assertion (Architect-bound):** extend `LivingArchView.legacyRegression.test.jsx` with: `for (const cfg of setPivotConfigCalls.filter(c => c.pivotAdvanceMs === null)) { for (const t of (cfg.pivotTargets || [])) { expect(t.align_to_pivot).toBeUndefined(); } }`. Mechanical, fast, closes the schema-leak vector.
  6. **JSDoc on `_tickTourOrbit` (Architect non-blocking improvement #3 adopted):** add a short pointer near line 640: "controls.enabled = false; `controls.update()` never runs during tour; camera quaternion is stale-from-engage-time. See CameraAnimator.labelAlignment.test.js for the projection model and the `align_to_pivot` alignment branch."
- **Consequences:** P2 effort stays bounded (~0.5d remaining now that spike + architect re-review completed). CameraAnimator state gains one new boolean field on the pivotTarget shape. The simpler `camera.lookAt` approach has zero oscillation risk vs. the original iterative-pitch-correction proposal. Snapshot byte-identity for legacy mode is preserved structurally (pivotTargets is empty in legacy mode).
- **Follow-ups:** (a) **P+1 C-c stacking trigger (Architect non-blocking improvement #2 adopted):** at `useProData` load time, parse `flavor_cluster_labels.json` and compute `||centroid_3d - trimmedMean(member_positions, 0.2)||` for each cluster. If any cluster exceeds **4.0 world-units**, file a P+1 ticket to add `visual_center` derivation and pass it as the pivot target (cheap retrofit since the schema is additive). This is a one-line vitest fixture check, deferrable until real-world data surfaces a sparse-outlier. (b) **P7 manual QA cross-check:** fly-to each of the 6 flavor3D cluster centroids in the actual browser, confirm the label sprite sits within the viewport-center band on first frame after orbit settles. (c) Architect re-review on this rewrite is **complete (APPROVE_WITH_NOTES, 2026-05-18)**; all 3 binding obligations folded into contract items 4b, 5, and the simplified math in step 2. P2-impl may proceed without further consensus loop.

### ADR-3 — iOS cone fix via TubeGeometry swap **+ raycast override (HARD requirement)**

- **Decision:** Replace `THREE.Line` cones at `AffinityMode.js:1224-1234` with `THREE.Mesh(TubeGeometry, MeshBasicMaterial)`. **Iteration-2:** the new Mesh MUST set `raycast = () => {}` to prevent click-stealing on underlying ingredient nodes. Verified by manual click-through QA: click directly on a node hidden behind a cone in the affinity wheel; the click MUST register on the node, not the cone. Preceded by 0.25d Capacitor iOS diagnostic.
- **Drivers:** Principle #3 (iOS parity binding); Driver #1 (variance dominator); zero new deps preferred; raycast override prevents a regression hidden by the visual fix.
- **Alternatives considered:** MeshLine shim (rejected: new dep, maintenance-mode); CSS transform fix (rejected: scene-graph 3D, not applicable); native plugin (rejected: overkill).
- **Why chosen:** built-in three.js primitive, cross-backend identical, bloom-layer compatible, zero deps. Raycast override is a 1-liner that closes the pointer-event regression vector.
- **Consequences:** per-cone allocation cost (sub-frame budget); LineBasicMaterial's `linewidth: 1` becomes `tubeRadius: 0.4` — visual tuning required to match bloom-blurred line.
- **Follow-ups:** if P6 diagnostic surfaces a different root cause (CSS transform / depthWrite), this ADR is voided and re-decided before implementation. (Note: R9 — raycast override — is no longer in the follow-up list; it is now part of the Decision body and ships as part of P6.)

---

## 5. Risk → Phase Mitigation Table

Applies lesson `pipeline-rebuild-wipes-manual-data-additions` — every risk has a mitigating phase, verification artifact, grep gate.

| # | Risk | Mitigating phase | Verification artifact | Grep / assertion gate |
|---|---|---|---|---|
| R1 | `MODE_CYCLE` change silently breaks programmatic `setMode('3D')` | P1 | NEW preservation tests in `networkModes.test.js` | `grep "MODE_LABELS\['3D'\]" src/data/networkModes.js` → 1 match; legacy regression test passes |
| R2 | P2 schema extension breaks legacy byte-identity | P2-test | Existing legacy regression test + NEW assertion: legacy cfgs never carry the new field (or carry default no-op value) | Legacy regression test passes; grep on `LivingArchView.legacyRegression.test.jsx` shows no new field reference |
| R3 | Affinity-hide leaves label group stuck after focal de-select | P3 | NEW round-trip test | `grep -c "flavorClusterLabelGroup.visible\|flavorGrp.visible"` → 3 matches, each line carries `inAffinityMode` |
| R4 | Primer alters pairings render path (Principle #4) | P4 | Snapshot byte-identity assertion + existing `WedgeGridFlavorWheel.test.jsx` passing | `npx vitest run src/components/__tests__/WedgeGridFlavorWheel.test.jsx` zero diffs |
| R5 | Primer trigger fires on mount (false-trigger) | P5 (B2) | NEW integration test: mount → primer (no auto-transition before explicit click) | `grep "addEventListener.*scroll\|addEventListener.*wheel"` in LivingArchView → 0 new matches |
| R6 | iOS cone fix regresses web visual fidelity | P6 | **Iteration-2: required before/after web screenshot pair in PR body** | `grep "BLOOM_LAYER\|layers.set"` post-P6 matches |
| R7 | iOS hardware unavailable — P6 unverifiable | P0 (flag) + P7 (gate) | **Iteration-2: required iOS device/simulator screenshot in PR body**; if absent, P6 marked `needs-ios-verify` | PR description carries iOS-verify status |
| R8 | **RESOLVED (iter-2)** — Y-offset hypothesis false; user confirmed misalignment is in flavor3D | P0 + P2-spike | Diagnostic harness output + ADR-2 rewrite with chosen mechanism | ADR-2 mechanism field selected post-spike; vitest ±5% predicate passes |
| R9 | **PROMOTED to ADR-3 hard requirement (iter-2)** — cone Mesh raycast steals clicks from nodes | P6 | Manual click-through QA on node behind cone | `grep "raycast.*=>.*{}" src/three/AffinityMode.js` → ≥1 match |
| R10 | Test baseline (657) shifts silently | P0 + P7 | P0 snapshots to `.omc/notepad.md`; P7 verifies count ≥ baseline + new tests | `npx vitest run` exit 0, count ≥ 660 |
| R11 (NEW iter-2) | P2 spike fails to identify a single mechanism (deltas inconclusive or no fix moves the predicate) | P2-spike | Spike output explicitly enumerates per-cluster deltas + which mechanism each tested fix-form satisfies | If no mechanism passes ±5%, ADR-2 is rewritten to a hybrid (e.g., sprite-anchor + visual-center) or P2 is downgraded to `needs-followup` and ship with Fix 2 marked deferred. Decision recorded in PR. |

---

## 6. Open Questions for Architect / Critic Pressure-Test (iteration 2)

1. **P2 spike scope — should the harness test all 3 candidate fix-forms in one pass, or test sequentially?** Recommendation: build the harness to *measure* deltas pre-fix (one-shot), then iterate fix-forms in-place to find the smallest mechanism that satisfies ±5%. Risk: confounding (fixing camera-pitch may mask a residual sprite-anchor issue). Default: build the harness with all 3 measurement modes (sprite-anchor delta, camera-projected screen-Y delta, visual-vs-arithmetic centroid delta) so the spike output is comprehensive; pick mechanism by smallest-blast that satisfies.

2. **iOS cone path — TubeGeometry up-front, or diagnostic spike first?** Recommendation: 0.25d spike at P6 head. Override only if iOS hardware unavailable (no diagnostic possible → commit to A1 and accept rework risk).

3. **Affinity-engage state ownership — parent React mount vs. `WedgeGridFlavorWheel` internal?** Recommendation: parent-owned `useState` + `key={focal.id}` remount on the wheel. Iteration-2 has pinned this via §2.5 wording; flagging for Architect sign-off in case `key` remount has a perf cost in the affinity overlay (the wheel re-builds SVG on every focal change anyway, so the cost is bounded).

---

## 7. Files Touched Summary

| File | Phase | Type |
|---|---|---|
| `src/data/networkModes.js` | P1 | source |
| `src/data/__tests__/networkModes.test.js` | P1 | test (extend) |
| `src/three/__tests__/CameraAnimator.labelAlignment.test.jsx` | P0 / P2 | test (NEW) — diagnostic harness, then regression |
| `src/three/CameraAnimator.js` | P2-impl | source — **only if mechanism = C-b or C-c**; if C-a, untouched |
| `src/components/LivingArchView.jsx` | P2-impl (if C-a or C-b or C-c wiring), P3, P5 | source |
| `src/components/__tests__/LivingArchView.affinityLabelHide.test.jsx` | P3 | test (NEW) |
| `src/components/__tests__/LivingArchView.affinityPrimer.test.jsx` | P5 | test (NEW or extend) |
| `src/components/__tests__/LivingArchView.legacyRegression.test.jsx` | P2-test | test (extend, conditional on C-b/C-c only) |
| `src/components/WedgeGridFlavorWheel.jsx` | P4 | source |
| `src/components/__tests__/WedgeGridFlavorWheel.primerState.test.jsx` | P4 | test (NEW) |
| `src/three/AffinityMode.js` | P6 | source |
| `src/hooks/useProData.js` | P2-impl (only if mechanism = C-c) | source — conditional |
| `.omc/notepad.md` | P0 + P7 | doc artifact (baseline, mechanism finding, screenshots-referenced) |

---

## Plan-shape summary (iteration 2)

- **Spec ambiguity:** 15.0%; spec patched in iter-2 for R8 resolution.
- **Mode:** SHORT consensus.
- **Phases:** 7 — P0 (0.5d) → P1 ‖ P2-spike → P2-impl ‖ P3 → P4 → P5; P6 independent.
- **Files modified:** 5-6 source (mechanism-dependent) + 4 new test files + 1 extended.
- **LOC estimate:** ~190 source + ~340 test + ~60 doc = **~590 LOC** (up from ~470 in iter-1; spike harness + iteration-2 pin tests + snapshot byte-identity assertions account for most of the lift).
- **Tests:** 657 baseline → ≥ 661 (P2 harness + P3 + P4 primer + P5 affinity-primer).
- **Effort:** **~5d (range 4.75–6.25d)** — P0 +0.25d (4 artifacts), P2 +0.5d (spike-first), P6 unchanged.

**Pipeline next step:** Architect review against ADR-1 / ADR-2-pre-spike / ADR-3 + open questions 1-3. Critic adversarial pass on Principle #1 (regression byte-identity under unknown P2 mechanism) and Principle #5 (round-trip). On consensus pass → `/oh-my-claudecode:start-work ralplan-network-cleanup-tactical`. Note: ADR-2 will be rewritten one more time post-P2-spike with the chosen mechanism; that rewrite is in-scope for the executor and is a hard gate before P2-impl starts.
