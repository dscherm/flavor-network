/**
 * CameraAnimator — single class that hosts the cluster-tour and
 * focal-orbit camera animations. Instantiated TWICE in the codebase:
 * once in LivingArchView's mount effect (Network), and once in
 * NetworkScene's mount effect (Cocktail / Sauce). The adapter pattern
 * lets the same class handle Network's mode-aware centroids and the
 * static family centroids used by the Lab views.
 *
 * State machine (6 states):
 *   idle | tour-gliding | tour-dwelling | focal-flying | focal-orbiting
 *   | cancelled-awaiting-resume
 *
 * Per-frame contract (tickAnimation):
 *   - dt is clamped to 100ms (handles Capacitor iOS resume from
 *     background — without the clamp, an 8s background suspension
 *     would advance the orbit angle by 8s × orbit-rate in one frame).
 *   - Visibility-gated. When document.visibilityState !== 'visible'
 *     we skip the tick entirely so dwell/glide/orbit timers don't
 *     accumulate while the tab is backgrounded.
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
 * Adapter contract:
 *   centroidAdapter() => Array<{id: number, position: [x,y,z], labelSprite?: THREE.Sprite}>
 *   - id: stable cluster identifier; used for deterministic tour ordering.
 *   - position: scene-space coordinate of the cluster centroid.
 *   - labelSprite (optional): reference to the sprite used for label-pop
 *     scale-lerp during dwell. May be omitted; pop animation no-ops.
 *   - Returning [] is the canonical "no clusters in this mode → pause
 *     the tour" signal. Network's adapter returns [] for neural/taste2d.
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
  TOUR_GLIDING: 'tour-gliding',
  TOUR_DWELLING: 'tour-dwelling',
  FOCAL_FLYING: 'focal-flying',
  FOCAL_ORBITING: 'focal-orbiting',
  CANCELLED_AWAITING_RESUME: 'cancelled-awaiting-resume',
});

export const DEFAULTS = Object.freeze({
  dwellSec: 4,
  glideSec: 2,
  lapSecDesktop: 25,
  lapSecMobile: 30,
  idleResumeMs: 30000,
  flyToFocalMs: 1200,
  orbitElevationRad: Math.PI / 3, // 60°
  orbitDistance: 75,
  labelScalePeak: 1.5,
  labelPopRampSec: 0.25,
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
    this._reducedMotion = detectReducedMotion(this._opts);
    this._disabled = this._reducedMotion;

    this._state = STATES.IDLE;
    this._tourCentroids = [];
    this._tourOrder = [];
    this._currentClusterIdx = -1;
    this._tourPaused = false;

    this._dwellAccumMs = 0;
    this._idleAccumMs = 0;

    // Glide / focal-flying tween segment.
    this._segment = null;

    // Focal orbit state.
    this._focalIdx = -1;
    this._focalPos = new THREE.Vector3();
    this._orbitTotalElapsedMs = 0;
    this._flightCounter = 0;
    this._currentFlightId = 0;

    // Label-pop bookkeeping — store original scale so dwell exit can restore.
    this._activeLabelSprite = null;
    this._labelOriginalScale = null;

    // Phase 5 polish: live media-query listener handle.
    this._mediaQueryList = null;
    this._mediaListener = null;

    // Reusable scratch vectors.
    this._tmpV = new THREE.Vector3();
    this._tmpV2 = new THREE.Vector3();
  }

  // ─── Inspectors (used by tests + LivingArchView guards) ─────

  get state() { return this._state; }
  get currentClusterIdx() { return this._currentClusterIdx; }
  get focalIdx() { return this._focalIdx; }
  get isMobile() { return this._isMobile; }
  get lapSec() { return this._lapSec; }
  get isDisabled() { return this._disabled; }
  get tourOrder() { return this._tourOrder.slice(); }
  get orbitElapsedMs() { return this._orbitTotalElapsedMs; }

  // ─── Public API ─────────────────────────────────────────────

  engageClusterTour() {
    if (this._disabled) { this._state = STATES.IDLE; return; }
    if (!this._camera || !this._controls) return;
    const centroids = this._readCentroids();
    if (centroids.length === 0) {
      this._state = STATES.IDLE;
      return;
    }
    this._tourCentroids = centroids;
    this._tourOrder = centroids
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((c) => c.id);
    // currentClusterIdx indexes into _tourCentroids (still in adapter
    // order). Map through tourOrder so iteration is id-sorted.
    this._currentClusterIdx = 0;
    this._idleAccumMs = 0;
    this._tourPaused = false;
    this._beginGlideToTourSlot(this._currentClusterIdx);
    this._takeOwnership();
  }

  engageFocalOrbit(focalIdx, focalPosition) {
    if (this._disabled) { this._state = STATES.IDLE; return; }
    if (!this._camera || !this._controls) return;
    if (!Array.isArray(focalPosition) || focalPosition.length < 3) return;
    this._restoreLabelScale();
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
   * User-input cancel. Synchronously transitions to
   * cancelled-awaiting-resume. The same tick's tickAnimation call
   * will see CANCELLED_AWAITING_RESUME and skip camera writes
   * (AC-CT-6, AC-FO-6).
   */
  recordInput() {
    if (this._state === STATES.IDLE) return;
    this._restoreLabelScale();
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
    this._state = STATES.CANCELLED_AWAITING_RESUME;
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
    if (this._state === STATES.TOUR_GLIDING || this._state === STATES.TOUR_DWELLING) {
      this._restoreLabelScale();
      this._segment = null;
      this._releaseOwnership();
      this._state = STATES.IDLE;
    }
  }

  resumeClusterTour() {
    this._tourPaused = false;
    if (this._state !== STATES.IDLE && this._state !== STATES.CANCELLED_AWAITING_RESUME) return;
    const centroids = this._readCentroids();
    if (centroids.length === 0) return;
    this._tourCentroids = centroids;
    this._tourOrder = centroids.slice().sort((a, b) => a.id - b.id).map((c) => c.id);
    if (this._currentClusterIdx < 0 || this._currentClusterIdx >= centroids.length) {
      this._currentClusterIdx = 0;
    }
    this._beginGlideToTourSlot(this._currentClusterIdx);
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
      case STATES.TOUR_GLIDING:
        this._tickSegment(dt, () => this._beginDwellAtTourSlot(this._currentClusterIdx));
        break;
      case STATES.TOUR_DWELLING:
        this._tickDwell(dt);
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
      this._restoreLabelScale();
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
    this._restoreLabelScale();
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
    this._tourCentroids = [];
    this._tourOrder = [];
    this._activeLabelSprite = null;
    this._labelOriginalScale = null;
    this._scene = null;
    this._camera = null;
    this._controls = null;
    this._adapter = () => [];
  }

  // ─── Test-only hooks ────────────────────────────────────────

  /** Test-only. Triggers the idle-resume flow as if 30s elapsed. */
  _resumeFromIdle() {
    const centroids = this._readCentroids();
    if (centroids.length === 0) {
      this._state = STATES.IDLE;
      return;
    }
    this._tourCentroids = centroids;
    this._tourOrder = centroids.slice().sort((a, b) => a.id - b.id).map((c) => c.id);
    const cam = [this._camera.position.x, this._camera.position.y, this._camera.position.z];
    const idx = nearestClusterIdx(centroids, cam);
    this._currentClusterIdx = idx >= 0 ? idx : 0;
    this._idleAccumMs = 0;
    this._beginGlideToTourSlot(this._currentClusterIdx);
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
    if (this._state === STATES.TOUR_GLIDING || this._state === STATES.TOUR_DWELLING) {
      const c = this._tourCentroids[this._currentClusterIdx];
      if (c) return new THREE.Vector3(c.position[0], c.position[1], c.position[2]);
    }
    return null;
  }

  _beginGlideToTourSlot(idx) {
    if (this._tourPaused) { this._state = STATES.IDLE; return; }
    const next = this._tourCentroids[idx];
    if (!next) { this._state = STATES.IDLE; return; }
    const startPos = this._camera.position.clone();
    const startTarget = this._controls.target.clone();
    const targetPos = new THREE.Vector3(next.position[0], next.position[1], next.position[2]);
    // Maintain the camera's relative offset to its current target
    // so the tour preserves view angle / distance as it moves between
    // clusters. Falls back to a sensible default if the camera-target
    // delta is degenerate.
    const offset = startPos.clone().sub(startTarget);
    if (offset.length() < 1e-3) offset.set(0, 60, 60);
    const endPos = targetPos.clone().add(offset);
    this._segment = {
      startPos,
      endPos,
      startTarget,
      endTarget: targetPos,
      durationMs: this._opts.glideSec * 1000,
      accumMs: 0,
      kind: 'glide',
    };
    this._state = STATES.TOUR_GLIDING;
  }

  _beginDwellAtTourSlot(idx) {
    if (this._tourPaused) { this._state = STATES.IDLE; return; }
    const next = this._tourCentroids[idx];
    if (!next) { this._state = STATES.IDLE; return; }
    this._dwellAccumMs = 0;
    this._activeLabelSprite = next.labelSprite || null;
    if (this._activeLabelSprite && this._activeLabelSprite.scale) {
      this._labelOriginalScale = this._activeLabelSprite.scale.clone();
    }
    this._state = STATES.TOUR_DWELLING;
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

  _tickDwell(dt) {
    this._dwellAccumMs += dt * 1000;
    if (this._activeLabelSprite && this._labelOriginalScale && this._activeLabelSprite.scale) {
      const factor = labelPopScale(
        this._dwellAccumMs / 1000,
        this._opts.dwellSec,
        this._opts.labelPopRampSec,
        this._opts.labelScalePeak,
      );
      this._activeLabelSprite.scale.set(
        this._labelOriginalScale.x * factor,
        this._labelOriginalScale.y * factor,
        this._labelOriginalScale.z * factor,
      );
    }
    if (this._dwellAccumMs >= this._opts.dwellSec * 1000) {
      this._restoreLabelScale();
      this._currentClusterIdx = (this._currentClusterIdx + 1) % this._tourCentroids.length;
      this._beginGlideToTourSlot(this._currentClusterIdx);
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

  _restoreLabelScale() {
    if (this._activeLabelSprite && this._labelOriginalScale && this._activeLabelSprite.scale) {
      this._activeLabelSprite.scale.copy(this._labelOriginalScale);
    }
    this._activeLabelSprite = null;
    this._labelOriginalScale = null;
  }
}

export default CameraAnimator;
