import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FilterPullSlider, { pullLabel } from '../FilterPullSlider.jsx';

describe('pullLabel', () => {
  it('snaps 0.0 to the leftmost anchor', () => {
    expect(pullLabel(0.0)).toBe('Pairings only');
  });

  it('snaps 0.12 to the leftmost anchor (still closer to 0 than 0.25)', () => {
    expect(pullLabel(0.12)).toBe('Pairings only');
  });

  it('snaps 0.24 to the second anchor (closer to 0.25 than 0)', () => {
    expect(pullLabel(0.24)).toBe('Pairings, gently grouped');
  });

  it('returns "Balanced" at exactly 0.5', () => {
    expect(pullLabel(0.5)).toBe('Balanced');
  });

  it('snaps 0.74 to the fourth anchor (closer to 0.75 than 0.5)', () => {
    expect(pullLabel(0.74)).toBe('Buckets, gently bridged');
  });

  it('snaps 1.0 to the rightmost anchor', () => {
    expect(pullLabel(1.0)).toBe('Buckets only');
  });

  it('falls back to the leftmost anchor on a non-numeric input', () => {
    expect(pullLabel(undefined)).toBe('Pairings only');
    expect(pullLabel(null)).toBe('Pairings only');
  });
});

describe('FilterPullSlider render', () => {
  it('renders the thumb label above the slider when enabled', () => {
    render(<FilterPullSlider pullStrength={0.5} onPullChange={vi.fn()} disabled={false} />);
    const lbl = screen.getByTestId('pull-thumb-label');
    expect(lbl).toHaveTextContent('Balanced');
    expect(lbl.getAttribute('aria-hidden')).toBe('true');
  });

  it('hides the thumb label when disabled', () => {
    render(<FilterPullSlider pullStrength={0.5} onPullChange={vi.fn()} disabled />);
    expect(screen.queryByTestId('pull-thumb-label')).toBeNull();
  });

  it('updates the slider aria-valuetext to include the anchor label', () => {
    render(<FilterPullSlider pullStrength={0.75} onPullChange={vi.fn()} />);
    const input = screen.getByRole('slider');
    expect(input).toHaveAttribute('aria-valuetext', '75 percent — Buckets, gently bridged');
  });

  it('positions the label at the thumb percentage via inline left style', () => {
    render(<FilterPullSlider pullStrength={0.25} onPullChange={vi.fn()} />);
    const lbl = screen.getByTestId('pull-thumb-label');
    expect(lbl.style.left).toBe('25%');
    expect(lbl).toHaveTextContent('Pairings, gently grouped');
  });
});
