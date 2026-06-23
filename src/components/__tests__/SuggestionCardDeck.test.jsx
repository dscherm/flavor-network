import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AXES } from '../../data/recipeProfileAnalysis.js';

// ── Mock the lazily-imported recipe set-completion model ────────────
// The deck does `import('../ml/recipeRuntime.js')` then calls
// loadRecipeModel() and suggestIngredients(). We mock both so the deck's
// ranking useEffect resolves with a deterministic candidate set without
// onnxruntime / fetch. (Pattern mirrors RecipeFlavorProfilesCard.test's
// graceful-fetch mock — here we additionally stub the model module.)
const suggestIngredients = vi.fn();
vi.mock('../../ml/recipeRuntime.js', () => ({
  loadRecipeModel: vi.fn(() => Promise.resolve({ meta: { cuisine_vocab: [] } })),
  suggestIngredients: (...a) => suggestIngredients(...a),
}));

import SuggestionCardDeck from '../SuggestionCardDeck.jsx';

const z = () => Object.fromEntries(AXES.map((a) => [a, 0]));
const probs = (o) => ({ ...z(), ...o });
function nodesFrom(map) {
  return new Map(Object.entries(map).map(([k, gnnProbs]) => [k, { gnnProbs, category: 'spice', cuisines: [] }]));
}

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
  suggestIngredients.mockReset();
});

// A bowl with flavor data + a candidate ("cinnamon") that strongly shifts a
// different axis, so its profileDelta is non-null and produces movers.
const nodes = nodesFrom({
  honey: probs({ sweet: 0.9 }),
  lemon: probs({ sour: 0.8 }),
  cinnamon: probs({ odor_spicy: 0.9 }),
  ginger: probs({ odor_spicy: 0.7, sour: 0.2 }),
});

describe('SuggestionCardDeck — add mode', () => {
  it('renders a single suggestion card with a ProfileDeltaRadar and Add commits onAdd', async () => {
    suggestIngredients.mockResolvedValue([{ name: 'cinnamon' }, { name: 'ginger' }]);
    const onAdd = vi.fn();
    const { container } = render(
      <SuggestionCardDeck mode="add" bowlNames={['honey', 'lemon']} nodes={nodes} onAdd={onAdd} />,
    );

    // Wait for the model-driven deck to populate (one card visible).
    await waitFor(() => expect(screen.getByTestId('suggestion-card')).toBeInTheDocument());

    const card = screen.getByTestId('suggestion-card');
    expect(card).toHaveAttribute('data-ingredient', 'cinnamon');

    // The hero card renders separate taste + aroma radars, each with before + after polygons.
    expect(container.querySelector('[data-testid="ingredient-card-radar-taste-before"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="ingredient-card-radar-taste-after"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="ingredient-card-radar-aroma-before"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="ingredient-card-radar-aroma-after"]')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('deck-commit'));
    expect(onAdd).toHaveBeenCalled();
    expect(onAdd.mock.calls[0][0]).toBe('cinnamon');
  });

  it('labels each deck page with a title naming the candidate + position (HELP-5)', async () => {
    suggestIngredients.mockResolvedValue([{ name: 'cinnamon' }, { name: 'ginger' }]);
    render(<SuggestionCardDeck mode="add" bowlNames={['honey', 'lemon']} nodes={nodes} onAdd={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('deck-page-title')).toBeInTheDocument());
    const title = screen.getByTestId('deck-page-title');
    expect(title).toHaveTextContent('cinnamon');
    expect(title).toHaveTextContent('1 / 2');
    // Advancing the deck retitles the page to the next candidate.
    fireEvent.click(screen.getByTestId('deck-next'));
    expect(screen.getByTestId('deck-page-title')).toHaveTextContent('ginger');
    expect(screen.getByTestId('deck-page-title')).toHaveTextContent('2 / 2');
  });

  it('renders the after polygon reflecting a non-null delta (mover dots present)', async () => {
    suggestIngredients.mockResolvedValue([{ name: 'cinnamon' }]);
    const { container } = render(
      <SuggestionCardDeck mode="add" bowlNames={['honey', 'lemon']} nodes={nodes} onAdd={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId('suggestion-card')).toBeInTheDocument());
    // grid ring circle + at least one mover dot → > 1 circle when delta moves an axis.
    expect(container.querySelectorAll('circle').length).toBeGreaterThan(1);
  });
});

describe('SuggestionCardDeck — replace mode', () => {
  it('renders a substitute card and Swap commits onSwap(ingredient, name)', async () => {
    suggestIngredients.mockResolvedValue([{ name: 'cinnamon' }]);
    const onSwap = vi.fn();
    render(
      <SuggestionCardDeck
        mode="replace"
        ingredient="ginger"
        bowlNames={['honey', 'lemon', 'ginger']}
        nodes={nodes}
        onSwap={onSwap}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('suggestion-card')).toBeInTheDocument());
    expect(screen.getByText('Swap')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('deck-commit'));
    expect(onSwap).toHaveBeenCalledWith('ginger', 'cinnamon');
  });
});

describe('SuggestionCardDeck — graceful degradation', () => {
  it('shows the empty state when nodes are missing (model never queried)', async () => {
    render(<SuggestionCardDeck mode="add" bowlNames={['honey']} nodes={null} onAdd={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/No suggestions for this recipe yet/)).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('suggestion-card')).not.toBeInTheDocument();
  });

  it('shows the empty state when the model returns no candidates', async () => {
    suggestIngredients.mockResolvedValue([]);
    render(<SuggestionCardDeck mode="add" bowlNames={['honey', 'lemon']} nodes={nodes} onAdd={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/No suggestions for this recipe yet/)).toBeInTheDocument(),
    );
  });

  it('keeps the deck root + close control even while loading', () => {
    suggestIngredients.mockReturnValue(new Promise(() => {})); // never resolves
    render(<SuggestionCardDeck mode="add" bowlNames={['honey', 'lemon']} nodes={nodes} onClose={vi.fn()} />);
    expect(screen.getByTestId('suggestion-deck-add')).toBeInTheDocument();
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });
});
