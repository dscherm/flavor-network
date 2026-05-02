import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SuggestionDrawer from '../SuggestionDrawer.jsx';

// Tiny in-memory dataset so the drawer renders without loading
// pairings.json. Keep node count low — addModeBucketing only needs
// recipePairs/globalCount/nodes, and the engine ranks deterministically.
function makeFixture() {
  const names = ['onion', 'garlic', 'sugar', 'lemon', 'tomato', 'butter', 'salt', 'chile', 'soy', 'wine'];
  const nodes = new Map();
  for (const n of names) nodes.set(n, {});
  const edges = []; // REPLACE column path uses `edges`; empty is fine here
  const recipePairs = {
    onion: { garlic: 30, sugar: 20, salt: 25, lemon: 12, soy: 15, chile: 18, butter: 10, tomato: 22 },
    garlic: { onion: 30, sugar: 14, salt: 22, lemon: 10, soy: 5, chile: 12, butter: 8, tomato: 18 },
    tomato: { onion: 22, garlic: 18, sugar: 14, salt: 22, lemon: 10, butter: 8, wine: 12 },
  };
  const globalCount = {};
  for (const n of names) globalCount[n] = 200;
  return { nodes, edges, recipePairs, globalCount };
}

function renderDrawer(props = {}) {
  const fix = makeFixture();
  return render(
    <SuggestionDrawer
      centerIngredient={null}
      recipeIngredients={[]}
      nodes={fix.nodes}
      edges={fix.edges}
      onAddIngredient={vi.fn()}
      onSwapIngredient={vi.fn()}
      activeTab="all"
      onTabChange={vi.fn()}
      snapState="full"
      onSnapChange={vi.fn()}
      labMode="taste"
      recipePairs={fix.recipePairs}
      globalCount={fix.globalCount}
      {...props}
    />
  );
}

beforeEach(() => {
  cleanup();
});

describe('SuggestionDrawer mode resolution (AC-6, AC-7, AC-8, AC-8b)', () => {
  it('AC-6: empty bowl + no centerIngredient → ADD selected; REPLACE has aria-disabled=true', () => {
    renderDrawer({ recipeIngredients: [], centerIngredient: null });
    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveAttribute('data-mode', 'ADD');
    const tabs = screen.getAllByRole('tab');
    const [add, replace] = tabs;
    expect(add).toHaveAttribute('aria-selected', 'true');
    expect(replace).toHaveAttribute('aria-disabled', 'true');
  });

  it('AC-6 (extension): clicking REPLACE while disabled is a no-op (data-mode unchanged)', () => {
    renderDrawer({ recipeIngredients: [], centerIngredient: null });
    const tablist = screen.getByRole('tablist');
    const replace = screen.getAllByRole('tab')[1];
    fireEvent.click(replace);
    expect(tablist).toHaveAttribute('data-mode', 'ADD');
  });

  it('AC-7: bowl=2 → REPLACE selected by default', () => {
    renderDrawer({ recipeIngredients: ['onion', 'garlic'] });
    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveAttribute('data-mode', 'REPLACE');
  });

  it('AC-8: bowl=2 + manual flip to ADD sticks; remains ADD when 3rd ingredient added', () => {
    const { rerender } = renderDrawer({ recipeIngredients: ['onion', 'garlic'] });
    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveAttribute('data-mode', 'REPLACE');
    const [add] = screen.getAllByRole('tab');
    fireEvent.click(add);
    expect(tablist).toHaveAttribute('data-mode', 'ADD');
    // Now add a third ingredient — sticky should keep ADD active.
    const fix = makeFixture();
    rerender(
      <SuggestionDrawer
        centerIngredient={null}
        recipeIngredients={['onion', 'garlic', 'butter']}
        nodes={fix.nodes}
        edges={fix.edges}
        onAddIngredient={vi.fn()}
        onSwapIngredient={vi.fn()}
        activeTab="all"
        onTabChange={vi.fn()}
        snapState="full"
        onSnapChange={vi.fn()}
        labMode="taste"
        recipePairs={fix.recipePairs}
        globalCount={fix.globalCount}
      />
    );
    expect(screen.getByRole('tablist')).toHaveAttribute('data-mode', 'ADD');
  });

  it('AC-8 (continued): drain to bowl=0 → manualMode resets, ADD via default rule', () => {
    const fix = makeFixture();
    const { rerender } = render(
      <SuggestionDrawer
        centerIngredient={null}
        recipeIngredients={['onion', 'garlic']}
        nodes={fix.nodes}
        edges={fix.edges}
        onAddIngredient={vi.fn()}
        onSwapIngredient={vi.fn()}
        activeTab="all"
        onTabChange={vi.fn()}
        snapState="full"
        onSnapChange={vi.fn()}
        labMode="taste"
        recipePairs={fix.recipePairs}
        globalCount={fix.globalCount}
      />
    );
    // Manually flip to ADD
    fireEvent.click(screen.getAllByRole('tab')[0]);
    expect(screen.getByRole('tablist')).toHaveAttribute('data-mode', 'ADD');
    // Drain to empty
    rerender(
      <SuggestionDrawer
        centerIngredient={null}
        recipeIngredients={[]}
        nodes={fix.nodes}
        edges={fix.edges}
        onAddIngredient={vi.fn()}
        onSwapIngredient={vi.fn()}
        activeTab="all"
        onTabChange={vi.fn()}
        snapState="full"
        onSnapChange={vi.fn()}
        labMode="taste"
        recipePairs={fix.recipePairs}
        globalCount={fix.globalCount}
      />
    );
    // Default rule resolves to ADD; REPLACE is disabled again.
    expect(screen.getByRole('tablist')).toHaveAttribute('data-mode', 'ADD');
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-disabled', 'true');
  });

  it('AC-8b: centerIngredient alone → effectiveBowlSize=1 → REPLACE default selected', () => {
    renderDrawer({ recipeIngredients: [], centerIngredient: 'tomato' });
    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveAttribute('data-mode', 'REPLACE');
  });
});
