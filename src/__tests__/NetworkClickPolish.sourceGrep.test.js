// NETWORK-CLICK-POLISH-V1 source-grep regression. WebGL-dependent
// rendering changes don't have a clean unit-testable API, so we
// assert the key code patterns are present (or absent) in the source.
// Failures here mean someone reverted the polish accidentally.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appJsx = readFileSync(resolve(__dirname, '../App.jsx'), 'utf8');
const lavJsx = readFileSync(
  resolve(__dirname, '../components/LivingArchView.jsx'),
  'utf8',
);
const affinityJs = readFileSync(
  resolve(__dirname, '../three/AffinityMode.js'),
  'utf8',
);

describe('NETWORK-CLICK-POLISH-V1 — App.jsx C1 (pill flight hides edges)', () => {
  it('App.jsx onFlyTo isCluster branch calls setShowEdges(false)', () => {
    const isClusterBlock = appJsx.match(/if \(isCluster\)\s*\{[\s\S]*?setFlyToTarget\(\{/);
    expect(isClusterBlock).not.toBeNull();
    expect(isClusterBlock[0]).toMatch(/setShowEdges\(false\)/);
  });

  it('the setShowEdges(false) reference is annotated with the task ID', () => {
    expect(appJsx).toMatch(/NETWORK-CLICK-POLISH-V1[\s\S]{0,300}setShowEdges\(false\)/);
  });
});

describe('NETWORK-CLICK-POLISH-V1 — LivingArchView.jsx C2 (isolate + labels)', () => {
  it('defaultScales is computed at build time + stored on stateRef', () => {
    expect(lavJsx).toMatch(/const defaultScales = new Float32Array\(count\)/);
    expect(lavJsx).toMatch(/defaultScales\[i\] = s/);
    expect(lavJsx).toMatch(/defaultColors, defaultScales,/);
  });

  it('the color/dim effect ALSO writes per-instance scales (hide non-affinity)', () => {
    // The dummyScale.set(target, target, target) line is the giveaway —
    // when target===0 the non-affinity nodes disappear.
    expect(lavJsx).toMatch(/dummyScale\.set\(target, target, target\)/);
    expect(lavJsx).toMatch(/const target = inSet \? defaultScales\[i\] : 0/);
    expect(lavJsx).toMatch(/mesh\.instanceMatrix\.needsUpdate = true/);
  });

  it('the color/dim effect hides edgeMesh when isolation is active', () => {
    // After the scale pass, edgeMesh.visible follows connMap presence.
    expect(lavJsx).toMatch(/edgeMesh\.visible = connMap \? false : showEdges/);
  });

  it('the labels effect extends labelNames with affinity neighbors of every selection', () => {
    expect(lavJsx).toMatch(/if \(activeSelections\.length > 0 && data\?\.graph\?\.edges\)/);
    // V1 used a simple inline edge iteration; V2 switched to a
    // perFocalSets pattern that handles the union/intersection split.
    // Either shape should ultimately call labelNames.add inside the
    // selection-driven branch.
    expect(lavJsx).toMatch(/labelNames\.add/);
  });

  // ===== NETWORK-CLICK-POLISH-V2 — multi-select + intersection =====

  it('V2: handleNodeClick single-click APPENDS to selection (toggle on/off)', () => {
    // V1 had `return [name];` (replace). V2 must use the prev.includes
    // toggle pattern. Comment context describes the V2 toggle behavior.
    expect(appJsx).toMatch(/prev\.includes\(name\)/);
    expect(appJsx).toMatch(/return \[\.\.\.prev, name\]/);
  });

  it('V2: empty-space click clears selection via functional setter (avoids stale closure)', () => {
    // V2 originally used direct read of selectedNodes which was stale
    // due to useCallback memoization. Fixed to use functional form.
    expect(appJsx).toMatch(/NETWORK-CLICK-POLISH-V2[\s\S]{0,800}setSelectedNodes\(\(prev\) => \{/);
    expect(appJsx).toMatch(/if \(prev\.length === 0\) return prev/);
  });

  it('V2: orbit drag is gated to preserve selection during rotation', () => {
    expect(lavJsx).toMatch(/DRAG_THRESHOLD_PX/);
    expect(lavJsx).toMatch(/Math\.hypot\(dx, dy\) > DRAG_THRESHOLD_PX/);
  });

  it('V2: isolate effect computes INTERSECTION when N>=2 focals', () => {
    expect(lavJsx).toMatch(/perFocalNeighbors/);
    expect(lavJsx).toMatch(/activeNodes\.length === 1/);
    // The intersection branch checks every focal's map has the name.
    expect(lavJsx).toMatch(/Intersection: keep only ingredients present in EVERY focal/);
  });

  it('V2: labels effect uses perFocalSets pattern for intersection-aware labels', () => {
    expect(lavJsx).toMatch(/perFocalSets/);
    expect(lavJsx).toMatch(/NETWORK-CLICK-POLISH-V2[\s\S]{0,300}INTERSECTION of neighbor sets/);
  });

  it('showEdges is added to the color/dim effect deps so toggling it propagates', () => {
    // The effect at line ~2225 — original deps were
    // [selectedNode, selectedNodes, data, filterStack, morphAxis]
    // V1 must add showEdges so the edge-visibility-from-isolate
    // re-evaluates when the user toggles the Edges control.
    const depsLine = lavJsx.match(/\}, \[selectedNode, selectedNodes, data, filterStack, morphAxis[^\]]*\]\);/);
    expect(depsLine).not.toBeNull();
    expect(depsLine[0]).toContain('showEdges');
  });
});

describe('NETWORK-CLICK-POLISH-V2 part B — AffinityMode multi-focal engage', () => {
  it('FOCAL_CAPACITY bumped from 1 to support multi-focal cubes', () => {
    expect(affinityJs).toMatch(/const FOCAL_CAPACITY = 6/);
  });

  it('MULTI_FOCAL_RING_RADIUS defined for extra-cube placement', () => {
    expect(affinityJs).toMatch(/const MULTI_FOCAL_RING_RADIUS = \d+/);
  });

  it('engage() accepts array OR string (back-compat)', () => {
    expect(affinityJs).toMatch(/engage\(focalOrFocals\)/);
    expect(affinityJs).toMatch(/Array\.isArray\(focalOrFocals\)/);
  });

  it('pivot() accepts array OR string (back-compat)', () => {
    expect(affinityJs).toMatch(/pivot\(newFocalOrFocals\)/);
  });

  it('_writeRingsAndDim() accepts array AND computes intersection across all focals', () => {
    expect(affinityJs).toMatch(/_writeRingsAndDim\(focalOrFocals\)/);
    expect(affinityJs).toMatch(/extraFocals\.length > 0/);
    // Revised intersection logic uses perFocalLists + perFocalByName.
    expect(affinityJs).toMatch(/perFocalLists/);
    expect(affinityJs).toMatch(/perFocalByName/);
  });

  it('multi-focal cubes placed at their bucket wedge sector (no focal at wheel center)', () => {
    // User feedback (2026-05-30): never place a focal at the wheel
    // center; every focal sits in its bucket sector on the innermost
    // tier. resolveBucket + wedgeByKey lookup is the placement signal.
    expect(affinityJs).toMatch(/multi-focal re-placement/);
    // Use _resolveWedgeContext (same path the existing single-focal
    // block 1a-revised uses) — handles the 'cluster' axis correctly
    // (CATEGORICAL_AXES doesn't have 'cluster' so resolveBucket fails).
    expect(affinityJs).toMatch(/this\._resolveWedgeContext\(\[\{ name: fName \}\], axisKey\)/);
    expect(affinityJs).toMatch(/sharedLayout\?\.wedgeByKey\?\.get\(bucket\)/);
    // Angular position = wedge.midAngle + offset (fan within bucket).
    expect(affinityJs).toMatch(/focalRingRadius \* Math\.cos\(angle\)/);
    expect(affinityJs).toMatch(/focalRingRadius \* Math\.sin\(angle\)/);
    expect(affinityJs).toMatch(/wedge\.midAngle \+ offset/);
  });

  it('multi-focal: same-bucket focals fan angularly across the wedge span (no overlap)', () => {
    // The fan logic distributes cohort.length focals across the wedge
    // span centered on midAngle, so 2+ focals in the same cluster
    // don't visually overlap at the same angle.
    expect(affinityJs).toMatch(/focalsByBucket/);
    expect(affinityJs).toMatch(/cohort\.length === 1/);
    expect(affinityJs).toMatch(/fanRange/);
  });

  it('multi-focal: labels rendered for EVERY focal at its wedge position (not just primary)', () => {
    // _buildLabels iterates focalLabelEntries built from
    // _multiFocalWorldPositions when N > 1.
    expect(affinityJs).toMatch(/_multiFocalWorldPositions/);
    expect(affinityJs).toMatch(/focalLabelEntries/);
  });

  it('focalMesh.count is set to focals.length so unused slots are not drawn', () => {
    expect(affinityJs).toMatch(/this\.focalMesh\.count = Math\.max\(1, focals\.length\)/);
  });

  it('_currentFocals tracked alongside legacy _currentFocal', () => {
    expect(affinityJs).toMatch(/this\._currentFocals = focals/);
  });

  it('LivingArchView α-mode driver engages with the full selectedNodes array (multi-focal path)', () => {
    expect(lavJsx).toMatch(/ctrl\.engage\(focals\)/);
    expect(lavJsx).toMatch(/ctrl\.pivot\(focals\)/);
  });

  it('App.jsx double-click preserves existing multi-selection when name is already in it', () => {
    expect(appJsx).toMatch(/prev\.includes\(name\) \? prev : \[name\]/);
  });

  // ===== C4 — tap-on-non-focal-in-α-mode adds another focal =====

  it('C4: App.jsx single-click no longer force-resets affinityRequested unconditionally', () => {
    // V1 had `setAffinityRequested(false);` at the TOP of the single-
    // click branch — unconditional dismissal of α-mode on every click.
    // V2-C4 removed that so α-mode re-engages with the appended focal.
    // The C4 comment must still be present.
    const handlerStart = appJsx.indexOf('Single-click ALWAYS opens panel only');
    expect(handlerStart).toBe(-1); // V1 unconditional comment replaced
    expect(appJsx).toMatch(/C4[\s\S]{0,200}ADDS it as another focal/);
    // The unconditional reset (immediately after else {) must NOT be
    // there anymore. (A conditional reset inside the toggle-off-to-
    // empty path is fine and intentional per user-feedback fix.)
    const elseHead = appJsx.match(/\} else \{\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n/);
    expect(elseHead).not.toBeNull();
    const after = elseHead ? appJsx.slice(elseHead.index, elseHead.index + 400) : '';
    expect(after).not.toMatch(/^\s*setAffinityRequested\(false\)/m);
  });
});
