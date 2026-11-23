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

describe('LandingScreen — the labs under the logo (2026-11-07)', () => {
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe() {} unobserve() {} disconnect() {}
      };
    }
  });

  it('shows one tile per lab, Recipe Lab first; no Make or "The Labs" tile', () => {
    render(<LandingScreen onModeSelect={vi.fn()} />);
    const modes = screen.getAllByRole('button').map((b) => b.getAttribute('data-mode'));
    expect(modes).toEqual(['make', 'cocktail', 'sauce', 'wine', 'cookbook', 'pairing']);
    expect(screen.getByText('Recipe Lab')).toBeInTheDocument();
    expect(screen.queryByText('Make a recipe')).toBeNull();
    expect(screen.queryByText('The Labs')).toBeNull();
  });

  it('every tile has a chalk drawing and a label + subheadline aria-label', () => {
    render(<LandingScreen onModeSelect={vi.fn()} />);
    for (const btn of screen.getAllByRole('button')) {
      expect(btn.querySelector('svg')).toBeTruthy();
      expect(btn.getAttribute('aria-label')).toMatch(/\. \S/);
    }
  });

  it('clicking a tile opens that lab', () => {
    const onModeSelect = vi.fn();
    render(<LandingScreen onModeSelect={onModeSelect} />);
    fireEvent.click(screen.getByTestId('landing-tile-make'));
    fireEvent.click(screen.getByTestId('landing-tile-wine'));
    expect(onModeSelect.mock.calls.map((c) => c[0])).toEqual(['make', 'wine']);
  });

  it('the labs are one written list on phones, two columns of three on wider screens (LOOK-5)', () => {
    render(<LandingScreen onModeSelect={vi.fn()} />);
    const board = screen.getByRole('list', { name: 'The labs' });
    expect(board.querySelectorAll(':scope > li')).toHaveLength(6);
    expect(board.className).toMatch(/md:grid-cols-2/);
    expect(board.className).toMatch(/md:grid-rows-3/);
    expect(board.className).toMatch(/md:grid-flow-col/);
  });
});
