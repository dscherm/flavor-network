// @vitest-environment jsdom
// PROFILE-1: the "Flavor profile" button beside Riff on the lab card and in the Cookbook recipe view.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import LabNodeCard from '../LabNodeCard.jsx';
import CookbookLab from '../CookbookLab.jsx';
import { SEED_RECIPES } from '../../data/seedRecipes.js';
import { fromOwnItem } from '../../data/sharedRecipe.js';
import { loadFlavorNodes } from '../../../scripts/lib/flavorNodes.mjs';

vi.mock('../NetworkScene.jsx', () => ({ default: () => null }));
vi.mock('../MultiAxisRadarStack.jsx', () => ({ default: () => null }));

const nodes = loadFlavorNodes();
const negroni = { kind: 'cocktail', name: 'Negroni', lines: [{ key: 'gin', amount: '1 oz' }, { key: 'campari', amount: '1 oz' }, { key: 'sweet vermouth', amount: '1 oz' }] };
const riff = { label: 'Riff on this', onClick: () => {}, testid: 'cocktail-riff-open' };
const card = (props = {}) => render(<LabNodeCard kind="cocktail" name="Negroni" ingredients={['gin']} actions={[riff]} onClose={() => {}} {...props} />);

describe('LabNodeCard: Flavor profile', () => {
  let fetchSpy;
  beforeEach(() => { fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('has no button without a recipe', () => {
    card();
    expect(screen.queryByTestId('flavor-profile-button')).toBeNull();
  });

  it('puts the button right after Riff, closed until tapped; opens Taste and Aroma, drivers and the note', () => {
    const onProfileOpen = vi.fn();
    card({ flavor: { recipe: negroni, nodes, builtIn: true, onProfileOpen } });
    const row = screen.getByTestId('cocktail-riff-open').parentElement;
    const kids = [...row.children];
    expect(kids.indexOf(screen.getByTestId('flavor-profile-button'))).toBe(kids.indexOf(screen.getByTestId('cocktail-riff-open')) + 1);
    const btn = screen.getByTestId('flavor-profile-button');
    expect(btn).toHaveTextContent('Flavor profile');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('flavor-profile-section')).toBeNull();
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    const section = screen.getByTestId('flavor-profile-section');
    expect(within(section).getByText('Taste')).toBeInTheDocument();
    expect(within(section).getByText('Aroma')).toBeInTheDocument();
    expect(within(section).getByTestId('flavor-profile-driven')).toHaveTextContent('Driven by');
    expect(within(section).getByText(/A guide, not a taste test/)).toBeInTheDocument();
    expect(onProfileOpen).toHaveBeenCalledWith('cocktail', true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fireEvent.click(btn);
    expect(screen.queryByTestId('flavor-profile-section')).toBeNull();
  });

  it('Escape closes the section (not the card) and focus returns to the button', () => {
    const onClose = vi.fn();
    card({ onClose, flavor: { recipe: negroni, nodes, builtIn: true } });
    const btn = screen.getByTestId('flavor-profile-button');
    btn.focus();
    fireEvent.click(btn);
    fireEvent.keyDown(screen.getByTestId('flavor-profile-section'), { key: 'Escape' });
    expect(screen.queryByTestId('flavor-profile-section')).toBeNull();
    expect(document.activeElement).toBe(btn);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the plain line and no bars when there is too little data', () => {
    card({ flavor: { recipe: { kind: 'cocktail', name: 'x', lines: [{ key: 'unobtainium', amount: '' }, { key: 'zzz', amount: '' }] }, nodes, builtIn: false } });
    fireEvent.click(screen.getByTestId('flavor-profile-button'));
    expect(screen.getByTestId('recipe-profile-empty')).toHaveTextContent('Not enough flavor data for a chart yet.');
    expect(screen.queryByTestId('recipe-profile-sentence')).toBeNull();
  });

  it('shows the plain line when no flavor labels are loaded', () => {
    card({ flavor: { recipe: negroni, nodes: null, builtIn: true } });
    fireEvent.click(screen.getByTestId('flavor-profile-button'));
    expect(screen.getByTestId('recipe-profile-empty')).toBeInTheDocument();
  });

  it('a cook-made cocktail and sauce show a profile from their own lines', () => {
    const own = fromOwnItem('cocktail', { name: 'Mine', lines: [{ key: 'gin', amount: '2 oz' }, { key: 'lime juice', amount: '1 oz' }, { key: 'simple syrup', amount: '1 oz' }] });
    const onProfileOpen = vi.fn();
    const { unmount } = card({ name: 'Mine', actions: [riff, { label: 'Edit', testid: 'saved-edit', onClick() {} }], flavor: { recipe: own, nodes, builtIn: false, onProfileOpen } });
    fireEvent.click(screen.getByTestId('flavor-profile-button'));
    expect(screen.getByTestId('recipe-profile-sentence')).toBeInTheDocument();
    expect(onProfileOpen).toHaveBeenCalledWith('cocktail', false);
    unmount();
    const sauce = fromOwnItem('sauce', { name: 'S', lines: [{ key: 'butter', amount: '2 tbsp' }, { key: 'lemon juice', amount: '1 tbsp' }, { key: 'salt', amount: '1 tsp' }] });
    render(<LabNodeCard kind="sauce" name="S" actions={[{ label: 'Edit', testid: 'saved-edit', onClick() {} }]} flavor={{ recipe: sauce, nodes, builtIn: false }} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('flavor-profile-button'));
    expect(screen.getByTestId('recipe-profile-sentence')).toBeInTheDocument();
  });
});

describe('Cookbook recipe view: Flavor profile', () => {
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  });

  it('a built-in dish opens its profile from the actions row', () => {
    const bolognese = SEED_RECIPES.find((r) => r.id === 'beef-bolognese');
    const onProfileOpen = vi.fn();
    const ctx = { graph: { nodes: new Map(bolognese.ingredients.map((n) => [n, { name: n, taste: nodes.get(n)?.taste }])) } };
    render(<CookbookLab ctx={ctx} onProfileOpen={onProfileOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /Beef Bolognese/i }));
    const dialog = screen.getByRole('dialog');
    const btn = within(dialog).getByTestId('flavor-profile-button');
    expect(within(dialog).getByTestId('recipe-actions')).toContainElement(btn);
    fireEvent.click(btn);
    const section = within(dialog).getByTestId('flavor-profile-section');
    expect(within(section).getByText('Taste')).toBeInTheDocument();
    expect(onProfileOpen).toHaveBeenCalledWith('dish', true);
    fireEvent.keyDown(section, { key: 'Escape' });
    expect(within(dialog).queryByTestId('flavor-profile-section')).toBeNull();
    expect(document.activeElement).toBe(btn);
  });

  it('a cook-made recipe shows a profile too', () => {
    const names = ['tomato', 'basil', 'garlic'];
    const ctx = { graph: { nodes: new Map(names.map((n) => [n, { name: n, taste: nodes.get(n)?.taste }])) } };
    render(<CookbookLab ctx={ctx} userRecipes={[{ name: 'Grandma Pesto', ingredients: names.map((n) => ({ name: n, raw: `1 cup ${n}` })) }]} />);
    fireEvent.click(screen.getByRole('button', { name: /Grandma Pesto/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByTestId('flavor-profile-button'));
    expect(within(dialog).getByTestId('flavor-profile-section')).toBeInTheDocument();
  });
});
