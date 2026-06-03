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

  // B-version P3 (2026-06-02): α-mode entry from Network is REMOVED.
  // Single-tap on a Network node now opens PairingMode (the Tinder-
  // swipe browser). The legacy double-click → α-mode branch is gone.
  it('App.jsx single-tap opens PairingMode (replaces double-click→α-mode entry)', () => {
    expect(appJsx).toMatch(/setPairingModeFocal\(name\)/);
    expect(appJsx).not.toMatch(/prev\.includes\(name\) \? prev : \[name\]/);
  });

  // ===== C4 — tap-on-non-focal-in-α-mode adds another focal =====

  it('Search-select flies camera to picked ingredient (2026-05-31 UX fix)', () => {
    // handleSearchSelect must call setFlyToTarget with the
    // ingredient's position so picking from the search bar moves the
    // camera to the result (previously: search just selected without
    // a visual cue).
    const handlerStart = appJsx.indexOf('handleSearchSelect = useCallback');
    expect(handlerStart).not.toBe(-1);
    const handlerSlice = appJsx.slice(handlerStart, handlerStart + 800);
    expect(handlerSlice).toMatch(/setFlyToTarget\(\{ position: pos, ts: Date\.now\(\) \}\)/);
    expect(handlerSlice).toMatch(/dataRef\.current\?\.positions\?\.positions/);
  });

  // B-version P3 (2026-06-02): legacy V1/V2/C4 single-click branch
  // semantics are gone. The Network click handler no longer manages
  // α-mode entry at all; it sets pairingModeFocal and returns.
  // sceneHandle.engageAffinity (used by Guided Discovery Step 2)
  // still uses setAffinityRequested, so that setter remains in the
  // file — we just verify it's no longer reached from a user tap.
  it('B-version: Network click handler no longer touches affinityRequested', () => {
    // PairingMode focal setter is the ONLY thing the click handler
    // does on a node tap.
    expect(appJsx).toMatch(/setPairingModeFocal\(name\)/);
    // Long-press also routes to PairingMode (was setAffinityRequested).
    expect(appJsx).toMatch(/handleNodeLongPress[\s\S]{0,200}setPairingModeFocal/);
    // sceneHandle.engageAffinity keeps its α-mode setter for the
    // Guided Discovery Step 2 tour entry path.
    expect(appJsx).toMatch(/engageAffinity\(name\)[\s\S]{0,200}setAffinityRequested\(true\)/);
  });
});

describe('α-EXIT-FULL-RESET (2026-05-31) — ESC from α-mode does a full reset', () => {
  it('ESC handler calls handleClearSelection() instead of just setAffinityRequested(false)', () => {
    // The α-mode ESC branch must full-reset to the default Network
    // state, not leave the user in V1 intersection-isolate. Anchor on
    // the keydown-handler-specific comment so we don't match the
    // doc-level ESC listener that fires only on focusedCluster.
    const anchor = appJsx.indexOf('ESC from α-mode does a full reset');
    expect(anchor).not.toBe(-1);
    const slice = appJsx.slice(anchor, anchor + 800);
    expect(slice).toMatch(/if \(affinityRequested\)/);
    expect(slice).toMatch(/handleClearSelection\(\)/);
  });

  it('handleClearSelection resets particlesOverride to false', () => {
    const handlerStart = appJsx.indexOf('handleClearSelection = useCallback');
    expect(handlerStart).not.toBe(-1);
    const handlerSlice = appJsx.slice(handlerStart, handlerStart + 1200);
    expect(handlerSlice).toMatch(/setParticlesOverride\(false\)/);
  });

  it('empty-space click also resets particlesOverride to false', () => {
    // The !node branch should land at the same default as
    // handleClearSelection so background-tap + Clear button feel
    // identical. Anchor on the V2 comment that precedes the relevant
    // block — there are multiple `if (!node)` occurrences in the file
    // (the cluster-focus exit and a guard return).
    const anchor = appJsx.indexOf('NETWORK-CLICK-POLISH-V2: empty-space click');
    expect(anchor).not.toBe(-1);
    const slice = appJsx.slice(anchor, anchor + 1000);
    expect(slice).toMatch(/setParticlesOverride\(false\)/);
  });
});

describe('NONE-PILL-PARTICLES-OVERRIDE (2026-05-31)', () => {
  it('App.jsx defines particlesOverride state', () => {
    expect(appJsx).toMatch(/const \[particlesOverride, setParticlesOverride\] = useState\(false\)/);
  });

  it('App.jsx defines toggleNoneOverride callback that flips particlesOverride', () => {
    expect(appJsx).toMatch(/toggleNoneOverride[\s\S]{0,200}setParticlesOverride\(\(p\) => !p\)/);
  });

  it('FilterPillRow None pill is wired to onToggleNone (not onClear)', () => {
    const filterPillRow = readFileSync(
      resolve(__dirname, '../components/FilterPillRow.jsx'),
      'utf8',
    );
    // The None button onClick must call onToggleNone, not onClear.
    const noneBlock = filterPillRow.match(/"None" pill[\s\S]{0,800}>\s*None\s*</);
    expect(noneBlock).not.toBeNull();
    expect(noneBlock[0]).toMatch(/onToggleNone\?\.\(\)/);
    expect(noneBlock[0]).not.toMatch(/onClear\?\.\(\)/);
  });

  it('FilterPillRow None pill active state binds to particlesOverride', () => {
    const filterPillRow = readFileSync(
      resolve(__dirname, '../components/FilterPillRow.jsx'),
      'utf8',
    );
    // isNoneActive used to be `filterStack.length === 0`; now it
    // tracks particlesOverride so the pill highlight reflects the
    // particle-toggle state.
    expect(filterPillRow).toMatch(/const isNoneActive = particlesOverride/);
  });

  it('LivingArchView R17 effect ORs particlesOverride into particle visibility', () => {
    // The rule changed from `!filterActive && showParticles` to
    // `(particlesOverride || !filterActive) && showParticles` so a
    // filter-active state can still surface particles via "None".
    expect(lavJsx).toMatch(/particlesOverride \|\| !filterActive/);
  });

  it('LivingArchView R17 effect adds particlesOverride to deps', () => {
    // Effect deps must include particlesOverride so toggling it
    // re-runs the visibility rule. Without this dep, "None" wouldn't
    // do anything until another effect (like a filter toggle)
    // triggered the R17 re-fire.
    expect(lavJsx).toMatch(/\[filterStack, morphAxis, mode, showEdges, showParticles, particlesOverride\]/);
  });
});
