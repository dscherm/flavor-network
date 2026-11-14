// @vitest-environment jsdom
// INVENT-12: the cook's own sauces in the Sauce Lab — onSave, the "Yours" group, pantry, Edit / Delete.
// The invent panel is mocked (it is being rewritten elsewhere); the profile writer is mocked.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';

const { node } = vi.hoisted(() => {
  const fams = [{ id: 0, name: 'Béchamel' }, { id: 3, name: 'Hollandaise' }, { id: 4, name: 'Tomato' }];
  return {
    node: (name, family_id, ingredients, extra = {}) => ({
      name, family_id, family: fams.find((f) => f.id === family_id).name, ingredients,
      ingredientsDetailed: ingredients.map((n) => ({ name: n, measure: '' })),
      cuisine: 'French', instructions: 'Whisk.', proteins: [], ...extra,
    }),
  };
});

vi.mock('../../data/sauceCodex.js', () => ({
  loadSauceCodex: vi.fn().mockResolvedValue({
    nodes: new Map([
      ['Hollandaise', node('Hollandaise', 3, ['egg yolk', 'butter', 'lemon juice', 'salt'], { isRoot: true })],
      ['Béchamel', node('Béchamel', 0, ['butter', 'flour', 'milk', 'nutmeg'], { isRoot: true })],
      ['Marinara', node('Marinara', 4, ['tomato', 'garlic', 'olive oil'])],
    ]),
    edges: [],
    ingredientList: ['Béchamel', 'Hollandaise'],
    ingredientToSauces: new Map(),
    codex: { clusters: [{ id: 0, name: 'Béchamel', color: '#f5f0d6' }, { id: 3, name: 'Hollandaise', color: '#f3d44e' }, { id: 4, name: 'Tomato', color: '#d94a3d' }] },
    ingredientMeta: [
      { name: 'butter', category: 'Fat' }, { name: 'egg yolk', category: 'Thickener' }, { name: 'flour', category: 'Thickener' },
      { name: 'lemon juice', category: 'Acid' }, { name: 'milk', category: 'Liquid' }, { name: 'nutmeg', category: 'Seasoning' },
      { name: 'tomato', category: 'Liquid' }, { name: 'garlic', category: 'Aromatic' }, { name: 'olive oil', category: 'Fat' },
      { name: 'basil', category: 'Herb' }, { name: 'miso', category: 'Seasoning' },
    ],
    pairings: [{ source: 'butter', target: 'egg yolk', strength: 0.9 }],
  }),
  computeSauceCodexPositions: vi.fn().mockReturnValue({}),
}));
vi.mock('../SaucePairings.jsx', () => ({ default: () => null }));
const panelProps = { current: null };
vi.mock('../InventSauce.jsx', () => ({
  default: (props) => {
    panelProps.current = props;
    return (
      <div data-testid="mock-invent">
        <span data-testid="mock-result" />
        <button type="button" data-testid="mock-save" onClick={async () => {
          const r = await props.onSave({ kind: 'sauce', ...(props.editItem ? { id: props.editItem.id } : {}), name: 'Panel Sauce', category: 'Tomato', lines: [{ key: 'tomato', amount: '1 can', role: null }, { key: 'basil', amount: '', role: null }] });
          document.querySelector('[data-testid="mock-result"]').textContent = JSON.stringify(r);
        }}>save</button>
        <button type="button" data-testid="mock-close" onClick={props.onClose}>close</button>
      </div>
    );
  },
}));

import SauceLab from '../SauceLab.jsx';

const L = (...pairs) => pairs.map(([key, amount]) => ({ key, amount, role: null }));
const item = (over = {}) => ({
  id: 'sau-1', kind: 'sauce', name: 'Miso Butter', createdAt: 1, category: 'Hollandaise', source: 'invent',
  lines: L(['miso', '1 tbsp'], ['butter', '4 tbsp']), method: 'Melt and whisk.', protein: 'salmon', ...over,
});
const withSaved = (items) => ({ profile: { sauces: items }, saveInvention: vi.fn(() => ({ ok: true, item: {} })), deleteInvention: vi.fn(() => true) });
const SIGNED_IN = { user: { uid: 'u1' }, loginWithGoogle: vi.fn(), loginWithApple: vi.fn(), authError: null };
const SIGNED_OUT = { user: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn(), authError: null };
const fullData = { graph: { nodes: new Map([['tomato', { gnnProbs: {} }]]), edges: [] } };

beforeEach(() => { localStorage.clear(); panelProps.current = null; });

const openInvent = async () => { fireEvent.click(await screen.findByTestId('sauce-invent-open')); return screen.findByTestId('mock-invent'); };

describe('SauceLab — saving an invention', () => {
  it('hands the panel the profile nodes and an onSave; without a writer, none', async () => {
    const view = render(<SauceLab fullData={fullData} userProfile={withSaved([])} auth={SIGNED_IN} />);
    await openInvent();
    expect(panelProps.current.nodes).toBe(fullData.graph.nodes);
    expect(typeof panelProps.current.onSave).toBe('function');
    expect(panelProps.current.editItem).toBeNull();
    view.unmount();
    render(<SauceLab fullData={fullData} />);
    await openInvent();
    expect(panelProps.current.onSave).toBeNull();
  });

  it('signed in: saves through the writer and confirms', async () => {
    const up = withSaved([]);
    render(<SauceLab fullData={fullData} userProfile={up} auth={SIGNED_IN} />);
    await openInvent();
    fireEvent.click(screen.getByTestId('mock-save'));
    await waitFor(() => expect(screen.getByTestId('mock-result').textContent).toContain('saved'));
    expect(JSON.parse(screen.getByTestId('mock-result').textContent)).toEqual({ status: 'saved', message: 'Saved to your sauces' });
    expect(up.saveInvention.mock.calls[0][0]).toMatchObject({ kind: 'sauce', name: 'Panel Sauce', category: 'Tomato' });
  });

  it('signed out: shows sign-in, then saves the same invention exactly once after sign-in', async () => {
    const up = withSaved([]);
    const view = render(<SauceLab fullData={fullData} userProfile={up} auth={SIGNED_OUT} />);
    await openInvent();
    fireEvent.click(screen.getByTestId('mock-save'));
    await screen.findByTestId('invent-save-signin');
    expect(JSON.parse(screen.getByTestId('mock-result').textContent).status).toBe('signin');
    expect(up.saveInvention).not.toHaveBeenCalled();
    view.rerender(<SauceLab fullData={fullData} userProfile={up} auth={SIGNED_IN} />);
    await waitFor(() => expect(up.saveInvention).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('invent-save-toast')).toHaveTextContent('Saved to your sauces');
    view.rerender(<SauceLab fullData={fullData} userProfile={up} auth={{ ...SIGNED_IN, user: { uid: 'u1' } }} />);
    expect(up.saveInvention).toHaveBeenCalledTimes(1);
  });

  it('closing the panel drops a save waiting on sign-in; a writer failure resolves error', async () => {
    const up = withSaved([]);
    const view = render(<SauceLab fullData={fullData} userProfile={up} auth={SIGNED_OUT} />);
    await openInvent();
    fireEvent.click(screen.getByTestId('mock-save'));
    await screen.findByTestId('invent-save-signin');
    fireEvent.click(screen.getByTestId('mock-close'));
    expect(screen.queryByTestId('invent-save-signin')).toBeNull();
    view.rerender(<SauceLab fullData={fullData} userProfile={up} auth={SIGNED_IN} />);
    expect(up.saveInvention).not.toHaveBeenCalled();
    up.saveInvention = vi.fn(() => ({ ok: false, reason: 'Could not save on this device. Nothing was lost; try again.' }));
    await openInvent();
    fireEvent.click(screen.getByTestId('mock-save'));
    await waitFor(() => expect(screen.getByTestId('mock-result').textContent).toContain('error'));
  });
});

describe('SauceLab — the cook’s own sauces in the list', () => {
  it('looks exactly as before with nothing saved, or with malformed entries', async () => {
    render(<SauceLab userProfile={withSaved([null, 3, { id: 'q' }, { name: 'old', ingredients: ['a'] }])} auth={SIGNED_IN} />);
    await screen.findByLabelText(/search sauces/i);
    expect(screen.queryByTestId('sauce-yours-group')).toBeNull();
    expect(screen.queryByTestId('yours-tag')).toBeNull();
  });

  it('a "Yours" group at the top, and the sauce again inside its family, both marked', async () => {
    render(<SauceLab userProfile={withSaved([item()])} auth={SIGNED_IN} />);
    const group = await screen.findByTestId('sauce-yours-group');
    expect(within(group).getByText('Miso Butter')).toBeInTheDocument();
    expect(within(group).getByTestId('yours-tag')).toBeInTheDocument();
    expect(screen.getAllByText('Miso Butter')).toHaveLength(2);
    expect(screen.getAllByTestId('yours-tag')).toHaveLength(2);
    const sections = [...document.querySelectorAll('[data-sauce-browse-root] section')];
    expect(sections[0]).toBe(group);
    expect(sections.slice(1).find((s) => s.textContent.includes('Miso Butter')).textContent).toContain('Hollandaise');
  });

  it('is found by search, by name and by ingredient, and counted by the match count', async () => {
    render(<SauceLab userProfile={withSaved([item()])} auth={SIGNED_IN} />);
    const box = await screen.findByLabelText(/search sauces/i);
    fireEvent.change(box, { target: { value: 'miso butter' } });
    expect(within(screen.getByTestId('sauce-yours-group')).getByText('Miso Butter')).toBeInTheDocument();
    fireEvent.change(box, { target: { value: 'miso' } });
    expect(within(screen.getByTestId('sauce-yours-group')).getByText('Miso Butter')).toBeInTheDocument();
    expect(screen.getByText(/1 sauce match/)).toBeInTheDocument();
    fireEvent.change(box, { target: { value: 'zzzz-nothing' } });
    expect(screen.queryByTestId('sauce-yours-group')).toBeNull();
  });

  it('an item with no family sits in the Yours group and an Uncategorised section', async () => {
    const odd = item({ id: 'sau-2', name: 'Strange Sauce', category: null, lines: L(['zzz one', ''], ['zzz two', '']) });
    render(<SauceLab userProfile={withSaved([odd])} auth={SIGNED_IN} />);
    const un = await screen.findByTestId('sauce-uncategorised-group');
    expect(within(un).getByText('Strange Sauce')).toBeInTheDocument();
    expect(within(screen.getByTestId('sauce-yours-group')).getByText('Strange Sauce')).toBeInTheDocument();
  });

  it('is counted by the pantry when the kitchen covers it', async () => {
    localStorage.setItem('fn-my-kitchen', JSON.stringify(['miso', 'butter']));
    render(<SauceLab userProfile={withSaved([item()])} auth={SIGNED_IN} />);
    fireEvent.click(await screen.findByTestId('sauce-pantry-open'));
    expect(within(screen.getByTestId('sauce-pantry-make')).getByText('Miso Butter')).toBeInTheDocument();
  });
});

describe('SauceLab — Edit and Delete', () => {
  const openCard = async (up) => {
    render(<SauceLab userProfile={up} auth={SIGNED_IN} />);
    fireEvent.click(within(await screen.findByTestId('sauce-yours-group')).getByText('Miso Butter'));
    return screen.findByTestId('lab-node-card');
  };

  it('opens the normal card, marked yours, with Edit and Delete', async () => {
    const card = await openCard(withSaved([item()]));
    expect(card).toHaveTextContent('YOURS');
    expect(within(card).getByTestId('saved-edit')).toBeInTheDocument();
    expect(within(card).getByTestId('saved-delete')).toBeInTheDocument();
    expect(within(card).getByTestId('lab-node-card-ingredients')).toHaveTextContent('miso');
    expect(within(card).getByTestId('lab-node-card-prep')).toHaveTextContent('Melt and whisk.');
  });

  it('codex sauces never show Edit or Delete', async () => {
    render(<SauceLab userProfile={withSaved([item()])} auth={SIGNED_IN} />);
    fireEvent.click((await screen.findAllByText('Marinara'))[0]);
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
      id: 'sau-1', name: 'Miso Butter',
      baseline: { category: 'Hollandaise', protein: 'salmon', method: 'Melt and whisk.' },
      lines: [{ key: 'miso', amount: '1 tbsp', role: null, source: 'user' }, { key: 'butter', amount: '4 tbsp', role: null, source: 'user' }],
    });
    fireEvent.click(screen.getByTestId('mock-save'));
    await waitFor(() => expect(up.saveInvention).toHaveBeenCalledTimes(1));
    expect(up.saveInvention.mock.calls[0][0]).toMatchObject({ kind: 'sauce', id: 'sau-1' });
  });

  it('Delete asks first and only removes it when confirmed', async () => {
    const up = withSaved([item()]);
    const card = await openCard(up);
    fireEvent.click(within(card).getByTestId('saved-delete'));
    expect(screen.getByTestId('saved-delete-confirm')).toHaveTextContent('Miso Butter');
    fireEvent.click(screen.getByTestId('saved-delete-confirm-no'));
    expect(up.deleteInvention).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByTestId('lab-node-card')).getByTestId('saved-delete'));
    await act(async () => { fireEvent.click(screen.getByTestId('saved-delete-confirm-yes')); });
    expect(up.deleteInvention).toHaveBeenCalledWith('sauce', 'sau-1');
    expect(screen.queryByTestId('lab-node-card')).toBeNull();
  });
});
