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

describe('LandingScreen — MAKE-LANDING-TILE (4-tile row)', () => {
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe() {} unobserve() {} disconnect() {}
      };
    }
  });

  it('renders 4 tiles in order: pairing, guided, make, build', () => {
    render(<LandingScreen onModeSelect={vi.fn()} />);
    const tiles = screen.getAllByRole('button');
    expect(tiles.length).toBe(4);
    expect(tiles[0]).toHaveAttribute('data-mode', 'pairing');
    expect(tiles[1]).toHaveAttribute('data-mode', 'guided');
    expect(tiles[2]).toHaveAttribute('data-mode', 'make');
    expect(tiles[3]).toHaveAttribute('data-mode', 'build');
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

  it('grid layout uses 4-column at lg breakpoint (sm: 2-col fallback)', () => {
    const { container } = render(<LandingScreen onModeSelect={vi.fn()} />);
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid.className).toMatch(/lg:grid-cols-4/);
    expect(grid.className).toMatch(/sm:grid-cols-2/);
  });
});
