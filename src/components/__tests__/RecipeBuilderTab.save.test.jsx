// @vitest-environment jsdom
// INVENT-12 / BUILDER-3: saving a recipe from the Recipe Notebook builder — through the existing user-recipe path
// (profile.recipes, which the Cookbook lists). The builder is mocked; the profile writer is mocked.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const auth = vi.hoisted(() => ({ value: { user: null, loading: false, authError: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn(), logout: vi.fn() } }));
vi.mock('../../hooks/useAuth.js', () => ({ default: () => auth.value }));
vi.mock('../../ml/kitchenRuntime.js', () => ({
  loadRealRecipes: vi.fn(async () => ({ index: { recipes: [], inv: {} }, vocab: [] })),
  loadInventModel: vi.fn(async () => null),
}));
vi.mock('../../ml/quantityRuntime.js', () => ({ predictBowlAmounts: vi.fn(async (names) => names.map((name) => ({ name, amount: null }))) }));
const panelProps = { current: null };
vi.mock('../InventRecipe.jsx', () => ({
  default: (props) => {
    panelProps.current = props;
    return (
      <div data-testid="mock-invent-recipe">
        <span data-testid="mock-result" />
        <button type="button" data-testid="mock-save" onClick={async () => {
          const r = await props.onSave({ kind: 'recipe', name: 'Panel Stir-fry', category: 'stir-fry', cuisine: 'chinese', method: 'Stir.', lines: [{ key: 'chicken', amount: '1 lb', role: null }, { key: 'broccoli', amount: '', role: null }] });
          document.querySelector('[data-testid="mock-result"]').textContent = JSON.stringify(r);
        }}>save</button>
        <button type="button" data-testid="mock-close" onClick={props.onClose}>close</button>
      </div>
    );
  },
}));

import RecipeBuilderTab from '../RecipeBuilderTab.jsx';
import { saveInvention } from '../../data/savedInventions.js';

const NODES = new Map([['chicken', { category: 'protein', cuisines: [] }], ['broccoli', { category: 'vegetable', cuisines: [] }]]);
const SIGNED_IN = { user: { uid: 'u1' }, loading: false, authError: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn(), logout: vi.fn() };
const SIGNED_OUT = { ...SIGNED_IN, user: null };

function mount(userProfile, extra = {}) {
  const ui = (up) => <RecipeBuilderTab nodes={NODES} edges={[]} userProfile={up} onBack={vi.fn()} {...extra} />;
  const view = render(ui(userProfile));
  return { view, ui };
}
const openInvent = async () => screen.findByTestId('mock-invent-recipe');

describe('RecipeBuilderTab — saving a recipe', () => {
  beforeEach(() => { localStorage.clear(); panelProps.current = null; auth.value = SIGNED_IN; });

  it('without a profile writer the panel gets no onSave', async () => {
    mount(null);
    await openInvent();
    expect(panelProps.current.onSave).toBeNull();
  });

  it('signed in: saves through the writer as a recipe and confirms', async () => {
    const up = { saveInvention: vi.fn(() => ({ ok: true, item: {} })) };
    mount(up);
    await openInvent();
    fireEvent.click(screen.getByTestId('mock-save'));
    await waitFor(() => expect(screen.getByTestId('mock-result').textContent).toContain('saved'));
    expect(JSON.parse(screen.getByTestId('mock-result').textContent)).toEqual({ status: 'saved', message: 'Saved to your recipes' });
    expect(up.saveInvention).toHaveBeenCalledTimes(1);
    expect(up.saveInvention.mock.calls[0][0]).toMatchObject({ kind: 'recipe', name: 'Panel Stir-fry', cuisine: 'chinese' });
  });

  it('the real writer puts the recipe in profile.recipes in the existing user-recipe shape', () => {
    const res = saveInvention({ recipes: [] }, { kind: 'recipe', name: 'Panel Stir-fry', cuisine: 'chinese', method: 'Stir.', lines: [{ key: 'chicken', amount: '1 lb' }, { key: 'broccoli' }] }, { makeId: () => 'r1' });
    expect(res.profile.recipes).toEqual([{
      id: 'r1', name: 'Panel Stir-fry',
      ingredients: [{ name: 'chicken', quantity: null, unit: null, raw: '1 lb chicken' }, { name: 'broccoli', quantity: null, unit: null, raw: 'broccoli' }],
      instructions: 'Stir.', cuisine: 'chinese', source: 'invent',
    }]);
  });

  it('signed out: shows sign-in, then saves the same recipe exactly once after sign-in', async () => {
    auth.value = SIGNED_OUT;
    const up = { saveInvention: vi.fn(() => ({ ok: true, item: {} })) };
    const { view, ui } = mount(up);
    await openInvent();
    fireEvent.click(screen.getByTestId('mock-save'));
    await screen.findByTestId('invent-save-signin');
    expect(JSON.parse(screen.getByTestId('mock-result').textContent).status).toBe('signin');
    expect(up.saveInvention).not.toHaveBeenCalled();
    auth.value = SIGNED_IN;
    view.rerender(ui(up));
    await waitFor(() => expect(up.saveInvention).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('invent-save-toast')).toHaveTextContent('Saved to your recipes');
    auth.value = { ...SIGNED_IN, user: { uid: 'u1' } };
    view.rerender(ui(up));
    expect(up.saveInvention).toHaveBeenCalledTimes(1);
  });

  it('closing the panel drops a save waiting on sign-in; a writer failure resolves error', async () => {
    auth.value = SIGNED_OUT;
    const up = { saveInvention: vi.fn(() => ({ ok: true, item: {} })) };
    const { view, ui } = mount(up);
    await openInvent();
    fireEvent.click(screen.getByTestId('mock-save'));
    await screen.findByTestId('invent-save-signin');
    fireEvent.click(screen.getByTestId('mock-close'));
    expect(screen.queryByTestId('invent-save-signin')).toBeNull();
    auth.value = SIGNED_IN;
    view.rerender(ui(up));
    expect(up.saveInvention).not.toHaveBeenCalled();
    up.saveInvention = vi.fn(() => ({ ok: false, reason: 'Could not save on this device. Nothing was lost; try again.' }));
    view.rerender(ui(up));
    await openInvent();
    fireEvent.click(screen.getByTestId('mock-save'));
    await waitFor(() => expect(screen.getByTestId('mock-result').textContent).toContain('error'));
  });

  it('the builder is the one chalkboard builder: it gets the handoff as its seed, the kitchen, and the Find handlers', async () => {
    const onFindCocktail = vi.fn();
    const handoff = { source: 'cocktail', ts: 5, ingredients: [{ ingredient: 'chicken', amount: { raw: '1 lb' } }, 'broccoli'], title: 'Dish', steps: ['Stir.'], stepsFrom: 'Dish', type: 'stir-fry', cuisine: 'chinese' };
    mount({ saveInvention: vi.fn() }, { handoff, onFindCocktail });
    await openInvent();
    expect(panelProps.current.seed).toMatchObject({
      pinned: [{ key: 'chicken', source: 'user', amount: '1 lb' }, { key: 'broccoli', source: 'user' }],
      title: 'Dish', steps: ['Stir.'], stepsFrom: 'Dish', type: 'stir-fry', fromName: true, cuisine: 'chinese',
    });
    expect(panelProps.current.onFindCocktail).toBe(onFindCocktail);
    expect(panelProps.current.onWrite).toBeUndefined();
  });

  it('Back closes through the host and drops a save waiting on sign-in', async () => {
    const onBack = vi.fn();
    mount({ saveInvention: vi.fn() }, { onBack });
    await openInvent();
    fireEvent.click(screen.getByTestId('mock-close'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('waits for the ingredient graph instead of opening the builder without it', () => {
    render(<RecipeBuilderTab nodes={null} edges={null} userProfile={null} onBack={vi.fn()} />);
    expect(screen.queryByTestId('mock-invent-recipe')).toBeNull();
  });
});
