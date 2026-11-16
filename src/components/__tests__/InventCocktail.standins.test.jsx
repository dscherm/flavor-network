// @vitest-environment jsdom
// STANDIN-3: the cocktail builder's "Don't have it?" reads the same stand-in table as the shopping sheet.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InventCocktail from '../InventCocktail.jsx';
import { buildPairingIndex } from '../../data/recipePairingMatch.js';
import { buildRolePool } from '../../data/cocktailRiff.js';
import { alternativesFor } from '../../data/shoppingAlternatives.js';

const roles = {
  gin: { role: 'spirit' }, 'lemon juice': { role: 'sour' }, 'triple sec': { role: 'amaro_liqueur' }, cointreau: { role: 'amaro_liqueur' },
  campari: { role: 'amaro_liqueur' }, 'dry vermouth': { role: 'vermouth' }, 'simple syrup': { role: 'sweet' },
};
const index = buildPairingIndex([{ source: 'gin', target: 'triple sec', strength: 0.7, known: true }], Object.keys(roles));
const pool = buildRolePool(roles, index.names);
const families = [{ id: 2, name: 'Sour Family', color: '#a16207' }];

const draw = (props = {}) => render(<InventCocktail bar={['gin']} cocktails={[]} families={families} roles={roles} pool={pool} pairingIndex={index} nodes={new Map()} onClose={vi.fn()} {...props} />);
const byId = (id) => screen.getByTestId(id);
const type = (id, text) => { fireEvent.change(byId(id), { target: { value: text } }); fireEvent.submit(byId(id).closest('form')); };
const options = () => screen.getAllByTestId('invent-list-replace-option').map((o) => o.dataset.key);

describe('the builder and the shopping sheet read one table', () => {
  it('an orange liqueur gets the same alternatives in both, in the same order', () => {
    draw();
    type('invent-start-input', 'gin');
    type('invent-list-add-input', 'triple sec');
    fireEvent.click(byId('invent-list-need-triple sec'));
    const sheet = alternativesFor({ key: 'triple sec' }, { names: index.names, roles, has: () => false }).alternatives.map((a) => a.key);
    expect(sheet).toEqual(['cointreau', 'orange curacao', 'orange liqueur']);
    expect(options()).toEqual(sheet);
  });
  it('what the bar holds comes first and is marked have; the rest say "not in your bar"', () => {
    draw({ bar: ['gin', 'orange liqueur'] });
    type('invent-start-input', 'gin');
    type('invent-list-add-input', 'triple sec');
    fireEvent.click(byId('invent-list-need-triple sec'));
    const chips = screen.getAllByTestId('invent-list-replace-option');
    expect(chips.map((c) => c.dataset.key)).toEqual(['orange liqueur', 'cointreau', 'orange curacao']);
    expect(chips[0].textContent).toMatch(/have/);
    expect(chips[1].textContent).toMatch(/not in your bar/);
    expect(chips[1].textContent).not.toMatch(/· have/);
  });
  it('tapping one replaces the line', () => {
    draw();
    type('invent-start-input', 'gin');
    type('invent-list-add-input', 'triple sec');
    fireEvent.click(byId('invent-list-need-triple sec'));
    fireEvent.click(screen.getAllByTestId('invent-list-replace-option').find((o) => o.dataset.key === 'cointreau'));
    expect(screen.getAllByTestId('invent-list-line').map((l) => l.dataset.key)).toEqual(['gin', 'cointreau']);
  });
  it('a vermouth gets only its aperitif-wine stand-in: dry is never offered for sweet', () => {
    draw({ bar: ['simple syrup'] });
    type('invent-start-input', 'gin');
    type('invent-list-add-input', 'dry vermouth');
    fireEvent.click(byId('invent-list-need-dry vermouth'));
    expect(options()).toEqual(['lillet blanc']);
  });
});
