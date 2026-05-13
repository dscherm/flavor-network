// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import RadialAffinityWheelGeometry, {
  computeWheelLayout,
} from '../RadialAffinityWheelGeometry.jsx';

const TAU = Math.PI * 2;

const FIVE_BUCKET_NEIGHBORS = [
  { name: 'a', strength: 0.9, bucketKey: 'Fruity' },
  { name: 'b', strength: 0.8, bucketKey: 'Floral' },
  { name: 'c', strength: 0.7, bucketKey: 'Green' },
  { name: 'd', strength: 0.6, bucketKey: 'Woody' },
  { name: 'e', strength: 0.5, bucketKey: 'Spicy' },
];

const BUCKET_COLORS = {
  Fruity: '#fb923c',
  Floral: '#f0abfc',
  Green: '#84cc16',
  Woody: '#a16207',
  Spicy: '#dc2626',
};

describe('computeWheelLayout — pure layout math', () => {
  it('with 5 buckets returns 5 wedges with summed span = 2π', () => {
    const layout = computeWheelLayout({
      focal: { name: 'tomato' },
      neighbors: FIVE_BUCKET_NEIGHBORS,
      axis: 'aroma',
      viewport: { width: 600, height: 600 },
      bucketColors: BUCKET_COLORS,
    });
    expect(layout.wedges).toHaveLength(5);
    const total = layout.wedges.reduce((s, w) => s + w.span, 0);
    expect(Math.abs(total - TAU)).toBeLessThan(1e-9);
  });

  it('deterministic placement — same inputs yield identical {x, y}', () => {
    const args = {
      focal: { name: 'tomato' },
      neighbors: FIVE_BUCKET_NEIGHBORS,
      axis: 'aroma',
      viewport: { width: 600, height: 600 },
      bucketColors: BUCKET_COLORS,
    };
    const a = computeWheelLayout(args);
    const b = computeWheelLayout(args);
    expect(a.dots.map((d) => [d.x, d.y])).toEqual(
      b.dots.map((d) => [d.x, d.y]),
    );
    // Snapshot the first dot's coords so a future regression in the
    // formula is caught even when the call sites still match.
    // Math: 5 buckets → span=2π/5; Fruity is i=0 → midAngle=-π/2+0.5*span;
    // M=1 in Fruity → angle=midAngle. r=(0.35+0.5*0.9)*radius
    // where radius=600*0.42=252. So r=0.8*252=201.6.
    const first = a.dots[0];
    expect(first.x).toBeCloseTo(118.50, 1);
    expect(first.y).toBeCloseTo(-163.10, 1);
  });

  it('viewport width 320 → fallback === true', () => {
    const layout = computeWheelLayout({
      focal: { name: 'tomato' },
      neighbors: FIVE_BUCKET_NEIGHBORS,
      viewport: { width: 320, height: 320 },
      bucketColors: BUCKET_COLORS,
    });
    expect(layout.fallback).toBe(true);
  });

  it('viewport width 600 → fallback === false', () => {
    const layout = computeWheelLayout({
      focal: { name: 'tomato' },
      neighbors: FIVE_BUCKET_NEIGHBORS,
      viewport: { width: 600, height: 600 },
      bucketColors: BUCKET_COLORS,
    });
    expect(layout.fallback).toBe(false);
  });

  it('dots fall within their bucket wedge angle range', () => {
    const layout = computeWheelLayout({
      focal: { name: 'tomato' },
      neighbors: FIVE_BUCKET_NEIGHBORS,
      viewport: { width: 600, height: 600 },
      bucketColors: BUCKET_COLORS,
    });
    for (const dot of layout.dots) {
      const wedge = layout.wedges.find((w) => w.key === dot.bucketKey);
      expect(wedge).toBeTruthy();
      const dotAngle = Math.atan2(dot.y, dot.x);
      const lo = wedge.midAngle - wedge.span / 2;
      const hi = wedge.midAngle + wedge.span / 2;
      // Normalize to the wedge's frame then assert it sits within span.
      const norm = ((dotAngle - lo) % TAU + TAU) % TAU;
      expect(norm).toBeLessThanOrEqual(wedge.span + 1e-9);
    }
  });
});

describe('Constraint #3 — RadialAffinityWheelGeometry imports policy', () => {
  it('imports ZERO modules from data/, hooks/, or IngredientPanel', () => {
    const file = path.resolve(
      __dirname,
      '..',
      'RadialAffinityWheelGeometry.jsx',
    );
    const src = fs.readFileSync(file, 'utf8');
    // Forbidden import-source patterns.
    const forbidden = [
      /from\s+['"][^'"]*\/data\//,
      /from\s+['"]\.\.\/data\//,
      /from\s+['"][^'"]*\/hooks\//,
      /from\s+['"]\.\.\/hooks\//,
      /from\s+['"][^'"]*IngredientPanel/,
    ];
    for (const re of forbidden) {
      expect(src).not.toMatch(re);
    }
  });

  it('top-of-file PURE LAYOUT comment exists', () => {
    const file = path.resolve(
      __dirname,
      '..',
      'RadialAffinityWheelGeometry.jsx',
    );
    const src = fs.readFileSync(file, 'utf8');
    expect(src).toMatch(/PURE LAYOUT/);
  });
});

describe('RadialAffinityWheelGeometry — render-props composition', () => {
  it('renders an <svg> with the four named layers when viewport is wide', () => {
    const { container } = render(
      <RadialAffinityWheelGeometry
        focal={{ name: 'tomato' }}
        neighbors={FIVE_BUCKET_NEIGHBORS}
        viewport={{ width: 600, height: 600 }}
        bucketColors={BUCKET_COLORS}
        renderWedge={(w, i) => <rect key={i} data-wedge={w.key} />}
        renderLabel={(l, i) => <text key={i} data-label={l.key}>{l.label}</text>}
        renderDot={(d, i) => <circle key={i} data-dot={d.neighbor.name} />}
        renderFocal={() => <circle data-role="focal" />}
      />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('[data-layer="wedges"]')).toBeTruthy();
    expect(container.querySelector('[data-layer="labels"]')).toBeTruthy();
    expect(container.querySelector('[data-layer="dots"]')).toBeTruthy();
    expect(container.querySelector('[data-layer="focal"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-dot]')).toHaveLength(5);
  });

  it('renders the ListFallback under viewport.width=320', () => {
    const { container } = render(
      <RadialAffinityWheelGeometry
        focal={{ name: 'tomato' }}
        neighbors={FIVE_BUCKET_NEIGHBORS}
        viewport={{ width: 320, height: 320 }}
        bucketColors={BUCKET_COLORS}
        renderWedge={() => null}
        renderLabel={() => null}
        renderDot={() => null}
        renderFocal={() => null}
      />,
    );
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('ul')).toBeTruthy();
  });
});
