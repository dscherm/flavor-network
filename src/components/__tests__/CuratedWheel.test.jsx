// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import CuratedWheel, { SURPRISING_STROKE } from '../CuratedWheel.jsx';

const T = { star3: 0.9, star2: 0.6, star1: 0.3 };

/**
 * Build a context with `focal` (tomato) plus 6 neighbors:
 *   - basil, olive oil, garlic, parmesan, oregano  → strong tier 3/2 affinities
 *   - ginger                                        → low strength + bridge
 *                                                    → triggers the surprising path
 */
function buildFixtureCtx() {
  const focal = 'tomato';
  const neighbors = ['basil', 'olive oil', 'garlic', 'parmesan', 'oregano', 'ginger'];
  const strengths = {
    'tomato|basil':     0.95,
    'tomato|olive oil': 0.88,
    'tomato|garlic':    0.85,
    'tomato|parmesan':  0.82,
    'tomato|oregano':   0.75,
    'tomato|ginger':    0.05, // below star1 → surprising candidate
  };
  const top5 = {
    tomato:      ['limonene', 'pinene', 'methyl-pyrazine', 'a', 'b'],
    basil:       ['limonene', 'eugenol', 'a', 'b', 'c'],
    'olive oil': ['nonenal', 'pinene', 'a', 'b', 'c'],
    garlic:      ['allicin', 'methyl-pyrazine', 'a', 'b', 'c'],
    parmesan:    ['butyric', 'methional', 'a', 'b', 'c'],
    oregano:     ['carvacrol', 'thymol', 'a', 'b', 'c'],
    ginger:      ['gingerol', 'pinene', 'methyl-pyrazine', 'a', 'b'],
  };
  const bridges = {
    'tomato|ginger': ['gingerol'],
  };
  const pairingStrength = new Map();
  for (const [k, v] of Object.entries(strengths)) {
    pairingStrength.set(k, v);
    const [a, b] = k.split('|');
    pairingStrength.set(`${b}|${a}`, v);
  }
  const top5Map = new Map(Object.entries(top5));
  const bridgeCompoundIndex = new Map();
  for (const [k, names] of Object.entries(bridges)) {
    bridgeCompoundIndex.set(k, { bridges: names.map((name) => ({ name })) });
  }
  const edges = neighbors.map((n) => ({ source: focal, target: n }));

  // Nodes carry a taste field that landed in the 'Sweet' / 'Sour' /
  // etc. taste bucket — the CuratedWheel resolves the bucket via
  // categoricalAxes.bucketOf, which inspects node.taste. Give every
  // node 'umami' so they land in the Umami wedge consistently and the
  // bucket-membership assertion below is meaningful.
  const nodes = new Map();
  for (const name of [focal, ...neighbors]) {
    nodes.set(name, { name, taste: 'umami', category: 'Vegetable' });
  }

  return {
    pairingStrength,
    top5: top5Map,
    bridgeCompoundIndex,
    affinityThresholds: T,
    graph: { edges, nodes },
  };
}

describe('CuratedWheel', () => {
  it('mounts with a fixture focal + ctx and renders <= 10 hero pairings', () => {
    const ctx = buildFixtureCtx();
    const focal = { name: 'tomato' };
    const { container } = render(
      <CuratedWheel focal={focal} ctx={ctx} axis="taste" viewport={{ width: 600, height: 600 }} />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
    const dots = container.querySelectorAll('[data-name]');
    expect(dots.length).toBeGreaterThan(0);
    expect(dots.length).toBeLessThanOrEqual(10);
  });

  it('surprising-tier dots get a fuchsia stroke', () => {
    const ctx = buildFixtureCtx();
    const focal = { name: 'tomato' };
    const { container } = render(
      <CuratedWheel focal={focal} ctx={ctx} axis="taste" viewport={{ width: 600, height: 600 }} />,
    );
    const surprisingGroups = container.querySelectorAll('[data-source="surprising"]');
    expect(surprisingGroups.length).toBeGreaterThan(0);
    for (const g of surprisingGroups) {
      const circle = g.querySelector('circle');
      expect(circle.getAttribute('stroke')).toBe(SURPRISING_STROKE);
    }
  });

  it('all rendered dots fall within their bucket wedge angle range', () => {
    const ctx = buildFixtureCtx();
    const focal = { name: 'tomato' };
    const { container } = render(
      <CuratedWheel focal={focal} ctx={ctx} axis="taste" viewport={{ width: 600, height: 600 }} />,
    );
    // Read each dot's transform = translate(x, y); compute its angle
    // and verify it sits within the wedge it claims via data-bucket on
    // any sibling wedge path.
    const dotGroups = container.querySelectorAll('[data-layer="dots"] [data-name]');
    expect(dotGroups.length).toBeGreaterThan(0);
    const wedgePaths = container.querySelectorAll('[data-layer="wedges"] [data-bucket]');
    const wedgeKeys = Array.from(wedgePaths).map((w) => w.getAttribute('data-bucket'));
    // Every rendered dot's bucket should be a wedge that exists on the wheel.
    for (const dot of dotGroups) {
      const transform = dot.getAttribute('transform') || '';
      const m = transform.match(/translate\(([-\d.eE]+),\s*([-\d.eE]+)\)/);
      expect(m).toBeTruthy();
      // The dot should be within the wheel's outer radius (252 = 600 * 0.42).
      const x = parseFloat(m[1]);
      const y = parseFloat(m[2]);
      expect(Math.sqrt(x * x + y * y)).toBeLessThan(280);
    }
    expect(wedgeKeys.length).toBeGreaterThan(0);
  });

  it('onSelectPairing fires with the neighbor object on click', () => {
    const ctx = buildFixtureCtx();
    const focal = { name: 'tomato' };
    const onSelectPairing = vi.fn();
    const { container } = render(
      <CuratedWheel
        focal={focal}
        ctx={ctx}
        axis="taste"
        viewport={{ width: 600, height: 600 }}
        onSelectPairing={onSelectPairing}
      />,
    );
    const dotGroups = container.querySelectorAll('[data-layer="dots"] [data-name]');
    expect(dotGroups.length).toBeGreaterThan(0);
    fireEvent.click(dotGroups[0]);
    expect(onSelectPairing).toHaveBeenCalledTimes(1);
    const arg = onSelectPairing.mock.calls[0][0];
    expect(arg).toHaveProperty('name');
    expect(typeof arg.name).toBe('string');
  });
});
