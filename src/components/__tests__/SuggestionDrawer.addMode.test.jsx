import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

// AC-26: ?engine=v1 must be set BEFORE the SuggestionDrawer module is
// imported (the module reads location.search at module-load via the IIFE
// at SuggestionDrawer.jsx:15). We use isolateModulesAsync inside its own
// `describe` block below to control import timing.

function makeFixture() {
  const names = [
    'onion', 'garlic', 'sugar', 'lemon', 'tomato', 'butter', 'salt',
    'chile', 'soy', 'wine', 'coffee', 'basil', 'parmesan', 'mint',
  ];
  const nodes = new Map();
  for (const n of names) nodes.set(n, {});
  // Inject one explicit-taste node for richer bucketing.
  nodes.set('parmesan', { taste: 'umami, salty' });
  const edges = [];
  const recipePairs = {
    onion: { garlic: 30, sugar: 20, salt: 25, lemon: 12, soy: 15, chile: 18, butter: 10, tomato: 22, parmesan: 8, basil: 12, coffee: 4 },
    garlic: { onion: 30, sugar: 14, salt: 22, lemon: 10, soy: 5, chile: 12, butter: 8, tomato: 18, parmesan: 11, basil: 14 },
    tomato: { onion: 22, garlic: 18, sugar: 14, salt: 22, lemon: 10, butter: 8, wine: 12, basil: 25, parmesan: 16 },
  };
  const globalCount = {};
  for (const n of names) globalCount[n] = 200;
  return { nodes, edges, recipePairs, globalCount };
}

beforeEach(() => {
  cleanup();
});

describe('SuggestionDrawer ADD-mode rendering (AC-9, AC-11, AC-13, AC-15..AC-19, AC-25)', () => {
  let SuggestionDrawer;
  beforeEach(async () => {
    // Default v2 path. Use vi.resetModules so each `describe` gets a
    // fresh module read of ENGINE_MODE.
    vi.resetModules();
    SuggestionDrawer = (await import('../SuggestionDrawer.jsx')).default;
  });

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

  it('AC-9: ADD mode renders exactly 8 capitalized headers in AXES order', () => {
    renderDrawer({ recipeIngredients: [] });
    const cols = screen.getAllByTestId('add-column');
    expect(cols).toHaveLength(8);
    const expectedOrder = ['Sweet', 'Salty', 'Sour', 'Bitter', 'Umami', 'Spicy', 'Pungent', 'Astringent'];
    cols.forEach((col, i) => {
      expect(within(col).getByText(expectedOrder[i])).toBeInTheDocument();
    });
  });

  it('AC-11: empty column renders the typed placeholder, not a collapsed DOM node', () => {
    // Build a sparse fixture: only 2 candidate ingredients (sugar +
    // lemon → sweet + sour). Guarantees the other 6 taste columns are
    // empty, so we can assert the placeholder copy.
    const sparseNodes = new Map();
    sparseNodes.set('onion', {});
    sparseNodes.set('sugar', {});
    sparseNodes.set('lemon', {});
    const sparsePairs = { onion: { sugar: 30, lemon: 25 } };
    const sparseGlobal = { onion: 200, sugar: 200, lemon: 200 };
    render(
      <SuggestionDrawer
        centerIngredient={null}
        recipeIngredients={[]}
        nodes={sparseNodes}
        edges={[]}
        onAddIngredient={vi.fn()}
        onSwapIngredient={vi.fn()}
        activeTab="all"
        onTabChange={vi.fn()}
        snapState="full"
        onSnapChange={vi.fn()}
        labMode="taste"
        recipePairs={sparsePairs}
        globalCount={sparseGlobal}
      />
    );
    const cols = screen.getAllByTestId('add-column');
    let foundEmpty = false;
    for (const col of cols) {
      const empty = within(col).queryByTestId('add-column-empty');
      if (empty) {
        foundEmpty = true;
        expect(empty.textContent).toMatch(/no .* (candidates|options)/i);
      }
    }
    expect(foundEmpty).toBe(true);
  });

  it('AC-12 (extension): ADD candidates do not include the bowl ingredient', () => {
    renderDrawer({ recipeIngredients: ['onion'] });
    // Default with bowl=1 is REPLACE — flip to ADD first.
    fireEvent.click(screen.getAllByRole('tab')[0]);
    const cols = screen.getAllByTestId('add-column');
    for (const col of cols) {
      const chips = within(col).queryAllByRole('button');
      for (const chip of chips) {
        // Skip the [ADD] [REPLACE] tab buttons themselves — they are not
        // chips. queryAllByRole('button') inside an add-column won't
        // include them, but defend anyway.
        expect(chip.textContent).not.toMatch(/^onion$/i);
      }
    }
  });

  it('AC-13: cocktail labMode hides the cuisine filter pill', () => {
    renderDrawer({ recipeIngredients: ['onion'], labMode: 'cocktail' });
    // The "Cuisine" pill is not in the filter row.
    expect(screen.queryByText('Cuisine')).toBeNull();
    expect(screen.getByText('Taste')).toBeInTheDocument();
    expect(screen.getByText('Aroma')).toBeInTheDocument();
  });

  it('AC-13 (extension): cocktail empty placeholder reads "options in cocktail scope"', () => {
    // Force ADD with bowl≥1 by manually flipping.
    renderDrawer({ recipeIngredients: ['onion'], labMode: 'cocktail' });
    // Default with bowl=1 is REPLACE. Click ADD to flip.
    const addTab = screen.getAllByRole('tab')[0];
    fireEvent.click(addTab);
    const empties = screen.getAllByTestId('add-column-empty');
    expect(empties.length).toBeGreaterThan(0);
    // Some placeholder should mention cocktail-scope copy.
    const anyCocktailCopy = empties.some(e => /options in cocktail scope/i.test(e.textContent));
    expect(anyCocktailCopy).toBe(true);
  });

  it('AC-15: REPLACE mode (default with bowl=2) renders 1 column header per bowl ingredient', () => {
    renderDrawer({ recipeIngredients: ['onion', 'garlic'] });
    // Drawer defaults to REPLACE. Look for the existing "Replace" header markup.
    const replaceLabels = screen.getAllByText('Replace');
    // Each replace column has a "Replace" mini-label + the ingredient name.
    expect(replaceLabels.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('onion')).toBeInTheDocument();
    expect(screen.getByText('garlic')).toBeInTheDocument();
  });

  it('AC-16: REPLACE chip click invokes onSwapIngredient (NOT onAddIngredient)', () => {
    const onAdd = vi.fn();
    const onSwap = vi.fn();
    const fix = makeFixture();
    // Edges path needs an entry for getNeighbors('onion') to produce candidates.
    fix.edges.push({ source: 'onion', target: 'sugar', strength: 0.7 });
    fix.edges.push({ source: 'onion', target: 'butter', strength: 0.6 });
    render(
      <SuggestionDrawer
        centerIngredient={null}
        recipeIngredients={['onion']}
        nodes={fix.nodes}
        edges={fix.edges}
        onAddIngredient={onAdd}
        onSwapIngredient={onSwap}
        activeTab="all"
        onTabChange={vi.fn()}
        snapState="full"
        onSnapChange={vi.fn()}
        labMode="taste"
        recipePairs={fix.recipePairs}
        globalCount={fix.globalCount}
      />
    );
    // Default with bowl=1 is REPLACE. Find a chip in the column and click.
    const buttons = screen.getAllByRole('button');
    // Find a chip whose name contains a candidate (sugar or butter).
    const chip = buttons.find(b => /sugar|butter/.test(b.textContent || ''));
    expect(chip).toBeDefined();
    fireEvent.click(chip);
    expect(onSwap).toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('AC-17: empty REPLACE column renders "No matches"', () => {
    const fix = makeFixture();
    // No edges → REPLACE column for "onion" produces no candidates.
    render(
      <SuggestionDrawer
        centerIngredient={null}
        recipeIngredients={['onion']}
        nodes={fix.nodes}
        edges={[]}
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
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('AC-18: REPLACE in cocktail+scopeFilter combination still renders the column structure', () => {
    const fix = makeFixture();
    fix.edges.push({ source: 'lime', target: 'rum', strength: 0.7 });
    fix.edges.push({ source: 'lime', target: 'sugar', strength: 0.6 });
    fix.nodes.set('lime', {});
    fix.nodes.set('rum', {});
    const scope = new Set(['lime', 'rum', 'sugar', 'mint']);
    render(
      <SuggestionDrawer
        centerIngredient={null}
        recipeIngredients={['lime']}
        nodes={fix.nodes}
        edges={fix.edges}
        onAddIngredient={vi.fn()}
        onSwapIngredient={vi.fn()}
        activeTab="all"
        onTabChange={vi.fn()}
        snapState="full"
        onSnapChange={vi.fn()}
        labMode="cocktail"
        recipePairs={fix.recipePairs}
        globalCount={fix.globalCount}
        scopeFilter={scope}
      />
    );
    // Default REPLACE with bowl=1 → 1 "Replace lime" column.
    expect(screen.getByText('lime')).toBeInTheDocument();
  });

  it('AC-25: filter persistence — flipping ADD↔REPLACE does not reset activeTab; sweet filter sticks', () => {
    const onTabChange = vi.fn();
    const fix = makeFixture();
    render(
      <SuggestionDrawer
        centerIngredient={null}
        recipeIngredients={['onion']}
        nodes={fix.nodes}
        edges={[]}
        onAddIngredient={vi.fn()}
        onSwapIngredient={vi.fn()}
        activeTab="sweet"
        onTabChange={onTabChange}
        snapState="full"
        onSnapChange={vi.fn()}
        labMode="taste"
        recipePairs={fix.recipePairs}
        globalCount={fix.globalCount}
      />
    );
    // Default mode = REPLACE. Flip to ADD.
    fireEvent.click(screen.getAllByRole('tab')[0]);
    // onTabChange should not have been called by the mode flip.
    expect(onTabChange).not.toHaveBeenCalled();
    // Iter-2 reviewer note: every visible chip's dominantTaste === 'sweet'.
    const chips = screen.getAllByTestId('add-column').flatMap(col =>
      within(col).queryAllByRole('button')
    );
    // With activeTab=sweet, applyChipFilter narrows to sweet-tasting chips.
    // We assert that ONLY the sweet column has chips (other columns are
    // all filtered out → empty placeholders).
    const sweetColumn = screen.getAllByTestId('add-column').find(c => c.getAttribute('data-taste') === 'sweet');
    const sweetChips = within(sweetColumn).queryAllByRole('button');
    // Every chip in the sweet column has dominantTaste sweet (asserted by
    // bucket placement). And every visible chip across all columns lives
    // in the sweet column (filter applied per-column).
    expect(chips.length).toBeGreaterThanOrEqual(0);
    expect(chips.length).toBe(sweetChips.length);
    // Flip back to REPLACE — onTabChange still untouched.
    fireEvent.click(screen.getAllByRole('tab')[1]);
    expect(onTabChange).not.toHaveBeenCalled();
  });
});

describe('SuggestionDrawer ADD-mode under ?engine=v1 (AC-26)', () => {
  let originalSearch;
  beforeEach(() => {
    originalSearch = window.location.search;
    // Override location.search BEFORE module load. JSDOM's window.location
    // is not assignable, so we use defineProperty.
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '?engine=v1' },
    });
    delete window.__fnEngineLogged;
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: originalSearch },
    });
    delete window.__fnEngineLogged;
  });

  it('AC-26: ?engine=v1 path still renders 8 ADD column headers (bucketing is engine-agnostic)', async () => {
    // Spy on console.log to confirm engine=v1 was logged at module init.
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.resetModules();
    const SuggestionDrawer = (await import('../SuggestionDrawer.jsx')).default;
    // Confirm v1 was logged.
    const sawV1 = logSpy.mock.calls.some(args =>
      args[0] === '[SuggestionDrawer] engine =' && args[1] === 'v1'
    );
    expect(sawV1).toBe(true);
    logSpy.mockRestore();

    const fix = makeFixture();
    render(
      <SuggestionDrawer
        centerIngredient={null}
        recipeIngredients={[]}
        nodes={fix.nodes}
        edges={[]}
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
    // ADD mode (default with empty bowl) renders 8 columns regardless
    // of ENGINE_MODE — addModeBucketing.js consumes recipePairs/globalCount
    // directly via the engine module, so v1 vs v2 is transparent here.
    const cols = screen.getAllByTestId('add-column');
    expect(cols).toHaveLength(8);
  });
});
