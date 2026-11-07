// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

const { node } = vi.hoisted(() => {
  const fams = [{ id: 0, name: 'Béchamel' }, { id: 3, name: 'Hollandaise' }];
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
      ['Beurre Blanc', node('Beurre Blanc', 3, ['cold butter', 'shallot', 'white wine'])],
    ]),
    edges: [],
    ingredientList: ['Béchamel', 'Hollandaise'],
    ingredientToSauces: new Map(),
    codex: { clusters: [{ id: 0, name: 'Béchamel', color: '#f5f0d6' }, { id: 3, name: 'Hollandaise', color: '#f3d44e' }] },
    ingredientMeta: [
      { name: 'butter', category: 'Fat' }, { name: 'egg yolk', category: 'Thickener' }, { name: 'flour', category: 'Thickener' },
      { name: 'lemon juice', category: 'Acid' }, { name: 'milk', category: 'Liquid' }, { name: 'nutmeg', category: 'Seasoning' },
      { name: 'shallot', category: 'Aromatic' }, { name: 'white wine', category: 'Liquid' },
    ],
    pairings: [{ source: 'butter', target: 'egg yolk', strength: 0.9 }],
  }),
  computeSauceCodexPositions: vi.fn().mockReturnValue({}),
}));
vi.mock('../SaucePairings.jsx', () => ({ default: () => null }));

import SauceLab from '../SauceLab.jsx';

describe('Sauce Lab — My pantry and Invent a sauce', () => {
  beforeEach(() => { localStorage.clear(); });

  it('the two buttons sit under the search box and open full panels with Back', async () => {
    localStorage.setItem('fn-my-kitchen', JSON.stringify(['egg yolk', 'lemon']));
    render(<SauceLab onOpenRecipeLab={vi.fn()} />);
    const open = await screen.findByTestId('sauce-pantry-open');
    expect(open).toHaveTextContent('My pantry (2)');
    fireEvent.click(open);
    const panel = screen.getByTestId('sauce-pantry-panel');
    expect(within(screen.getByTestId('sauce-pantry-make')).getByText('Hollandaise')).toBeInTheDocument();
    // Panel → Invent → Back.
    fireEvent.click(within(panel).getByTestId('sauce-pantry-invent'));
    expect(screen.getByTestId('sauce-invent')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('sauce-invent-close'));
    expect(screen.queryByTestId('sauce-invent')).toBeNull();
    fireEvent.click(screen.getByTestId('sauce-invent-open'));
    expect(screen.getByTestId('sauce-invent')).toBeInTheDocument();
  });

  it('a sauce opened from the pantry returns to the pantry when its card closes', async () => {
    localStorage.setItem('fn-my-kitchen', JSON.stringify(['egg yolk', 'lemon']));
    render(<SauceLab />);
    fireEvent.click(await screen.findByTestId('sauce-pantry-open'));
    fireEvent.click(within(screen.getByTestId('sauce-pantry-make')).getByText('Hollandaise'));
    expect(screen.queryByTestId('sauce-pantry-panel')).toBeNull();
    const back = screen.getAllByRole('button').find((b) => /back/i.test(b.textContent || b.getAttribute('aria-label') || ''));
    fireEvent.click(back);
    await waitFor(() => expect(screen.getByTestId('sauce-pantry-panel')).toBeInTheDocument());
  });

  it('passes the sauce catalogue through: "cold butter" is covered by butter', async () => {
    localStorage.setItem('fn-my-kitchen', JSON.stringify(['shallot', 'white wine']));
    render(<SauceLab />);
    fireEvent.click(await screen.findByTestId('sauce-pantry-open'));
    expect(within(screen.getByTestId('sauce-pantry-make')).getByText('Beurre Blanc')).toBeInTheDocument();
  });

  it('edits the shared kitchen list', async () => {
    render(<SauceLab />);
    fireEvent.click(await screen.findByTestId('sauce-pantry-open'));
    fireEvent.change(screen.getByTestId('sauce-pantry-input'), { target: { value: 'milk' } });
    fireEvent.click(screen.getByTestId('sauce-pantry-add'));
    expect(JSON.parse(localStorage.getItem('fn-my-kitchen'))).toEqual(['milk']);
  });
});
