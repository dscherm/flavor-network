// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import FullWheel, { TIER_ALPHA } from '../FullWheel.jsx';

const T = { star3: 0.9, star2: 0.6, star1: 0.3 };

function buildFixtureCtx() {
  const focal = 'tomato';
  // 6 neighbors so topAffinities's default 5/10/15 ring split produces
  // a mix of ringIdx 3 (top 5) + ringIdx 2 (next 10).
  const neighbors = ['basil', 'olive oil', 'garlic', 'parmesan', 'oregano', 'pasta'];
  const strengths = {
    'tomato|basil':     0.95,
    'tomato|olive oil': 0.92,
    'tomato|garlic':    0.90,
    'tomato|parmesan':  0.88,
    'tomato|oregano':   0.85,
    'tomato|pasta':     0.65,
  };
  const top5 = {
    tomato:      ['limonene', 'pinene', 'methyl-pyrazine', 'a', 'b'],
    basil:       ['limonene', 'eugenol', 'a', 'b', 'c'],
    'olive oil': ['nonenal', 'pinene', 'a', 'b', 'c'],
    garlic:      ['allicin', 'methyl-pyrazine', 'a', 'b', 'c'],
    parmesan:    ['butyric', 'methional', 'a', 'b', 'c'],
    oregano:     ['carvacrol', 'thymol', 'a', 'b', 'c'],
    pasta:       ['glutamate', 'a', 'b', 'c', 'd'],
  };
  const pairingStrength = new Map();
  for (const [k, v] of Object.entries(strengths)) {
    pairingStrength.set(k, v);
    const [a, b] = k.split('|');
    pairingStrength.set(`${b}|${a}`, v);
  }
  const top5Map = new Map(Object.entries(top5));
  const edges = neighbors.map((n) => ({ source: focal, target: n }));
  const nodes = new Map();
  for (const name of [focal, ...neighbors]) {
    nodes.set(name, { name, taste: 'umami', category: 'Vegetable' });
  }
  return {
    pairingStrength,
    top5: top5Map,
    bridgeCompoundIndex: new Map(),
    affinityThresholds: T,
    graph: { edges, nodes },
  };
}

describe('FullWheel', () => {
  it('mounts with a fixture and renders all neighbors', () => {
    const ctx = buildFixtureCtx();
    const focal = { name: 'tomato' };
    const { container } = render(
      <FullWheel focal={focal} ctx={ctx} axis="taste" viewport={{ width: 600, height: 600 }} />,
    );
    const dots = container.querySelectorAll('[data-layer="dots"] [data-name]');
    // 6 fixture neighbors all sharing the 'umami' taste bucket → they
    // all resolve to the Umami wedge and render as dots.
    expect(dots.length).toBe(6);
  });

  it('tier coloring applies the configured TIER_ALPHA to fillOpacity', () => {
    const ctx = buildFixtureCtx();
    const focal = { name: 'tomato' };
    const { container } = render(
      <FullWheel focal={focal} ctx={ctx} axis="taste" viewport={{ width: 600, height: 600 }} />,
    );
    const dotGroups = container.querySelectorAll('[data-layer="dots"] [data-name]');
    let saw3 = false;
    let saw2 = false;
    for (const g of dotGroups) {
      const tier = Number(g.getAttribute('data-tier'));
      const circle = g.querySelector('circle');
      const opacity = parseFloat(circle.getAttribute('fill-opacity'));
      expect(opacity).toBeCloseTo(TIER_ALPHA[tier], 5);
      if (tier === 3) saw3 = true;
      if (tier === 2) saw2 = true;
    }
    expect(saw3).toBe(true);
    expect(saw2).toBe(true);
  });

  it('onIngredientClick fires with the neighbor name on click', () => {
    const ctx = buildFixtureCtx();
    const focal = { name: 'tomato' };
    const onIngredientClick = vi.fn();
    const { container } = render(
      <FullWheel
        focal={focal}
        ctx={ctx}
        axis="taste"
        viewport={{ width: 600, height: 600 }}
        onIngredientClick={onIngredientClick}
      />,
    );
    const dotGroups = container.querySelectorAll('[data-layer="dots"] [data-name]');
    expect(dotGroups.length).toBeGreaterThan(0);
    const firstName = dotGroups[0].getAttribute('data-name');
    fireEvent.click(dotGroups[0]);
    expect(onIngredientClick).toHaveBeenCalledWith(firstName);
  });

  it('renders no story-headline labels (story is curated-only)', () => {
    const ctx = buildFixtureCtx();
    const focal = { name: 'tomato' };
    const { container } = render(
      <FullWheel focal={focal} ctx={ctx} axis="taste" viewport={{ width: 600, height: 600 }} />,
    );
    const headlines = container.querySelectorAll('[data-role="story-headline"]');
    expect(headlines).toHaveLength(0);
  });
});
