/**
 * R14: CameraAnimator unit tests.
 *
 * Covers acceptance criteria from `.omc/plans/ralplan-camera-animations.md`,
 * adapted to the v2 cluster-tour model (continuous orbit around the
 * current `controls.target`, replacing the original glide-and-dwell
 * pattern after live-test feedback).
 *
 *   AC-CT-1..CT-8  (cluster tour, v2 continuous orbit)
 *   AC-FO-1..FO-7  (focal orbit, unchanged)
 *   AC-MA-2        (prefers-reduced-motion)
 *
 * Test env: vitest default (`node`). No DOM or canvas needed —
 * CameraAnimator is pure CPU math against THREE.Vector3 / Camera /
 * Sprite objects, all of which work outside a renderer.
 */
import { describe, it, expect } from 'vitest';
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
} = {}) {
  const camera = makeCamera();
  const controls = makeControlsStub();
  const scene = new THREE.Scene();
  const animator = new CameraAnimator(
    { camera, controls, scene },
    () => centroids,
    {
      isMobile,
      reducedMotion,
      mediaMatcher: () => ({ matches: reducedMotion === true }),
      getVisibilityState: () => visibility,
      ...opts,
    },
  );
  return { animator, camera, controls, scene };
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

  it('labelPopScale (legacy pure helper) keeps its anchors', () => {
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

// ─── Cluster tour (v2: continuous orbit) ─────────────────────

describe('Cluster tour (continuous orbit)', () => {
  it('engageClusterTour transitions to TOUR_ORBITING and disables controls', () => {
    const { animator, controls } = makeAnimator();
    expect(animator.state).toBe(STATES.IDLE);
    animator.engageClusterTour();
    expect(animator.state).toBe(STATES.TOUR_ORBITING);
    expect(controls.enabled).toBe(false);
  });

  it('first tick does not move the camera off its initial radius', () => {
    const { animator, camera } = makeAnimator();
    animator.engageClusterTour();
    const r0 = camera.position.clone();
    animator.tickAnimation(0.016);
    // Camera position changes, but radius from pivot is preserved.
    const dx = camera.position.x - 0; // pivot is centroid mean (≈ origin here)
    const dy = camera.position.y - 0;
    const dz = camera.position.z - 0;
    const radius = Math.hypot(dx, dy, dz);
    const r0Hypot = Math.hypot(r0.x, r0.y, r0.z);
    // mean of [10,0,0],[0,10,0],[0,0,10] = (10/3, 10/3, 10/3) — not zero.
    // Recompute precisely.
    const px = 10 / 3, py = 10 / 3, pz = 10 / 3;
    const r1 = Math.hypot(camera.position.x - px, camera.position.y - py, camera.position.z - pz);
    const r0p = Math.hypot(r0.x - px, r0.y - py, r0.z - pz);
    expect(r1).toBeCloseTo(r0p, 3);
  });

  it('tour orbit uses controls.target as pivot when adapter returns []', () => {
    const camera = makeCamera();
    const target = new THREE.Vector3(50, 60, 70);
    const controls = { target: target.clone(), enabled: true, update: () => {} };
    const animator = new CameraAnimator(
      { camera, controls, scene: new THREE.Scene() },
      () => [], // empty adapter — mode-agnostic path
      { mediaMatcher: () => ({ matches: false }) },
    );
    animator.engageClusterTour();
    // Tour engages successfully even with no centroids — orbits target.
    expect(animator.state).toBe(STATES.TOUR_ORBITING);
    // Walk a quarter lap. Camera should still be equidistant from target.
    const r0 = camera.position.distanceTo(target);
    const lapSec = animator.tourLapSec;
    const ticksPerQuarterLap = Math.round((lapSec / 4) / 0.1);
    for (let i = 0; i < ticksPerQuarterLap; i++) animator.tickAnimation(0.1);
    expect(camera.position.distanceTo(target)).toBeCloseTo(r0, 2);
    // controls.target stays fixed at the pivot.
    expect(controls.target.distanceTo(target)).toBeLessThan(1e-6);
  });

  it('camera azimuth advances around the pivot (full lap returns to start)', () => {
    const { animator, camera } = makeAnimator();
    animator.engageClusterTour();
    const start = camera.position.clone();
    const lapSec = animator.tourLapSec;
    const lapMs = lapSec * 1000;
    // Walk the full lap in 100ms ticks (dt clamped, so we burn lapMs/100 ticks).
    const ticks = Math.round(lapMs / 100);
    for (let i = 0; i < ticks; i++) animator.tickAnimation(0.1);
    // After exactly one lap, position should be back to start (mod float).
    expect(camera.position.distanceTo(start)).toBeLessThan(0.5);
  });

  it('mid-lap camera position is azimuth-rotated from start', () => {
    const { animator, camera } = makeAnimator();
    animator.engageClusterTour();
    const start = camera.position.clone();
    const lapSec = animator.tourLapSec;
    // Walk a quarter lap.
    const quarter = Math.round((lapSec / 4) * 10);
    for (let i = 0; i < quarter; i++) animator.tickAnimation(0.1);
    // After 1/4 lap the camera should be ~90° around the pivot —
    // not equal to start.
    expect(camera.position.distanceTo(start)).toBeGreaterThan(1);
  });

  it('AC-CT-6 (v2): recordInput → cancelled-awaiting-resume; same-tick is camera-write-free', () => {
    const { animator, camera } = makeAnimator();
    animator.engageClusterTour();
    animator.tickAnimation(0.1);
    const beforeCancel = camera.position.clone();
    animator.recordInput();
    expect(animator.state).toBe(STATES.CANCELLED_AWAITING_RESUME);
    animator.tickAnimation(0.5);
    expect(camera.position.distanceTo(beforeCancel)).toBeLessThan(1e-9);
  });

  it('AC-CT-7 (v2): _resumeFromIdle re-engages TOUR_ORBITING', () => {
    const { animator } = makeAnimator();
    animator.engageClusterTour();
    animator.recordInput();
    expect(animator.state).toBe(STATES.CANCELLED_AWAITING_RESUME);
    animator._resumeFromIdle();
    expect(animator.state).toBe(STATES.TOUR_ORBITING);
  });

  it('AC-CT-7 (v2): 60s of CANCELLED_AWAITING_RESUME triggers idle resume', () => {
    const { animator } = makeAnimator();
    animator.engageClusterTour();
    animator.recordInput();
    expect(animator.state).toBe(STATES.CANCELLED_AWAITING_RESUME);
    // Default idleResumeMs is 60_000 — advance 60s in 100ms ticks (600 calls).
    for (let i = 0; i < 600; i++) animator.tickAnimation(0.1);
    expect(animator.state).toBe(STATES.TOUR_ORBITING);
  });

  it('AC-CT-7 (v2): less than idleResumeMs of CANCELLED_AWAITING_RESUME stays cancelled', () => {
    const { animator } = makeAnimator();
    animator.engageClusterTour();
    animator.recordInput();
    // 30s < 60s default — should still be cancelled-awaiting-resume.
    for (let i = 0; i < 300; i++) animator.tickAnimation(0.1);
    expect(animator.state).toBe(STATES.CANCELLED_AWAITING_RESUME);
  });

  it('AC-CT-8 (v2): visibility hidden → camera does not move during tour', () => {
    let visibility = 'visible';
    const { animator, camera } = makeAnimator({
      opts: { getVisibilityState: () => visibility },
    });
    animator.engageClusterTour();
    animator.tickAnimation(0.1);
    const frozen = camera.position.clone();
    visibility = 'hidden';
    for (let i = 0; i < 1000; i++) animator.tickAnimation(0.1);
    expect(camera.position.distanceTo(frozen)).toBeLessThan(1e-9);
    expect(animator.state).toBe(STATES.TOUR_ORBITING);
  });

  it('cluster tour pause + resume cleanly restarts orbit', () => {
    const { animator, controls } = makeAnimator();
    animator.engageClusterTour();
    expect(controls.enabled).toBe(false);
    animator.pauseClusterTour();
    expect(animator.state).toBe(STATES.IDLE);
    expect(controls.enabled).toBe(true);
    animator.resumeClusterTour();
    expect(animator.state).toBe(STATES.TOUR_ORBITING);
    expect(controls.enabled).toBe(false);
  });

  it('lap rate: 60s desktop / 90s mobile', () => {
    const desktop = makeAnimator({ isMobile: false });
    const mobile = makeAnimator({ isMobile: true });
    expect(desktop.animator.tourLapSec).toBe(60);
    expect(mobile.animator.tourLapSec).toBe(90);
  });
});

// ─── Focal orbit acceptance criteria ─────────────────────────

describe('Focal orbit', () => {
  it('AC-FO-1: engageFocalOrbit → focal-flying → focal-orbiting after 1200ms', () => {
    const { animator } = makeAnimator();
    animator.engageFocalOrbit(0, [10, 0, 0]);
    expect(animator.state).toBe(STATES.FOCAL_FLYING);
    for (let i = 0; i < 13; i++) animator.tickAnimation(0.1);
    expect(animator.state).toBe(STATES.FOCAL_ORBITING);
  });

  it('AC-FO-2: after flight, elevation stays within [59°, 61°] across one full lap', () => {
    const { animator, camera } = makeAnimator();
    const focal = [50, 50, 50];
    animator.engageFocalOrbit(0, focal);
    for (let i = 0; i < 13; i++) animator.tickAnimation(0.1);
    expect(animator.state).toBe(STATES.FOCAL_ORBITING);
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

  it('AC-FO-3: focal lap time is 25s desktop / 30s mobile', () => {
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
    for (let i = 0; i < 13 + 50; i++) animator.tickAnimation(0.1);
    const angleBefore = orbitAngle(animator.orbitElapsedMs, animator.lapSec);
    animator.repivot(1, [20, 0, 0]);
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
    for (let i = 0; i < 13; i++) animator.tickAnimation(0.1);
    const beforeElapsed = animator.orbitElapsedMs;
    animator.tickAnimation(5.0);
    const delta = animator.orbitElapsedMs - beforeElapsed;
    expect(delta).toBeCloseTo(100, 0);
  });

  it('dt clamp prevents tour orbit from skipping past completion', () => {
    const { animator } = makeAnimator();
    animator.engageClusterTour();
    expect(animator.state).toBe(STATES.TOUR_ORBITING);
    // A 10s tick (clamped to 0.1s) advances tourElapsedMs by exactly 100ms,
    // not 10000. Stays in TOUR_ORBITING (lap is 60s, so well short of full lap).
    animator.tickAnimation(10.0);
    expect(animator.state).toBe(STATES.TOUR_ORBITING);
    expect(animator.tourElapsedMs).toBeCloseTo(100, 0);
  });
});

// ─── Construction defaults ────────────────────────────────────

describe('construction', () => {
  it('uses DEFAULTS for unset opts', () => {
    const { animator } = makeAnimator();
    expect(animator._opts.tourLapSecDesktop).toBe(DEFAULTS.tourLapSecDesktop);
    expect(animator._opts.tourLapSecMobile).toBe(DEFAULTS.tourLapSecMobile);
    expect(animator._opts.idleResumeMs).toBe(DEFAULTS.idleResumeMs);
    expect(animator._opts.orbitDistance).toBe(DEFAULTS.orbitDistance);
  });

  it('idleResumeMs default is 60_000ms (bumped from 30s on user feedback)', () => {
    expect(DEFAULTS.idleResumeMs).toBe(60_000);
  });

  it('dispose returns animator to idle and zeroes references', () => {
    const { animator, controls } = makeAnimator();
    animator.engageClusterTour();
    animator.dispose();
    expect(animator.state).toBe(STATES.IDLE);
    expect(() => animator.tickAnimation(0.1)).not.toThrow();
    expect(controls.enabled).toBe(true);
  });
});
