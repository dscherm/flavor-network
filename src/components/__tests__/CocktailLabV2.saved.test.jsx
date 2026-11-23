// @vitest-environment jsdom
// INVENT-12: the cook's own cocktails in the Cocktail Lab — onSave, the "Yours" group, Edit / Delete.
// The invent panel is mocked (it is being rewritten elsewhere); the profile writer is mocked.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const codex = readCuratedCodex();
const ingredients = read('public/proDataset/ingredients.json');

vi.mock('../NetworkScene.jsx', () => ({ default: () => null }));
vi.mock('../ClusterJoystick.jsx', () => ({ default: () => null }));
vi.mock('../ShapeLegend.jsx', () => ({ default: () => null }));
vi.mock('../../three/AxisLabels.js', () => ({ createClusterLabels: () => ({ add: () => {} }), createGlowSprite: () => ({}) }));
vi.mock('../../data/cocktailCodexV2.js', () => ({
  loadCodexV2: (raw) => raw,
  curateCodexRaw: (raw) => raw,
  placeCocktailInFamily: () => ({ x: 0, y: 0, z: 0 }),
  topSimilar: () => [],
  crossFamilySimilar: () => [],
  cocktailSimilarity: () => 0,
}));
vi.mock('../../data/ingredientRoles.js', async (orig) => ({
  ...(await orig()),
  getCocktailRoles: vi.fn(async () => (await import('node:fs')).default
    ? JSON.parse((await import('node:fs')).default.readFileSync(`${process.cwd()}/public/data/cocktail_roles.json`, 'utf8')).byIngredient
    : {}),
}));
const panelProps = { current: null };
vi.mock('../InventCocktail.jsx', () => ({
  default: (props) => {
    panelProps.current = props;
    return (
      <div data-testid="mock-invent">
        <span data-testid="mock-edit">{props.editItem ? JSON.stringify(props.editItem) : ''}</span>
        <span data-testid="mock-result" />
        <button type="button" data-testid="mock-save" onClick={async () => {
          const r = await props.onSave({ kind: 'cocktail', ...(props.editItem ? { id: props.editItem.id } : {}), name: 'Panel Drink', category: 3, lines: [{ key: 'gin', amount: '2 oz', role: null }, { key: 'sweet vermouth', amount: '1 oz', role: null }] });
          document.querySelector('[data-testid="mock-result"]').textContent = JSON.stringify(r);
        }}>save</button>
        <button type="button" data-testid="mock-close" onClick={props.onClose}>close</button>
      </div>
    );
  },
}));

import CocktailLabV2 from '../CocktailLabV2.jsx';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';

const keep = new Set(['Negroni', 'Gimlet', 'Old-Fashioned', 'Daiquiri']);
const picked = codex.cocktails.filter((c) => keep.has(c.name));
const GRAPH = {
  ...codex,
  cocktails: picked,
  byFamily: new Map(codex.families.map((f) => [f.id, picked.filter((c) => c.family_id === f.id)])),
  byCanonical: new Map(picked.map((c) => [c.canonical, c])),
};
const fullData = { graph: { nodes: new Map(Object.entries(ingredients)), edges: [] } };
const L = (...pairs) => pairs.map(([key, amount]) => ({ key, amount, role: null }));
const item = (over = {}) => ({
  id: 'inv-1', kind: 'cocktail', name: 'Gin Vermouth Thing', createdAt: 1, category: 3, source: 'invent',
  lines: L(['gin', '2 oz'], ['sweet vermouth', '1 oz']), method: 'Stir with ice.', ...over,
});
const withSaved = (items) => ({ profile: { cocktails: items }, saveInvention: vi.fn(() => ({ ok: true, item: {} })), deleteInvention: vi.fn(() => true) });
const SIGNED_IN = { user: { uid: 'u1' }, loginWithGoogle: vi.fn(), loginWithApple: vi.fn(), authError: null };
const SIGNED_OUT = { user: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn(), authError: null };

beforeEach(() => {
  localStorage.clear();
  panelProps.current = null;
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => GRAPH });
});

const openInvent = async () => { fireEvent.click(await screen.findByTestId('cocktail-invent-open')); return screen.findByTestId('mock-invent'); };

describe('CocktailLabV2 — saving an invention', () => {
  it('hands the panel the profile nodes, the kitchen and an onSave', async () => {
    render(<CocktailLabV2 fullData={fullData} userProfile={withSaved([])} auth={SIGNED_IN} />);
    await openInvent();
    expect(panelProps.current.nodes).toBe(fullData.graph.nodes);
    expect(Array.isArray(panelProps.current.kitchen)).toBe(true);
    expect(typeof panelProps.current.onSave).toBe('function');
    expect(panelProps.current.editItem).toBeNull();
  });

  it('without a profile writer the panel gets no onSave (it hides its save row)', async () => {
    render(<CocktailLabV2 fullData={fullData} />);
    await openInvent();
    expect(panelProps.current.onSave).toBeNull();
  });

  it('signed in: saves through the writer and confirms', async () => {
    const up = withSaved([]);
    render(<CocktailLabV2 fullData={fullData} userProfile={up} auth={SIGNED_IN} />);
    await openInvent();
    fireEvent.click(screen.getByTestId('mock-save'));
    await waitFor(() => expect(screen.getByTestId('mock-result').textContent).toContain('saved'));
    expect(JSON.parse(screen.getByTestId('mock-result').textContent)).toEqual({ status: 'saved', message: 'Saved to your cocktails' });
    expect(up.saveInvention).toHaveBeenCalledTimes(1);
    expect(up.saveInvention.mock.calls[0][0]).toMatchObject({ kind: 'cocktail', name: 'Panel Drink', category: 3 });
  });

  it('signed out: shows sign-in, then saves the same invention exactly once after sign-in', async () => {
    const up = withSaved([]);
    const view = render(<CocktailLabV2 fullData={fullData} userProfile={up} auth={SIGNED_OUT} />);
    await openInvent();
    fireEvent.click(screen.getByTestId('mock-save'));
    await waitFor(() => expect(screen.getByTestId('mock-result').textContent).toContain('signin'));
    expect(JSON.parse(screen.getByTestId('mock-result').textContent)).toEqual({ status: 'signin', message: 'Sign in to save this.' });
    expect(up.saveInvention).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('invent-save-signin-google'));
    expect(SIGNED_OUT.loginWithGoogle).toHaveBeenCalled();
    view.rerender(<CocktailLabV2 fullData={fullData} userProfile={up} auth={SIGNED_IN} />);
    await waitFor(() => expect(up.saveInvention).toHaveBeenCalledTimes(1));
    expect(up.saveInvention.mock.calls[0][0]).toMatchObject({ kind: 'cocktail', name: 'Panel Drink' });
    expect(screen.queryByTestId('invent-save-signin')).toBeNull();
    expect(screen.getByTestId('invent-save-toast')).toHaveTextContent('Saved to your cocktails');
    view.rerender(<CocktailLabV2 fullData={fullData} userProfile={up} auth={{ ...SIGNED_IN, user: { uid: 'u1' } }} />);
    expect(up.saveInvention).toHaveBeenCalledTimes(1);
  });

  it('closing the panel drops a save that was waiting on sign-in', async () => {
    const up = withSaved([]);
    const view = render(<CocktailLabV2 fullData={fullData} userProfile={up} auth={SIGNED_OUT} />);
    await openInvent();
    fireEvent.click(screen.getByTestId('mock-save'));
    await screen.findByTestId('invent-save-signin');
    fireEvent.click(screen.getByTestId('mock-close'));
    expect(screen.queryByTestId('invent-save-signin')).toBeNull();
    view.rerender(<CocktailLabV2 fullData={fullData} userProfile={up} auth={SIGNED_IN} />);
    expect(up.saveInvention).not.toHaveBeenCalled();
  });

  it('a writer failure resolves error and nothing is lost', async () => {
    const up = withSaved([]);
    up.saveInvention = vi.fn(() => ({ ok: false, reason: 'Could not save on this device. Nothing was lost; try again.' }));
    render(<CocktailLabV2 fullData={fullData} userProfile={up} auth={SIGNED_IN} />);
    await openInvent();
    fireEvent.click(screen.getByTestId('mock-save'));
    await waitFor(() => expect(screen.getByTestId('mock-result').textContent).toContain('error'));
    expect(JSON.parse(screen.getByTestId('mock-result').textContent).message).toMatch(/Nothing was lost/);
    expect(screen.getByTestId('mock-invent')).toBeInTheDocument();
  });
});

describe('CocktailLabV2 — the cook’s own cocktails in the list', () => {
  it('shows nothing extra when nothing is saved, signed in or not', async () => {
    render(<CocktailLabV2 fullData={fullData} userProfile={withSaved([])} auth={SIGNED_IN} />);
    await screen.findByLabelText(/search cocktails/i);
    expect(screen.queryByTestId('cocktail-yours-group')).toBeNull();
    expect(screen.queryByTestId('yours-tag')).toBeNull();
  });

  it('a profile with malformed entries lists as empty without an error', async () => {
    const up = { profile: { cocktails: [null, 4, { id: 'x' }, { name: 'legacy', ingredients: ['rum'] }] }, saveInvention: vi.fn(), deleteInvention: vi.fn() };
    render(<CocktailLabV2 fullData={fullData} userProfile={up} auth={SIGNED_IN} />);
    await screen.findByLabelText(/search cocktails/i);
    expect(screen.queryByTestId('cocktail-yours-group')).toBeNull();
  });

  it('a "Yours" group at the top, and the item again inside its family, both marked', async () => {
    render(<CocktailLabV2 fullData={fullData} userProfile={withSaved([item()])} auth={SIGNED_IN} />);
    const group = await screen.findByTestId('cocktail-yours-group');
    expect(within(group).getByText('Gin Vermouth Thing')).toBeInTheDocument();
    expect(within(group).getByTestId('yours-tag')).toBeInTheDocument();
    expect(screen.getAllByText('Gin Vermouth Thing')).toHaveLength(2);
    expect(screen.getAllByTestId('yours-tag')).toHaveLength(2);
    const sections = [...document.querySelectorAll('[data-browse-root] section')];
    expect(sections[0]).toBe(group);
    const family3 = codex.families.find((f) => f.id === 3);
    const inFamily = sections.slice(1).find((s) => s.textContent.includes(family3.name));
    expect(inFamily.textContent).toContain('Gin Vermouth Thing');
  });

  it('is found by the existing search, by name and by ingredient', async () => {
    render(<CocktailLabV2 fullData={fullData} userProfile={withSaved([item()])} auth={SIGNED_IN} />);
    const box = await screen.findByLabelText(/search cocktails/i);
    fireEvent.change(box, { target: { value: 'vermouth thing' } });
    expect(within(screen.getByTestId('cocktail-yours-group')).getByText('Gin Vermouth Thing')).toBeInTheDocument();
    fireEvent.change(box, { target: { value: 'sweet vermouth' } });
    expect(within(screen.getByTestId('cocktail-yours-group')).getByText('Gin Vermouth Thing')).toBeInTheDocument();
    fireEvent.change(box, { target: { value: 'zzzz-nothing' } });
    expect(screen.queryByTestId('cocktail-yours-group')).toBeNull();
  });

  it('an item with no family sits in the Yours group and an Uncategorised section', async () => {
    const odd = item({ id: 'inv-2', name: 'Strange One', category: null, lines: L(['zzz one', ''], ['zzz two', '']) });
    render(<CocktailLabV2 fullData={fullData} userProfile={withSaved([odd])} auth={SIGNED_IN} />);
    const group = await screen.findByTestId('cocktail-yours-group');
    expect(within(group).getByText('Strange One')).toBeInTheDocument();
    const un = screen.getByTestId('cocktail-uncategorised-group');
    expect(within(un).getByText('Strange One')).toBeInTheDocument();
    expect(un).toHaveTextContent('Uncategorised');
  });

  it('is counted by what-can-I-make when the bar covers it', async () => {
    localStorage.setItem('fn-my-bar', JSON.stringify(['gin', 'sweet vermouth']));
    render(<CocktailLabV2 fullData={fullData} userProfile={withSaved([item()])} auth={SIGNED_IN} />);
    const toggle = await screen.findByTestId('cocktail-bar-only');
    await waitFor(() => expect(toggle).not.toBeDisabled());
    fireEvent.click(toggle);
    const group = await screen.findByTestId('cocktail-yours-group');
    expect(within(group).getByText('Gin Vermouth Thing')).toBeInTheDocument();
    expect(screen.queryByText('Daiquiri')).toBeNull();
  });

  it('is not counted when the bar does not cover it', async () => {
    localStorage.setItem('fn-my-bar', JSON.stringify(['rum']));
    render(<CocktailLabV2 fullData={fullData} userProfile={withSaved([item()])} auth={SIGNED_IN} />);
    const toggle = await screen.findByTestId('cocktail-bar-only');
    await waitFor(() => expect(toggle).not.toBeDisabled());
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.queryByTestId('cocktail-yours-group')).toBeNull());
  });
});

describe('CocktailLabV2 — Edit and Delete', () => {
  const openCard = async (up, name = 'Gin Vermouth Thing') => {
    render(<CocktailLabV2 fullData={fullData} userProfile={up} auth={SIGNED_IN} />);
    const group = await screen.findByTestId('cocktail-yours-group');
    fireEvent.click(within(group).getByText(name));
    return screen.findByTestId('lab-node-card');
  };

  it('opens the normal card, marked yours, with the saved method and ingredients', async () => {
    const card = await openCard(withSaved([item()]));
    expect(within(card).getByTestId('saved-edit')).toBeInTheDocument();
    expect(within(card).getByTestId('saved-delete')).toBeInTheDocument();
    expect(card).toHaveTextContent('Yours');
    expect(within(card).getByTestId('lab-node-card-ingredients')).toHaveTextContent('gin');
    expect(within(card).getByTestId('lab-node-card-prep')).toHaveTextContent('Stir with ice.');
  });

  it('PROFILE-1: the cook-made card and a codex card both have a Flavor profile button beside Riff', async () => {
    const view = render(<CocktailLabV2 fullData={fullData} userProfile={withSaved([item()])} auth={SIGNED_IN} />);
    fireEvent.click(within(await screen.findByTestId('cocktail-yours-group')).getByText('Gin Vermouth Thing'));
    let card = await screen.findByTestId('lab-node-card');
    expect(within(card).getByTestId('flavor-profile-button').previousElementSibling).toBe(within(card).getByTestId('cocktail-riff-open'));
    fireEvent.click(within(card).getByTestId('flavor-profile-button'));
    expect(within(card).getByTestId('flavor-profile-section')).toBeInTheDocument();
    view.unmount();
    render(<CocktailLabV2 fullData={fullData} userProfile={withSaved([item()])} auth={SIGNED_IN} />);
    fireEvent.click((await screen.findAllByText('Daiquiri'))[0]);
    card = await screen.findByTestId('lab-node-card');
    expect(within(card).getByTestId('flavor-profile-button').previousElementSibling).toBe(within(card).getByTestId('cocktail-riff-open'));
    fireEvent.click(within(card).getByTestId('flavor-profile-button'));
    expect(within(card).getByTestId('flavor-profile-section')).toBeInTheDocument();
  });

  it('codex cocktails never show Edit or Delete', async () => {
    render(<CocktailLabV2 fullData={fullData} userProfile={withSaved([item()])} auth={SIGNED_IN} />);
    fireEvent.click((await screen.findAllByText('Daiquiri'))[0]);
    const card = await screen.findByTestId('lab-node-card');
    expect(within(card).queryByTestId('saved-edit')).toBeNull();
    expect(within(card).queryByTestId('saved-delete')).toBeNull();
  });

  it('Edit reopens the panel with the same name, category and lines; saving again updates in place', async () => {
    const up = withSaved([item()]);
    const card = await openCard(up);
    fireEvent.click(within(card).getByTestId('saved-edit'));
    await screen.findByTestId('mock-invent');
    expect(panelProps.current.editItem).toEqual({
      id: 'inv-1', name: 'Gin Vermouth Thing',
      baseline: { category: 3, method: 'Stir with ice.' },
      lines: [{ key: 'gin', amount: '2 oz', role: null, source: 'user' }, { key: 'sweet vermouth', amount: '1 oz', role: null, source: 'user' }],
    });
    fireEvent.click(screen.getByTestId('mock-save'));
    await waitFor(() => expect(up.saveInvention).toHaveBeenCalledTimes(1));
    expect(up.saveInvention.mock.calls[0][0]).toMatchObject({ kind: 'cocktail', id: 'inv-1' });
  });

  it('the ordinary Invent button after an edit starts with no editItem', async () => {
    const card = await openCard(withSaved([item()]));
    fireEvent.click(within(card).getByTestId('saved-edit'));
    await screen.findByTestId('mock-invent');
    fireEvent.click(screen.getByTestId('mock-close'));
    await openInvent();
    expect(panelProps.current.editItem).toBeNull();
  });

  it('Delete asks first and only removes it when confirmed', async () => {
    const up = withSaved([item()]);
    const card = await openCard(up);
    fireEvent.click(within(card).getByTestId('saved-delete'));
    expect(screen.getByTestId('saved-delete-confirm')).toHaveTextContent('Gin Vermouth Thing');
    expect(up.deleteInvention).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('saved-delete-confirm-no'));
    expect(up.deleteInvention).not.toHaveBeenCalled();
    expect(screen.queryByTestId('saved-delete-confirm')).toBeNull();
    fireEvent.click(within(screen.getByTestId('lab-node-card')).getByTestId('saved-delete'));
    await act(async () => { fireEvent.click(screen.getByTestId('saved-delete-confirm-yes')); });
    expect(up.deleteInvention).toHaveBeenCalledWith('cocktail', 'inv-1');
    expect(screen.queryByTestId('lab-node-card')).toBeNull();
  });
});
