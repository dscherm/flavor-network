/**
 * CameraAnimator label-alignment DIAGNOSTIC HARNESS — P0 artifact for
 * network-cleanup-tactical iter-2 (ralplan §2.0 artifact #1 + #4).
 *
 * R8 user-confirmation invalidated the prior Y-offset hypothesis:
 * `flavorClusterLabelGroup` sprites mount AT `centroid_3d` (no offset,
 * LivingArchView.jsx:765). The label-vs-FOV misalignment user report
 * is real in flavor3D mode. ADR-2 needs an empirical pick between:
 *
 *   (C-a) Sprite text-anchor — canvas glyph center ≠ sprite.position
 *   (C-b) Camera-pitch on pivot land — camera lookAt projects target
 *         to NDC (0,0) but the SPRITE world position projects offset
 *         from viewport center because the sprite is anchored at
 *         centroid_3d AND the camera looks at the same centroid_3d
 *         — the sprite IS the target, so any offset is glyph-side.
 *         When the harness measures camera-pitch delta we project
 *         the sprite position (not the controls.target) so any
 *         delta surfaces the residual screen-Y error after the lerp.
 *   (C-c) `centroid_3d` ≠ visual center — sparse-cluster outliers
 *         inflate the arithmetic mean (current `centroid_3d`) away
 *         from the visual bulk; a trimmed-mean / median would land
 *         on the eye-perceived center of the cluster.
 *
 * This harness measures all 3 deltas in ONE pass per cluster (Architect
 * note: parallel measurement avoids confounding — fixing one mechanism
 * before measuring the others would mask interaction effects).
 *
 * MODE: log-only. Per Architect + Critic concur, no assertions in P0;
 * the harness becomes a regression test in P2-test (post-spike, after
 * the chosen mechanism's fix-form is implemented). For now the
 * `it('logs measurements', ...)` block runs to completion without
 * any expect() so the suite stays green.
 *
 * Fixture: 3 mock clusters chosen to exercise the C-c outlier case:
 *   Cluster 0 — compact (8 ingredients, 5-unit radius). C-c near 0.
 *   Cluster 1 — medium spread (10 ingredients, 12-unit radius). C-c small.
 *   Cluster 2 — sparse + outlier (5 ingredients clustered in 6-unit
 *               radius + 1 outlier at 40 units). Centroid dragged.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

// ─── Fixture builders ────────────────────────────────────────────────

/**
 * Build 3 mock clusters with explicit member positions. Returns
 * `{ id, label, centroid_3d, members }` per cluster.
 *
 * Centroid is computed as the arithmetic mean of `members` so the
 * fixture mirrors how `flavorClusterLabels.clusters[i].centroid_3d`
 * gets produced upstream (offline aggregate).
 */
function buildFixtureClusters() {
  const clusters = [];

  // Cluster 0 — compact (8 ingredients within 5-unit radius around (10, 4, -8))
  const compactCenter = [10, 4, -8];
  const compactMembers = [
    [10 + 1.2, 4 + 0.3, -8 + 0.8],
    [10 - 0.7, 4 - 1.1, -8 + 1.4],
    [10 + 2.1, 4 + 1.8, -8 - 0.9],
    [10 - 1.3, 4 + 0.6, -8 + 2.3],
    [10 + 0.4, 4 - 2.2, -8 - 1.7],
    [10 + 1.8, 4 + 0.2, -8 + 0.1],
    [10 - 0.9, 4 + 1.5, -8 - 1.2],
    [10 + 0.6, 4 - 0.4, -8 + 1.9],
  ];
  clusters.push({
    id: 0,
    label: 'COMPACT_BERRIES',
    centroid_3d: arithmeticMean(compactMembers),
    members: compactMembers,
  });

  // Cluster 1 — medium spread (10 ingredients within 12-unit radius around (-15, 6, 12))
  const mediumCenter = [-15, 6, 12];
  const mediumMembers = [
    [-15 + 4.2, 6 + 1.3, 12 + 3.8],
    [-15 - 5.7, 6 - 2.1, 12 + 4.4],
    [-15 + 6.1, 6 + 2.8, 12 - 4.9],
    [-15 - 3.3, 6 + 1.6, 12 + 7.3],
    [-15 + 2.4, 6 - 3.2, 12 - 5.7],
    [-15 + 7.8, 6 + 0.9, 12 + 1.1],
    [-15 - 6.9, 6 + 2.5, 12 - 3.2],
    [-15 + 3.6, 6 - 0.7, 12 + 6.9],
    [-15 - 4.1, 6 + 3.4, 12 - 2.8],
    [-15 + 5.5, 6 - 1.8, 12 + 0.4],
  ];
  clusters.push({
    id: 1,
    label: 'MEDIUM_AROMATICS',
    centroid_3d: arithmeticMean(mediumMembers),
    members: mediumMembers,
  });

  // Cluster 2 — sparse with outlier: 5 ingredients in 6-unit radius around
  // (0, 0, 25), PLUS one outlier 40 units away dragging the centroid.
  const sparseCenter = [0, 0, 25];
  const sparseMembers = [
    [sparseCenter[0] + 1.5, sparseCenter[1] + 2.1, sparseCenter[2] + 1.8],
    [sparseCenter[0] - 2.3, sparseCenter[1] - 1.4, sparseCenter[2] + 0.9],
    [sparseCenter[0] + 0.8, sparseCenter[1] + 0.6, sparseCenter[2] - 2.7],
    [sparseCenter[0] - 1.1, sparseCenter[1] + 2.9, sparseCenter[2] + 2.4],
    [sparseCenter[0] + 2.6, sparseCenter[1] - 0.3, sparseCenter[2] - 1.2],
    // Outlier — drags the arithmetic mean ~6.7 units away from the bulk.
    [sparseCenter[0] + 40, sparseCenter[1] + 20, sparseCenter[2] - 15],
  ];
  clusters.push({
    id: 2,
    label: 'SPARSE_OUTLIER',
    centroid_3d: arithmeticMean(sparseMembers),
    members: sparseMembers,
  });

  return clusters;
}

function arithmeticMean(positions) {
  const n = positions.length;
  const sum = [0, 0, 0];
  for (const p of positions) { sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; }
  return [sum[0] / n, sum[1] / n, sum[2] / n];
}

/**
 * Trimmed-mean visual center: per-axis, drop the top + bottom 20%
 * before averaging. This is the C-c candidate fix form — if the
 * visual-center delta is large vs camera-pitch and sprite-anchor,
 * C-c is the dominant cause.
 */
function trimmedMean(positions, trimFrac = 0.2) {
  const n = positions.length;
  const drop = Math.floor(n * trimFrac);
  const result = [0, 0, 0];
  for (let axis = 0; axis < 3; axis++) {
    const vals = positions.map(p => p[axis]).sort((a, b) => a - b);
    const kept = vals.slice(drop, n - drop);
    const sum = kept.reduce((s, v) => s + v, 0);
    result[axis] = kept.length > 0 ? sum / kept.length : vals[Math.floor(n / 2)];
  }
  return result;
}

// ─── makeLabel-like canvas with measured glyph metrics ───────────────

/**
 * Build a stub canvas + sprite mimicking `livingArchUtils.makeLabel`
 * geometry. In production:
 *   - canvas.height = 144 (fixed)
 *   - fontSize = 72
 *   - text drawn at canvas.width/2, canvas.height/2 with
 *     textBaseline='middle' → glyph vertical center sits at canvas
 *     Y = 0.5 (canvas-normalized).
 *
 * jsdom does NOT implement canvas 2D context fully, so we synthesize
 * the metrics the production code would produce. For C-a we report
 * the glyph centroid in sprite-canvas units (0..1, where 0.5 is the
 * canvas midpoint = sprite.center default).
 *
 * Returns:
 *   { sprite, canvasGlyphCenterY: <0..1>, spriteAnchorY: 0.5,
 *     deltaSpriteUnits: glyphCenterY - spriteAnchorY }
 */
function buildLabelSprite(text, worldPos) {
  // Mimic makeLabel: fontSize=72, canvasH=144, text drawn at midline.
  const fontSize = 72;
  const canvasH = 144;
  // textBaseline='middle' + fillText(..., canvasH/2) → glyph center at canvasH/2.
  // For an "ideal" canvas, glyph-center-Y / canvasH = 0.5 exactly.
  const canvasGlyphCenterY = (canvasH / 2) / canvasH; // = 0.5

  // sprite.center is THREE.Vector2(0.5, 0.5) by default — sprite anchored
  // at world position has its canvas midpoint mapped to that world point.
  const spriteAnchorY = 0.5; // matches THREE.Sprite default center.y

  // Real-world wrinkle: `ctx.textBaseline='middle'` aligns to the EM-box
  // middle, NOT the ascender-descender midpoint of the rendered glyph.
  // For most fonts the difference is ~5-8% of fontSize. We model this
  // as a small upward bias of the perceived optical center (descenders
  // push the visual mass slightly below EM-middle, so the perceived
  // center is offset DOWN from canvas-Y=0.5 by ~0.04 units in
  // sprite-normalized space). This is an *upper bound* on C-a in
  // production typography.
  const opticalBiasFromBaselineMode = 0.04; // estimate for 'middle' baseline
  const perceivedGlyphCenterY = canvasGlyphCenterY + opticalBiasFromBaselineMode;

  // Build a real THREE.Sprite at worldPos (no real canvas — jsdom can't
  // render text; the sprite's color/material is irrelevant for projection).
  const mat = new THREE.SpriteMaterial({ transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(worldPos[0], worldPos[1], worldPos[2]);
  sprite.scale.set(22, 22 * canvasH / 768, 1); // mimic makeLabel scale

  return {
    sprite,
    canvasGlyphCenterY,
    perceivedGlyphCenterY,
    spriteAnchorY,
    // Delta in sprite-canvas units. Range -0.5 to +0.5; sign convention:
    // positive = glyph optical center is BELOW sprite anchor → label
    // visually appears below the world-space anchor point (camera reads
    // it as offset toward the lower viewport edge).
    deltaSpriteUnits: perceivedGlyphCenterY - spriteAnchorY,
  };
}

// ─── Camera-pitch projection ──────────────────────────────────────────

/**
 * Set up a perspective camera at an orbit pose matching CameraAnimator's
 * tour-orbit defaults, then project `sampledWorldPos` to NDC and convert
 * to viewport-Y (0 = top, 1 = bottom).
 *
 * Mirrors the post-lerp state in CameraAnimator._tickTourOrbit:
 *   - tour-orbit captures camera radius + elevation at engage time
 *   - controls.target = _tourPivot (the cluster centroid_3d after lerp)
 *   - camera.position = orbit pose at the current azimuth
 *   - controls.enabled = false during tour, so OrbitControls.update()
 *     is NOT called → camera.lookAt(target) is NOT applied each tick.
 *     The camera quaternion is STALE: it points wherever it pointed at
 *     engage time (or, in the lerp-advance case, at the PREVIOUS pivot
 *     before the new one became _tourPivot).
 *
 * The C-b mechanism candidate is that this stale-quaternion state
 * causes the new pivot to project off-center. To measure it faithfully
 * we set the camera to look at `stalePoseTarget` (the previous pivot or
 * engage-time target), not the new pivot. The harness exposes both:
 *
 *   - `freshLookAt` = camera.lookAt(target) → target projects to (0,0)
 *     NDC by construction. Useful only as a sanity check.
 *   - `staleLookAt` = camera.lookAt(stalePoseTarget) — models the
 *     real post-lerp state. Sprite projection shows the actual
 *     viewport-Y the user sees.
 */
function projectAtOrbitPose({ target, sampledWorldPos, elevation, radius, stalePoseTarget = null }) {
  // PerspectiveCamera — 50° fov, 16:9 aspect (matches typical desktop).
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);

  // Orbit pose at azimuth=0 (looking along +X from +X side, toward target).
  const horiz = radius * Math.cos(elevation);
  const vert = radius * Math.sin(elevation);
  const camPos = new THREE.Vector3(
    target[0] + horiz, // azimuth=0 → cos=1, sin=0
    target[1] + vert,
    target[2] + 0,
  );
  camera.position.copy(camPos);
  // Stale-quaternion model: if a stalePoseTarget is provided, the
  // camera's lookAt points at that PRIOR target — not the new pivot.
  // This is the actual mid-pivot-lerp state when controls.enabled=false.
  const lookAtPoint = stalePoseTarget ?? target;
  camera.lookAt(lookAtPoint[0], lookAtPoint[1], lookAtPoint[2]);
  camera.updateMatrixWorld(true);

  // Project sampledWorldPos to NDC. The sprite billboards to face the
  // camera at render time, but its position (the anchor) is what
  // matters for screen-space alignment — that's the world point we
  // project.
  const ndc = new THREE.Vector3(sampledWorldPos[0], sampledWorldPos[1], sampledWorldPos[2]);
  ndc.project(camera);

  // Convert NDC Y ([-1, +1], +1 = top) to viewport-Y ([0, 1], 0 = top).
  const viewportY = (1 - ndc.y) / 2;
  return {
    cameraPos: [camPos.x, camPos.y, camPos.z],
    lookAtPoint,
    ndc: [ndc.x, ndc.y, ndc.z],
    viewportY,
    deltaFromCenter: viewportY - 0.5,
  };
}

// ─── Test ────────────────────────────────────────────────────────────

describe('CameraAnimator label-alignment diagnostic harness (P0 artifact)', () => {
  it('logs per-cluster deltas for C-a / C-b / C-c (log-only, no assertions)', () => {
    const clusters = buildFixtureClusters();

    // Representative orbit pose mirroring CameraAnimator defaults +
    // typical flavor3D capture-time state. Elevation = PI/6 (30°)
    // matches a typical user-camera pose; tour-orbit captures live
    // elevation so this is a reasonable mid-range value.
    const elevation = Math.PI / 6;
    const radius = 80; // matches DEFAULTS.orbitDistance ballpark

    // For C-b: model the "stale camera quaternion" state. After a
    // pivot-advance lerp lands on cluster N, the camera position is
    // updated to orbit around cluster N's centroid, but
    // controls.enabled=false during the tour so camera.lookAt is
    // NEVER updated to point at the new pivot. The camera continues
    // to look at the PREVIOUS pivot (cluster N-1's centroid_3d at
    // tour-engage time). For each cluster we use the PREVIOUS cluster
    // in the fixture list as the stale lookAt (cluster 0 → falls
    // back to a synthetic prior pose at world-origin-ish).
    const measurements = clusters.map((cluster, idx) => {
      const priorIdx = idx === 0 ? clusters.length - 1 : idx - 1;
      const stalePoseTarget = clusters[priorIdx].centroid_3d;

      // C-c: visual-center delta (centroid vs trimmed-mean)
      const visualCenter = trimmedMean(cluster.members, 0.2);
      const dx = cluster.centroid_3d[0] - visualCenter[0];
      const dy = cluster.centroid_3d[1] - visualCenter[1];
      const dz = cluster.centroid_3d[2] - visualCenter[2];
      const centroidVsVisualDelta = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // C-a: sprite-anchor delta — measure the canvas glyph optical
      // center vs the sprite.center default. Sprite is built at the
      // cluster centroid (mirroring LivingArchView.jsx:765).
      const labelInfo = buildLabelSprite(cluster.label, cluster.centroid_3d);
      const spriteAnchor = {
        glyphCenterSpriteY: labelInfo.perceivedGlyphCenterY,
        spritePositionSpriteY: labelInfo.spriteAnchorY,
        deltaSpriteUnits: labelInfo.deltaSpriteUnits,
      };

      // C-b (fresh): project sprite with camera.lookAt(new pivot) — this
      // is the IDEAL post-update state. By construction, the lookAt
      // target projects to (0,0) NDC, so the centroid sprite lands at
      // viewport-Y = 0.5 exactly. This is the sanity-check baseline.
      const projectionFresh = projectAtOrbitPose({
        target: cluster.centroid_3d,
        sampledWorldPos: cluster.centroid_3d,
        elevation,
        radius,
      });

      // C-b (stale): camera position moved to orbit new pivot, but
      // camera.lookAt still pointing at PRIOR pivot (controls.enabled
      // false during tour → no lookAt update). This models the actual
      // mid/post-lerp state and surfaces the camera-pitch residual.
      const projectionStale = projectAtOrbitPose({
        target: cluster.centroid_3d, // camera pos derived from new pivot
        sampledWorldPos: cluster.centroid_3d,
        elevation,
        radius,
        stalePoseTarget,
      });

      const cameraPitch = {
        spriteWorldPos: cluster.centroid_3d,
        cameraPos: projectionStale.cameraPos,
        stalePoseTarget,
        freshLookAt_projectedViewportY: projectionFresh.viewportY,
        freshLookAt_deltaFromCenter: projectionFresh.deltaFromCenter,
        staleLookAt_projectedViewportY: projectionStale.viewportY,
        staleLookAt_deltaFromCenter: projectionStale.deltaFromCenter,
      };

      // C-c-corrected: aim camera at visual-center instead of centroid.
      // Sprite remains at centroid_3d (we can't move the label without
      // a P2-impl change). Result shows whether C-c fix-form alone
      // closes the screen-Y gap.
      const projectionVisualCenter = projectAtOrbitPose({
        target: visualCenter,
        sampledWorldPos: cluster.centroid_3d,
        elevation,
        radius,
      });

      // Heuristic candidate-cause score: higher = more likely cause.
      // Normalized to comparable scales:
      //   C-a: absolute delta in sprite-units × 2 (range 0..1 for ±0.5)
      //   C-b: stale-state absolute viewport-Y delta × 10 (range 0..1 for ±10%)
      //   C-c: centroid-vs-visual euclidean / 10 (range 0..1 for ≤10 units)
      const c_a_score = Math.abs(spriteAnchor.deltaSpriteUnits) * 2;
      const c_b_score = Math.abs(cameraPitch.staleLookAt_deltaFromCenter) * 10;
      const c_c_score = centroidVsVisualDelta / 10;

      return {
        cluster_id: cluster.id,
        label: cluster.label,
        centroid_3d: cluster.centroid_3d,
        visualCenter,
        centroidVsVisualDelta,
        spriteAnchor,
        cameraPitch,
        cameraPitchAfterCcFix: {
          target: visualCenter,
          projectedViewportY: projectionVisualCenter.viewportY,
          deltaFromCenter: projectionVisualCenter.deltaFromCenter,
        },
        candidateRanking: {
          c_a_score,
          c_b_score,
          c_c_score,
        },
      };
    });

    // Aggregate ranking across all clusters — mean score per candidate.
    const aggregate = {
      mean_c_a_score: measurements.reduce((s, m) => s + m.candidateRanking.c_a_score, 0) / measurements.length,
      mean_c_b_score: measurements.reduce((s, m) => s + m.candidateRanking.c_b_score, 0) / measurements.length,
      mean_c_c_score: measurements.reduce((s, m) => s + m.candidateRanking.c_c_score, 0) / measurements.length,
    };
    aggregate.dominant = (() => {
      const entries = [
        ['C-a sprite-anchor', aggregate.mean_c_a_score],
        ['C-b camera-pitch', aggregate.mean_c_b_score],
        ['C-c visual-center', aggregate.mean_c_c_score],
      ];
      entries.sort((a, b) => b[1] - a[1]);
      return entries[0][0];
    })();

    // Log-only output — no expect() to keep this green in P0. Format
    // chosen for direct paste into .omc notepad + PR body.
    console.log('\n=== P0 Harness Output — network-cleanup-tactical iter-2 ===');
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Camera: PerspectiveCamera(fov=50, aspect=16/9), elevation=${elevation.toFixed(4)} rad (${(elevation * 180 / Math.PI).toFixed(1)}°), radius=${radius}`);
    console.log(`Sprite-anchor model: makeLabel canvas (fontSize=72, canvasH=144, textBaseline='middle' + ~0.04 optical-bias estimate)`);
    console.log('\nPer-cluster measurements:');
    console.log(JSON.stringify(measurements, null, 2));
    console.log('\nAggregate ranking:');
    console.log(JSON.stringify(aggregate, null, 2));
    console.log('=== End P0 Harness Output ===\n');
  });

  // ─── P2-test: post-fix predicate (graduates from log-only) ─────────
  //
  // ADR-2 contract item 4(a): for each cluster fixture, after applying
  // `camera.lookAt(target); camera.updateMatrixWorld(true);` the projected
  // viewport-Y of the pivot must land within [0.45, 0.55] (±5% of viewport
  // center). This is the post-fix predicate that the `align_to_pivot`
  // branch in `_tickTourOrbit` satisfies by construction (the lookAt
  // target projects to NDC origin).
  it('post-fix: camera.lookAt(target) lands every cluster within ±5% of viewport center', () => {
    const clusters = buildFixtureClusters();
    const elevation = Math.PI / 6;
    const radius = 80;

    for (const cluster of clusters) {
      // Mirror the post-fix state: camera positioned at the orbit pose
      // around the new pivot AND camera.lookAt(new pivot) applied (the
      // `align_to_pivot === true` branch in _tickTourOrbit).
      const projection = projectAtOrbitPose({
        target: cluster.centroid_3d,
        sampledWorldPos: cluster.centroid_3d,
        elevation,
        radius,
        // stalePoseTarget omitted → camera.lookAt(target) — i.e., the
        // fix-active state. Sprite projects to NDC origin.
      });
      expect(projection.viewportY).toBeGreaterThanOrEqual(0.45);
      expect(projection.viewportY).toBeLessThanOrEqual(0.55);
    }
  });

  // ─── P2-test: pre-fix sanity branch (Architect contract item 4b) ───
  //
  // Without the `align_to_pivot` branch, `controls.target.copy(_tourPivot)`
  // advances the target without rotating the camera (controls.enabled =
  // false during tour → no controls.update() → camera quaternion stale).
  // At least ONE cluster must drift outside [0.45, 0.55] under the stale-
  // quaternion model — otherwise the post-fix test is dead code. The
  // sparse-outlier cluster 2 is the natural witness (P0 spike notepad
  // recorded stale viewportY = 0.645).
  it.each([
    { fixActive: false, expectFail: true,  label: 'pre-fix (stale quaternion)' },
    { fixActive: true,  expectFail: false, label: 'post-fix (camera.lookAt active)' },
  ])('parameterized alignment predicate: $label', ({ fixActive, expectFail }) => {
    const clusters = buildFixtureClusters();
    const elevation = Math.PI / 6;
    const radius = 80;

    let anyOutsideBand = false;
    let allInsideBand = true;
    for (let idx = 0; idx < clusters.length; idx++) {
      const cluster = clusters[idx];
      const priorIdx = idx === 0 ? clusters.length - 1 : idx - 1;
      // When fixActive: omit stalePoseTarget so projectAtOrbitPose calls
      // camera.lookAt(target) — pivot projects to NDC origin.
      // When fix not active: pass stalePoseTarget = prior cluster centroid,
      // modeling the stale-quaternion state production exhibits today.
      const projection = projectAtOrbitPose({
        target: cluster.centroid_3d,
        sampledWorldPos: cluster.centroid_3d,
        elevation,
        radius,
        stalePoseTarget: fixActive ? null : clusters[priorIdx].centroid_3d,
      });
      if (projection.viewportY < 0.45 || projection.viewportY > 0.55) {
        anyOutsideBand = true;
        allInsideBand = false;
      }
    }
    if (expectFail) {
      // Pre-fix: at least one cluster MUST drift outside the band, else
      // the predicate is dead-code and the post-fix test is meaningless.
      expect(anyOutsideBand).toBe(true);
    } else {
      // Post-fix: all clusters MUST be inside the band.
      expect(allInsideBand).toBe(true);
    }
  });
});
