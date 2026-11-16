// @vitest-environment jsdom
// BUILDER-1: the one suggestion deck (SuggestionCardDeck over two FlavorGrid charts) opened from each invent panel,
// for "Goes well with what you have" (add) and "Don't have it? Try..." (swap). Cocktail and sauce panels here; the
// recipe panel (which mocks its models) is in InventDeck.recipe.test.jsx.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import InventCocktail from '../InventCocktail.jsx';
import InventSauce from '../InventSauce.jsx';
import { buildPairingIndex } from '../../data/recipePairingMatch.js';
import { buildRolePool } from '../../data/cocktailRiff.js';
import { buildCategoryMap } from '../../data/saucePantry.js';

// ── cocktail ─────────────────────────────────────────────────────────────
const roles = {
  gin: { role: 'spirit' }, rye: { role: 'spirit' }, bourbon: { role: 'spirit' },
  'lemon juice': { role: 'sour' }, 'lime juice': { role: 'sour' }, 'simple syrup': { role: 'sweet' },
  'sweet vermouth': { role: 'vermouth' }, campari: { role: 'amaro_liqueur' }, 'triple sec': { role: 'amaro_liqueur' },
  'soda water': { role: 'modifier' }, 'angostura bitters': { role: 'bitter' },
};
const index = buildPairingIndex([
  { source: 'gin', target: 'campari', strength: 0.8, known: true },
  { source: 'gin', target: 'sweet vermouth', strength: 0.8, known: true },
  { source: 'campari', target: 'sweet vermouth', strength: 0.9, known: true },
  { source: 'gin', target: 'lemon juice', strength: 0.6, known: true },
  { source: 'gin', target: 'simple syrup', strength: 0.5, known: true },
  { source: 'gin', target: 'soda water', strength: 0.4, known: true },
], Object.keys(roles));
const pool = buildRolePool(roles, index.names);
const families = [{ id: 2, name: 'Sour Family', color: '#a16207' }, { id: 4, name: 'Aromatic Stirred', color: '#7c3aed' }];
const BAR = ['gin', 'campari', 'sweet vermouth', 'lemon juice', 'simple syrup', 'soda water'];
const nodes = new Map([
  ['lemon juice', { taste: 'sour' }], ['simple syrup', { taste: 'sweet' }],
  ['gin', { taste: 'bitter' }], ['sweet vermouth', { taste: 'sweet bitter' }], ['campari', { taste: 'bitter sweet sour' }],
  ['soda water', { taste: 'neutral' }],
]);

function cocktail(props = {}) {
  return render(<InventCocktail bar={BAR} cocktails={[]} families={families} roles={roles} pool={pool} pairingIndex={index} nodes={nodes} onClose={vi.fn()} {...props} />);
}
const byId = (id) => screen.getByTestId(id);
const cStart = (text) => {
  fireEvent.change(byId('invent-start-input'), { target: { value: text } });
  fireEvent.submit(byId('invent-start-input').closest('form'));
};
const cAdd = (text) => {
  fireEvent.change(byId('invent-list-add-input'), { target: { value: text } });
  fireEvent.submit(byId('invent-list-add-input').closest('form'));
};
const cKeys = () => screen.queryAllByTestId('invent-list-line').map((l) => l.dataset.key);
const chipKeys = (p) => screen.queryAllByTestId(`${p}-item`).map((c) => c.dataset.key);
const nowAxes = () => [...byId('ingredient-card-grid-before').querySelectorAll('[data-testid="flavor-grid-cell"]')]
  .filter((c) => c.dataset.on === 'true').map((c) => ({ axis: c.dataset.axis, r: Number(c.dataset.radius) }))
  .sort((a, b) => b.r - a.r);
const profileAxes = (p) => screen.queryAllByTestId(new RegExp(`^${p}-bar-`)).map((e) => e.dataset.testid.replace(`${p}-bar-`, ''));

describe('InventDeck in the cocktail panel', () => {
  it('the button opens a deck with one card per suggestion; Add on the second card adds it with the chip amount and closes', () => {
    cocktail();
    cStart('gin');
    cAdd('campari');
    const chips = chipKeys('invent-suggest');
    expect(chips.length).toBeGreaterThan(2);
    fireEvent.click(byId('invent-suggest-deck'));
    expect(byId('invent-deck')).toBeTruthy();
    expect(byId('suggestion-deck-add')).toHaveAttribute('data-stack-size', String(chips.length));
    expect(byId('suggestion-card')).toHaveAttribute('data-ingredient', chips[0]);
    fireEvent.click(byId('deck-next'));
    expect(byId('suggestion-card')).toHaveAttribute('data-ingredient', chips[1]);
    fireEvent.click(byId('deck-commit'));
    // closed, back on the panel with the list intact plus the added line
    expect(screen.queryByTestId('invent-deck')).toBeNull();
    expect(cKeys()).toEqual(['gin', 'campari', chips[1]]);
    const deckAmount = byId(`invent-list-amount-${chips[1]}`).value;
    expect(deckAmount).not.toBe('');

    // the chip route gives the same line with the same amount
    document.body.innerHTML = '';
    cocktail();
    cStart('gin');
    cAdd('campari');
    fireEvent.click(screen.getAllByTestId('invent-suggest-item').find((c) => c.dataset.key === chips[1]));
    expect(byId(`invent-list-amount-${chips[1]}`).value).toBe(deckAmount);
  });

  it('Back closes the deck and leaves the list as it was', () => {
    cocktail();
    cStart('gin');
    cAdd('campari');
    fireEvent.click(byId('invent-suggest-deck'));
    fireEvent.click(byId('deck-back'));
    expect(screen.queryByTestId('invent-deck')).toBeNull();
    expect(cKeys()).toEqual(['gin', 'campari']);
  });

  it("the deck's Now grid leads with the same notes as the panel's flavor profile (Negroni lines)", () => {
    cocktail();
    cStart('gin');
    cAdd('sweet vermouth');
    cAdd('campari');
    const panel = profileAxes('invent-profile');
    expect(panel.length).toBeGreaterThan(1);
    fireEvent.click(byId('invent-suggest-deck'));
    const now = nowAxes();
    expect(new Set(now.map((n) => n.axis))).toEqual(new Set(panel));
    expect(now[0].axis).toBe(panel[0]);
  });

  it('swap mode from "Don\'t have it?" lists the stand-ins as cards; Swap replaces the line and closes', () => {
    cocktail({ bar: ['bourbon', 'rye', 'lemon juice'] });
    cStart('gin');
    fireEvent.click(byId('invent-list-need-gin'));
    const opts = screen.getAllByTestId('invent-list-replace-option').map((o) => o.dataset.key);
    fireEvent.click(byId('invent-list-replace-deck-gin'));
    expect(byId('suggestion-deck-replace')).toHaveAttribute('data-stack-size', String(opts.length));
    expect(byId('invent-deck')).toBeTruthy();
    const first = byId('suggestion-card').dataset.ingredient;
    expect(opts).toContain(first);
    fireEvent.click(byId('deck-commit'));
    expect(screen.queryByTestId('invent-deck')).toBeNull();
    expect(cKeys()).toEqual([first]);
  });
});

// ── sauce ────────────────────────────────────────────────────────────────
const meta = [
  { name: 'butter', category: 'Fat' }, { name: 'olive oil', category: 'Fat' },
  { name: 'flour', category: 'Thickener' }, { name: 'egg yolk', category: 'Thickener' },
  { name: 'milk', category: 'Liquid' }, { name: 'cream', category: 'Liquid' }, { name: 'chicken stock', category: 'Liquid' },
  { name: 'lemon juice', category: 'Acid' }, { name: 'tomato', category: 'Acid' },
  { name: 'shallot', category: 'Aromatic' }, { name: 'garlic', category: 'Aromatic' }, { name: 'onion', category: 'Aromatic' },
  { name: 'nutmeg', category: 'Seasoning' }, { name: 'cumin', category: 'Seasoning' },
];
const catMap = buildCategoryMap(meta);
const sauceFamilies = [{ id: 0, name: 'Béchamel', color: '#f5f0d6' }, { id: 4, name: 'Tomato', color: '#d94a3d' }];
const sauces = [
  { name: 'Béchamel', family_id: 0, ingredients: ['butter', 'flour', 'milk', 'nutmeg'], proteins: ['chicken'] },
  { name: 'Marinara', family_id: 4, ingredients: ['olive oil', 'tomato', 'garlic'], proteins: ['chicken'] },
];
const sauceNodes = new Map([
  ['tomato', { taste: 'sour sweet umami' }], ['onion', { taste: 'sweet pungent' }], ['garlic', { taste: 'pungent' }],
  ['olive oil', { taste: 'bitter' }], ['butter', { taste: 'sweet' }], ['shallot', { taste: 'sweet pungent' }],
]);
const PANTRY = ['butter', 'tomato', 'garlic', 'shallot', 'cream', 'olive oil'];
const P = 'sauce-invent';
const L = `${P}-list`;
function sauce(props = {}) {
  return render(<InventSauce kitchen={PANTRY} sauces={sauces} families={sauceFamilies} meta={meta} catMap={catMap} nodes={sauceNodes} wineStyles={null} onClose={vi.fn()} {...props} />);
}
const sStart = (text) => {
  fireEvent.change(screen.getByTestId(`${P}-start-input`), { target: { value: text } });
  fireEvent.click(screen.getByTestId(`${P}-start-go`));
};
const sAdd = (text) => {
  fireEvent.change(screen.getByTestId(`${L}-add-input`), { target: { value: text } });
  fireEvent.click(screen.getByTestId(`${L}-add`));
};
const sKeys = () => screen.queryAllByTestId(`${L}-line`).map((e) => e.getAttribute('data-key'));

describe('InventDeck in the sauce panel', () => {
  it('the button opens a deck with one card per suggestion; Add on the second card adds the line and closes', () => {
    sauce();
    sStart('tomato');
    const chips = chipKeys(`${P}-suggest`);
    expect(chips.length).toBeGreaterThan(1);
    fireEvent.click(screen.getByTestId(`${P}-suggest-deck`));
    expect(screen.getByTestId('suggestion-deck-add')).toHaveAttribute('data-stack-size', String(chips.length));
    fireEvent.click(screen.getByTestId('deck-next'));
    expect(screen.getByTestId('suggestion-card')).toHaveAttribute('data-ingredient', chips[1]);
    fireEvent.click(screen.getByTestId('deck-commit'));
    expect(screen.queryByTestId('invent-deck')).toBeNull();
    expect(sKeys()).toEqual(['tomato', chips[1]]);
  });

  it("the deck's Now grid leads with the same notes as the panel's flavor profile (a tomato, onion, garlic, oil build)", () => {
    sauce();
    sStart('tomato');
    sAdd('onion');
    sAdd('garlic');
    sAdd('olive oil');
    const panel = profileAxes(`${P}-profile`);
    expect(panel.length).toBeGreaterThan(1);
    fireEvent.click(screen.getByTestId(`${P}-suggest-deck`));
    const now = nowAxes();
    expect(new Set(now.map((n) => n.axis))).toEqual(new Set(panel));
    expect(now[0].axis).toBe(panel[0]);
  });

  it('swap mode replaces the line with the stand-in and closes', () => {
    sauce({ kitchen: ['butter', 'shallot'] });
    sStart('butter');
    sAdd('onion');
    fireEvent.click(screen.getByTestId(`${L}-need-onion`));
    fireEvent.click(screen.getByTestId(`${L}-replace-deck-onion`));
    expect(screen.getByTestId('suggestion-deck-replace')).toHaveAttribute('data-stack-size', '1');
    expect(screen.getByTestId('suggestion-card')).toHaveAttribute('data-ingredient', 'shallot');
    fireEvent.click(screen.getByTestId('deck-commit'));
    expect(screen.queryByTestId('invent-deck')).toBeNull();
    expect(sKeys()).toEqual(['butter', 'shallot']);
  });

  it('a suggestion with no flavor data still gets a card with an unchanged grid', () => {
    sauce();
    sStart('tomato');
    const chips = chipKeys(`${P}-suggest`);
    fireEvent.click(screen.getByTestId(`${P}-suggest-deck`));
    const names = [];
    for (let i = 0; i < chips.length; i += 1) {
      names.push(screen.getByTestId('suggestion-card').dataset.ingredient);
      if (i < chips.length - 1) fireEvent.click(screen.getByTestId('deck-next'));
    }
    expect(names).toEqual(chips);
    expect(within(screen.getByTestId('suggestion-card')).getByTestId('ingredient-card-grid-after')).toBeTruthy();
  });
});
