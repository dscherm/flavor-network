// @vitest-environment jsdom
// INVENT-6: "✨ Invent this" on the three search bars, and the panels it opens.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import CocktailBrowse from '../CocktailBrowse.jsx';
import SauceBrowse from '../SauceBrowse.jsx';
import CookbookLab from '../CookbookLab.jsx';

const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

vi.mock('../NetworkScene.jsx', () => ({ default: () => null }));

// ── Cocktail browse ─────────────────────────────────────────────────
const cocktail = (name, ings) => ({
  name, canonical: name.toLowerCase(), family_id: 0, subcluster_id: '0.1', ingredients_raw: ings.map((raw) => ({ raw })),
  build_method: 'stir', ice_format: 'rocks',
});
const COCKTAIL_GRAPH = {
  families: [{ id: 0, name: 'Sours', color: '#88ccff' }],
  byFamily: new Map([[0, [cocktail('Gimlet', ['Gin', 'Lime juice']), cocktail('Negroni', ['Gin', 'Campari'])]]]),
};
const cocktailBrowse = (props = {}) => render(
  <CocktailBrowse graph={COCKTAIL_GRAPH} selectedCocktail={null} onSelectCocktail={vi.fn()} filterFamily={null}
    onFilterFamily={vi.fn()} filterSpirit={null} onFilterSpirit={vi.fn()} {...props} />,
);

describe('CocktailBrowse — ✨ Invent this', () => {
  it('is hidden with an empty search and without the handler', () => {
    cocktailBrowse({ onInventThis: vi.fn() });
    expect(screen.queryByTestId('cocktail-invent-this')).toBeNull();
    fireEvent.change(screen.getByLabelText(/search cocktails/i), { target: { value: 'gin' } });
    expect(screen.getByTestId('cocktail-invent-this')).toHaveTextContent(/^Invent this$/);
  });
  it('is not rendered at all without onInventThis', () => {
    cocktailBrowse();
    fireEvent.change(screen.getByLabelText(/search cocktails/i), { target: { value: 'gin' } });
    expect(screen.queryByTestId('cocktail-invent-this')).toBeNull();
  });
  it('shows the seeder summary and calls the handler with the query', () => {
    const onInventThis = vi.fn();
    cocktailBrowse({ onInventThis, inventSummary: (q) => `idea: ${q}` });
    fireEvent.change(screen.getByLabelText(/search cocktails/i), { target: { value: ' gin, lime ' } });
    expect(screen.getByTestId('cocktail-invent-this-summary')).toHaveTextContent('idea:');
    fireEvent.click(screen.getByTestId('cocktail-invent-this'));
    expect(onInventThis).toHaveBeenCalledWith('gin, lime');
  });
  it('with 0 matches the empty state invites inventing, with the same button', () => {
    const onInventThis = vi.fn();
    cocktailBrowse({ onInventThis });
    fireEvent.change(screen.getByLabelText(/search cocktails/i), { target: { value: 'gin, cucumber, chartreuse' } });
    const empty = screen.getByTestId('cocktail-invent-empty');
    expect(empty).toHaveTextContent('No cocktail has gin + cucumber + chartreuse — invent one?');
    fireEvent.click(within(empty).getByTestId('cocktail-invent-this'));
    expect(onInventThis).toHaveBeenCalledWith('gin, cucumber, chartreuse');
    expect(screen.getAllByTestId('cocktail-invent-this')).toHaveLength(1);
  });
  it('shows ONE empty state: the invent offer, with the way back inside it', () => {
    cocktailBrowse({ onInventThis: vi.fn() });
    fireEvent.change(screen.getByLabelText(/search cocktails/i), { target: { value: 'gin, cucumber, chartreuse' } });
    expect(screen.queryByText(/No cocktails match these filters/)).toBeNull();
    expect(within(screen.getByTestId('cocktail-invent-empty')).getByTestId('cocktail-invent-empty-clear')).toHaveTextContent('Clear search and filters');
    fireEvent.click(screen.getByTestId('cocktail-invent-empty-clear'));
    expect(screen.queryByTestId('cocktail-invent-empty')).toBeNull();
  });
  it('without the invent handler the plain empty state remains', () => {
    cocktailBrowse();
    fireEvent.change(screen.getByLabelText(/search cocktails/i), { target: { value: 'gin, cucumber, chartreuse' } });
    expect(screen.getByText(/No cocktails match these filters/)).toBeInTheDocument();
  });
});

// ── Sauce browse ────────────────────────────────────────────────────
const sauce = (name, ingredients) => ({ name, family_id: 0, family: 'Tomato', ingredients, cuisine: 'Italian', isRoot: false });
const SAUCE_CODEX = {
  codex: { clusters: [{ id: 0, name: 'Tomato', color: '#e05050' }] },
  graph: { nodes: new Map([['Marinara', sauce('Marinara', ['tomato', 'garlic', 'basil'])]]) },
};
const sauceBrowse = (props = {}) => render(
  <SauceBrowse codexData={SAUCE_CODEX} selectedSauce={null} onSelectSauce={vi.fn()} filterFamily={null}
    onFilterFamily={vi.fn()} filterCuisine={null} onFilterCuisine={vi.fn()} {...props} />,
);

describe('SauceBrowse — ✨ Invent this', () => {
  it('hidden when empty, shown with text, calls the handler', () => {
    const onInventThis = vi.fn();
    sauceBrowse({ onInventThis });
    expect(screen.queryByTestId('sauce-invent-this')).toBeNull();
    fireEvent.change(screen.getByLabelText(/search sauces/i), { target: { value: 'tomato' } });
    fireEvent.click(screen.getByTestId('sauce-invent-this'));
    expect(onInventThis).toHaveBeenCalledWith('tomato');
  });
  it('with 0 matches the empty state reads as an invitation', () => {
    const onInventThis = vi.fn();
    sauceBrowse({ onInventThis });
    fireEvent.change(screen.getByLabelText(/search sauces/i), { target: { value: 'tomato, basil, miso' } });
    const empty = screen.getByTestId('sauce-invent-empty');
    expect(empty).toHaveTextContent('No sauce has tomato + basil + miso — invent one?');
    fireEvent.click(within(empty).getByTestId('sauce-invent-this'));
    expect(onInventThis).toHaveBeenCalledWith('tomato, basil, miso');
  });
  it('shows ONE empty state: the invent offer, with the way back inside it', () => {
    sauceBrowse({ onInventThis: vi.fn() });
    fireEvent.change(screen.getByLabelText(/search sauces/i), { target: { value: 'tomato, basil, miso' } });
    expect(screen.queryByText(/No sauces match these filters/)).toBeNull();
    expect(within(screen.getByTestId('sauce-invent-empty')).getByTestId('sauce-invent-empty-clear')).toHaveTextContent('Clear search and filters');
    fireEvent.click(screen.getByTestId('sauce-invent-empty-clear'));
    expect(screen.queryByTestId('sauce-invent-empty')).toBeNull();
  });
});

// ── Cookbook ────────────────────────────────────────────────────────
const NODES = new Map([['chicken', { category: 'protein' }], ['ginger', { category: 'aromatic' }]]);
describe('CookbookLab — ✨ Invent this', () => {
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  });
  const search = (v) => fireEvent.change(screen.getByTestId('cookbook-search'), { target: { value: v } });

  it('hidden when empty, shown with text; click hands the Recipe Lab seed to the caller', () => {
    const onInventThis = vi.fn();
    render(<CookbookLab ctx={{ graph: { nodes: NODES } }} onInventThis={onInventThis} />);
    expect(screen.queryByTestId('cookbook-invent-this')).toBeNull();
    search('chicken');
    fireEvent.click(screen.getByTestId('cookbook-invent-this'));
    const seed = onInventThis.mock.calls[0][0];
    expect(seed.main).toBe('chicken');
    expect(seed.type).toBeTruthy();
  });
  it('with 0 matches the empty state invites inventing', () => {
    render(<CookbookLab ctx={{ graph: { nodes: NODES } }} onInventThis={vi.fn()} />);
    search('chicken, ginger, chartreuse');
    expect(screen.getByTestId('cookbook-invent-empty')).toHaveTextContent('No dish here has chicken + ginger + chartreuse — invent one?');
  });
  it('without the handler there is no button', () => {
    render(<CookbookLab ctx={{ graph: { nodes: NODES } }} />);
    search('chicken');
    expect(screen.queryByTestId('cookbook-invent-this')).toBeNull();
  });
});
