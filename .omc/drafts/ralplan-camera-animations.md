# RALPLAN: Camera Animations (Cluster Tour + Focal Orbit) — v2

**Source spec:** `.omc/specs/deep-interview-camera-animations.md` (deep-interview, 6 rounds, 13.3% ambiguity)
**Mode:** Consensus / Direct
**Iteration:** 2 (after Architect APPROVE_WITH_CHANGES + Critic REJECT_WITH_FEEDBACK)

**Changelog vs v1:**
- Acknowledged dual scene paths (LivingArchView own SceneManager vs. NetworkScene-shared) as the central architectural fact (Architect + Critic).
- Verified `flyToPoint` actually lives at `LivingArchView.jsx:1081` (not livingArchUtils.js — Critic flag corrected by direct grep).
- Corrected `_flyToFocal` cite to `AffinityMode.js:716` (Architect flag).
- Engaged Option D (SceneManager-hosted animator) as the chosen path; revised RALPLAN-DR.
- Added 6th FSM state `cancelled-awaiting-resume`.
- OrbitControls handoff: `enabled=false` during animator writes (replaces polling-only).
- Swapped Phases 1↔2: Network first as the harder API validator.
- Moved `prefers-reduced-motion` opt-out into Phase 1 (Principle 5 honored throughout).
- Repivot abort protocol added.
- Float-drift formula made explicit and drift-free by construction.
- Capacitor backgrounding `dt` clamp (≤100 ms).
- Mode-cycle policy: cluster tour PAUSES in non-cluster modes (`neural`/`taste2d`); does not synthesize taste centroids in v1.
- Replaced 3 "manual test will catch it" risk mitigations with measurable gates.
- Tightened 6 weak ACs (AC-CT-1, AC-CT-6, AC-FO-5, AC-NR-3, AC-NR-5, AC-CT-7).
- Added concrete per-phase smoke-test checklists.
- Phase estimates now grounded in line-count + step-count derivations.

---

## RALPLAN-DR Summary

### Principles (5, revised)
1. **Reuse the real codebase primitives.** Reusable building blocks: `easeInOutCubic` from `src/components/livingArchUtils.js:7`, the inline `flyToPoint(labelPos, centroidPos)` defined at `LivingArchView.jsx:1081`, `stateRef.flyToPoint?.()` callsites at lines 1322 + 1370, NetworkScene's `flyToTarget` useEffect at `NetworkScene.jsx:372-403`. Compose, don't replicate.
2. **Two scene paths, one animator class.** LivingArchView (Network) builds its own SceneManager + AffinityMode lifecycle in `useEffect` at lines 1066-1204; NetworkScene (Cocktail/Sauce) builds a separate SceneManager via `sceneRef.current = manager` at line 61. The same `CameraAnimator` class is instantiated in BOTH mount paths, parameterized by a centroid-source adapter. The "single class" doesn't equal "single instance."
3. **Ref-based state, never React state.** Animation frames mutate refs only. Verified pattern: `flyToTarget` is React state in CocktailLab/SauceLab (input only); the actual per-frame work happens in NetworkScene's effect against `sceneRef.current.getCamera()`.
4. **Cancel via `controls.enabled = false`, not polling alone.** While the animator owns the camera (`tour-gliding`/`tour-dwelling`/`focal-flying`/`focal-orbiting`), `OrbitControls.enabled = false`. On `recordInput()` we sync `controls.target` to whatever the animator just wrote, then flip `enabled = true`. This avoids damping-velocity-against-stale-pose snap.
5. **Accessibility ships in Phase 1, not Phase 5.** `prefers-reduced-motion: reduce` opts out at construction time; the animator's `tickAnimation` is a no-op when reduced motion is on. Phase 5 only adds the live media-query listener for runtime preference change.

### Decision Drivers (top 3)
1. **The Network α-mode collision is the highest-cost regression surface.** Phase 4 modifies `_flyToFocal` at `AffinityMode.js:716` (verified line) and must not regress engage/pivot/exit/suspend lifecycle, the 30-instance affinity InstancedMesh, dim-everything-else logic, or the 7 existing `affinityModeRef.current?.engaged` guards across `LivingArchView.jsx:1216, 1273, 1435, 1455, 1507, 1570, 1594`.
2. **Network is the harder API validator.** Network has the most state (mode-cycle, AffinityMode, transition tween, cluster-mode vs taste-mode dichotomy). If `CameraAnimator`'s API satisfies Network, plumbing it to Cocktail/Sauce is mechanical. Phase 1 = Network.
3. **Mid-orbit user input must hand off cleanly.** OrbitControls' damping has its own velocity buffer that goes stale during animator writes. Polling alone can't fix this; `controls.enabled` toggle plus pose sync at hand-off is the load-bearing mechanism.

### Viable Options

#### Option A (rejected): Polling-only cancel + per-mount instantiation
- One `CameraAnimator` class, instantiated in each scene path's mount effect. Cancel = polling `lastInputTs` only.
- **Why rejected:** doesn't solve the OrbitControls damping handoff. Architect verified the snap mechanism is real even with polling. Need `controls.enabled` toggle.

#### Option B (rejected): Per-view animator subclasses
- `NetworkCameraAnimator` extends `CameraAnimator`; same for Cocktail/Sauce.
- **Why rejected:** the spec mandates uniform camera language. Architect noted the steelman (Network-specific subclass for α-mode collision) but the seam is small enough (5 lines in `_flyToFocal`, 2 lines in `pivot`/`exit`) that injection beats subclassing. **Concrete invalidation:** AffinityMode constructor already takes (stateRef, ctx) — adding a third (cameraAnimator) param is two lines vs. ~50 lines of subclass scaffold.

#### Option C (rejected): Loop flag on existing `flyToPoint`
- Extend `flyToPoint` at `LivingArchView.jsx:1081` to accept `loop=true`.
- **Why rejected:** `flyToPoint` is a closure inside the mount effect, capturing `centroidByCluster3d`, `clusterLabelGroup`, etc. Promoting it would unwind the closure. Also, the cluster tour adds label-pop animation, idle resume, mode-cycle pause — three responsibilities `flyToPoint` doesn't currently own.

#### Option D (CHOSEN): SceneManager-hosted animator with dependency-injected centroid adapter
- New file `src/three/CameraAnimator.js`. Single class.
- Each consumer (LivingArchView's mount effect AND NetworkScene's mount effect) instantiates `new CameraAnimator(stateOrSceneRef, centroidAdapter, opts)` where `centroidAdapter` is a small function returning `[{id, position}, ...]` — Network's adapter reads `centroidByCluster3d` and the current `mode`, Cocktail/Sauce's adapter reads `familyCentroids`.
- AffinityMode receives the animator via constructor injection: `new AffinityMode(stateRef, affinityCtx, cameraAnimator)`.
- The animator owns: state machine, dwell/glide timers, orbit math, cancel, idle resume, label-pop lerp, mode-cycle pause hook, visibility gate, dt clamp.
- **Pros:** Same class for both scene paths. Clean dependency injection seam for AffinityMode. Adapter pattern handles the Network mode-cycle (adapter returns `[]` for `neural`/`taste2d` → animator pauses naturally).
- **Cons:** Adapter pattern is one indirection layer; tests need mock adapters. Acceptable.

---

## Requirements Summary

(Verbatim from spec — see `.omc/specs/deep-interview-camera-animations.md` § Goal.)

- **Cluster tour** (auto on view-load): 4 s dwell + 2 s glide × N clusters. 1.5× label scale-pop during dwell. Resumes after 30 s idle from cluster nearest current camera position.
- **Focal orbit** (auto on focal-select): 60° elevation, distance 75. 25 s/lap desktop, 30 s/lap mobile. Continuous loop. In Network: replaces α-mode top-down flight while keeping rings visible.
- All three views, both platforms. `prefers-reduced-motion: reduce` = full opt-out.

## Acceptance Criteria (revised, v2)

### Cluster Tour

- [ ] **AC-CT-1** *(tightened)*: `CameraAnimator.engageClusterTour(centroids)` is called from each scene path's mount effect; first call to `tickAnimation(dt)` after engage advances state to `tour-gliding` on the SAME frame. Measured by spy on the state setter, not wall clock.
- [ ] **AC-CT-2**: dwell timer accumulator hits dwell-end at `4 ± 0.05 s` (jest fake timers + injected `now()`).
- [ ] **AC-CT-3**: cluster label sprite scale lerps `1.0 → 1.5 → 1.0` during dwell — at `t=0` scale=1.0, at `t=250ms` scale=1.5, at `t=3.75s` scale=1.5, at `t=4.0s` scale=1.0. Three sample points asserted in unit test.
- [ ] **AC-CT-4**: glide segment reaches target in `2 ± 0.05 s`. Camera position at `t=0` matches start; at `t=2s` matches `centroidNext` within 0.01 scene units (eased curve at endpoint is 0).
- [ ] **AC-CT-5**: deterministic order — `state.tourOrder = centroids.slice().sort((a,b) => a.id - b.id).map(c => c.id)`. Reload twice, assert order identical.
- [ ] **AC-CT-6** *(tightened)*: `recordInput()` transitions state to `cancelled-awaiting-resume` synchronously; the SAME tick's `tickAnimation` call returns early without writing camera. Verified by spy on `camera.position` setter — count must be `0` after `recordInput()` until next `engageX()`.
- [ ] **AC-CT-7** *(tightened)*: From `cancelled-awaiting-resume`, after `30000 ms` of zero `recordInput()` calls (measured by injected `now()`), state transitions to `tour-gliding` AND `state.currentClusterIdx` equals `argmin(distance(centroid_i, camera.position))`. Test exposes `_resumeFromIdle()` directly.
- [ ] **AC-CT-8**: When `document.visibilityState !== 'visible'`, `tickAnimation` does not advance dwell/glide timers. Asserted by stubbing `document.visibilityState = 'hidden'` and confirming dwell timer unchanged after 1000 simulated ticks.

### Focal Orbit

- [ ] **AC-FO-1**: On `engageFocalOrbit(focalIdx)`, state transitions `idle → focal-flying`, then `focal-flying → focal-orbiting` after 1200 ms (verified by injected clock).
- [ ] **AC-FO-2** *(formula explicit)*: elevation = `Math.atan2(camera.y - focal.y, Math.hypot(camera.x - focal.x, camera.z - focal.z))`. After `focal-flying` completes, elevation ∈ `[59°, 61°]`. Sampled every 100 ms for one full lap; max deviation < 1°.
- [ ] **AC-FO-3**: lap completes in `desktop: 25 ± 0.5 s, mobile: 30 ± 0.5 s`. `mobile` driven by `opts.isMobile` flag, set by adapter from `window.innerWidth < 640`.
- [ ] **AC-FO-4** *(drift-free formula)*: orbit angle = `((totalElapsed * 1000) % (lapSec * 1000)) / (lapSec * 1000) * 2 * Math.PI`. After 100 simulated laps, `Math.abs(angle - 0)` at the lap boundary < 1e-9.
- [ ] **AC-FO-5** *(tightened)*: After `engageFocalOrbit(idx)` in Network, `affinityModeRef.current.affinityMesh.visible === true` AND for `i in [0..29]`, `affinityModeRef.current.affinityMesh.getMatrixAt(i, m); m.decompose(_, _, scale); expect(scale.x > 0.5 && scale.y > 0.5 && scale.z > 0.5).toBe(true)` — i.e. ring instances are NOT scale-zeroed. Verified after one full orbit lap.
- [ ] **AC-FO-6** *(measurable)*: at `recordInput()`-frame N, save `posN = camera.position.clone()`. At frame N+1, after `controls.enabled = true; controls.update();`, `camera.position.distanceTo(posN) < 0.5` scene units. No tween-back.
- [ ] **AC-FO-7**: `repivot(newIdx)` calls `_abortFlight()` first (which clears any in-progress `focal-flying` tween); then transitions state to `focal-flying` for the new focal. Orbit angle accumulator continues from current value (not reset). Test: hammer-call repivot 5× in 100ms, assert state ends at `focal-flying` for the LAST idx, not stuck partway.

### Mobile / Accessibility

- [ ] **AC-MA-1**: when `window.innerWidth < 640`, the bloom pass `strength` is 0.6× the desktop default. Verified by reading `composer.passes[1].strength` after init.
- [ ] **AC-MA-2**: when `window.matchMedia('(prefers-reduced-motion: reduce)').matches === true` at construction, `engageClusterTour()` and `engageFocalOrbit()` set state to `idle` and return early. `tickAnimation` is a no-op. Existing static fly-to behavior takes over for selection.
- [ ] **AC-MA-3** *(measurable)*: 100 mount/unmount cycles → `scene.children.length` returns to its initial value (mirrors `AffinityMode.perf.test.js:131-156`). Measured at iteration 0 and iteration 100; equal within tolerance 0.

### No Regression

- [ ] **AC-NR-1**: `ClusterJoystick.onFlyTo` still flies to family centroids; on first joystick interaction, animator state is `cancelled-awaiting-resume`.
- [ ] **AC-NR-2**: `SearchBar` selection still flies to ingredient with existing 1200 ms ease.
- [ ] **AC-NR-3** *(tightened)*: in Network, mode transition (e.g. ml→neural): when `triggerTransition` fires, animator state moves to `idle`. After `TRANSITION_DURATION` ms (constant from `livingArchConstants.js`), if new mode is `ml` or `ml2d`, animator re-engages with new centroids; if new mode is `neural` or `taste2d`, animator stays `idle` (no clusters to tour).
- [ ] **AC-NR-4**: AffinityMode `pivot()` between focal ingredients works correctly; affinity rings re-write at new focal position; orbit angle continues from current value. Existing `AffinityMode.test.js` + `AffinityMode.perf.test.js` continue to pass with the dependency-injected animator.
- [ ] **AC-NR-5** *(grounded)*: every pre-existing test in the affected files (`cocktailShapes.test.js`, `sauceShapes.test.js`, `affinityShapes.test.js`, `affinityTiers.test.js`, `AffinityMode.test.js`, `AffinityMode.perf.test.js`) continues to pass. The gate is "no regressions"; record baseline test count via `npx vitest run --reporter=verbose <files> | grep -c '✓'` BEFORE Phase 1 and assert the same count post-Phase-4. Plus new tests: ≥10 in `CameraAnimator.test.js`, ≥2 in `CameraAnimator.perf.test.js`.

## Implementation Steps

### Phase 1 — CameraAnimator + Network cluster tour + a11y (~1.5 d, ≈400 LoC)
**Why first:** Network is the harder consumer (mode-cycle, AffinityMode interaction). Get the API right against the worst case.

1. **Create `src/three/CameraAnimator.js`** (≈300 LoC):
   - Class with `constructor(sceneCtx, centroidAdapter, opts)`. `sceneCtx` is an explicit `{camera, controls, scene}` object — the caller (LivingArchView's mount effect, NetworkScene's mount effect) unwraps its own scene-ref shape into this concrete contract. No polymorphism inside the animator.
   - **`centroidAdapter` contract:** `() => Array<{id: number, position: [x,y,z]}>`. Returning `[]` is the canonical signal for "no clusters in this mode → pause tour naturally." Network's adapter consults the live `mode` and returns `[]` for `neural`/`taste2d`; Cocktail/Sauce's adapter returns the static `familyCentroids`.
   - 6-state FSM: `idle | tour-gliding | tour-dwelling | focal-flying | focal-orbiting | cancelled-awaiting-resume`.
   - Public methods: `engageClusterTour()`, `engageFocalOrbit(focalIdx, focalPosition)`, `repivot(focalIdx, focalPosition)`, `recordInput()`, `tickAnimation(dt)`, `pauseClusterTour()`, `resumeClusterTour()`, `dispose()`.
   - Private: `_glideTo(target, durationMs)`, `_dwellAtCluster(idx, durationMs)`, `_orbitTick(dt)`, `_resumeFromIdle()`, `_abortFlight()`.
   - On construction: read `window.matchMedia('(prefers-reduced-motion: reduce)').matches`; if true, set internal `_disabled = true` and have `engageX()` return early.
   - On construction: detect `window.innerWidth < 640`; set `lapSec = 30` instead of `25` for orbit.
   - Drift-free orbit angle formula (see AC-FO-4).
   - dt clamp: `dt = Math.min(dt, 0.1)` to handle Capacitor iOS resume from background.
   - Visibility gate: skip tick if `document.visibilityState !== 'visible'`.
   - Cancel via `controls.enabled = false` while owning camera; on `recordInput()`, sync `controls.target` to focal/centroid then `controls.enabled = true`.
2. **Create `src/three/CameraAnimator.test.js`** (≥10 tests covering ACs CT-1..CT-8, FO-1..FO-7, MA-2):
   - Pure-math: `nearestClusterIdx`, drift-free orbit angle over 100 simulated laps, label-scale lerp at three sample points, dwell/glide timer accumulators, dt clamp.
3. **Create `src/three/CameraAnimator.perf.test.js`** (≥2 tests covering AC-MA-3):
   - Mirror `AffinityMode.perf.test.js:131-156` pattern: stateRef stub, 100 engage/dispose cycles, assert scene.children unchanged.
4. **Modify `src/components/LivingArchView.jsx`**:
   - Inside the mount effect (line 1066-1204), after AffinityMode is constructed (line 1163), construct `cameraAnimator = new CameraAnimator(stateRef.current, networkCentroidAdapter, {...})`. The adapter returns centroids from `centroidByCluster3d` when mode is `ml`/`ml2d`, else `[]`.
   - Pass `cameraAnimator` into the AffinityMode constructor so it can call `cameraAnimator.engageFocalOrbit()` later (Phase 4 wires this up; for now AffinityMode doesn't use it).
   - In the `animate()` loop, call `cameraAnimator.tickAnimation(dt)` BEFORE `controls.update()`.
   - In dispose (lines 1180-1191), order is **load-bearing**: call `affinityModeRef.current.dispose()` FIRST (it may invoke `cameraAnimator.exitFocalOrbit()` from inside its own `exit()`), THEN `affinityModeRef.current = null`, THEN `cameraAnimator.dispose()`. Animator MUST outlive AffinityMode because AffinityMode holds a constructor-injected reference. Reverse order produces a use-after-free on the animator that may silently no-op rather than throw — making the leak invisible to AC-MA-3.
   - Wire `recordInput()` to: OrbitControls 'start' event, `handleSceneClick`, double-tap handler, ESC keydown, joystick `onFlyTo` callback, search-select callback.
   - On `triggerTransition` (mode change), call `cameraAnimator.pauseClusterTour()`; on transition complete, call `cameraAnimator.resumeClusterTour()` if new mode is cluster-mode, else leave paused.
5. **Smoke-test checklist** (manual, before commit):
   - Open Network on desktop. Within 1 sec, camera glides to first cluster. Wait 4 sec, label scales up to 1.5×. Glides to next cluster (~2 sec). Continues for full lap (~60 sec). No console errors.
   - Drag the canvas mid-glide. Camera stops immediately, OrbitControls take over, no snap.
   - Wait 30 sec idle (no input). Tour resumes from cluster nearest current camera position.
   - Cycle modes: ml → ml2d → neural → taste2d → ml. Tour pauses during transition. Tour does NOT run in `neural`/`taste2d`. Tour resumes in `ml`/`ml2d`.
   - In Chrome DevTools: enable "Emulate CSS prefers-reduced-motion: reduce". Reload. Tour does NOT start. Existing static behavior works.
6. Run `npx vitest run src/three/CameraAnimator.test.js src/three/CameraAnimator.perf.test.js` — all pass.
7. Run `npm run build` — clean.

### Phase 2 — Plumb cluster tour to Cocktail + Sauce (~0.5 d, ≈80 LoC)
**Why second:** plumbing only. NetworkScene is the simpler consumer.

1. **Modify `src/components/NetworkScene.jsx`**: in mount effect, instantiate `new CameraAnimator(manager, props.centroidAdapter, {...})`. Hook `tickAnimation(dt)` into existing animator loop (use `clock.getDelta()`). Wire `recordInput()` to OrbitControls 'start' + scene click handlers.
2. **Modify `src/components/CocktailLab.jsx`**: pass `centroidAdapter={() => Array.from(familyCentroids).map(([id,pos]) => ({id, position: pos}))}` to NetworkScene.
3. **Modify `src/components/SauceLab.jsx`**: same pattern.
4. **Smoke-test checklist** (manual):
   - Open Cocktail Lab. Tour starts with 7 family centroids. Cycles. Joystick fly-to cancels tour.
   - Open Sauce Lab. Tour starts with 10 family centroids. Cycles. Cancellation works.
5. Run `npm run build`.

### Phase 3 — Focal orbit for Cocktail + Sauce (~1.5 d, ≈150 LoC)
**Why third:** test focal orbit on the easy views first (no α-mode collision).

1. **Implement `engageFocalOrbit`/`repivot`/`exitFocalOrbit`/`_abortFlight` in `CameraAnimator.js`**:
   - `engageFocalOrbit(focalIdx, focalPosition)`: if state is `tour-X`, transition to `focal-flying`. Save `_currentFlightId = ++this._flightCounter`. Compute target camera pose at 60° elevation, distance 75 from focal. Tween for 1200 ms. On completion, transition to `focal-orbiting`.
   - `repivot(newIdx, newPosition)`: call `_abortFlight()` (sets `_currentFlightId = null` and short-circuits the in-progress lerp); call `engageFocalOrbit(newIdx, newPosition)`.
   - `_orbitTick(dt)`: parametric write of camera position around focal using drift-free angle. Maintain elevation = 60°.
2. **Modify `src/components/CocktailLab.jsx`** and **`SauceLab.jsx`**: when `selectedCocktail`/`selectedSauce` changes from null to a name, call `cameraAnimatorRef.current.engageFocalOrbit(idx, position)`. When it changes name-to-name, call `repivot(...)`. When it returns to null, animator stays in current state until user input (per spec: deselect cancels orbit, returns to idle, tour eventually resumes).
3. **Add tests for AC-FO-1..FO-4, FO-7** in `CameraAnimator.test.js`.
4. **Smoke-test checklist**:
   - Open Cocktail Lab. Click a cocktail. 1.2 sec eased flight to angled view. 25 sec lap. Camera maintains ~60° elevation throughout.
   - Click 5 cocktails in 3 sec (hammer-pivot). Animator handles each repivot cleanly; ends at the last clicked cocktail; no stuck state.
   - Drag camera mid-orbit. Stops cleanly; no snap.
   - Same for Sauce Lab.

### Phase 4 — Focal orbit for Network (replaces α-mode flight) (~2.0 d, ≈100 LoC modified, highest risk)
**Why last:** the AffinityMode collision surface. Phase 1-3 must validate the API before this.

1. **Modify `src/three/AffinityMode.js`**:
   - Constructor accepts a third arg: `cameraAnimator`. Store as `this._cameraAnimator`.
   - Replace `_flyToFocal()` body (lines 716-753) with: `this._cameraAnimator.engageFocalOrbit(focalIdx, focalPosition)`.
   - In `pivot()` (line 267): instead of calling `this._flyToFocal(newFocal)`, call `this._cameraAnimator.repivot(newIdx, newPosition)`.
   - In `exit()`: call `this._cameraAnimator.exitFocalOrbit()`.
2. **Modify `LivingArchView.jsx` mount effect**: when constructing AffinityMode (line 1163), pass `cameraAnimator` as 3rd arg.
3. **Run all existing AffinityMode tests** — `AffinityMode.test.js` (6 tests) + `AffinityMode.perf.test.js` (2 tests). Ensure no regression. The perf test's 100-pivot loop is a stress-test of `repivot()` flight abortion.
4. **Add new test in `AffinityMode.perf.test.js`**: assert affinity ring instance scales remain non-zero after one orbit lap (AC-FO-5).
5. **Smoke-test checklist**:
   - Open Network. Click an ingredient. 1.2 sec angled flight. 25 sec lap. Affinity rings visible throughout, rotating into view from different angles.
   - Pick a different ingredient. Rings re-write at new focal. Camera re-flies. Orbit continues.
   - Hammer-click 5 ingredients. Final state stable on last clicked.
   - Drag camera mid-orbit. OrbitControls take over cleanly.
   - Press ESC. Orbit cancels. Tour does NOT immediately re-engage (cancelled-awaiting-resume).
   - All 7 prior α-mode acceptance criteria still pass (run through them manually).

### Phase 5 — Polish (~0.5 d, ≈30 LoC)
**Why last:** polish only.

1. **Live media-query listener**: `mediaQueryList.addEventListener('change', ...)` so users who toggle "Reduce Motion" mid-session see immediate effect.
2. **Bloom downscale verification**: confirm `composer.passes[bloomIdx].strength` is 0.6× on mobile. Add as a unit test against `SceneManager` initialization.
3. **Final regression sweep**: run all 38+ tests + new tests.
4. **Deploy to Firebase**: `npm run build && firebase deploy --only hosting && git push`.

**Total estimate:** 1.5 + 0.5 + 1.5 + 2.0 + 0.5 = **6.0 days** (vs v1's optimistic 4.5).
**Total LoC:** new ~430, modified ~120, test ~250. Total ~800 LoC.

## Risks and Mitigations (revised)

| Risk | Severity | Mitigation (gate) |
|------|----------|------------------|
| Mid-orbit cancel produces visual snap | High | `OrbitControls.enabled = false` during animator-owned frames; on `recordInput()`, sync `controls.target` to focal then re-enable. **Gate:** AC-FO-6 measures position delta < 0.5 scene units between cancel-frame and next frame. Failing this AC blocks Phase 4 ship. |
| AffinityMode regression (rings disappear / dim breaks / pivot stuck) | High | Phase 4 last; existing 8 AffinityMode tests must pass; new AC-FO-5 test asserts ring scales after one orbit lap. **Gate:** any failing AffinityMode test blocks Phase 4. |
| Mode-cycle leaves tour pointing at stale centroids | High | Adapter returns `[]` for `neural`/`taste2d`; animator pauses naturally. On transition complete, animator re-reads via adapter. **Gate:** AC-NR-3 unit test stubs adapter, verifies state transitions. |
| Focal orbit FP drift over 8h | Medium | Drift-free formula `(totalElapsed % lapSec) / lapSec * 2π`. **Gate:** AC-FO-4 test simulates 100 laps, asserts angle == 0 at lap boundary within 1e-9. |
| Hammer-pivot leaves animator in bad state | Medium | `repivot()` calls `_abortFlight()` to clear in-progress tween. **Gate:** AC-FO-7 test calls repivot 5× in 100 ms, asserts final state matches last call. |
| Mobile heat / battery (continuous orbit GPU draw) | Medium | Bloom 0.6× on mobile, lap 30 s instead of 25 s. **Gate:** Chrome DevTools Performance panel during 30-sec orbit on iPhone 11 emulation; p95 frame time < 16 ms. If fails, drop bloom further. |
| `prefers-reduced-motion` toggle mid-session | Low | Live media-query listener (Phase 5). **Gate:** AC-MA-2 test plus manual toggle in DevTools. |
| Idle timer runs in background tab | Low | Visibility gate in `tickAnimation`. **Gate:** AC-CT-8 test stubs `document.visibilityState='hidden'`, verifies dwell timer unchanged after 1000 ticks. |
| AffinityMode + CameraAnimator dispose order | Medium | AffinityMode holds an injected ref to `cameraAnimator` (Phase 4). Correct order at `LivingArchView.jsx:1180`: `affinityModeRef.current.dispose()` → `affinityModeRef.current = null` → `cameraAnimator.dispose()`. Animator outlives AffinityMode. Reverse order produces use-after-free that may silently no-op (AC-MA-3 leak test won't necessarily catch it). **Gate:** code-review checklist + explicit comment at the dispose site. |
| Capacitor iOS resume → huge `dt` jump | Medium | `dt = Math.min(dt, 0.1)` clamp in `tickAnimation`. **Gate:** unit test passes `dt = 5.0`, asserts orbit angle advances by orbit-rate × 0.1, not × 5.0. |

All risks now have measurable gates; "manual test" is reserved for cross-platform smoke validation, not as the primary mitigation.

## Verification Steps

1. `npx vitest run src/three/CameraAnimator.test.js src/three/CameraAnimator.perf.test.js` — new tests pass
2. `npx vitest run src/three/AffinityMode.test.js src/three/AffinityMode.perf.test.js src/data/__tests__/cocktailShapes.test.js src/data/__tests__/sauceShapes.test.js src/data/__tests__/affinityShapes.test.js src/data/affinityTiers.test.js` — 38 existing tests pass
3. `npm run build` — clean production build, no errors
4. Manual smoke-test checklists (per phase, see Implementation Steps)
5. Chrome DevTools Performance panel: 30-sec orbit on mobile-viewport emulation; p95 frame time < 16 ms
6. iOS verification deferred to next TestFlight build (parked until billing resets)
7. Final post-deploy: `firebase deploy --only hosting && git push`; verify https://neuralflavor.web.app loads cleanly with tour running

## ADR (Architecture Decision Record)

### Decision
Implement a single `CameraAnimator` class in `src/three/CameraAnimator.js`, instantiated **twice** (once in LivingArchView's mount effect for Network, once in NetworkScene's mount effect for Cocktail/Sauce). Cancel via `OrbitControls.enabled = false` toggle plus pose sync at handoff (not polling alone). Adapter pattern for centroid sources allows the same class to handle Network's mode-aware centroids and Cocktail/Sauce's static family centroids. AffinityMode receives the animator via constructor injection. 5-phase rollout, Network first.

### Drivers
1. **Network is the hardest consumer.** Mode-cycle, AffinityMode collision, transition tweens. Build the API against this and the easy consumers fall out.
2. **AffinityMode regression is the highest-cost failure mode.** Phase 4 sequencing (last) is non-negotiable.
3. **OrbitControls damping requires explicit handoff.** `enabled = false` during animator writes is load-bearing.

### Alternatives considered
- Option A (polling-only cancel) — rejected: doesn't solve damping handoff.
- Option B (per-view subclasses) — rejected: 5-line injection beats 50-line subclass scaffold.
- Option C (loop flag on `flyToPoint`) — rejected: closure can't be promoted without rewrite; 3 responsibilities don't fit one function.
- Option D (SceneManager-hosted animator) — chosen.

### Why chosen
Option D balances reuse (single class), encapsulation (animator owns animation state), and risk control (5-phase rollout with each phase ship-able). Constructor injection into AffinityMode keeps the lifecycle seam tight (5 modified lines in AffinityMode total).

### Consequences
- New `CameraAnimator.js` (≈300 LoC).
- Two new test files (`CameraAnimator.test.js`, `CameraAnimator.perf.test.js`).
- AffinityMode constructor signature changes (3rd arg `cameraAnimator`). Existing AffinityMode tests need 1-line update for the new arg.
- LivingArchView mount effect grows by ~30 lines (animator construction, dispose, input wiring).
- NetworkScene mount effect grows by ~30 lines (same).
- CocktailLab + SauceLab grow by ~10 lines each (centroid adapter prop).
- `dt` clamp + visibility gate are global behaviors that affect future animation work in the same scene paths — document this contract at the top of `CameraAnimator.js`.
- LivingArchView's separate scene path becomes "supported" rather than incidental; the dual-instantiation pattern makes future cross-view animation work explicit.
- **Adapter contract is load-bearing:** `centroidAdapter: () => Array<{id, position}>`. Returning `[]` is the canonical signal to pause tour. Future maintainers must NOT add Network-specific behavior to the adapter (e.g., reading α-mode state) — the adapter is purely a centroid source, not a policy layer.
- **Dispose order contract:** at LivingArchView's cleanup, AffinityMode disposes BEFORE the animator (because AffinityMode holds an injected ref). Reverse order is silent-failure territory; documented at the dispose site with a comment.
- **Subclass escape hatch:** if Phase 4's AffinityMode-side modifications exceed 15 lines (current estimate: 5), refactor to `NetworkAffinityAnimator extends CameraAnimator` rather than further pollute the shared class with Network-specific calls. This is a Phase 4 review gate, not a default path.
- **Network animator feature flag:** Phase 1 ships the animator wired into LivingArchView, but the engage-call is gated behind a `?cameraAnim=v1` URL param OR a single boolean constant. Phase 4 flips the constant to default-on once α-mode regression is verified. This avoids a production rollback if Phase 4 reveals a regression after Phase 1 ships.

### Follow-ups
- v1.1: explicit "▶ Tour" button as opt-in (currently out of scope).
- v1.1: configurable orbit elevation via URL param.
- v1.2: synthesize taste-mode centroids so cluster tour also runs in `neural`/`taste2d` modes.
- v1.2: per-view custom tour orderings (size-sorted, color-sorted) — would need a new spec.

---

**End of Planner v2 draft.** Major changes from v1 documented in changelog above. Awaiting Architect + Critic re-review.
