import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BridgePulseOverlay from '../BridgePulseOverlay.jsx';

const SAMPLE_BRIDGES = [
  { name: 'lemon', x: 100, y: 200, color: '#ffaa00' },
  { name: 'basil', x: 300, y: 400, color: '#22c55e' },
  { name: 'mint',  x: 500, y: 600 },
];

describe('BridgePulseOverlay', () => {
  it('renders nothing when pulse is null', () => {
    const { container } = render(<BridgePulseOverlay pulse={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the bridges array is empty', () => {
    const { container } = render(<BridgePulseOverlay pulse={{ bridges: [], ts: 1 }} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one ring per bridge entry on the first synchronous frame', () => {
    render(<BridgePulseOverlay pulse={{ bridges: SAMPLE_BRIDGES, ts: 1 }} />);
    expect(screen.getAllByTestId('bridge-pulse-ring')).toHaveLength(SAMPLE_BRIDGES.length);
    expect(screen.getByTestId('bridge-pulse-overlay')).toHaveAttribute('aria-hidden', 'true');
  });

  it('positions each ring at its (x, y) with a radius-centered offset', () => {
    render(<BridgePulseOverlay pulse={{ bridges: [SAMPLE_BRIDGES[0]], ts: 2 }} />);
    const ring = screen.getByTestId('bridge-pulse-ring');
    const width = parseFloat(ring.style.width);
    const height = parseFloat(ring.style.height);
    expect(width).toBeGreaterThan(0);
    expect(height).toBe(width); // rings are circles
    const left = parseFloat(ring.style.left);
    const top = parseFloat(ring.style.top);
    // x,y are centers; left = x - radius, top = y - radius
    expect(left + width / 2).toBeCloseTo(100, 1);
    expect(top + height / 2).toBeCloseTo(200, 1);
  });

  it('falls back to the cyan default color when none is supplied on a bridge', () => {
    render(<BridgePulseOverlay pulse={{ bridges: [{ name: 'mint', x: 1, y: 2 }], ts: 3 }} />);
    const ring = screen.getByTestId('bridge-pulse-ring');
    // borderColor is set via inline style; default sits in the rgb form
    // that browsers/jsdom normalize from #7dd3fc.
    expect(ring.style.borderColor.replace(/\s/g, '').toLowerCase()).toMatch(
      /^(#7dd3fc|rgb\(125,211,252\))$/,
    );
  });
});
