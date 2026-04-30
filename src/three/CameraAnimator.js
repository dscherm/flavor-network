/**
 * CameraAnimator — single class that hosts the cluster-tour and
 * focal-orbit camera animations. Instantiated TWICE in the codebase:
 * once in LivingArchView's mount effect (Network), and once in
 * NetworkScene's mount effect (Cocktail / Sauce). The adapter pattern
 * lets the same class handle Network's mode-aware centroids and the
 * static family centroids used by the Lab views.
 *
 * State machine (5 states):
 *   idle | tour-orbiting | focal-flying | focal-orbiting
 *   | cancelled-awaiting-resume
 *
 * Cluster tour model (v2 — user feedback driven):
 *   The tour is a CONTINUOUS ORBIT around the current `controls.target`,
 *   captured at engage time. The camera keeps its current radius and
 *   elevation and walks azimuth around the pivot at a fixed lap rate
 *   (60s desktop / 90s mobile). This works mode-agnostically — neural,
 *   ml, ml2d, taste2d, Cocktail Lab, Sauce Lab — without needing any
 *   per-mode centroid input. The previous glide-and-dwell pattern was
 *   replaced because it "just shifts the camera a little bit" rather
 *   than rotating around the model.
 *
 * Per-frame contract (tickAnimation):
 *   - dt is clamped to 100ms (handles Capacitor iOS resume from
 *     background — without the clamp, an 8s background suspension
 *     would advance the orbit angle by 8s × orbit-rate in one frame).
 *   - Visibility-gated. When document.visibilityState !== 'visible'
 *     we skip the tick entirely so orbit timers don't accumulate
 *     while the tab is backgrounded.
 *   - Reduced-motion-respecting. When the user has
 *     prefers-reduced-motion: reduce, the animator is permanently
 *     disabled at construction (engageX returns early; tickAnimation
 *     is a no-op). Phase 5 wires the live media-query listener so
 *     mid-session toggles take effect.
 *
 * OrbitControls handoff:
 *   - While the animator owns the camera (any non-idle state),
 *     OrbitControls.enabled = false. This is load-bearing: with
 *     enabled=true, OrbitControls.update() runs damping against the
 *     stale internal pose buffer and produces a visible snap when the
 *     animator next writes camera.position.
 *   - On recordInput(), controls.target syncs to the current focal /
 *     centroid, then enabled = true. controls.update() re-engages
 *     against the current camera.position so subsequent user input
 *     orbits cleanly around the right pivot.
 *
 * Drift-free orbit angle:
 *   angle = ((totalElapsedMs % lapMs) / lapMs) * 2π
 *   Integer-modular over the lap window. After N laps the angle at
 *   the lap boundary is exactly 0 (modulo float epsilon). The naive
 *   alternative `angle += dt * (2π / lapSec)` accumulates rounding
 *   error and drifts visibly over an 8h session.
 *
 * Adapter contract (legacy — retained for centroid-mean pivot override):
 *   centroidAdapter() => Array<{id: number, position: [x,y,z]}>
 *   - id: stable cluster identifier (unused in v2 — was used for tour ordering).
 *   - position: scene-space coordinate of the cluster centroid.
 *   - Optional. When non-empty, the orbit pivot defaults to the mean
 *     of all centroid positions instead of `controls.target`. When
 *     empty (or omitted), the orbit pivots around `controls.target`.
 *
 * Lifecycle ordering (LivingArchView cleanup):
 *   AffinityMode holds an injected reference to this instance once
 *   Phase 4 ships. Dispose order MUST be:
 *     affinityModeRef.current.dispose()  ←  drains its hold
 *     affinityModeRef.current = null
 *     cameraAnimator.dispose()           ←  animator outlives AffinityMode
 *   Reverse order produces a use-after-free that may silently no-op
 *   (the disposed animator's methods become no-ops) instead of throwing,
 *   making the leak invisible to AC-MA-3.
 */
import * as THREE from 'three';

export const STATES = Object.freeze({
  IDLE: 'idle',
  // v2 (user feedback): the cluster tour is now a continuous orbit
  // around `controls.target` at the camera's current radius and
  // elevation. The previous glide-and-dwell pattern only "shifted
  // the camera a little bit" rather than rotating around the model.
  TOUR_ORBITING: 'tour-orbiting',
  FOCAL_FLYING: 'focal-flying',
  FOCAL_ORBITING: 'focal-orbiting',
  CANCELLED_AWAITING_RESUME: 'cancelled-awaiting-resume',
});

export const DEFAULTS = Object.freeze({
  // Tour lap (continuous orbit around controls.target). Slow enough
  // to feel ambient, not aggressive — the user reads labels while it
  // rotates underneath. Mobile gets a longer lap for battery.
  tourLapSecDesktop: 60,
  tourLapSecMobile: 90,
  // Focal orbit lap (orbiting around a clicked ingredient).
  lapSecDesktop: 25,
  lapSecMobile: 30,
  // After user input cancels the tour, how long before it resumes.
  // Bumped from 30s → 60s on user feedback ("wait time is not enough
  // after selecting one of the labels").
  idleResumeMs: 60000,
  flyToFocalMs: 1200,
  orbitElevationRad: Math.PI / 3, // 60° — focal-orbit only
  orbitDistance: 75,             // focal-orbit only
  dtClampSec: 0.1,
  mobileViewportPx: 640,
});

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function detectReducedMotion(opts) {
  if (typeof opts.reducedMotion === 'boolean') return opts.reducedMotion;
  const matcher = opts.mediaMatcher
    ?? (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? (q) => window.matchMedia(q)
        : null);
  if (!matcher) return false;
  try {
    return matcher('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

function detectIsMobile(opts) {
  if (typeof opts.isMobile === 'boolean') return opts.isMobile;
  if (typeof window !== 'undefined' && typeof window.innerWidth === 'number') {
    return window.innerWidth < (opts.mobileViewportPx ?? DEFAULTS.mobileViewportPx);
  }
  return false;
}

function detectVisibility(opts) {
  if (typeof opts.getVisibilityState === 'function') return opts.getVisibilityState();
  if (typeof opts.visibilityState === 'string') return opts.visibilityState;
  if (typeof document !== 'undefined' && typeof document.visibilityState === 'string') {
    return document.visibilityState;
  }
  return 'visible';
}

/**
 * Pure: index of the centroid closest to the given camera position.
 * Returns -1 when centroids is empty. Squared distance — no sqrt.
 */
export function nearestClusterIdx(centroids, cameraPos) {
  if (!Array.isArray(centroids) || centroids.length === 0) return -1;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < centroids.length; i++) {
    const p = centroids[i].position;
    const dx = p[0] - cameraPos[0];
    const dy = p[1] - cameraPos[1];
    const dz = p[2] - cameraPos[2];
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/**
 * Pure: label-pop scale factor at `elapsedSec` into a `dwellSec`
 * dwell, with `ramp` ramp-up/ramp-down portions (default 0.25s).
 *
 * Curve: ramps 1 → peak over `ramp` seconds, holds at peak,
 * ramps peak → 1 over the last `ramp` seconds.
 *
 *   t = 0       → 1.0
 *   t = ramp    → peak
 *   t = dwell-ramp → peak
 *   t = dwell   → 1.0
 */
export function labelPopScale(elapsedSec, dwellSec, ramp = 0.25, peak = 1.5) {
  if (elapsedSec <= 0 || elapsedSec >= dwellSec) return 1;
  const upT = Math.min(elapsedSec / ramp, 1);
  const downT = Math.min((dwellSec - elapsedSec) / ramp, 1);
  const popT = Math.min(upT, downT);
  return 1 + (peak - 1) * popT;
}

/**
 * Pure: drift-free orbit angle. Integer-modular over (lapSec * 1000)
 * milliseconds. Returns 0 at every lap boundary regardless of how
 * many laps preceded.
 */
export function orbitAngle(totalElapsedMs, lapSec) {
  const lapMs = lapSec * 1000;
  if (lapMs <= 0) return 0;
  return ((totalElapsedMs % lapMs) / lapMs) * 2 * Math.PI;
}

/**
 * Pure: orbit camera pose at `angle` radians around `focal`, at the
 * given elevation (radians from horizontal) and radial distance.
 */
export function computeOrbitPose(focal, angle, elevation, distance) {
  const horiz = distance * Math.cos(elevation);
  const vert = distance * Math.sin(elevation);
  return new THREE.Vector3(
    focal.x + horiz * Math.cos(angle),
    focal.y + vert,
    focal.z + horiz * Math.sin(angle),
  );
}

export class CameraAnimator {
  /**
   * @param {{camera: THREE.Camera, controls: {target: THREE.Vector3, enabled: boolean, update?: Function}, scene?: THREE.Scene}} sceneCtx
   * @param {() => Array<{id: number, position: [number,number,number], labelSprite?: THREE.Sprite}>} centroidAdapter
   * @param {object} [opts]
   */
  constructor(sceneCtx, centroidAdapter, opts = {}) {
    this._scene = sceneCtx?.scene ?? null;
    this._camera = sceneCtx?.camera ?? null;
    this._controls = sceneCtx?.controls ?? null;
    this._adapter = typeof centroidAdapter === 'function' ? centroidAdapter : () => [];
    this._opts = { ...DEFAULTS, ...opts };

    this._isMobile = detectIsMobile(this._opts);
    this._lapSec = this._isMobile ? this._opts.lapSecMobile : this._opts.lapSecDesktop;
    this._tourLapSec = this._isMobile ? this._opts.tourLapSecMobile : this._opts.tourLapSecDesktop;
    this._reducedMotion = detectReducedMotion(this._opts);
    this._disabled = this._reducedMotion;

    this._state = STATES.IDLE;
    this._tourPaused = false;

    this._idleAccumMs = 0;

    // Tour orbit state — captured at engage time so the camera keeps
    // its current radius / elevation / starting azimuth while orbiting.
    this._tourPivot = new THREE.Vector3();
    this._tourRadius = 0;
    this._tourElevationRad = 0;
    this._tourAzimuthOffset = 0;
    this._tourElapsedMs = 0;

    // Focal-flying tween segment.
    this._segment = null;

    // Focal orbit state.
    this._focalIdx = -1;
    this._focalPos = new THREE.Vector3();
    this._orbitTotalElapsedMs = 0;
    this._flightCounter = 0;
    this._currentFlightId = 0;

    // Phase 5 polish: live media-query listener handle.
    this._mediaQueryList = null;
    this._mediaListener = null;

    // Reusable scratch vectors.
    this._tmpV = new THREE.Vector3();
    this._tmpV2 = new THREE.Vector3();
  }

  // ─── Inspectors (used by tests + LivingArchView guards) ─────

  get state() { return this._state; }
  get focalIdx() { return this._focalIdx; }
  get isMobile() { return this._isMobile; }
  get lapSec() { return this._lapSec; }
  get tourLapSec() { return this._tourLapSec; }
  get isDisabled() { return this._disabled; }
  get orbitElapsedMs() { return this._orbitTotalElapsedMs; }
  get tourElapsedMs() { return this._tourElapsedMs; }

  // ─── Public API ─────────────────────────────────────────────

  engageClusterTour() {
    if (this._disabled) { this._state = STATES.IDLE; return; }
    if (!this._camera || !this._controls) return;
    this._idleAccumMs = 0;
    this._tourPaused = false;
    this._captureTourOrbit();
    this._state = STATES.TOUR_ORBITING;
    this._takeOwnership();
  }

  engageFocalOrbit(focalIdx, focalPosition) {
    if (this._disabled) { this._state = STATES.IDLE; return; }
    if (!this._camera || !this._controls) return;
    if (!Array.isArray(focalPosition) || focalPosition.length < 3) return;
    this._focalIdx = focalIdx;
    this._focalPos.set(focalPosition[0], focalPosition[1], focalPosition[2]);
    this._idleAccumMs = 0;
    // Reset orbit angle accumulator on a fresh engage. repivot()
    // intentionally does NOT reset (preserves angle continuity).
    this._orbitTotalElapsedMs = 0;
    this._beginFocalFlight();
    this._takeOwnership();
  }

  repivot(newIdx, newPosition) {
    if (this._disabled) return;
    if (!this._camera || !this._controls) return;
    if (!Array.isArray(newPosition) || newPosition.length < 3) return;
    this._abortFlight();
    this._focalIdx = newIdx;
    this._focalPos.set(newPosition[0], newPosition[1], newPosition[2]);
    // Preserve _orbitTotalElapsedMs so angle continuity is maintained
    // across the pivot. This is the AC-FO-7 invariant.
    this._beginFocalFlight();
    this._takeOwnership();
  }

  exitFocalOrbit() {
    if (this._state !== STATES.FOCAL_FLYING && this._state !== STATES.FOCAL_ORBITING) return;
    this._segment = null;
    this._focalIdx = -1;
    this._releaseOwnership();
    this._state = STATES.IDLE;
  }

  /**
   * User-input cancel. v3 (live-feedback): permanently transitions
   * to IDLE so the user can drag, pinch, zoom, and click affinity
   * nodes without the tour stomping on them. Restart only happens
   * on explicit view/mode change via `resumeClusterTour()` or a
   * fresh mount.
   *
   * Hands controls back cleanly: target syncs to the current focal /
   * pivot, then enabled=true. controls.update() re-engages against
   * the current camera.position so OrbitControls orbits smoothly
   * around the right pivot.
   */
  recordInput() {
    if (this._state === STATES.IDLE) return;
    if (this._controls && this._camera) {
      const t = this._currentTargetPos();
      if (t) this._controls.target.copy(t);
      this._controls.enabled = true;
      if (typeof this._controls.update === 'function') {
        this._controls.update();
      }
    }
    this._segment = null;
    this._idleAccumMs = 0;
    this._state = STATES.IDLE;
  }

  /**
   * Pause the cluster tour during a mode-cycle transition. Releases
   * camera ownership so the existing transition tween in
   * LivingArchView can take over without a fight. resumeClusterTour
   * is called when the transition completes (if the new mode is
   * a cluster mode).
   */
  pauseClusterTour() {
    this._tourPaused = true;
    if (this._state === STATES.TOUR_ORBITING) {
      this._segment = null;
      this._releaseOwnership();
      this._state = STATES.IDLE;
    }
  }

  resumeClusterTour() {
    this._tourPaused = false;
    if (this._state !== STATES.IDLE && this._state !== STATES.CANCELLED_AWAITING_RESUME) return;
    if (!this._camera || !this._controls) return;
    this._idleAccumMs = 0;
    this._captureTourOrbit();
    this._state = STATES.TOUR_ORBITING;
    this._takeOwnership();
  }

  tickAnimation(dtSec) {
    if (this._disabled) return;
    if (this._state === STATES.IDLE) return;
    const visibility = detectVisibility(this._opts);
    if (visibility !== 'visible') return;
    const dt = Math.min(Math.max(0, dtSec || 0), this._opts.dtClampSec);

    switch (this._state) {
      case STATES.CANCELLED_AWAITING_RESUME:
        this._idleAccumMs += dt * 1000;
        if (this._idleAccumMs >= this._opts.idleResumeMs) {
          this._resumeFromIdle();
        }
        break;
      case STATES.TOUR_ORBITING:
        this._tickTourOrbit(dt);
        break;
      case STATES.FOCAL_FLYING:
        this._tickSegment(dt, () => { this._state = STATES.FOCAL_ORBITING; });
        break;
      case STATES.FOCAL_ORBITING:
        this._tickOrbit(dt);
        break;
      default:
        break;
    }
  }

  setReducedMotion(reduced) {
    const wasDisabled = this._disabled;
    this._reducedMotion = reduced === true;
    this._disabled = this._reducedMotion;
    if (this._disabled && !wasDisabled) {
      this._segment = null;
      if (this._state !== STATES.IDLE) this._releaseOwnership();
      this._state = STATES.IDLE;
    }
  }

  /**
   * Phase 5: subscribe to live media-query changes so users who
   * toggle "Reduce Motion" mid-session see immediate effect.
   * Idempotent — safe to call multiple times.
   */
  attachMediaQueryListener() {
    if (this._mediaQueryList) return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    try {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      const listener = (e) => this.setReducedMotion(e.matches === true);
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', listener);
      } else if (typeof mql.addListener === 'function') {
        mql.addListener(listener);
      }
      this._mediaQueryList = mql;
      this._mediaListener = listener;
    } catch {
      this._mediaQueryList = null;
      this._mediaListener = null;
    }
  }

  dispose() {
    if (this._mediaQueryList && this._mediaListener) {
      try {
        if (typeof this._mediaQueryList.removeEventListener === 'function') {
          this._mediaQueryList.removeEventListener('change', this._mediaListener);
        } else if (typeof this._mediaQueryList.removeListener === 'function') {
          this._mediaQueryList.removeListener(this._mediaListener);
        }
      } catch { /* ignore */ }
    }
    this._mediaQueryList = null;
    this._mediaListener = null;
    if (this._state !== STATES.IDLE) this._releaseOwnership();
    this._state = STATES.IDLE;
    this._segment = null;
    this._scene = null;
    this._camera = null;
    this._controls = null;
    this._adapter = () => [];
  }

  // ─── Test-only hooks ────────────────────────────────────────

  /** Test-only. Triggers the idle-resume flow as if idleResumeMs elapsed. */
  _resumeFromIdle() {
    if (!this._camera || !this._controls) return;
    if (this._tourPaused) { this._state = STATES.IDLE; return; }
    this._idleAccumMs = 0;
    this._captureTourOrbit();
    this._state = STATES.TOUR_ORBITING;
    this._takeOwnership();
  }

  // ─── Private ────────────────────────────────────────────────

  _readCentroids() {
    try {
      const arr = this._adapter() || [];
      if (!Array.isArray(arr)) return [];
      return arr.filter((c) =>
        c
        && Array.isArray(c.position)
        && c.position.length >= 3
        && typeof c.id === 'number'
      );
    } catch {
      return [];
    }
  }

  _takeOwnership() {
    if (this._controls) this._controls.enabled = false;
  }

  _releaseOwnership() {
    if (!this._controls) return;
    this._controls.enabled = true;
    if (typeof this._controls.update === 'function') {
      this._controls.update();
    }
  }

  _currentTargetPos() {
    if (this._state === STATES.FOCAL_FLYING || this._state === STATES.FOCAL_ORBITING) {
      return this._focalPos;
    }
    if (this._state === STATES.TOUR_ORBITING) {
      return this._tourPivot;
    }
    return null;
  }

  /**
   * Capture the current camera→pivot relationship so the orbit walks
   * azimuth from where the camera already is. The pivot defaults to
   * `controls.target`; if the centroid adapter returns clusters, the
   * mean of all centroid positions overrides it (legacy callers can
   * still hint where to orbit). Radius and elevation are derived from
   * the camera position so the tour begins with no visible jump.
   */
  _captureTourOrbit() {
    const cam = this._camera.position;
    const tgt = this._controls.target;

    // Pivot resolution: prefer caller-provided centroid mean over
    // the current target. Both are valid; centroid-mean tends to
    // sit at the cluster cloud center even when the user has
    // panned the camera off to one side.
    const centroids = this._readCentroids();
    if (centroids.length > 0) {
      let sx = 0, sy = 0, sz = 0;
      for (const c of centroids) {
        sx += c.position[0];
        sy += c.position[1];
        sz += c.position[2];
      }
      this._tourPivot.set(sx / centroids.length, sy / centroids.length, sz / centroids.length);
    } else {
      this._tourPivot.copy(tgt);
    }

    // Camera vector relative to pivot, in spherical (radius, elevation, azimuth).
    const dx = cam.x - this._tourPivot.x;
    const dy = cam.y - this._tourPivot.y;
    const dz = cam.z - this._tourPivot.z;
    const radius = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (radius < 1e-3) {
      // Camera sitting on top of pivot — pick a sensible default
      // so the orbit isn't degenerate.
      this._tourRadius = 80;
      this._tourElevationRad = Math.PI / 4; // 45°
      this._tourAzimuthOffset = 0;
    } else {
      const horiz = Math.sqrt(dx * dx + dz * dz);
      this._tourRadius = radius;
      this._tourElevationRad = Math.atan2(dy, horiz);
      this._tourAzimuthOffset = Math.atan2(dz, dx);
    }
    this._tourElapsedMs = 0;
  }

  _tickTourOrbit(dt) {
    if (!this._camera || !this._controls) { this._state = STATES.IDLE; return; }
    this._tourElapsedMs += dt * 1000;
    const advance = orbitAngle(this._tourElapsedMs, this._tourLapSec);
    const angle = this._tourAzimuthOffset + advance;
    const horiz = this._tourRadius * Math.cos(this._tourElevationRad);
    const vert = this._tourRadius * Math.sin(this._tourElevationRad);
    this._camera.position.set(
      this._tourPivot.x + horiz * Math.cos(angle),
      this._tourPivot.y + vert,
      this._tourPivot.z + horiz * Math.sin(angle),
    );
    this._controls.target.copy(this._tourPivot);
  }

  _beginFocalFlight() {
    const startPos = this._camera.position.clone();
    const startTarget = this._controls.target.clone();
    const angle = orbitAngle(this._orbitTotalElapsedMs, this._lapSec);
    const endPos = computeOrbitPose(
      this._focalPos,
      angle,
      this._opts.orbitElevationRad,
      this._opts.orbitDistance,
    );
    this._segment = {
      startPos,
      endPos,
      startTarget,
      endTarget: this._focalPos.clone(),
      durationMs: this._opts.flyToFocalMs,
      accumMs: 0,
      kind: 'focal-fly',
    };
    this._currentFlightId = ++this._flightCounter;
    this._state = STATES.FOCAL_FLYING;
  }

  _abortFlight() {
    this._currentFlightId = ++this._flightCounter;
    this._segment = null;
  }

  _tickSegment(dt, onComplete) {
    if (!this._segment) { this._state = STATES.IDLE; return; }
    this._segment.accumMs += dt * 1000;
    const t = Math.min(this._segment.accumMs / this._segment.durationMs, 1);
    const e = easeInOutCubic(t);
    this._tmpV.lerpVectors(this._segment.startPos, this._segment.endPos, e);
    this._camera.position.copy(this._tmpV);
    this._tmpV2.lerpVectors(this._segment.startTarget, this._segment.endTarget, e);
    this._controls.target.copy(this._tmpV2);
    if (t >= 1) {
      this._segment = null;
      if (onComplete) onComplete();
    }
  }

  _tickOrbit(dt) {
    this._orbitTotalElapsedMs += dt * 1000;
    const angle = orbitAngle(this._orbitTotalElapsedMs, this._lapSec);
    const pose = computeOrbitPose(
      this._focalPos,
      angle,
      this._opts.orbitElevationRad,
      this._opts.orbitDistance,
    );
    this._camera.position.copy(pose);
    this._controls.target.copy(this._focalPos);
  }

}

export default CameraAnimator;
