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
    expect(lavJsx).toMatch(/for \(const edge of data\.graph\.edges\)[\s\S]{0,200}labelNames\.add/);
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
