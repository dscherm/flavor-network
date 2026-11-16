import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FlavorGrid from '../FlavorGrid.jsx';
import { flavorGrid } from '../../data/flavorCharts.js';
import { AXES } from '../../data/flavorDisplay.js';

const cells = (c) => [...c.querySelectorAll('[data-testid="flavor-grid-cell"]')];

describe('FlavorGrid', () => {
  it('draws seventeen cells in the fixed order for two different profiles', () => {
    const one = flavorGrid([{ axis: 'sweet', score: 0.6 }, { axis: 'odor_fruity', score: 0.3 }]);
    const two = flavorGrid([{ axis: 'umami', score: 0.4 }]);
    const a = render(<FlavorGrid grid={one} />);
    const b = render(<FlavorGrid grid={two} />);
    expect(cells(a.container).map((c) => c.dataset.axis)).toEqual(AXES);
    expect(cells(b.container).map((c) => c.dataset.axis)).toEqual(AXES);
  });

  it('draws a filled dot for a note that is on and an empty ring for one that is absent', () => {
    const { container } = render(<FlavorGrid grid={flavorGrid([{ axis: 'sweet', score: 0.6 }])} />);
    const sweet = container.querySelector('[data-axis="sweet"]');
    const sour = container.querySelector('[data-axis="sour"]');
    expect(sweet.dataset.on).toBe('true');
    expect(sweet.querySelector('circle').getAttribute('fill')).not.toBe('none');
    expect(sour.dataset.on).toBe('false');
    expect(sour.querySelector('circle').getAttribute('fill')).toBe('none');
  });

  it('renders marks with a direction a reader can tell without colour (caret shape), and none elsewhere', () => {
    const { container } = render(<FlavorGrid grid={flavorGrid([{ axis: 'sweet', score: 0.6 }])} marks={{ sweet: 'up', sour: 'down' }} />);
    expect(container.querySelector('[data-axis="sweet"]').dataset.mark).toBe('up');
    expect(container.querySelector('[data-axis="sour"]').dataset.mark).toBe('down');
    expect(container.querySelector('[data-axis="bitter"]').dataset.mark).toBe('');
    expect(container.querySelectorAll('[data-mark="up"] polygon, [data-mark="down"] polygon')).toHaveLength(2);
    expect(container.querySelector('[data-axis="sweet"] polygon').getAttribute('points'))
      .not.toBe(container.querySelector('[data-axis="sour"] polygon').getAttribute('points'));
  });

  it('shows headings, and labels for all cells (absent dimmed) with showLabels, none by default', () => {
    const grid = flavorGrid([{ axis: 'sweet', score: 0.6 }]);
    const off = render(<FlavorGrid grid={grid} />);
    expect(off.container.querySelectorAll('[data-testid="flavor-grid-label"]')).toHaveLength(0);
    expect(screen.getAllByText('Taste').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Aroma').length).toBeGreaterThan(0);
    const on = render(<FlavorGrid grid={grid} showLabels />);
    const labels = on.container.querySelectorAll('[data-testid="flavor-grid-label"]');
    expect(labels).toHaveLength(17);
    expect(labels[0].style.opacity).toBe('1');
    expect(labels[1].style.opacity).toBe('0.55');
  });

  it('labels only the listed axes when given a set', () => {
    const { container } = render(<FlavorGrid grid={flavorGrid([{ axis: 'sweet', score: 0.6 }])} showLabels={new Set(['sweet'])} />);
    expect(container.querySelectorAll('[data-testid="flavor-grid-label"]')).toHaveLength(1);
  });

  it('a faint present note is still a clear dot: bigger than an empty ring, smaller than a strong dot', () => {
    const grid = flavorGrid([{ axis: 'sweet', score: 1 }, { axis: 'sour', score: 0.06 }], { scale: 1 });
    const { container } = render(<FlavorGrid grid={grid} />);
    const r = (axis) => Number(container.querySelector(`[data-axis="${axis}"] circle`).getAttribute('r'));
    expect(r('sour')).toBeGreaterThanOrEqual(4.5);
    expect(r('sour')).toBeGreaterThan(r('bitter'));
    expect(r('sour')).toBeLessThan(r('sweet'));
  });

  it('the caret is large enough to read without the ring (at least 10 units tall in the 28-unit cell)', () => {
    const { container } = render(<FlavorGrid grid={flavorGrid([{ axis: 'sweet', score: 0.6 }])} marks={{ sweet: 'up' }} />);
    const pts = container.querySelector('[data-axis="sweet"] polygon').getAttribute('points').split(' ').map((p) => p.split(',').map(Number));
    const ys = pts.map((p) => p[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(10);
  });
});
