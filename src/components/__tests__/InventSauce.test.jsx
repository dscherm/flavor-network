// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import InventSauce from '../InventSauce.jsx';
import { buildCategoryMap } from '../../data/saucePantry.js';

const meta = [
  { name: 'butter', category: 'Fat' }, { name: 'olive oil', category: 'Fat' },
  { name: 'flour', category: 'Thickener' }, { name: 'egg yolk', category: 'Thickener' },
  { name: 'milk', category: 'Liquid' }, { name: 'cream', category: 'Liquid' }, { name: 'chicken stock', category: 'Liquid' },
  { name: 'lemon juice', category: 'Acid' }, { name: 'white wine vinegar', category: 'Acid' }, { name: 'tomato', category: 'Acid' },
  { name: 'shallot', category: 'Aromatic' }, { name: 'garlic', category: 'Aromatic' }, { name: 'onion', category: 'Aromatic' },
  { name: 'tarragon', category: 'Herb' }, { name: 'nutmeg', category: 'Seasoning' }, { name: 'cumin', category: 'Seasoning' },
];
const catMap = buildCategoryMap(meta);
const families = [
  { id: 0, name: 'Béchamel', color: '#f5f0d6' }, { id: 1, name: 'Velouté', color: '#e8c989' }, { id: 2, name: 'Espagnole', color: '#a05a2c' },
  { id: 3, name: 'Hollandaise', color: '#f3d44e' }, { id: 4, name: 'Tomato', color: '#d94a3d' },
];
const sauces = [
  { name: 'Hollandaise', family_id: 3, ingredients: ['egg yolk', 'butter', 'lemon juice', 'salt'], proteins: ['salmon', 'eggs'] },
  { name: 'Béarnaise', family_id: 3, ingredients: ['egg yolk', 'butter', 'white wine vinegar', 'shallot', 'tarragon'], proteins: ['beef', 'salmon'] },
  { name: 'Béchamel', family_id: 0, ingredients: ['butter', 'flour', 'milk', 'nutmeg'], proteins: ['chicken'] },
  { name: 'Marinara', family_id: 4, ingredients: ['olive oil', 'tomato', 'garlic'], proteins: ['chicken'] },
];
// The real wine list, shaped as loadWineStyles returns it.
const wineJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/data/wine_styles.json'), 'utf8'));
const wineStyles = { families: wineJson._meta?.families || [], wines: wineJson.wines };

const P = 'sauce-invent-slots';
const PANTRY = ['butter', 'egg yolk', 'lemon', 'shallot', 'cream', 'tomato', 'garlic'];

function renderInvent(props = {}) {
  return render(<InventSauce kitchen={PANTRY} sauces={sauces}
    families={families} meta={meta} catMap={catMap} wineStyles={null} onClose={vi.fn()} {...props} />);
}
const line = (id) => screen.getByTestId(`${P}-line-${id}`).textContent;
const slot = (id) => screen.getByTestId(`${P}-slot-${id}`);
const pickStyle = (re) => fireEvent.click(within(screen.getByTestId('sauce-invent-styles')).getByRole('button', { name: re }));

describe('InventSauce — pick a baseline, then build it', () => {
  it('shows the ten techniques and ONE sauce card (no three-up page, no Shuffle)', () => {
    renderInvent({ initialStyle: 'Hollandaise' });
    expect(screen.getByTestId('sauce-invent-source')).toHaveTextContent('From your pantry (7 items)');
    const styles = screen.getByTestId('sauce-invent-styles');
    expect(within(styles).getAllByRole('button')).toHaveLength(10);
    expect(within(styles).getByRole('button', { name: /Emulsion/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(styles).getByRole('button', { name: /Roux & milk/ })).toBeInTheDocument();
    expect(screen.getByTestId('sauce-invent-chemistry')).toHaveTextContent(/emulsifier/);
    expect(screen.getAllByTestId('sauce-invent-card')).toHaveLength(1);
    expect(screen.queryByTestId('sauce-invent-shuffle')).toBeNull();
    expect(screen.queryByText(/Shuffle/)).toBeNull();
    expect(screen.queryByTestId('sauce-invent-exhausted')).toBeNull();
    expect(screen.getByTestId('sauce-invent-vessel')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('sauce-invent-honest')).toHaveTextContent('An idea from what pairs, not a tested recipe — taste and adjust.');
  });

  it('Emulsion pre-fills fat + egg yolk + acid and leaves aromatic / herb / spice empty', () => {
    renderInvent({ initialStyle: 'Hollandaise' });
    expect(line('fat')).toBe('butter');
    expect(line('emulsifier')).toBe('egg yolk');
    expect(line('acid')).toMatch(/lemon/);
    for (const id of ['aromatic', 'herb', 'spice']) expect(slot(id)).toHaveAttribute('data-empty', 'true');
    for (const id of ['fat', 'emulsifier', 'acid']) expect(slot(id)).toHaveAttribute('data-empty', 'false');
    expect(screen.queryByTestId('sauce-invent-missing')).toBeNull();
    expect(screen.getByTestId('sauce-invent-method')).toHaveTextContent(/lecithin/);
  });

  it('switching technique re-seeds the card', () => {
    renderInvent({ initialStyle: 'Hollandaise' });
    pickStyle(/Tomato simmer/);
    expect(screen.getByTestId('sauce-invent-name')).toHaveTextContent(/Tomato Sauce/);
    expect(line('tomato')).toBe('tomato');
  });

  it('marks what you would need when the pantry lacks a required role, and names it in the shopping line', () => {
    renderInvent({ initialStyle: 'Velouté' });
    expect(line('liquid')).toBe('chicken stock');
    expect(screen.getByTestId('sauce-invent-shopping')).toHaveTextContent('chicken stock');
    expect(within(slot('liquid')).getByTestId(`${P}-need`)).toHaveTextContent('you’d need');
    expect(within(slot('fat')).queryByTestId(`${P}-need`)).toBeNull();
  });

  it('Only what I have: an unfillable emulsifier is missing, never filled from outside', () => {
    renderInvent({ kitchen: ['butter', 'lemon'], initialStyle: 'Hollandaise' });
    // Without the switch the emulsifier comes from outside the pantry, marked.
    expect(line('emulsifier')).toBe('egg yolk');
    fireEvent.click(screen.getByTestId('sauce-invent-pantry-only'));
    expect(slot('emulsifier')).toHaveAttribute('data-empty', 'true');
    expect(screen.getByTestId('sauce-invent-missing')).toHaveTextContent('Needs egg yolk (the emulsifier)');
    expect(screen.getByTestId('sauce-invent-method')).toHaveTextContent(/Fill the empty required slots/);
    expect(screen.queryByTestId('sauce-invent-shopping')).toBeNull();
    // The shortlist offers the pantry only, so nothing from outside it.
    fireEvent.click(screen.getByTestId(`${P}-open-emulsifier`));
    expect(within(screen.getByTestId(`${P}-shortlist-emulsifier`)).queryAllByTestId(`${P}-option`)).toHaveLength(0);
    // Typing it in is allowed and clears the message.
    fireEvent.change(screen.getByTestId(`${P}-type-emulsifier`), { target: { value: 'egg yolk' } });
    fireEvent.click(screen.getByTestId(`${P}-use-emulsifier`));
    expect(line('emulsifier')).toBe('egg yolk');
    expect(screen.queryByTestId('sauce-invent-missing')).toBeNull();
  });

  it('swapping a slot changes the amounts and the method', () => {
    renderInvent({ initialStyle: 'Hollandaise' });
    const method = screen.getByTestId('sauce-invent-method').textContent;
    expect(screen.getByTestId(`${P}-amount-fat`)).toHaveTextContent('½ cup (115 g), melted');
    expect(method).toMatch(/butter/);
    fireEvent.click(screen.getByTestId(`${P}-open-fat`));
    fireEvent.change(screen.getByTestId(`${P}-type-fat`), { target: { value: 'olive oil' } });
    fireEvent.click(screen.getByTestId(`${P}-use-fat`));
    expect(line('fat')).toBe('olive oil');
    expect(screen.getByTestId(`${P}-amount-fat`)).toHaveTextContent('¾ cup');
    expect(screen.getByTestId('sauce-invent-method').textContent).not.toBe(method);
    expect(screen.getByTestId('sauce-invent-method')).toHaveTextContent(/mayonnaise/);
    expect(screen.getByTestId('sauce-invent-name')).toHaveTextContent(/Mayonnaise/);
  });

  it('refuses a pick that does not fit the slot, with a reason, and lets you add it as an extra', () => {
    renderInvent({ initialStyle: 'Hollandaise' });
    fireEvent.click(screen.getByTestId(`${P}-open-emulsifier`));
    fireEvent.change(screen.getByTestId(`${P}-type-emulsifier`), { target: { value: 'cumin' } });
    fireEvent.click(screen.getByTestId(`${P}-use-emulsifier`));
    expect(screen.getByTestId(`${P}-notice`)).toHaveTextContent(/doesn't fit as the egg yolk/);
    expect(line('emulsifier')).toBe('egg yolk');
    fireEvent.change(screen.getByTestId(`${P}-add-input`), { target: { value: 'cumin' } });
    fireEvent.click(screen.getByTestId(`${P}-add`));
    expect(within(screen.getByTestId(`${P}-extras`)).getByText('cumin')).toBeInTheDocument();
    expect(screen.getByTestId('sauce-invent-method')).toBeInTheDocument();
  });

  it('a chosen protein re-ranks the shortlist and brings its wine', () => {
    renderInvent({ initialStyle: 'Hollandaise', wineStyles });
    expect(screen.queryByTestId('sauce-invent-wine')).toBeNull();
    fireEvent.click(within(screen.getByTestId('sauce-invent-proteins')).getByRole('button', { name: 'salmon' }));
    const wine = screen.getByTestId('sauce-invent-wine');
    expect(wine).toHaveTextContent('wine with salmon');
    expect(wineStyles.wines.some((w) => wine.textContent.includes(w.name))).toBe(true);
    expect(screen.getByTestId('sauce-invent-card')).toHaveTextContent('for salmon');
    // Still one fully built card with the shortlist reachable.
    fireEvent.click(screen.getByTestId(`${P}-open-herb`));
    expect(within(screen.getByTestId(`${P}-shortlist-herb`)).getAllByTestId(`${P}-option`).length).toBeGreaterThan(0);
  });

  it('shows the closest existing sauce and opens it', () => {
    const onSelectSauce = vi.fn();
    renderInvent({ initialStyle: 'Hollandaise', onSelectSauce });
    const btn = within(screen.getByTestId('sauce-invent-nearest')).getByRole('button');
    expect(btn).toHaveTextContent(/Hollandaise|Béarnaise/);
    fireEvent.click(btn);
    expect(onSelectSauce).toHaveBeenCalled();
  });

  it('Open in Recipe Notebook passes the built lines and the protein', () => {
    const onOpenRecipeLab = vi.fn();
    renderInvent({ initialStyle: 'Hollandaise', onOpenRecipeLab });
    fireEvent.click(within(screen.getByTestId('sauce-invent-proteins')).getByRole('button', { name: 'salmon' }));
    fireEvent.change(screen.getByTestId(`${P}-add-input`), { target: { value: 'tarragon' } });
    fireEvent.click(screen.getByTestId(`${P}-add`));
    fireEvent.click(screen.getByTestId('sauce-invent-notebook'));
    const arg = onOpenRecipeLab.mock.calls[0][0];
    expect(arg).toEqual(expect.arrayContaining(['butter', 'egg yolk', 'tarragon']));
    expect(arg[arg.length - 1]).toBe('salmon');
  });

  it('Start over restores the baseline; Back closes', () => {
    const onClose = vi.fn();
    renderInvent({ initialStyle: 'Hollandaise', onClose });
    fireEvent.click(screen.getByTestId(`${P}-clear-emulsifier`));
    expect(screen.getByTestId('sauce-invent-missing')).toHaveTextContent('Needs egg yolk (the emulsifier)');
    fireEvent.click(screen.getByTestId('sauce-invent-restart'));
    expect(line('emulsifier')).toBe('egg yolk');
    expect(screen.queryByTestId('sauce-invent-missing')).toBeNull();
    fireEvent.click(screen.getByTestId('sauce-invent-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('says the pantry is empty and still builds from the sauce list', () => {
    renderInvent({ kitchen: [], initialStyle: 'Béchamel' });
    expect(screen.getByTestId('sauce-invent-source')).toHaveTextContent('Your pantry is empty');
    expect(line('liquid')).toMatch(/milk|cream/);
  });
});

describe('InventSauce — the seed prop', () => {
  it('opens on the seeded technique and protein with search pins locked into the slots they fit', () => {
    renderInvent({ seed: { styleId: 'Hollandaise', protein: 'salmon', pinned: [{ key: 'tarragon', source: 'search' }, { key: 'white wine vinegar', source: 'search' }] }, wineStyles });
    expect(within(screen.getByTestId('sauce-invent-styles')).getByRole('button', { name: /Emulsion/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByTestId('sauce-invent-proteins')).getByRole('button', { name: 'salmon' })).toHaveAttribute('aria-pressed', 'true');
    expect(line('herb')).toBe('tarragon');
    expect(line('acid')).toBe('white wine vinegar');
    expect(slot('herb')).toHaveTextContent('from your search');
    expect(screen.getByTestId('sauce-invent-wine')).toBeInTheDocument();
  });

  it('pins stay locked through a technique change, Start over and a pin no slot takes becomes an extra', () => {
    renderInvent({ seed: { styleId: 'Hollandaise', pinned: [{ key: 'tarragon', source: 'search' }, { key: 'cumin', source: 'search' }] } });
    expect(line('herb')).toBe('tarragon');
    expect(within(screen.getByTestId(`${P}-extras`)).getAllByTestId(`${P}-extra`)).toHaveLength(1); // cumin fits no emulsion slot
    expect(within(screen.getByTestId(`${P}-extras`)).getByText('cumin')).toBeInTheDocument();
    pickStyle(/Roux & stock/);
    expect(line('herb')).toBe('tarragon');
    fireEvent.click(screen.getByTestId('sauce-invent-restart'));
    expect(line('herb')).toBe('tarragon');
    pickStyle(/Nut sauce/);
    // No herb slot in a nut sauce: both pins become extras.
    expect(within(screen.getByTestId(`${P}-extras`)).getAllByTestId(`${P}-extra`)).toHaveLength(2);
  });

  it('falls back to initialStyle for an unknown seed style', () => {
    renderInvent({ seed: { styleId: 'nonsense' }, initialStyle: 'Tomato' });
    expect(within(screen.getByTestId('sauce-invent-styles')).getByRole('button', { name: /Tomato simmer/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
