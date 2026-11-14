// @vitest-environment jsdom
// INVENT-6: ✨ Invent this on the Sauce Lab, through the real browse list and the real Invent panel.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../../data/sauceCodex.js', async () => {
  const fs = (await import('node:fs')).default;
  const augment = JSON.parse(fs.readFileSync(`${process.cwd()}/public/data/sauce_augment.json`, 'utf8'));
  const clusters = ['Béchamel', 'Velouté', 'Espagnole', 'Hollandaise', 'Tomato', 'Curry', 'Stir-fry', 'Mole', 'Salsa', 'Nut Sauce']
    .map((name, id) => ({ id, name, color: '#cccccc' }));
  const nodes = new Map();
  for (const s of augment.sauces) {
    const fam = clusters.find((c) => c.name === s.motherSauce);
    if (!fam) continue;
    const ingredients = s.ingredients.map((i) => i.name);
    nodes.set(s.name, { ...s, ingredients, ingredientsDetailed: s.ingredients, family_id: fam.id, family: fam.name, isRoot: s.name === fam.name });
  }
  return {
    loadSauceCodex: vi.fn().mockResolvedValue({
      nodes, edges: [], ingredientList: [...nodes.keys()], ingredientToSauces: new Map(), graph: undefined,
      codex: { clusters }, ingredientMeta: augment.ingredients, pairings: augment.pairings,
    }),
    computeSauceCodexPositions: vi.fn().mockReturnValue({}),
  };
});
vi.mock('../SaucePairings.jsx', () => ({ default: () => null }));

import SauceLab from '../SauceLab.jsx';

describe('SauceLab — ✨ Invent this', () => {
  beforeEach(() => { localStorage.clear(); });
  const search = async (v) => fireEvent.change(await screen.findByLabelText(/search sauces/i), { target: { value: v } });
  const lineText = (id) => screen.getByTestId(`sauce-invent-slots-line-${id}`).textContent;

  it("'tomato, basil' opens InventSauce with both locked under a fitting technique; closing keeps the search", async () => {
    render(<SauceLab />);
    await search('tomato, basil');
    fireEvent.click(await screen.findByTestId('sauce-invent-this'));
    expect(screen.getByTestId('sauce-invent')).toBeInTheDocument();
    const slots = screen.getByTestId('sauce-invent');
    expect(lineText('tomato')).toBe('tomato');
    expect(within(slots).getAllByText(/from your search/).length).toBeGreaterThanOrEqual(2);
    expect(slots).toHaveTextContent('basil');
    expect(screen.getByTestId('sauce-invent-styles').querySelector('[aria-pressed="true"]')).toHaveTextContent(/Tomato/);
    fireEvent.click(screen.getByTestId('sauce-invent-close'));
    expect(screen.queryByTestId('sauce-invent')).toBeNull();
    expect(screen.getByLabelText(/search sauces/i)).toHaveValue('tomato, basil');
  });

  it('changing the technique keeps the searched ingredients', async () => {
    render(<SauceLab />);
    await search('tomato, basil');
    fireEvent.click(await screen.findByTestId('sauce-invent-this'));
    fireEvent.click(within(screen.getByTestId('sauce-invent-styles')).getByRole('button', { name: /Curry base/ }));
    const panel = screen.getByTestId('sauce-invent');
    expect(panel).toHaveTextContent('tomato');
    expect(panel).toHaveTextContent('basil');
    expect(within(panel).getAllByText(/from your search/).length).toBeGreaterThanOrEqual(2);
  });

  it("'chicken, lemon' sets the protein and pins lemon", async () => {
    render(<SauceLab />);
    await search('chicken, lemon');
    fireEvent.click(await screen.findByTestId('sauce-invent-this'));
    expect(within(screen.getByTestId('sauce-invent-proteins')).getByRole('button', { name: 'chicken' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('sauce-invent')).toHaveTextContent('lemon');
  });

  it('the ordinary Invent button starts fresh', async () => {
    render(<SauceLab />);
    await search('tomato, basil');
    fireEvent.click(await screen.findByTestId('sauce-invent-this'));
    fireEvent.click(screen.getByTestId('sauce-invent-close'));
    fireEvent.click(screen.getByTestId('sauce-invent-open'));
    expect(within(screen.getByTestId('sauce-invent')).queryAllByText(/from your search/)).toHaveLength(0);
  });
});
