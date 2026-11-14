// @vitest-environment jsdom
// INVENT-6: ✨ Invent this on the Cocktail Lab, through the real browse list and the real Invent panel.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const codex = read('public/data/cocktail_codex_v2.json');
const ingredients = read('public/proDataset/ingredients.json');
const roles = read('public/data/cocktail_roles.json').byIngredient;

vi.mock('../NetworkScene.jsx', () => ({ default: () => null }));
vi.mock('../ClusterJoystick.jsx', () => ({ default: () => null }));
vi.mock('../ShapeLegend.jsx', () => ({ default: () => null }));
vi.mock('../../three/AxisLabels.js', () => ({ createClusterLabels: () => ({ add: () => {} }), createGlowSprite: () => ({}) }));
vi.mock('../../data/cocktailCodexV2.js', () => ({
  loadCodexV2: (raw) => raw,
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

import CocktailLabV2 from '../CocktailLabV2.jsx';

const keep = new Set(['Negroni', 'Gimlet', 'Old-Fashioned', 'Daiquiri']);
const picked = codex.cocktails.filter((c) => keep.has(c.name));
const families = codex.families;
const GRAPH = {
  ...codex,
  cocktails: picked,
  byFamily: new Map(families.map((f) => [f.id, picked.filter((c) => c.family_id === f.id)])),
};
const fullData = { graph: { nodes: new Map(Object.entries(ingredients)), edges: [] } };

describe('CocktailLabV2 — ✨ Invent this', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => GRAPH });
  });

  const search = async (v) => {
    const box = await screen.findByLabelText(/search cocktails/i);
    fireEvent.change(box, { target: { value: v } });
  };
  const lineText = (id) => screen.getByTestId(`invent-line-${id}`).textContent;

  it("'gin, cucumber' opens InventCocktail with gin and cucumber locked; closing keeps the search", async () => {
    render(<CocktailLabV2 fullData={fullData} />);
    await search('gin, cucumber');
    await waitFor(() => expect(screen.getByTestId('cocktail-invent-this-summary')).toHaveTextContent('gin + cucumber'));
    fireEvent.click(screen.getByTestId('cocktail-invent-this'));
    expect(screen.getByTestId('invent-cocktail')).toBeInTheDocument();
    expect(lineText('base')).toBe('gin');
    expect(screen.getByTestId('invent-slot-base')).toHaveTextContent(/locked/);
    expect(screen.getByTestId('invent-extras')).toHaveTextContent('cucumber');
    fireEvent.click(screen.getByTestId('invent-close'));
    expect(screen.queryByTestId('invent-cocktail')).toBeNull();
    expect(screen.getByLabelText(/search cocktails/i)).toHaveValue('gin, cucumber');
  });

  it('changing the style keeps the searched ingredients', async () => {
    render(<CocktailLabV2 fullData={fullData} />);
    await search('gin, cucumber');
    fireEvent.click(await screen.findByTestId('cocktail-invent-this'));
    fireEvent.click(within(screen.getByTestId('invent-families')).getByLabelText(/Highballs/));
    expect(lineText('base')).toBe('gin');
    expect(screen.getByTestId('invent-extras')).toHaveTextContent('cucumber');
  });

  it("'negroni, mezcal' opens the Negroni's family with mezcal as the base", async () => {
    render(<CocktailLabV2 fullData={fullData} />);
    await search('negroni, mezcal');
    fireEvent.click(await screen.findByTestId('cocktail-invent-this'));
    expect(lineText('base')).toBe('mezcal');
    expect(lineText('vermouth')).toBe('sweet vermouth');
  });

  it('the ordinary Invent button starts fresh, with no old seed', async () => {
    render(<CocktailLabV2 fullData={fullData} />);
    await search('gin, cucumber');
    fireEvent.click(await screen.findByTestId('cocktail-invent-this'));
    fireEvent.click(screen.getByTestId('invent-close'));
    fireEvent.click(screen.getByTestId('cocktail-invent-open'));
    expect(screen.getByTestId('invent-cocktail').textContent).not.toMatch(/from your search/);
  });
});
