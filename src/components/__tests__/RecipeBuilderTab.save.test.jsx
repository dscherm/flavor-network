// @vitest-environment jsdom
// INVENT-12: saving an invented recipe from Make a recipe — through the existing user-recipe path
// (profile.recipes, which the Cookbook lists). The invent panel is mocked; the profile writer is mocked.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const auth = vi.hoisted(() => ({ value: { user: null, loading: false, authError: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn(), logout: vi.fn() } }));
vi.mock('../../hooks/useAuth.js', () => ({ default: () => auth.value }));
vi.mock('../../ml/kitchenRuntime.js', () => ({
  loadRealRecipes: vi.fn(async () => ({ index: { recipes: [], inv: {} }, vocab: [] })),
  loadInventModel: vi.fn(async () => null),
}));
vi.mock('../../ml/quantityRuntime.js', () => ({ predictBowlAmounts: vi.fn(async (names) => names.map((name) => ({ name, amount: null }))) }));
vi.mock('../ProfileAxisRadar.jsx', () => ({ default: () => null }));
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

import MakeRecipeStart from '../MakeRecipeStart.jsx';
import { saveInvention } from '../../data/savedInventions.js';

const NODES = new Map([['chicken', { category: 'protein', cuisines: [] }], ['broccoli', { category: 'vegetable', cuisines: [] }]]);
const SIGNED_IN = { user: { uid: 'u1' }, loading: false, authError: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn(), logout: vi.fn() };
const SIGNED_OUT = { ...SIGNED_IN, user: null };

function mount(userProfile) {
  const s = { setRecipeHandoff: vi.fn(), setRecipeMounted: vi.fn(), setActiveTab: vi.fn(), setCookbookPickerMode: vi.fn() };
  const ui = (up) => <MakeRecipeStart {...s} nodes={NODES} edges={[]} userProfile={up} />;
  const view = render(ui(userProfile));
  return { view, ui };
}
const openInvent = async () => { fireEvent.click(await screen.findByTestId('make-card-invent')); return screen.findByTestId('mock-invent-recipe'); };

describe('MakeRecipeStart — saving an invented recipe', () => {
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
});
