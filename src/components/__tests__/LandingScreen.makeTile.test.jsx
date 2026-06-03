// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LandingScreen from '../LandingScreen.jsx';

vi.mock('../AnimatedLogo.jsx', () => ({
  default: () => null,
}));

vi.mock('../../utils/native.js', () => ({
  hapticMedium: vi.fn(),
}));

describe('LandingScreen — MAKE-LANDING-TILE (3-tile row, post MAKE-BUILD-DEPRECATE)', () => {
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe() {} unobserve() {} disconnect() {}
      };
    }
  });

  // B-version P5 (2026-06-02): landing tile order is now Guided →
  // Make → Network per LANDING-CHALKBOARD spec. Old order was
  // pairing → guided → make; updated here to match.
  it('renders 3 tiles in order: guided, make, pairing', () => {
    render(<LandingScreen onModeSelect={vi.fn()} />);
    const tiles = screen.getAllByRole('button');
    expect(tiles.length).toBe(3);
    expect(tiles[0]).toHaveAttribute('data-mode', 'guided');
    expect(tiles[1]).toHaveAttribute('data-mode', 'make');
    expect(tiles[2]).toHaveAttribute('data-mode', 'pairing');
    expect(screen.queryByText('Build your Recipe')).toBeNull();
  });

  it('Make tile shows the spec-locked label + subheadline', () => {
    render(<LandingScreen onModeSelect={vi.fn()} />);
    expect(screen.getByText('Make a recipe')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Start a recipe from scratch, from a photo, or from a saved Cookbook recipe.',
      ),
    ).toBeInTheDocument();
  });

  it('clicking the Make tile fires onModeSelect("make")', () => {
    const onModeSelect = vi.fn();
    render(<LandingScreen onModeSelect={onModeSelect} />);
    fireEvent.click(screen.getByText('Make a recipe').closest('button'));
    expect(onModeSelect).toHaveBeenCalledTimes(1);
    expect(onModeSelect).toHaveBeenCalledWith('make');
  });

  it('Make tile aria-label includes both label and subheadline', () => {
    render(<LandingScreen onModeSelect={vi.fn()} />);
    const btn = screen.getByRole('button', {
      name: /Make a recipe.*Start a recipe from scratch, from a photo, or from a saved Cookbook recipe\./i,
    });
    expect(btn).toBeInTheDocument();
  });

  it('grid layout uses 3-column at sm+ breakpoint (1-col at mobile)', () => {
    const { container } = render(<LandingScreen onModeSelect={vi.fn()} />);
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid.className).toMatch(/grid-cols-1/);
    expect(grid.className).toMatch(/sm:grid-cols-3/);
  });
});
