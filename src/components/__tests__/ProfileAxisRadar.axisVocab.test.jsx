// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ProfileAxisRadar from '../ProfileAxisRadar.jsx';
import { axisOrder } from '../../data/briscionePalette.js';

function buildNodes(ingredientList = ['tomato', 'basil']) {
  const nodes = new Map();
  for (const n of ingredientList) {
    nodes.set(n, {
      name: n,
      taste: 'umami sweet',
      gnnProbs: {
        odor_fruity: 0.4,
        odor_floral: 0.1,
        odor_green:  0.6,
        odor_woody:  0.2,
        odor_fatty:  0.3,
      },
      season: 'summer',
      cuisines: ['Italian'],
    });
  }
  return nodes;
}

describe('ProfileAxisRadar — chef-canonical axis vocab', () => {
  // AROMA-4 (interim display rule): the radar plots only the keys the recipe has a signal on, 3 to 8 aroma spokes and
  // 3 to 6 taste spokes, in the chef vocabulary's own order, instead of all 13 / 8 (most of them empty).
  it('aroma axis renders 3 to 8 labels, all from the chef-canonical 13, in vocab order', () => {
    const { container } = render(
      <ProfileAxisRadar ingredients={['tomato']} nodes={buildNodes()} axis="aroma" />,
    );
    const labels = Array.from(container.querySelectorAll('svg text'))
      .map(t => t.textContent.trim().toLowerCase());
    expect(labels.length).toBeGreaterThanOrEqual(3);
    expect(labels.length).toBeLessThanOrEqual(8);
    const order = axisOrder('aroma');
    for (const l of labels) expect(order).toContain(l);
    expect(labels).toEqual(order.filter((k) => labels.includes(k)));
  });

  it('taste axis renders 3 to 6 labels from the chef-canonical taste vocab', () => {
    const { container } = render(
      <ProfileAxisRadar ingredients={['tomato']} nodes={buildNodes()} axis="taste" />,
    );
    const labels = Array.from(container.querySelectorAll('svg text'))
      .map(t => t.textContent.trim().toLowerCase());
    expect(labels.length).toBeGreaterThanOrEqual(3);
    expect(labels.length).toBeLessThanOrEqual(6);
    for (const l of labels) expect(axisOrder('taste')).toContain(l);
  });

  it('aroma axis draws one spoke per label (never the full 13)', () => {
    const { container } = render(
      <ProfileAxisRadar ingredients={['tomato']} nodes={buildNodes()} axis="aroma" />,
    );
    const spokes = container.querySelectorAll('svg g line');
    expect(spokes.length).toBeGreaterThanOrEqual(3);
    expect(spokes.length).toBeLessThanOrEqual(8);
  });

  it('chef-only aromas (citrus/herbal/etc) have no data dot when only GNN signal is present', () => {
    const { container } = render(
      <ProfileAxisRadar ingredients={['tomato']} nodes={buildNodes()} axis="aroma" />,
    );
    // Data dots are circle elements drawn at each value>0 axis. With
    // only GNN signal (5 keys), at most 5 dots should appear despite
    // 13 axis labels existing.
    const dots = container.querySelectorAll('svg circle');
    expect(dots.length).toBeLessThanOrEqual(5);
  });
});
