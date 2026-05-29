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
  it('aroma axis renders all 13 chef-canonical labels (citrus/fruity/.../pungent)', () => {
    const { container } = render(
      <ProfileAxisRadar ingredients={['tomato']} nodes={buildNodes()} axis="aroma" />,
    );
    const labels = Array.from(container.querySelectorAll('svg text'))
      .map(t => t.textContent.trim().toLowerCase());
    for (const aroma of axisOrder('aroma')) {
      expect(labels).toContain(aroma);
    }
  });

  it('taste axis renders all 8 chef-canonical labels (sweet/sour/.../umami)', () => {
    const { container } = render(
      <ProfileAxisRadar ingredients={['tomato']} nodes={buildNodes()} axis="taste" />,
    );
    const labels = Array.from(container.querySelectorAll('svg text'))
      .map(t => t.textContent.trim().toLowerCase());
    for (const taste of axisOrder('taste')) {
      expect(labels).toContain(taste);
    }
  });

  it('aroma axis renders 13 spokes (not the legacy 6)', () => {
    const { container } = render(
      <ProfileAxisRadar ingredients={['tomato']} nodes={buildNodes()} axis="aroma" />,
    );
    const spokes = container.querySelectorAll('svg g line');
    expect(spokes.length).toBe(13);
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
