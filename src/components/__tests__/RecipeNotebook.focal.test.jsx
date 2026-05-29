// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import RecipeNotebook from '../RecipeNotebook.jsx';
import { bowlFromIngredients } from '../../data/bowlEntry.js';

vi.mock('../../data/graph.js', () => ({
  getNeighborsEnriched: () => [],
}));

vi.mock('../../data/tastePositioning.js', () => ({
  scoreIngredient: () => ({ channels: {} }),
}));

vi.mock('../../utils/color.js', () => ({
  TASTE_COLORS: { default: '#888888', umami: '#888888' },
}));

const NODES = new Map([
  ['tomato', { taste: 'umami' }],
  ['basil', { taste: 'umami' }],
]);

function mount(props = {}) {
  const onSetFocal = vi.fn();
  const utils = render(
    <RecipeNotebook
      bowl={bowlFromIngredients(['tomato', 'basil'])}
      centerIngredient="tomato"
      nodes={NODES}
      edges={[]}
      onRemove={() => {}}
      onRecenter={() => {}}
      onAmountChange={() => {}}
      onFocusIngredient={() => {}}
      onRequestAdd={() => {}}
      onRequestSuggestions={() => {}}
      recipeTitle="Test"
      onTitleChange={() => {}}
      compatibility={null}
      onSetFocal={onSetFocal}
      focalKey={null}
      {...props}
    />,
  );
  return { ...utils, onSetFocal };
}

describe('RecipeNotebook — RL-FOCAL-FLAG (§13.3 focal popover + badge)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe() {} unobserve() {} disconnect() {}
      };
    }
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('right-click on a row opens the focal popover with "Set as focal"', () => {
    mount();
    fireEvent.contextMenu(screen.getByTestId('notebook-row-tomato'));
    const menu = screen.getByTestId('focal-menu-tomato');
    expect(menu).toBeInTheDocument();
    expect(screen.getByTestId('focal-menu-toggle-tomato').textContent.trim()).toBe('Set as focal');
  });

  it('right-click on the already-focal row shows "Clear focal"', () => {
    mount({ focalKey: 'tomato' });
    fireEvent.contextMenu(screen.getByTestId('notebook-row-tomato'));
    expect(screen.getByTestId('focal-menu-toggle-tomato').textContent.trim()).toBe('Clear focal');
  });

  it('clicking "Set as focal" fires onSetFocal(name) and closes the popover', () => {
    const { onSetFocal } = mount();
    fireEvent.contextMenu(screen.getByTestId('notebook-row-tomato'));
    fireEvent.click(screen.getByTestId('focal-menu-toggle-tomato'));
    expect(onSetFocal).toHaveBeenCalledWith('tomato');
    expect(screen.queryByTestId('focal-menu-tomato')).toBeNull();
  });

  it('tap-and-hold (500ms touch) opens the popover', () => {
    mount();
    const row = screen.getByTestId('notebook-row-tomato');
    fireEvent.touchStart(row, { touches: [{ clientX: 50, clientY: 100 }] });
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByTestId('focal-menu-tomato')).toBeInTheDocument();
  });

  it('tap shorter than 500ms does NOT open the popover', () => {
    mount();
    const row = screen.getByTestId('notebook-row-tomato');
    fireEvent.touchStart(row, { touches: [{ clientX: 50, clientY: 100 }] });
    act(() => { vi.advanceTimersByTime(250); });
    fireEvent.touchEnd(row, { changedTouches: [{ clientX: 50, clientY: 100 }] });
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.queryByTestId('focal-menu-tomato')).toBeNull();
  });

  it('touch move >10px cancels the long-press timer (scroll wins over tap-and-hold)', () => {
    mount();
    const row = screen.getByTestId('notebook-row-tomato');
    fireEvent.touchStart(row, { touches: [{ clientX: 50, clientY: 100 }] });
    fireEvent.touchMove(row, { touches: [{ clientX: 50, clientY: 130 }] });
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.queryByTestId('focal-menu-tomato')).toBeNull();
  });

  it('focal badge renders on the focal row only', () => {
    mount({ focalKey: 'basil' });
    expect(screen.getByTestId('focal-badge-basil')).toBeInTheDocument();
    expect(screen.queryByTestId('focal-badge-tomato')).toBeNull();
    expect(screen.getByTestId('focal-badge-basil').textContent).toBe('focal');
  });

  it('clicking the backdrop closes the focal popover (no onSetFocal call)', () => {
    const { onSetFocal } = mount();
    fireEvent.contextMenu(screen.getByTestId('notebook-row-tomato'));
    fireEvent.click(screen.getByTestId('focal-menu-backdrop-tomato'));
    expect(screen.queryByTestId('focal-menu-tomato')).toBeNull();
    expect(onSetFocal).not.toHaveBeenCalled();
  });

  it('right-click suppresses the native context menu (preventDefault was called)', () => {
    mount();
    const row = screen.getByTestId('notebook-row-tomato');
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    row.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
