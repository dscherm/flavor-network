// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import InventCocktail from '../InventCocktail.jsx';
import { buildPairingIndex } from '../../data/recipePairingMatch.js';
import { buildRolePool } from '../../data/cocktailRiff.js';

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

function renderInvent(props = {}) {
  return render(<InventCocktail bar={BAR} cocktails={[negroni, oldFashioned]}
    families={families} roles={roles} pool={pool} pairingIndex={index} onClose={vi.fn()} {...props} />);
}
const slotRow = (id) => screen.getByTestId(`invent-slot-${id}`);
const lineText = (id) => screen.getByTestId(`invent-line-${id}`).textContent;
const open = (id) => fireEvent.click(screen.getByTestId(`invent-open-${id}`));
const type = (testid, text) => {
  fireEvent.change(screen.getByTestId(testid), { target: { value: text } });
  fireEvent.submit(screen.getByTestId(testid).closest('form'));
};

describe('InventCocktail: baseline pickers', () => {
  it('shows the spirit picker before the style picker, and each style with its one-line description', () => {
    renderInvent();
    const bases = screen.getByTestId('invent-bases');
    const styles = screen.getByTestId('invent-families');
    expect(bases.compareDocumentPosition(styles) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/2 · What are you going for\?/)).toBeTruthy();
    const blurbs = { 2: 'bright, shaken, citrus-forward', 4: 'spirit-forward, silky', 1: 'long, bubbly, easy', 5: 'low-proof, bittersweet, bubbly', 0: 'fruity, shaken, crushed ice', 3: 'strong, stirred, slow' };
    for (const [id, text] of Object.entries(blurbs)) expect(screen.getByTestId(`invent-blurb-${id}`)).toHaveTextContent(text);
  });

  it('opens on a pre-filled sour from the bar with amounts, build and why', () => {
    renderInvent();
    expect(screen.getByTestId('invent-source')).toHaveTextContent('From your bar (5 items)');
    expect(screen.getByTestId('invent-name')).toHaveTextContent('Gin & Lemon Sour');
    expect(screen.getByTestId('invent-lines')).toHaveTextContent('2 oz');
    expect(screen.getByTestId('invent-card')).toHaveTextContent(/Shake/);
    expect(screen.getByTestId('invent-why')).toHaveTextContent('gin + lemon juice');
    expect(screen.queryByTestId('invent-shuffle')).toBeNull();
  });

  it('bourbon + Boozy Sippers: bourbon locked as the base, sweetener pre-filled, bitters empty and offered', () => {
    renderInvent({ bar: ['bourbon', 'rye', 'simple syrup', 'angostura bitters', 'lemon juice'] });
    fireEvent.click(within(screen.getByTestId('invent-bases')).getByText('bourbon'));
    fireEvent.click(within(screen.getByTestId('invent-families')).getByText('Boozy Sippers'));
    expect(lineText('base')).toBe('bourbon');
    expect(slotRow('base')).toHaveTextContent('🔒');
    expect(lineText('sweet')).toBe('simple syrup');
    expect(slotRow('bitters').dataset.empty).toBe('true');
    expect(lineText('bitters')).toMatch(/optional/);
    open('bitters');
    expect(within(screen.getByTestId('invent-shortlist-bitters')).getByText('angostura bitters')).toBeTruthy();
  });

  it('switching to Aromatic Stirred builds the Negroni and names it as the closest cocktail', () => {
    const onSelectCocktail = vi.fn();
    renderInvent({ onSelectCocktail });
    fireEvent.click(within(screen.getByTestId('invent-families')).getByText('Aromatic Stirred'));
    expect(screen.getByTestId('invent-name')).toHaveTextContent('Gin & Sweet Vermouth Stirred');
    expect(slotRow('modifier').dataset.empty).toBe('true'); // optional slots start empty
    open('modifier');
    fireEvent.click(within(screen.getByTestId('invent-shortlist-modifier')).getByText('campari'));
    expect(screen.getByTestId('invent-name')).toHaveTextContent('Gin & Campari Stirred');
    fireEvent.click(within(screen.getByTestId('invent-nearest')).getByText('Negroni'));
    expect(onSelectCocktail).toHaveBeenCalledWith('Negroni');
  });

  it('Aperitivos with a spirit chosen says the aperitif is the base instead of dropping the pick silently', () => {
    renderInvent({ bar: ['gin', 'campari', 'soda water'] });
    fireEvent.click(within(screen.getByTestId('invent-bases')).getByText('gin'));
    fireEvent.click(within(screen.getByTestId('invent-families')).getByText(/Aperitivos/));
    expect(screen.getByTestId('invent-no-spirit')).toHaveTextContent(/aperitif is the base/);
    expect(lineText('aperitif')).toBe('campari');
  });
});

describe('InventCocktail: building it yourself', () => {
  it('says what is missing instead of refilling behind the user', () => {
    renderInvent({ bar: ['gin', 'simple syrup'] });
    expect(screen.getByTestId('invent-missing')).toHaveTextContent('Needs a sour');
    expect(slotRow('sour').dataset.empty).toBe('true');
    fireEvent.click(screen.getByTestId('invent-clear-sweet'));
    expect(screen.getByTestId('invent-missing')).toHaveTextContent('Needs a sour and a sweetener');
  });

  it('swapping from the shortlist updates the line, amounts, name and closest cocktails', () => {
    renderInvent({ bar: ['gin', 'campari', 'sweet vermouth', 'lemon juice', 'simple syrup', 'triple sec'] });
    open('sweet');
    fireEvent.click(within(screen.getByTestId('invent-shortlist-sweet')).getByText('triple sec'));
    expect(lineText('sweet')).toBe('triple sec');
    expect(screen.getByTestId('invent-name')).toHaveTextContent('Gin & Triple Sec Sour');
    expect(screen.getByTestId('invent-amount-sweet')).toHaveTextContent('¾ oz');
    expect(screen.getByTestId('invent-nearest').textContent).not.toBe('');
  });

  it('a typed ingredient goes into the slot, and one that does not fit is refused with a reason', () => {
    renderInvent();
    open('sour');
    type('invent-type-sour', 'Lime Juice');
    expect(lineText('sour')).toBe('lime juice');
    expect(screen.getByTestId('invent-name')).toHaveTextContent(/Lime/);
    open('sweet');
    type('invent-type-sweet', 'lime juice');
    expect(screen.getByTestId('invent-notice')).toBeTruthy();
  });

  it('refuses a second base spirit and a second sour, with a visible reason', () => {
    renderInvent({ bar: ['gin', 'rye', 'lemon juice', 'lime juice', 'simple syrup'] });
    type('invent-add-input', 'rye');
    expect(screen.getByTestId('invent-notice')).toHaveTextContent(/one base spirit/i);
    expect(screen.queryByTestId('invent-remove-rye')).toBeNull();
    type('invent-add-input', 'lime juice');
    expect(screen.getByTestId('invent-notice')).toHaveTextContent(/two sours/i);
    expect(screen.queryByTestId('invent-remove-lime juice')).toBeNull();
  });

  it('adds an extra with a default amount and removes it', () => {
    renderInvent({ bar: ['gin', 'lemon juice', 'simple syrup', 'angostura bitters'] });
    type('invent-add-input', 'angostura bitters');
    expect(screen.getByTestId('invent-extras')).toHaveTextContent('angostura bitters');
    expect(screen.getByTestId('invent-extras')).toHaveTextContent('2 dashes');
    fireEvent.click(screen.getByTestId('invent-remove-angostura bitters'));
    expect(screen.getByTestId('invent-extras')).not.toHaveTextContent('angostura bitters');
  });

  it('a tinting ingredient changes the glass colour', () => {
    renderInvent({ bar: ['gin', 'lemon juice', 'simple syrup', 'campari'] });
    const before = screen.getByTestId('invent-glass').dataset.color;
    type('invent-add-input', 'campari');
    expect(screen.getByTestId('invent-glass').dataset.color).not.toBe(before);
  });

  it('Riff on it and Write it in the Recipe Notebook pass the built lines, extras included', () => {
    const onRiff = vi.fn(); const onOpenRecipeLab = vi.fn();
    renderInvent({ onRiff, onOpenRecipeLab, bar: ['gin', 'lemon juice', 'simple syrup', 'angostura bitters'] });
    type('invent-add-input', 'angostura bitters');
    fireEvent.click(screen.getByTestId('invent-riff'));
    expect(onRiff.mock.calls[0][0].ingredients_raw.map((r) => r.raw)).toEqual(['2 oz gin', '¾ oz lemon juice', '¾ oz simple syrup', '2 dashes angostura bitters']);
    fireEvent.click(screen.getByTestId('invent-notebook'));
    expect(onOpenRecipeLab.mock.calls[0][0]).toEqual(['gin', 'lemon juice', 'simple syrup', 'angostura bitters']);
    expect(screen.queryByText(/Shuffle/)).toBeNull();
  });

  it('Start over re-seeds the build', () => {
    renderInvent();
    fireEvent.click(screen.getByTestId('invent-clear-sour'));
    expect(screen.getByTestId('invent-missing')).toBeTruthy();
    fireEvent.click(screen.getByTestId('invent-restart'));
    expect(lineText('sour')).toBe('lemon juice');
    expect(screen.queryByTestId('invent-missing')).toBeNull();
  });
});

describe('InventCocktail: empty bar and seed', () => {
  it('with an empty bar draws on the whole pool for fills and shortlists, and offers base spirits', () => {
    renderInvent({ bar: [] });
    expect(screen.getByTestId('invent-source')).toHaveTextContent(/every bottle/);
    fireEvent.click(within(screen.getByTestId('invent-bases')).getByText('rye'));
    expect(lineText('base')).toBe('rye');
    expect(screen.getByTestId('invent-name')).toHaveTextContent(/^Rye/);
    open('sour');
    const list = screen.getByTestId('invent-shortlist-sour');
    // lemon juice is already the pick; the rest of the pool is on offer
    expect(within(list).getByText('lime juice')).toBeTruthy();
  });

  it('the seed prop opens on its style with search pins locked in the slots they fit', () => {
    renderInvent({
      seed: { familyId: 3, pinned: [{ key: 'bourbon', source: 'search' }, { key: 'angostura bitters', source: 'search' }] },
      bar: ['bourbon', 'simple syrup', 'angostura bitters'],
    });
    expect(screen.getByTestId('invent-name')).toHaveTextContent(/Sipper/);
    expect(lineText('base')).toBe('bourbon');
    expect(slotRow('base')).toHaveTextContent(/from your search/);
    expect(lineText('bitters')).toBe('angostura bitters');
    expect(slotRow('bitters')).toHaveTextContent(/from your search/);
    fireEvent.click(within(screen.getByTestId('invent-families')).getByText('Aromatic Stirred'));
    expect(lineText('base')).toBe('bourbon');
  });

  it('a pinned ingredient no slot takes becomes an extra', () => {
    renderInvent({ seed: { familyId: 2, pinned: [{ key: 'angostura bitters', source: 'search' }] }, bar: BAR });
    expect(screen.getByTestId('invent-extras')).toHaveTextContent('angostura bitters');
  });
});
