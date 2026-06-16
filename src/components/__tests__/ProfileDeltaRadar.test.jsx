import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ProfileDeltaRadar from '../ProfileDeltaRadar.jsx';
import { AXES } from '../../data/recipeProfileAnalysis.js';

const z = () => Object.fromEntries(AXES.map((a) => [a, 0]));
const vec = (o) => ({ ...z(), ...o });

describe('ProfileDeltaRadar', () => {
  it('renders two polygons (before + after) and mover dots for a non-null delta', () => {
    const before = vec({ sweet: 0.4, sour: 0.1 });
    const delta = { ...z(), sweet: 0.2, green: 0 };
    const movers = [{ axis: 'sweet', delta: 0.2 }];
    const { container } = render(
      <ProfileDeltaRadar before={before} delta={delta} movers={movers} size={120} />,
    );
    // before (faint fill) + after (accent outline) = 2 polygons
    const polygons = container.querySelectorAll('polygon');
    expect(polygons.length).toBe(2);
    // one mover dot for sweet
    const dots = container.querySelectorAll('circle');
    // the grid ring is a <circle>; mover dots are also <circle>. With one
    // mover there should be the ring + exactly one mover dot = 2.
    expect(dots.length).toBe(2);
  });

  it('still renders the before polygon when delta is null', () => {
    const before = vec({ bitter: 0.3 });
    const { container } = render(<ProfileDeltaRadar before={before} delta={null} size={120} />);
    // before + after(=before, since delta null) → still two polygons, no mover dots
    expect(container.querySelectorAll('polygon').length).toBe(2);
    // only the grid ring circle, no mover dots
    expect(container.querySelectorAll('circle').length).toBe(1);
  });
});
