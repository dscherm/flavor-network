// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import MyBarPanel from '../MyBarPanel.jsx';
import InventCocktail from '../InventCocktail.jsx';
import { buildPairingIndex } from '../../data/recipePairingMatch.js';
import { buildRolePool } from '../../data/cocktailRiff.js';
import { drinkColor, ingredientColour, liftColor } from '../../data/drinkColor.js';

afterEach(cleanup);

describe('drinkColor', () => {
  it('a drink with no coloured ingredient keeps its family colour', () => {
    expect(drinkColor(['gin', 'lemon juice', 'simple syrup'], '#a16207')).toEqual({ color: '#a16207', tinted: false });
  });
  it('campari, grenadine and blue curaçao tint the drink', () => {
    expect(drinkColor(['gin', 'campari', 'sweet vermouth'], '#991b1b')).toEqual({ color: '#c8102e', tinted: true });
    expect(drinkColor(['white rum', 'grenadine'], '#047857').color).toBe(ingredientColour('grenadine'));
    expect(drinkColor(['vodka', 'Blue Curaçao', 'lemonade'], '#0369a1').color).toBe('#1d8fe0');
  });
  it('a bright colourant wins over a brown spirit tone', () => {
    expect(drinkColor(['bourbon', 'campari', 'sweet vermouth']).color).toBe('#c8102e');
    expect(drinkColor(['bourbon', 'lemon juice']).color).toBe(ingredientColour('bourbon'));
  });
  it('does not read "dry" as rye or "support" as port', () => {
    expect(ingredientColour('dry vermouth')).toBeNull();
    expect(ingredientColour('rye')).not.toBeNull();
  });
  it('liftColor brightens dark colours only', () => {
    expect(liftColor('#fde68a')).toBe('#fde68a');
    expect(liftColor('#5b21b6')).not.toBe('#5b21b6');
  });
});

const ing = (raw) => ({ raw });
const families = [
  { id: 2, name: 'Sour Family', color: '#a16207' },
  { id: 4, name: 'Aromatic Stirred', color: '#991b1b' },
  { id: 5, name: 'Aperitivos', color: '#be185d' },
];
const negroni = { name: 'Negroni', family_id: 4, ingredients_raw: [ing('1 oz Gin'), ing('1 oz Sweet vermouth'), ing('1 oz Campari')] };
const boulevardier = { name: 'Boulevardier', family_id: 4, ingredients_raw: [ing('1 1/4 oz Bourbon'), ing('1 oz Sweet vermouth'), ing('1 oz Campari')] };
const roles = {
  gin: { role: 'spirit' }, bourbon: { role: 'spirit' }, rye: { role: 'spirit' },
  'lemon juice': { role: 'sour' }, 'simple syrup': { role: 'sweet' },
  'sweet vermouth': { role: 'vermouth' }, campari: { role: 'amaro_liqueur' }, 'soda water': { role: 'modifier' },
};

describe('My bar — drink glasses', () => {
  it('each drink you can make, and each one away, shows its family glass beside its name', () => {
    const index = buildPairingIndex([], Object.keys(roles));
    render(<MyBarPanel bar={['gin', 'sweet vermouth', 'campari']} onChange={vi.fn()} cocktails={[negroni, boulevardier]}
      families={families} roles={roles} pairingIndex={index} />);
    const make = screen.getByTestId('my-bar-make');
    const negroniRow = within(make).getByText('Negroni').closest('button');
    const glass = within(negroniRow).getByTestId('drink-glass');
    expect(glass.dataset.glass).toBe('martini');
    expect(glass.getAttribute('aria-hidden')).toBe('true');
    // Campari makes it red
    expect(glass.querySelector('[data-part="liquid"]').getAttribute('fill')).toBe('#c8102e');
    const away = screen.getByTestId('my-bar-one-away');
    expect(within(within(away).getByText('Boulevardier').closest('button')).getByTestId('drink-glass')).toBeTruthy();
  });
});

describe('Invent a cocktail — the drink in its glass', () => {
  const index = buildPairingIndex([
    { source: 'gin', target: 'lemon juice', strength: 0.6, known: true },
    { source: 'campari', target: 'soda water', strength: 0.8, known: true },
  ], Object.keys(roles));
  const pool = buildRolePool(roles, index.names);
  const renderInvent = (props) => render(<InventCocktail bar={['gin', 'campari', 'lemon juice', 'simple syrup', 'soda water']}
    cocktails={[negroni]} families={families} roles={roles} pool={pool} pairingIndex={index} onClose={vi.fn()} {...props} />);

  it('draws the invented sour in its family glass, untinted', () => {
    renderInvent();
    const wrap = screen.getByTestId('invent-glass');
    expect(within(wrap).getByTestId('invent-drink-glass').dataset.glass).toBe('margarita');
    expect(wrap.dataset.tinted).toBe('false');
    expect(wrap.dataset.color).toBe('#a16207');
  });

  it('a campari drink is poured red', () => {
    renderInvent({ initialFamily: 5 });
    const wrap = screen.getByTestId('invent-glass');
    expect(screen.getByTestId('invent-lines')).toHaveTextContent('campari');
    expect(wrap.dataset.tinted).toBe('true');
    expect(wrap.dataset.color).toBe('#c8102e');
  });

  it('every style chip carries its glass, and the names stay as text', () => {
    renderInvent();
    const group = screen.getByTestId('invent-families');
    for (const id of [2, 4, 1, 5, 0, 3]) expect(within(group).getByTestId(`invent-family-glass-${id}`)).toBeTruthy();
    expect(within(group).getByRole('button', { name: 'Sour Family' })).toBeInTheDocument();
    fireEvent.click(within(group).getByRole('button', { name: 'Aperitivos' }));
    expect(within(group).getByRole('button', { name: 'Aperitivos' })).toHaveAttribute('aria-pressed', 'true');
  });
});
