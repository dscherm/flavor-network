// @vitest-environment jsdom
// KITCHEN-2: the Recipe Lab's kitchen flow end to end, ML runtimes mocked.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../../hooks/useAuth.js', () => ({
  default: () => ({ user: { uid: 't' }, loading: false, authError: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn(), logout: vi.fn() }),
}));
vi.mock('../../ml/kitchenRuntime.js', () => ({
  loadRealRecipes: vi.fn(async () => ({
    index: { recipes: [{ v: [0, 1, 2], t: 'Lemon Garlic Chicken', d: ['Roast.'] }], inv: { 0: [0], 1: [0], 2: [0] } },
    vocab: ['chicken', 'lemon', 'garlic'],
  })),
  loadInventModel: vi.fn(async () => null),
}));
vi.mock('../ProfileAxisRadar.jsx', () => ({ default: () => null }));

import MakeRecipeStart from '../MakeRecipeStart.jsx';
import { MY_KITCHEN_KEY } from '../../data/myKitchen.js';

const NODES = new Map(['chicken', 'lemon', 'garlic', 'rice', 'onion', 'lentil', 'cumin', 'olive oil'].map((n) => [n, { category: 'vegetable' }]));

function mount() {
  const s = { setRecipeHandoff: vi.fn(), setRecipeMounted: vi.fn(), setActiveTab: vi.fn(), setCookbookPickerMode: vi.fn() };
  render(<MakeRecipeStart {...s} nodes={NODES} edges={[]} />);
  return s;
}

describe('MakeRecipeStart — KITCHEN-2 kitchen flow', () => {
  beforeEach(() => {
    localStorage.clear();
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    }
  });

  it('the kitchen card opens the panel; what you add is saved on this device', async () => {
    mount();
    fireEvent.click(screen.getByTestId('make-card-kitchen'));
    const panel = await screen.findByTestId('kitchen-panel');
    fireEvent.click(within(panel).getByRole('button', { name: '+ garlic' }));
    expect(JSON.parse(localStorage.getItem(MY_KITCHEN_KEY))).toEqual(['garlic']);
    fireEvent.click(within(panel).getByTestId('kitchen-close'));
    expect(screen.queryByTestId('kitchen-panel')).toBeNull();
    expect(screen.getByTestId('make-card-kitchen')).toHaveTextContent('1 thing on hand');
  });

  it('a real recipe goes to the notebook as a make-kitchen handoff with its steps', async () => {
    localStorage.setItem(MY_KITCHEN_KEY, JSON.stringify(['chicken', 'lemon', 'garlic']));
    const s = mount();
    fireEvent.click(screen.getByTestId('make-card-kitchen'));
    fireEvent.click(await screen.findByTestId('kitchen-real-0'));
    expect(s.setRecipeHandoff).toHaveBeenCalledWith(expect.objectContaining({
      source: 'make-kitchen', title: 'Lemon Garlic Chicken', steps: ['Roast.'], ingredients: ['chicken', 'lemon', 'garlic'],
    }));
    expect(s.setActiveTab).toHaveBeenCalledWith('recipe');
  });

  it('a Cookbook recipe opens as in the Cookbook, then goes to the notebook with its method', async () => {
    localStorage.setItem(MY_KITCHEN_KEY, JSON.stringify(['rice', 'onion', 'lentil', 'cumin']));
    const s = mount();
    fireEvent.click(screen.getByTestId('make-card-kitchen'));
    fireEvent.click(within(await screen.findByTestId('kitchen-make')).getByRole('button', { name: /Mujadara/ }));
    const detail = screen.getByRole('dialog', { name: 'Mujadara details' });
    fireEvent.click(within(detail).getByRole('button', { name: /Open in Recipe Notebook/ }));
    const h = s.setRecipeHandoff.mock.calls[0][0];
    expect(h).toMatchObject({ source: 'make-kitchen', title: 'Mujadara' });
    expect(h.ingredients).toContain('lentil');
    expect(h.steps.length).toBeGreaterThan(0);
  });

  it('invent card opens Invent a recipe, which says it is unavailable when the model is', async () => {
    mount();
    fireEvent.click(screen.getByTestId('make-card-invent'));
    expect(await screen.findByTestId('invent-recipe-unavailable')).toBeInTheDocument();
  });
});
