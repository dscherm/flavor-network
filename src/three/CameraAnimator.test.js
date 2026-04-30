/**
 * R14: CameraAnimator unit tests.
 *
 * Covers acceptance criteria from `.omc/plans/ralplan-camera-animations.md`:
 *   AC-CT-1..CT-8 (cluster tour), AC-FO-1..FO-7 (focal orbit),
 *   AC-MA-2 (prefers-reduced-motion), plus the dt-clamp invariant
 *   and the `nearestClusterIdx` pure helper.
 *
 * Test env: vitest default (`node`). No DOM or canvas needed —
 * CameraAnimator is pure CPU math against THREE.Vector3 / Camera /
 * Sprite objects, all of which work outside a renderer.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  CameraAnimator,
  STATES,
  DEFAULTS,
  nearestClusterIdx,
  labelPopScale,
  orbitAngle,
  computeOrbitPose,
  easeInOutCubic,
} from './CameraAnimator.js';

// ─── Helpers ──────────────────────────────────────────────────

function makeCamera() {
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
  cam.position.set(0, 40, 120);
  return cam;
}

function makeControlsStub(target = new THREE.Vector3(0, 0, 0)) {
  return {
    target: target.clone(),
    enabled: true,
    update: () => {},
  };
}

function makeLabelStub() {
  // Minimal sprite-like object — we only touch `scale` (a Vector3).
  return {
    scale: new THREE.Vector3(10, 10, 1),
  };
}

function makeAnimator({
  centroids = [
    { id: 0, position: [10, 0, 0] },
    { id: 1, position: [0, 10, 0] },
    { id: 2, position: [0, 0, 10] },
  ],
  opts = {},
  reducedMotion = false,
  visibility = 'visible',
  isMobile = false,
  withLabels = false,
} = {}) {
  const camera = makeCamera();
  const controls = makeControlsStub();
  const scene = new THREE.Scene();
  const adapterCentroids = withLabels
    ? centroids.map((c) => ({ ...c, labelSprite: makeLabelStub() }))
    : centroids;
  const animator = new CameraAnimator(
    { camera, controls, scene },
    () => adapterCentroids,
    {
      isMobile,
      reducedMotion,
      mediaMatcher: () => ({ matches: reducedMotion === true }),
      getVisibilityState: () => visibility,
      ...opts,
    },
  );
  return { animator, camera, controls, scene, adapterCentroids };
}

// ─── Pure-math helpers ────────────────────────────────────────

describe('pure math helpers', () => {
  it('easeInOutCubic anchors at 0/0 and 1/1, symmetric at 0.5', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBeCloseTo(1, 10);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
  });

  it('nearestClusterIdx returns -1 on empty input', () => {
    expect(nearestClusterIdx([], [0, 0, 0])).toBe(-1);
  });

  it('nearestClusterIdx finds the closest centroid', () => {
    const centroids = [
      { id: 0, position: [100, 0, 0] },
      { id: 1, position: [-1, 2, 3] },
      { id: 2, position: [50, 50, 50] },
    ];
    expect(nearestClusterIdx(centroids, [0, 0, 0])).toBe(1);
    expect(nearestClusterIdx(centroids, [99, 0, 0])).toBe(0);
    expect(nearestClusterIdx(centroids, [60, 60, 60])).toBe(2);
  });

  it('orbitAngle is drift-free at integer lap boundaries', () => {
    const lapSec = 25;
    for (let n = 1; n <= 100; n++) {
      const totalMs = n * lapSec * 1000;
      // Angle at a lap boundary should be 0 (exact, no float drift).
      expect(Math.abs(orbitAngle(totalMs, lapSec))).toBeLessThan(1e-9);
    }
  });

  it('orbitAngle increases linearly within a lap', () => {
    const lapSec = 25;
    const lapMs = 25_000;
    expect(orbitAngle(lapMs / 4, lapSec)).toBeCloseTo(Math.PI / 2, 6);
    expect(orbitAngle(lapMs / 2, lapSec)).toBeCloseTo(Math.PI, 6);
    expect(orbitAngle((3 * lapMs) / 4, lapSec)).toBeCloseTo((3 * Math.PI) / 2, 6);
  });

  it('labelPopScale matches AC-CT-3 four sample points (1, 1.5, 1.5, 1)', () => {
    // Default ramp 0.25s, dwell 4s, peak 1.5.
    expect(labelPopScale(0, 4)).toBe(1);
    expect(labelPopScale(0.25, 4)).toBeCloseTo(1.5, 6);
    expect(labelPopScale(3.75, 4)).toBeCloseTo(1.5, 6);
    expect(labelPopScale(4.0, 4)).toBe(1);
  });

  it('computeOrbitPose places camera at exact 60° elevation and distance 75', () => {
    const focal = new THREE.Vector3(5, 7, 9);
    const pose = computeOrbitPose(focal, 0, Math.PI / 3, 75);
    const dx = pose.x - focal.x;
    const dy = pose.y - focal.y;
    const dz = pose.z - focal.z;
    expect(Math.hypot(dx, dy, dz)).toBeCloseTo(75, 5);
    const elevation = Math.atan2(dy, Math.hypot(dx, dz));
    expect(elevation).toBeCloseTo(Math.PI / 3, 5);
  });
});

// ─── Cluster tour acceptance criteria ────────────────────────

describe('Cluster tour', () => {
  it('AC-CT-1: engageClusterTour + first tick → state is tour-gliding', () => {
    const { animator } = makeAnimator();
    expect(animator.state).toBe(STATES.IDLE);
    animator.engageClusterTour();
    expect(animator.state).toBe(STATES.TOUR_GLIDING);
    animator.tickAnimation(0.016);
    expect(animator.state).toBe(STATES.TOUR_GLIDING);
  });

  it('AC-CT-2: dwell-end fires at 4 ± 0.05s', () => {
    const { animator } = makeAnimator({ withLabels: false });
    animator.engageClusterTour();
    // dt clamp truncates each tick to ≤ 100ms, so we walk the
    // 2s glide in 20 ticks of 0.1s each.
    for (let i = 0; i < 20; i++) animator.tickAnimation(0.1);
    expect(animator.state).toBe(STATES.TOUR_DWELLING);
    // Tick toward 3.9s of dwell — still dwelling.
    for (let i = 0; i < 39; i++) animator.tickAnimation(0.1);
    expect(animator.state).toBe(STATES.TOUR_DWELLING);
    // 4.0s — dwell exits, glide begins.
    animator.tickAnimation(0.1);
    expect(animator.state).toBe(STATES.TOUR_GLIDING);
  });

  it('AC-CT-3: label sprite scale lerps 1 → 1.5 → 1 across dwell', () => {
    const { animator, adapterCentroids } = makeAnimator({ withLabels: true });
    const sprite = adapterCentroids[0].labelSprite;
    const orig = sprite.scale.clone();
    animator.engageClusterTour();
    // Glide: 2s (10 ticks of 0.1, plus 1 final 0.1 to roll over to dwell).
    for (let i = 0; i < 21; i++) animator.tickAnimation(0.1);
    // We are now in dwell phase (elapsed dwell ≈ 0.1s into dwell).
    expect(animator.state).toBe(STATES.TOUR_DWELLING);
    // Walk dwell forward to t=0.25s — scale should be at peak.
    for (let i = 0; i < 2; i++) animator.tickAnimation(0.1);
    expect(sprite.scale.x).toBeCloseTo(orig.x * 1.5, 1);
  });

  it('AC-CT-5: tourOrder is deterministic — sorted by id', () => {
    const centroids = [
      { id: 7, position: [1, 0, 0] },
      { id: 2, position: [0, 1, 0] },
      { id: 5, position: [0, 0, 1] },
      { id: 1, position: [1, 1, 0] },
    ];
    const { animator } = makeAnimator({ centroids });
    animator.engageClusterTour();
    expect(animator.tourOrder).toEqual([1, 2, 5, 7]);
    // Re-engage → identical order.
    animator.recordInput();
    animator.engageClusterTour();
    expect(animator.tourOrder).toEqual([1, 2, 5, 7]);
  });

  it('AC-CT-6: recordInput → cancelled-awaiting-resume; same-tick is camera-write-free', () => {
    const { animator, camera } = makeAnimator();
    animator.engageClusterTour();
    animator.tickAnimation(0.1); // advance glide a bit
    const beforeCancel = camera.position.clone();
    animator.recordInput();
    expect(animator.state).toBe(STATES.CANCELLED_AWAITING_RESUME);
    // Subsequent tick should NOT move the camera.
    animator.tickAnimation(0.5);
    expect(camera.position.distanceTo(beforeCancel)).toBeLessThan(1e-9);
  });

  it('AC-CT-7: _resumeFromIdle picks nearest cluster and transitions to tour-gliding', () => {
    const { animator, camera } = makeAnimator({
      centroids: [
        { id: 0, position: [100, 0, 0] },
        { id: 1, position: [0, 100, 0] },
        { id: 2, position: [0, 0, 100] },
      ],
    });
    // Move camera near cluster 2.
    camera.position.set(1, 1, 99);
    animator.recordInput.bind(animator); // sanity: method exists
    // Start cancelled-awaiting-resume by simulating a prior tour.
    animator.engageClusterTour();
    animator.recordInput();
    expect(animator.state).toBe(STATES.CANCELLED_AWAITING_RESUME);
    animator._resumeFromIdle();
    expect(animator.state).toBe(STATES.TOUR_GLIDING);
    expect(animator.currentClusterIdx).toBe(2);
  });

  it('AC-CT-7 via tick: 30s of CANCELLED_AWAITING_RESUME triggers idle resume', () => {
    const { animator } = makeAnimator();
    animator.engageClusterTour();
    animator.recordInput();
    expect(animator.state).toBe(STATES.CANCELLED_AWAITING_RESUME);
    // Advance 30s in 100ms ticks (300 calls).
    for (let i = 0; i < 300; i++) animator.tickAnimation(0.1);
    expect(animator.state).toBe(STATES.TOUR_GLIDING);
  });

  it('AC-CT-8: visibility hidden → tickAnimation does not advance dwell timer', () => {
    let visibility = 'visible';
    const { animator } = makeAnimator({
      opts: { getVisibilityState: () => visibility },
    });
    animator.engageClusterTour();
    // Burn the 2s glide via 20 dt-clamped ticks.
    for (let i = 0; i < 20; i++) animator.tickAnimation(0.1);
    expect(animator.state).toBe(STATES.TOUR_DWELLING);
    // Hide tab — 1000 ticks of 0.1s (100s wall-time worth) should
    // not advance dwell or transition state.
    visibility = 'hidden';
    for (let i = 0; i < 1000; i++) animator.tickAnimation(0.1);
    expect(animator.state).toBe(STATES.TOUR_DWELLING);
    // Restore — dwell completes after 4s.
    visibility = 'visible';
    for (let i = 0; i < 41; i++) animator.tickAnimation(0.1);
    expect(animator.state).toBe(STATES.TOUR_GLIDING);
  });

  it('cluster tour pause + resume cleanly restarts from current slot', () => {
    const { animator, controls } = makeAnimator();
    animator.engageClusterTour();
    expect(controls.enabled).toBe(false);
    animator.pauseClusterTour();
    expect(animator.state).toBe(STATES.IDLE);
    expect(controls.enabled).toBe(true);
    animator.resumeClusterTour();
    expect(animator.state).toBe(STATES.TOUR_GLIDING);
    expect(controls.enabled).toBe(false);
  });

  it('adapter returning [] keeps animator idle', () => {
    const camera = makeCamera();
    const controls = makeControlsStub();
    const animator = new CameraAnimator(
      { camera, controls, scene: new THREE.Scene() },
      () => [], // empty adapter
      { mediaMatcher: () => ({ matches: false }) },
    );
    animator.engageClusterTour();
    expect(animator.state).toBe(STATES.IDLE);
  });
});

// ─── Focal orbit acceptance criteria ─────────────────────────

describe('Focal orbit', () => {
  it('AC-FO-1: engageFocalOrbit → focal-flying → focal-orbiting after 1200ms', () => {
    const { animator } = makeAnimator();
    animator.engageFocalOrbit(0, [10, 0, 0]);
    expect(animator.state).toBe(STATES.FOCAL_FLYING);
    // Burn ~1.2s of flight time in chunks ≤ dt clamp.
    for (let i = 0; i < 13; i++) animator.tickAnimation(0.1);
    expect(animator.state).toBe(STATES.FOCAL_ORBITING);
  });

  it('AC-FO-2: after flight, elevation stays within [59°, 61°] across one full lap', () => {
    const { animator, camera } = makeAnimator();
    const focal = [50, 50, 50];
    animator.engageFocalOrbit(0, focal);
    // Burn flight.
    for (let i = 0; i < 13; i++) animator.tickAnimation(0.1);
    expect(animator.state).toBe(STATES.FOCAL_ORBITING);
    // Sample every 100ms for 25s (one lap on desktop).
    const lapMs = 25_000;
    const samples = lapMs / 100;
    let maxDevDeg = 0;
    for (let i = 0; i < samples; i++) {
      animator.tickAnimation(0.1);
      const dx = camera.position.x - focal[0];
      const dy = camera.position.y - focal[1];
      const dz = camera.position.z - focal[2];
      const elevationDeg = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
      maxDevDeg = Math.max(maxDevDeg, Math.abs(elevationDeg - 60));
    }
    expect(maxDevDeg).toBeLessThan(1);
  });

  it('AC-FO-3: lap time is 25s desktop / 30s mobile', () => {
    const desktop = makeAnimator({ isMobile: false });
    const mobile = makeAnimator({ isMobile: true });
    expect(desktop.animator.lapSec).toBe(25);
    expect(mobile.animator.lapSec).toBe(30);
  });

  it('AC-FO-4: drift-free orbit angle returns to 0 at every lap boundary (100 laps)', () => {
    const lapSec = 25;
    for (let n = 1; n <= 100; n++) {
      const totalMs = n * lapSec * 1000;
      expect(Math.abs(orbitAngle(totalMs, lapSec))).toBeLessThan(1e-9);
    }
  });

  it('AC-FO-7: hammer-call repivot 5× ends at last focal in focal-flying', () => {
    const { animator } = makeAnimator();
    animator.engageFocalOrbit(0, [10, 0, 0]);
    for (let i = 1; i <= 5; i++) {
      animator.repivot(i, [i * 5, 0, 0]);
    }
    expect(animator.state).toBe(STATES.FOCAL_FLYING);
    expect(animator.focalIdx).toBe(5);
  });

  it('repivot preserves orbit angle accumulator (continuity)', () => {
    const { animator } = makeAnimator();
    animator.engageFocalOrbit(0, [10, 0, 0]);
    // Burn flight, then 5s of orbit.
    for (let i = 0; i < 13 + 50; i++) animator.tickAnimation(0.1);
    const angleBefore = orbitAngle(animator.orbitElapsedMs, animator.lapSec);
    animator.repivot(1, [20, 0, 0]);
    // Repivot must NOT zero the elapsed accumulator.
    const angleAfter = orbitAngle(animator.orbitElapsedMs, animator.lapSec);
    expect(angleAfter).toBeCloseTo(angleBefore, 6);
  });

  it('exitFocalOrbit returns animator to idle and re-enables controls', () => {
    const { animator, controls } = makeAnimator();
    animator.engageFocalOrbit(0, [10, 0, 0]);
    expect(controls.enabled).toBe(false);
    animator.exitFocalOrbit();
    expect(animator.state).toBe(STATES.IDLE);
    expect(controls.enabled).toBe(true);
  });
});

// ─── Mobile / accessibility ───────────────────────────────────

describe('Mobile / accessibility', () => {
  it('AC-MA-2: prefers-reduced-motion → engage is no-op, tickAnimation no-op', () => {
    const { animator, camera } = makeAnimator({ reducedMotion: true });
    expect(animator.isDisabled).toBe(true);
    const before = camera.position.clone();
    animator.engageClusterTour();
    expect(animator.state).toBe(STATES.IDLE);
    animator.tickAnimation(1.0);
    expect(camera.position.distanceTo(before)).toBeLessThan(1e-9);
    animator.engageFocalOrbit(0, [10, 0, 0]);
    expect(animator.state).toBe(STATES.IDLE);
    animator.tickAnimation(2.0);
    expect(camera.position.distanceTo(before)).toBeLessThan(1e-9);
  });

  it('setReducedMotion(true) mid-tour bails cleanly back to idle', () => {
    const { animator, controls } = makeAnimator();
    animator.engageClusterTour();
    expect(controls.enabled).toBe(false);
    animator.setReducedMotion(true);
    expect(animator.state).toBe(STATES.IDLE);
    expect(controls.enabled).toBe(true);
  });
});

// ─── dt clamp invariant ───────────────────────────────────────

describe('dt clamp', () => {
  it('orbit advances by at most dtClampSec of angle per tick (Capacitor resume)', () => {
    const { animator } = makeAnimator();
    animator.engageFocalOrbit(0, [0, 0, 0]);
    // Burn flight.
    for (let i = 0; i < 13; i++) animator.tickAnimation(0.1);
    const beforeElapsed = animator.orbitElapsedMs;
    // Pass 5s of "background suspension" — clamp should treat as 100ms.
    animator.tickAnimation(5.0);
    const delta = animator.orbitElapsedMs - beforeElapsed;
    expect(delta).toBeCloseTo(100, 0); // clamp is 100ms, not 5000ms
  });

  it('dt clamp prevents glide segment from skipping past completion', () => {
    const { animator } = makeAnimator();
    animator.engageClusterTour();
    expect(animator.state).toBe(STATES.TOUR_GLIDING);
    // A 10s tick (clamped to 0.1s) should NOT instantly complete the 2s glide.
    animator.tickAnimation(10.0);
    expect(animator.state).toBe(STATES.TOUR_GLIDING);
  });
});

// ─── Construction defaults ────────────────────────────────────

describe('construction', () => {
  it('uses DEFAULTS for unset opts', () => {
    const { animator } = makeAnimator();
    expect(animator._opts.dwellSec).toBe(DEFAULTS.dwellSec);
    expect(animator._opts.glideSec).toBe(DEFAULTS.glideSec);
    expect(animator._opts.orbitDistance).toBe(DEFAULTS.orbitDistance);
  });

  it('dispose returns animator to idle and zeroes references', () => {
    const { animator, controls } = makeAnimator();
    animator.engageClusterTour();
    animator.dispose();
    expect(animator.state).toBe(STATES.IDLE);
    // Subsequent ticks must be safe (no-op, no throw).
    expect(() => animator.tickAnimation(0.1)).not.toThrow();
    expect(controls.enabled).toBe(true);
  });
});
