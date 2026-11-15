// @vitest-environment jsdom
// INVENT-9: the Cocktail Lab invent panel starts empty; the cook chooses everything.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import InventCocktail from '../InventCocktail.jsx';
import { buildPairingIndex } from '../../data/recipePairingMatch.js';
import { buildRolePool } from '../../data/cocktailRiff.js';
import { AXES } from '../../data/recipeProfileAnalysis.js';

const ing = (raw) => ({ raw });
const negroni = { name: 'Negroni', ingredients_raw: [ing('1 oz Gin'), ing('1 oz Sweet vermouth'), ing('1 oz Campari')] };
const oldFashioned = { name: 'Old Fashioned', ingredients_raw: [ing('2 oz Bourbon'), ing('1 tsp Simple syrup'), ing('2 dashes Angostura bitters')] };
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
  { source: 'bourbon', target: 'simple syrup', strength: 0.7, known: true },
  { source: 'bourbon', target: 'angostura bitters', strength: 0.7, known: true },
], Object.keys(roles));
const pool = buildRolePool(roles, index.names);
const families = [{ id: 2, name: 'Sour Family', color: '#a16207' }, { id: 4, name: 'Aromatic Stirred', color: '#7c3aed' }, { id: 3, name: 'Boozy Sippers', color: '#92400e' }];
const BAR = ['gin', 'campari', 'sweet vermouth', 'lemon juice', 'simple syrup'];
const probs = (o) => ({ ...Object.fromEntries(AXES.map((a) => [a, 0])), ...o });
// TASTE comes from the curated label; the aroma half (gnnProbs) is not needed here.
const nodes = new Map([
  ['lemon juice', { taste: 'sour' }], ['simple syrup', { taste: 'sweet' }],
  ['gin', { taste: 'bitter' }], ['sweet vermouth', { taste: 'sweet bitter' }], ['campari', { taste: 'bitter sweet sour' }],
  ['jalapeno', { taste: 'spicy pungent' }], ['soda water', { taste: 'neutral' }],
]);

function renderInvent(props = {}) {
  return render(<InventCocktail bar={BAR} cocktails={[negroni, oldFashioned]}
    families={families} roles={roles} pool={pool} pairingIndex={index} nodes={nodes} onClose={vi.fn()} {...props} />);
}
const byId = (id) => screen.getByTestId(id);
const listKeys = () => screen.queryAllByTestId('invent-list-line').map((l) => l.dataset.key);
const addText = (text) => {
  fireEvent.change(byId('invent-list-add-input'), { target: { value: text } });
  fireEvent.submit(byId('invent-list-add-input').closest('form'));
};
const startWith = (text) => {
  fireEvent.change(byId('invent-start-input'), { target: { value: text } });
  fireEvent.submit(byId('invent-start-input').closest('form'));
};
const chooseStyle = (id) => {
  fireEvent.click(byId('invent-category-toggle'));
  fireEvent.click(byId(`invent-category-option-${id}`));
};

describe('InventCocktail: starts empty', () => {
  it('opens showing only the liquor question: no list, no name, no card', () => {
    renderInvent({ onSave: vi.fn() });
    expect(byId('invent-start-question')).toHaveTextContent(/liquor/i);
    for (const id of ['invent-list', 'invent-namesave', 'invent-card', 'invent-category', 'invent-hint', 'invent-suggest', 'invent-profile', 'invent-checklist']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    expect(screen.queryByText(/^any$/)).toBeNull();
    expect(byId('invent-close')).toBeTruthy();
  });

  it('offers the bar base spirits first, then the common ones, and a text box', () => {
    renderInvent({ bar: ['rye', 'lemon juice'] });
    const opts = screen.getAllByTestId('invent-start-option').map((o) => o.dataset.key);
    expect(opts[0]).toBe('rye');
    expect(opts).toContain('gin');
    expect(opts).not.toContain('lemon juice');
    expect(byId('invent-start-input')).toBeTruthy();
  });

  it('after picking bourbon the list is exactly [bourbon], nothing else is added, the name box is empty', () => {
    renderInvent({ bar: ['bourbon', 'simple syrup'], onSave: vi.fn() });
    fireEvent.click(screen.getAllByTestId('invent-start-option').find((o) => o.dataset.key === 'bourbon'));
    expect(listKeys()).toEqual(['bourbon']);
    expect(byId('invent-namesave-name')).toHaveValue('');
    expect(screen.queryByTestId('invent-checklist')).toBeNull();
    expect(screen.queryByTestId('invent-card')).toBeNull();
    expect(screen.queryByTestId('invent-start')).toBeNull();
  });

  it('a typed liquor starts the list too', () => {
    renderInvent();
    startWith('Rye');
    expect(listKeys()).toEqual(['rye']);
  });

  it('Start over returns to the question with everything cleared', () => {
    renderInvent({ onSave: vi.fn() });
    startWith('gin');
    addText('lemon juice');
    fireEvent.click(byId('invent-restart'));
    expect(byId('invent-start')).toBeTruthy();
    startWith('gin');
    expect(listKeys()).toEqual(['gin']);
  });
});

describe('InventCocktail: the style is opt-in and recommended', () => {
  it('recommends for sugar and bitters, applies only on Accept, and Not now hides it until the list changes', () => {
    renderInvent({ bar: ['bourbon', 'simple syrup', 'angostura bitters'] });
    startWith('bourbon');
    expect(screen.queryByTestId('invent-hint')).toBeNull();
    addText('simple syrup');
    addText('angostura bitters');
    expect(byId('invent-hint')).toHaveTextContent('This looks like Boozy Sippers');
    expect(screen.queryByTestId('invent-checklist')).toBeNull();
    fireEvent.click(byId('invent-hint-dismiss'));
    expect(screen.queryByTestId('invent-hint')).toBeNull();
    addText('rye');
    expect(byId('invent-hint')).toBeTruthy();
    fireEvent.click(byId('invent-hint-accept'));
    expect(screen.queryByTestId('invent-hint')).toBeNull();
    expect(byId('invent-checklist')).toHaveTextContent('A Sipper usually has');
    expect(byId('invent-card')).toBeTruthy();
    expect(listKeys().sort()).toEqual(['angostura bitters', 'bourbon', 'rye', 'simple syrup']);
  });

  it('the style picker is collapsed by default and lists the six styles with a no-style choice', () => {
    renderInvent();
    startWith('gin');
    expect(screen.queryByTestId('invent-category-option-2')).toBeNull();
    fireEvent.click(byId('invent-category-toggle'));
    for (const id of [2, 4, 1, 5, 0, 3]) expect(byId(`invent-category-option-${id}`)).toBeTruthy();
    expect(byId('invent-category-none')).toBeTruthy();
    expect(byId('invent-category-option-2')).toHaveTextContent('bright, shaken, citrus-forward');
    expect(byId('invent-family-glass-2')).toBeTruthy();
  });

  it('with Sour chosen: sour and sweetener unticked; lime juice ticks the sour; the sweetener tap adds nothing by itself', () => {
    renderInvent({ bar: ['gin', 'lime juice', 'simple syrup'] });
    startWith('gin');
    chooseStyle(2);
    expect(byId('invent-checklist-item-sour').dataset.done).toBe('false');
    expect(byId('invent-checklist-item-sweet').dataset.done).toBe('false');
    expect(byId('invent-checklist-item-base').dataset.done).toBe('true');
    addText('lime juice');
    expect(byId('invent-checklist-item-sour').dataset.done).toBe('true');
    fireEvent.click(byId('invent-checklist-open-sweet'));
    expect(within(byId('invent-checklist-options-sweet')).getByText('simple syrup')).toBeTruthy();
    expect(listKeys()).toEqual(['gin', 'lime juice']);
    fireEvent.click(within(byId('invent-checklist-options-sweet')).getByText('simple syrup'));
    expect(listKeys()).toEqual(['gin', 'lime juice', 'simple syrup']);
    expect(byId('invent-checklist-item-sweet').dataset.done).toBe('true');
  });

  it('never fills a part by itself: choosing a style with only gin leaves the rest unticked', () => {
    renderInvent({ bar: BAR });
    startWith('gin');
    chooseStyle(2);
    expect(listKeys()).toEqual(['gin']);
    expect(byId('invent-checklist-item-sour').dataset.done).toBe('false');
  });

  it('clearing the style removes the checklist and the card but keeps the list', () => {
    renderInvent({ bar: ['gin', 'lime juice'] });
    startWith('gin');
    addText('lime juice');
    chooseStyle(2);
    expect(byId('invent-card')).toBeTruthy();
    fireEvent.click(byId('invent-category-none'));
    expect(screen.queryByTestId('invent-checklist')).toBeNull();
    expect(screen.queryByTestId('invent-card')).toBeNull();
    expect(listKeys()).toEqual(['gin', 'lime juice']);
  });

  it('glass, method, why and the closest cocktails appear only once a style is chosen', () => {
    renderInvent({ bar: ['gin', 'campari', 'sweet vermouth'] });
    startWith('gin');
    addText('campari');
    addText('sweet vermouth');
    for (const id of ['invent-glass', 'invent-why', 'invent-method', 'invent-nearest']) expect(screen.queryByTestId(id)).toBeNull();
    chooseStyle(4);
    expect(byId('invent-method')).toHaveTextContent(/Stir/);
    expect(byId('invent-glass')).toBeTruthy();
    expect(byId('invent-why')).toBeTruthy();
    expect(byId('invent-nearest')).toHaveTextContent('Negroni');
  });
});

describe('InventCocktail: your ingredients', () => {
  it('a second base spirit is added with a split-base note; a duplicate is refused with a reason', () => {
    renderInvent();
    startWith('bourbon');
    addText('rye');
    expect(listKeys()).toEqual(['bourbon', 'rye']);
    expect(byId('invent-advice-split-base')).toHaveTextContent(/split base/i);
    addText('bourbon');
    expect(byId('invent-list-notice')).toBeTruthy();
    expect(listKeys()).toEqual(['bourbon', 'rye']);
  });

  it('two sours are advice too', () => {
    renderInvent();
    startWith('gin');
    addText('lemon juice');
    addText('lime juice');
    expect(byId('invent-advice-two-sours')).toHaveTextContent(/check the balance/i);
    expect(listKeys()).toEqual(['gin', 'lemon juice', 'lime juice']);
  });

  it("amounts are suggested by role, editable, and the cook's text survives a style change", () => {
    renderInvent({ bar: ['gin', 'lemon juice', 'simple syrup'] });
    startWith('gin');
    addText('lemon juice');
    expect(byId('invent-list-amount-gin')).toHaveValue('2 oz');
    expect(byId('invent-list-amount-lemon juice')).toHaveValue('¾ oz');
    fireEvent.change(byId('invent-list-amount-gin'), { target: { value: '1½ oz' } });
    chooseStyle(2);
    expect(byId('invent-list-amount-gin')).toHaveValue('1½ oz');
    expect(byId('invent-list-amount-lemon juice')).toBeTruthy();
  });

  it('an ingredient not in the bar offers same-role bottles from the bar; tapping one replaces the line', () => {
    renderInvent({ bar: ['bourbon', 'rye', 'lemon juice'] });
    startWith('gin');
    expect(byId('invent-list-line').dataset.have).toBe('false');
    fireEvent.click(byId('invent-list-need-gin'));
    const opts = screen.getAllByTestId('invent-list-replace-option').map((o) => o.dataset.key);
    expect(opts).toEqual(expect.arrayContaining(['bourbon', 'rye']));
    expect(opts).not.toContain('lemon juice');
    fireEvent.click(screen.getAllByTestId('invent-list-replace-option').find((o) => o.dataset.key === 'rye'));
    expect(listKeys()).toEqual(['rye']);
  });

  it('a line the bar has is marked have; the kitchen prop counts as stock', () => {
    renderInvent({ bar: ['gin'], kitchen: ['lemon juice'] });
    startWith('gin');
    addText('lemon juice');
    expect(screen.getAllByTestId('invent-list-line').every((l) => l.dataset.have === 'true')).toBe(true);
    expect(screen.queryByTestId('invent-list-need-gin')).toBeNull();
  });

  it('suggestions rank what goes with the list, bar first, and tapping one adds it', () => {
    renderInvent({ bar: ['gin', 'campari', 'sweet vermouth'] });
    startWith('gin');
    const items = screen.getAllByTestId('invent-suggest-item').map((i) => i.dataset.key);
    expect(items.length).toBeGreaterThan(0);
    expect(items).not.toContain('gin');
    expect(['campari', 'sweet vermouth']).toContain(items[0]);
    fireEvent.click(screen.getAllByTestId('invent-suggest-item')[0]);
    expect(listKeys()).toHaveLength(2);
  });

  it('removing a line removes it', () => {
    renderInvent();
    startWith('gin');
    addText('lemon juice');
    fireEvent.click(byId('invent-list-remove-lemon juice'));
    expect(listKeys()).toEqual(['gin']);
  });
});

describe('InventCocktail: flavor profile', () => {
  it('draws bars for the list and names the ingredients it could not count', () => {
    renderInvent();
    startWith('lemon juice');
    addText('simple syrup');
    addText('mystery bitters');
    expect(byId('invent-profile-bar-sour')).toBeTruthy();
    expect(byId('invent-profile-bar-sweet')).toBeTruthy();
    expect(byId('invent-profile-summary')).toHaveTextContent(/On the chart|this drink/);
    expect(byId('invent-profile-uncounted')).toHaveTextContent('mystery bitters');
  });

  it('gin, sweet vermouth and campari chart bitter and sweet, with Heat labelled and absent', () => {
    renderInvent();
    startWith('gin');
    addText('sweet vermouth');
    addText('campari');
    const bars = screen.getAllByTestId(/^invent-profile-bar-/).map((b) => b.dataset.testid.replace('invent-profile-bar-', ''));
    expect(bars[0]).toBe('bitter');
    expect(bars).toContain('sweet');
    expect(bars).not.toContain('heat');
    expect(byId('invent-profile-bar-bitter')).toHaveAttribute('aria-label', expect.stringMatching(/^Bitter \d+ percent$/));
  });

  it('a jalapeno adds a Heat bar with its label', () => {
    renderInvent();
    startWith('gin');
    addText('jalapeno');
    addText('lemon juice');
    expect(byId('invent-profile-bar-heat')).toHaveAttribute('aria-label', expect.stringMatching(/^Heat \d+ percent$/));
    expect(byId('invent-profile-bar-heat')).toHaveTextContent('Heat');
  });

  it('a list of only soda water has nothing to chart, shows the plain line and does not crash', () => {
    renderInvent();
    startWith('soda water');
    addText('soda water');
    expect(screen.queryByTestId('invent-profile-bar-sweet')).toBeNull();
    expect(byId('invent-profile')).toBeTruthy();
  });

  it('with no nodes it explains there is no flavor data and never throws', () => {
    renderInvent({ nodes: null });
    startWith('gin');
    addText('lemon juice');
    expect(byId('invent-profile-nodata')).toBeTruthy();
  });
});

describe('InventCocktail: name and save', () => {
  it("is disabled until there is a name and two ingredients, then sends the cook's drink", async () => {
    const onSave = vi.fn().mockResolvedValue({ status: 'saved', message: 'Added to your cocktails.' });
    renderInvent({ onSave });
    startWith('gin');
    expect(byId('invent-namesave-save')).toBeDisabled();
    fireEvent.change(byId('invent-namesave-name'), { target: { value: 'My Gin Thing' } });
    expect(byId('invent-namesave-save')).toBeDisabled();
    expect(byId('invent-namesave-reason')).toHaveTextContent(/two ingredients/i);
    addText('lemon juice');
    expect(byId('invent-namesave-save')).not.toBeDisabled();
    fireEvent.change(byId('invent-list-amount-lemon juice'), { target: { value: '1 oz' } });
    fireEvent.click(byId('invent-namesave-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toEqual({
      kind: 'cocktail', name: 'My Gin Thing', category: null,
      lines: [{ key: 'gin', amount: '2 oz', role: 'spirit' }, { key: 'lemon juice', amount: '1 oz', role: 'sour' }],
    });
    await waitFor(() => expect(byId('invent-namesave-status')).toHaveAttribute('data-status', 'saved'));
  });

  it('sends the style, glass and method when one is chosen, and relays a sign-in answer', async () => {
    const onSave = vi.fn().mockResolvedValue({ status: 'signin' });
    renderInvent({ onSave });
    startWith('gin');
    addText('lemon juice');
    chooseStyle(2);
    fireEvent.change(byId('invent-namesave-name'), { target: { value: '  Tart  ' } });
    fireEvent.click(byId('invent-namesave-save'));
    const input = onSave.mock.calls[0][0];
    expect(input).toMatchObject({ kind: 'cocktail', name: 'Tart', category: 2 });
    expect(input.glass).toMatch(/Coupe/);
    expect(input.method).toMatch(/Shake/);
    await waitFor(() => expect(byId('invent-namesave-status')).toHaveAttribute('data-status', 'signin'));
  });

  it('shows no save row without an onSave prop', () => {
    renderInvent();
    startWith('gin');
    expect(screen.queryByTestId('invent-namesave')).toBeNull();
  });

  it('editItem opens on that drink with its own name and saves under the same id', async () => {
    const onSave = vi.fn().mockResolvedValue({ status: 'saved' });
    renderInvent({
      onSave,
      editItem: { id: 'abc', name: 'House Sour', baseline: { category: 2 }, lines: [{ key: 'gin', amount: '2 oz', role: 'spirit' }, { key: 'lemon juice', amount: '1 oz', role: 'sour' }] },
    });
    expect(byId('invent-namesave-name')).toHaveValue('House Sour');
    expect(listKeys()).toEqual(['gin', 'lemon juice']);
    expect(byId('invent-list-amount-lemon juice')).toHaveValue('1 oz');
    expect(byId('invent-checklist')).toBeTruthy();
    fireEvent.click(byId('invent-namesave-save'));
    expect(onSave.mock.calls[0][0]).toMatchObject({ id: 'abc', name: 'House Sour', category: 2 });
    await waitFor(() => expect(byId('invent-namesave-status')).toBeTruthy());
  });
});

describe('InventCocktail: seed, riff, notebook', () => {
  it('a search seed opens with the searched ingredients as the list; a best-fit family is only recommended', () => {
    renderInvent({ seed: { familyId: 2, base: 'gin', pinned: [{ key: 'gin', source: 'search' }, { key: 'lemon juice', source: 'search' }] } });
    expect(listKeys()).toEqual(['gin', 'lemon juice']);
    expect(screen.getAllByTestId('invent-list-line')[0].textContent).toMatch(/from your search/);
    expect(screen.queryByTestId('invent-checklist')).toBeNull();
    expect(byId('invent-hint')).toBeTruthy();
  });

  it('a seed that named a recipe applies its family', () => {
    renderInvent({ seed: { familyId: 4, fromName: true, base: 'mezcal', pinned: [{ key: 'mezcal', source: 'search' }, { key: 'sweet vermouth', source: 'search' }, { key: 'campari', source: 'search' }] } });
    expect(byId('invent-checklist-item-vermouth').dataset.done).toBe('true');
    expect(screen.queryByTestId('invent-hint')).toBeNull();
  });

  it('Riff on it (styled) and the Recipe Notebook pass the built lines with the cook amounts', () => {
    const onRiff = vi.fn(); const onOpenRecipeLab = vi.fn();
    renderInvent({ onRiff, onOpenRecipeLab });
    startWith('gin');
    expect(screen.queryByTestId('invent-riff')).toBeNull();
    addText('lemon juice');
    chooseStyle(2);
    fireEvent.change(byId('invent-list-amount-gin'), { target: { value: '3 oz' } });
    fireEvent.click(byId('invent-riff'));
    expect(onRiff.mock.calls[0][0].ingredients_raw.map((r) => r.raw)).toEqual(['3 oz gin', expect.stringMatching(/lemon juice$/)]);
    fireEvent.click(byId('invent-notebook'));
    expect(onOpenRecipeLab.mock.calls[0][0]).toEqual(['gin', 'lemon juice']);
  });
});
