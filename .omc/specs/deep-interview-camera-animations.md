# Deep Interview Spec: Camera Animations (Cluster Tour + Focal Orbit)

## Metadata
- Interview ID: camera-animations-2026-04-29
- Rounds: 6 (+ initial framing pass)
- Final Ambiguity Score: ~13% (under 20% threshold)
- Type: brownfield (extends existing Network / Cocktail Lab / Sauce Lab 3D scenes)
- Generated: 2026-04-29
- Status: PASSED
- Inspiration: ambient cinematic camera language ("tour-bus" + "orbit-around-subject"),
  applied to make the existing static cluster-and-node visualization feel alive on
  view-load.

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity      | 0.90 | 0.35 | 0.3150 |
| Constraint Clarity| 0.85 | 0.25 | 0.2125 |
| Success Criteria  | 0.85 | 0.25 | 0.2125 |
| Context Clarity   | 0.85 | 0.15 | 0.1275 |
| **Total Clarity** |      |      | **0.8675** |
| **Ambiguity**     |      |      | **0.1325 (~13%)** |

## Goal

Add two coordinated camera animations to all three 3D views (Network /
LivingArchView, Cocktail Lab, Sauce Lab) so the visualization reads as
"alive" on first impression rather than a static graph diagram:

1. **Cluster Tour (auto, on view-load)**: camera glides through every
   cluster centroid in the scene, dwelling on each cluster's label for
   4 sec with a 1.5× label-scale-pop emphasis effect, then gliding 2 sec
   to the next cluster. Loops indefinitely. Cancels on any user camera
   input. Resumes after 30 sec of idle, picking up from the cluster
   nearest the camera's current position.

2. **Focal Orbit (auto, on focal-select)**: when a single ingredient /
   cocktail / sauce is selected, camera flies to a 60° angled bird's-eye
   view at the focal node and orbits 360° around it continuously
   (~25 sec / revolution). In Network specifically, this **replaces**
   α-mode's existing static top-down flight while keeping the affinity
   rings + dim-everything-else visuals — the rings rotate slowly into
   view from different angles as the camera laps. Cancels on any user
   camera input.

The two animations form a single "camera language": when the user is
not focal-selecting, the cluster tour runs; when they pick a focal,
the cluster tour yields and the focal orbit takes over; when they
deselect, cluster tour resumes from the nearest cluster. Mobile and
desktop both run the full animation by default, with downscaled GPU
load on phones (lower bloom intensity, possibly slightly longer lap
time on the orbit) to manage heat / battery.

## Defined Variables

### Cluster Tour timing
```
PER_CLUSTER_DWELL_SEC          = 4.0   // hold + label-pop
INTER_CLUSTER_GLIDE_SEC        = 2.0   // eased fly-to-next
LAP_DURATION_SEC               = N * (DWELL + GLIDE)
                                 // Network: 10 clusters → 60 sec
                                 // Cocktail: 7 families  → 42 sec  (Syrups skipped, no codex centroid)
                                 // Sauce:   10 families → 60 sec
LABEL_EMPHASIS_SCALE           = 1.5   // sprite scale during dwell
LABEL_EMPHASIS_EASE_MS         = 250   // pop-in / pop-out lerp time
IDLE_BEFORE_RESUME_MS          = 30000 // 30 sec
TOUR_ORDER                     = sortBy(cluster.id ASC)
                                 // deterministic so "nearest cluster" math
                                 // produces a stable resume target
```

### Focal Orbit timing
```
ORBIT_LAP_SEC_DESKTOP          = 25    // chosen mid-range of 20-30 from Round 5
ORBIT_LAP_SEC_MOBILE           = 30    // slightly slower → less GPU stress
ORBIT_ELEVATION_DEG            = 60    // angled bird's-eye (per user spec)
ORBIT_DISTANCE                 = 75    // matches existing AffinityMode._flyToFocal
ORBIT_DIRECTION                = clockwise (from above)
INITIAL_FLIGHT_TO_ORBIT_MS     = 1200  // re-uses existing flyToPoint cadence
```

### Cancellation triggers (apply to BOTH animations)
```
CANCEL_ON = OrbitControls drag, pinch, scroll-zoom, tap-on-node,
            tap-on-cluster-pill, search-select, double-tap, ESC
RESUME_AFTER = 30000 ms of zero camera input
RESUME_FROM = nearest cluster centroid to the camera's current position
              (cluster tour only)
```

### Mobile downscale strategy
```
detect: window.innerWidth < 640 (matches existing isMobile hook)
adjust:
  - bloom intensity: 0.6× of desktop
  - orbit lap time: 25 → 30 sec (slower = less work / sec)
  - cluster dwell: 4 → 4 sec (no change, already cheap)
respect: prefers-reduced-motion media query — if true, BOTH animations
         disabled; the existing static flyToPoint behavior takes over
```

## Constraints

### Trigger model (Round 1: Option A — auto-cycling demo mode)
- Cluster tour begins **immediately on view-load** for Network, Cocktail Lab,
  and Sauce Lab. Loops indefinitely.
- Focal orbit begins automatically when `selectedNodes.length === 1`
  (the same gate that engages α-mode in Network).
- Neither animation requires a button or explicit user action to start.
- Both cancel on any user camera input.

### Pacing (Round 2: Option C — mid-pace 60 sec lap)
- Cluster tour: 4 sec dwell + 2 sec glide per cluster.
- Focal orbit: 25 sec / lap on desktop, 30 sec / lap on mobile.
- All transitions use `easeInOutCubic` (matches existing `flyToPoint`).

### Resume after interrupt (Round 3: Option D — camera-aware)
- After 30 sec of zero camera input, cluster tour resumes from the
  cluster centroid **nearest the camera's current position**
  (Euclidean distance in scene units, not from where it left off).
- If the focal is still selected at the resume time, focal orbit
  resumes (not cluster tour).
- Tour does not resume if the user has switched to a different tab
  (Recipe Lab, etc.) — the tour only runs while the parent view is
  visible.

### Dwell behavior (Round 4: Option D — stop + label pop)
- Camera holds completely still for 4 sec at each cluster.
- During the dwell, the cluster's label sprite scales from 1.0 → 1.5
  (250 ms ease-out), holds for ~3.5 sec, then scales back to 1.0
  (250 ms ease-in) just before the camera glides away.
- Other cluster labels stay at 1.0 throughout.

### α-mode interaction (Round 5: Option B — replace + loop)
- In Network, when the user picks a focal:
  - Existing α-mode dims non-affinity nodes + shows 30 affinity rings — KEEP.
  - Existing α-mode top-down flight at distance 75 — REPLACE with
    angled 60° orbit at distance 75, looping continuously.
  - Affinity rings remain visible the whole time, slowly rotating into
    view from different angles as the camera laps.
- In Cocktail Lab and Sauce Lab (no α-mode), focal orbit is just a
  60° angled orbit around the selected node with no other visuals
  changing.

### Platform coverage (Round 6: Option A — no compromise)
- All three views, both desktop and mobile, get both animations by
  default.
- Mobile gets downscaled bloom + slightly longer orbit lap to manage
  GPU heat.
- `prefers-reduced-motion: reduce` opts the user out of both
  animations completely (static existing camera behavior takes over).

### Implementation constraints (brownfield)
- Reuse `flyToPoint` (1200 ms eased) for the cluster glide segments.
- Reuse `ClusterJoystick.onFlyTo` cluster-centroid math (already
  computed in `familyCentroids` for Cocktail/Sauce; in Network the
  cluster centroids come from `cluster_labels.json`).
- AffinityMode's `_flyToFocal` becomes a special case of focal orbit:
  replace the static `tween()` at line 643 with a continuous
  parametric orbit. Keep the 1200 ms initial fly-in cadence.
- No new heavy deps. Tour state is ref-based (mirrors existing
  `flyToTarget` pattern), not React state, so animation frames don't
  cause React re-renders.
- Prefers-reduced-motion check via `window.matchMedia('(prefers-reduced-motion: reduce)')`.

## Non-Goals
- **NOT replacing OrbitControls.** The user can still drag / pinch /
  zoom freely; that just cancels the active animation.
- **NOT adding a manual "Play Tour" button.** The user explicitly
  picked auto-cycling demo mode in Round 1; an opt-in button is out
  of scope.
- **NOT animating the existing flyToPoint calls** that fire on
  joystick taps or search-select. Those keep their current 1200 ms
  ease cadence — only the new ambient/focal animations are added.
- **NOT building a focal-orbit "exit transition"** in Network when
  the user deselects. The animation just stops and cluster tour
  resumes from the nearest cluster after 30 sec idle (or
  immediately, since deselect counts as user input that cancels
  the orbit AND restarts the tour countdown).
- **NOT rebuilding the camera system per-view.** A single shared
  `CameraAnimator` controller serves all three views via the existing
  `stateRef.camera` + `stateRef.controls` references.

## Acceptance Criteria

### Cluster Tour
- [ ] On view-load (Network / Cocktail / Sauce), camera begins gliding
  through cluster centroids within 500 ms of mount.
- [ ] At each cluster, camera holds still for 4 ± 0.2 sec while the
  cluster label sprite scales from 1.0 → 1.5 → 1.0 over the dwell.
- [ ] Glide between clusters takes 2 ± 0.2 sec with `easeInOutCubic`.
- [ ] Lap order is deterministic across reloads (sorted by cluster id).
- [ ] Tour loops indefinitely until user input.
- [ ] Any of {drag, pinch, scroll-zoom, tap-on-node, tap-on-pill,
  search-select} cancels the tour within one frame.
- [ ] After 30 sec of zero input, tour resumes from the cluster
  nearest the camera's current Euclidean position.
- [ ] Switching to Recipe Lab tab pauses the tour; switching back
  resumes the idle countdown.

### Focal Orbit
- [ ] On focal-select (selectedNodes.length transitions to 1), camera
  flies to a position 60° above horizontal at distance 75 from the
  focal in 1200 ms (eased) — same cadence as existing flyToPoint.
- [ ] After arrival, camera orbits clockwise around the focal axis at
  desktop 25 ± 1 sec / lap, mobile 30 ± 1 sec / lap.
- [ ] Camera maintains the 60° elevation throughout the orbit
  (focal is always centered, never at edge of frame).
- [ ] Orbit loops indefinitely until user input.
- [ ] In Network: affinity rings remain fully visible during the
  entire orbit (no dim/restore mid-orbit).
- [ ] User input {drag/pinch/zoom} cancels the orbit immediately;
  on cancel, OrbitControls take over from the camera's current pose
  with no jump.
- [ ] Selecting a different focal: orbit re-targets smoothly to the
  new focal with a 1200 ms re-flight (no full reset).

### Mobile / accessibility
- [ ] On mobile (`window.innerWidth < 640`), orbit lap is 30 sec and
  bloom intensity is reduced to 0.6× of desktop value.
- [ ] If `prefers-reduced-motion: reduce` is set, NEITHER animation
  runs — view loads with the existing static camera behavior, and
  focal-select still triggers α-mode but at the existing top-down
  static framing.
- [ ] No memory leaks: 100 view-mount/unmount cycles do not increase
  retained heap (verified via the same pattern as `AffinityMode.perf.test.js`).

### Cross-platform
- [ ] All three acceptance suites pass on https://neuralflavor.web.app
  (desktop Chrome).
- [ ] Mobile orbit pacing tested via DevTools mobile-viewport emulation
  AND on a real iOS device via Capacitor wrap when the next TestFlight
  build ships (parked until billing cycle resets).
- [ ] No regression in: ClusterJoystick fly-to, search-select fly-to,
  AffinityMode pivot, double-tap-to-clear, mode-cycle (Network
  ml/ml2d/neural/taste2d).

## Implementation Plan (for executor / ralplan stage)

### New files
1. `src/three/CameraAnimator.js` — single controller class. Owns:
   - `engageClusterTour(clusters, centroids)` / `pauseClusterTour()` /
     `resumeClusterTour()`
   - `engageFocalOrbit(focalIdx)` / `repivot(focalIdx)` / `exitFocalOrbit()`
   - `tickAnimation(deltaSec)` — called from the existing animator
     loop, advances whichever animation is currently active
   - Internal state: `state ∈ {idle, tour-gliding, tour-dwelling,
     focal-orbiting}`, last-input timestamp, current cluster idx
   - Reuses `easeInOutCubic` from `livingArchUtils.js`
2. `src/three/__tests__/CameraAnimator.test.js` — pure-math tests for
   orbit position parameterization, nearest-cluster lookup, dwell
   timing accumulator.
3. `src/three/__tests__/CameraAnimator.perf.test.js` — 100-mount
   cycle leak test, mirroring `AffinityMode.perf.test.js`.

### Files to modify
1. `src/three/SceneManager.js` — instantiate `CameraAnimator` when
   the scene mounts; route every user-input event (mousedown,
   touchstart, wheel, keydown for arrow nav, etc.) to its
   `_recordInput()` cancellation method.
2. `src/three/AffinityMode.js` — replace `_flyToFocal()`'s static
   tween at line 643-657 with a delegation to
   `cameraAnimator.engageFocalOrbit(focalIdx)`. Affinity-ring
   visibility logic stays untouched. Dispose path unchanged.
3. `src/components/LivingArchView.jsx` — pass `clusterCentroids`
   (already computed for ClusterJoystick) to `CameraAnimator` on
   mount. Add the `prefers-reduced-motion` media query listener and
   pass its current value as a `reducedMotion` flag.
4. `src/components/CocktailLab.jsx` + `src/components/SauceLab.jsx` —
   pass `familyCentroids` (already computed locally) to the
   underlying `NetworkScene`'s `CameraAnimator` instance via a new
   `clusterCentroidsForTour` prop.
5. `src/components/NetworkScene.jsx` — accept and forward the new
   `clusterCentroidsForTour` prop to its `CameraAnimator` init.

### Phasing
- **Phase 1 (1 day)**: Ship `CameraAnimator` + cluster tour for
  Cocktail Lab only. Validate the timing feels right end-to-end on
  a smaller cluster set (7 families). User feedback round.
- **Phase 2 (1 day)**: Roll cluster tour out to Network and Sauce Lab.
  No new code, just two more `clusterCentroidsForTour` plumbing lines.
- **Phase 3 (2 days)**: Ship focal orbit for Cocktail Lab + Sauce Lab
  (no α-mode collision to worry about).
- **Phase 4 (2 days)**: Ship focal orbit for Network — replaces the
  α-mode static flight. Run regression on every existing α-mode
  acceptance criterion in the prior spec.
- **Phase 5 (0.5 day)**: Mobile downscale + prefers-reduced-motion
  opt-out. Ship.

Total estimate: 6.5 days. Phases 3 and 4 can be parallelized if
ralplan splits the work.

## Risks / Notes for executor

1. **OrbitControls interaction.** The default OrbitControls has its
   own internal damping that runs every frame. The orbit animation
   needs to write directly to `camera.position` + `controls.target`
   without conflict. The existing `flyToPoint` solves this by calling
   `controls.update()` after the lerp; replicate that pattern.
2. **Cancel-without-jump.** When the user grabs the camera mid-orbit,
   the camera pose at cancel time should hand off cleanly to
   OrbitControls — no snap. Test by dragging mid-orbit and checking
   for visual discontinuity.
3. **Focal orbit math precision.** A naive `t * 2π / lapSec` will
   accumulate floating-point error over a long-running session.
   Reset the orbit angle to `t % 2π` every full lap to keep
   precision bounded.
4. **Network's α-mode mesh visibility.** When the user pivots between
   focal ingredients mid-orbit, AffinityMode's `_writeRingsAndDim`
   currently snapshot-restores positions. Verify that mid-orbit
   pivots don't write stale snapshots back into the InstancedMesh.
5. **iOS scroll-zoom on the canvas.** Capacitor wraps the web view
   and on iOS, two-finger pinch gestures can be interpreted as page
   zoom rather than canvas zoom. The cancellation listener needs to
   bind to `gesturestart` as well as `touchstart` for this.
6. **Performance probe.** Before shipping mobile, run the
   `requestAnimationFrame` callback time over a 30-sec orbit on an
   older device (iPhone 11 baseline). If frame time exceeds 16 ms
   p95, drop bloom intensity further (0.6 → 0.4) or raise lap time
   to 35 sec.
7. **Mode-cycle regression in Network.** The user can switch between
   `ml / ml2d / neural / taste2d` mid-tour. The cluster tour needs
   to either (a) re-engage with the new mode's cluster positions, or
   (b) stay paused during the transition tween. Recommend (b) —
   pause tour during transitions, restart from nearest cluster after
   the transition completes.
8. **Idle detection across tabs.** The 30 sec resume countdown
   should pause when the parent tab isn't visible (use
   `document.visibilityState`). Otherwise the tour would silently
   restart while the user is reading the Recipe Lab.
9. **Cluster centroid stability.** The cluster centroids are
   computed once at mount and don't update if the layout changes
   (e.g., user toggles between Network's 4 modes). Each mode change
   needs to recompute centroids and pass them to the animator.
10. **Spec→ralplan handoff: a11y.** The `prefers-reduced-motion`
    opt-out is a hard requirement (per Option B in Round 6 was
    rejected, but the user picked A which still includes it as a
    constraint via the "respect" line in the mobile downscale
    strategy). Ralplan should not negotiate this away.

## Ontology (Final entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| ClusterTour | core domain | `state`, `currentClusterIdx`, `dwellElapsedSec`, `glideElapsedSec`, `lastInputTs` | runs when no FocalOrbit active; resumed by CameraAnimator |
| FocalOrbit | core domain | `focalIdx`, `lapSec`, `elevationDeg`, `currentAngleRad`, `lastInputTs` | active when `selectedNodes.length === 1`; replaces α-mode static flight in Network |
| CameraAnimator | core controller | `state`, `clusterTour`, `focalOrbit`, `clusterCentroids[]`, `reducedMotion` | owns both animations; bridges to SceneManager + AffinityMode |
| ClusterLabel | view object | `position`, `text`, `currentScale`, `targetScale` | scales 1.0 → 1.5 → 1.0 during ClusterTour dwell |
| FocalIngredient | domain entity | `name`, `idx`, `position` | center of FocalOrbit; sourced from `selectedNodes[0]` |
| ClusterCentroid | view object | `clusterId`, `position` | cached per-mode at mount; consumed by ClusterTour |

Stability ratio: 100% from Round 4 onward (ClusterCentroid added in Round 4, no churn since).

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 5 | 5 | - | - | N/A |
| 2 | 5 | 0 | 0 | 5 | 100% |
| 3 | 5 | 0 | 0 | 5 | 100% |
| 4 | 6 | 1 | 0 | 5 | 83% |
| 5 | 6 | 0 | 0 | 6 | 100% |
| 6 | 6 | 0 | 0 | 6 | 100% |

Convergence achieved by Round 5. The final two rounds confirmed
stability without entity churn.

## Interview Transcript

<details>
<summary>6 rounds of Q&A</summary>

### Round 1 — Trigger model
**Q**: Should animations run as auto-cycling, button-triggered, idle-ambient, or hybrid?
**A**: A — auto-cycling demo mode.

### Round 2 — Pacing
**Q**: Slow (90s/lap) / brisk (30s/lap) / mid (60s/lap) / custom? Plus: resume after interrupt or stay stopped?
**A**: C — mid-pace 60 sec / lap (4 sec dwell + 2 sec glide).

### Round 3 — Interruption feel
**Q**: Permanent stop / patient screensaver / quick screensaver / camera-aware resume?
**A**: D — camera-aware resume after 30 sec idle, picks up from cluster nearest current camera position.

### Round 4 — Dwell behavior (Contrarian Mode)
**Q**: Hard stop / continuous orbit through clusters / stop + micro-orbit / stop + label-pop?
**A**: D — stop + 1.5× label scale-pop emphasis effect.

### Round 5 — α-mode interaction
**Q**: Focal orbit replaces α-mode flight (one-shot/loop), or only fires in Cocktail/Sauce, or fires once before α-mode?
**A**: B — replace α-mode's static flight AND loop continuously, ~25 sec/lap, rings stay visible.

### Round 6 — Platform / scope (Simplifier Mode)
**Q**: All animations everywhere, or accessibility opt-out, or focal-orbit desktop-only, or phase the rollout?
**A**: A — both animations, both platforms, all three views; downscale on mobile if needed.

</details>

---

## Pipeline next step

Per the deep-interview skill chain, this spec hands off to
**`omc-plan --consensus --direct`** for multi-agent plan refinement,
then **`autopilot`** for execution. The executor sees:

- Phase 1 (Cocktail Lab cluster tour) is the smallest, lowest-risk
  validation surface. Ship first; gather feedback on the timing feel.
- Phase 2 (rollout cluster tour to Network + Sauce) is plumbing only.
- Phase 3 (Cocktail/Sauce focal orbit) is contained — no α-mode
  collision.
- Phase 4 (Network focal orbit) is the highest-risk because it
  modifies AffinityMode. Ship last with regression testing against
  the existing α-mode acceptance criteria.
- Phase 5 (mobile + a11y) is polish; ship to verify on real devices
  once TestFlight billing resets.
