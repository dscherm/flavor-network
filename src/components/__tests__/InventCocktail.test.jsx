// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import InventCocktail from '../InventCocktail.jsx';
import { buildPairingIndex } from '../../data/recipePairingMatch.js';
import { buildRolePool } from '../../data/cocktailRiff.js';

const ing = (raw) => ({ raw });
const negroni = { name: 'Negroni', ingredients_raw: [ing('1 oz Gin'), ing('1 oz Sweet vermouth'), ing('1 oz Campari')] };
const roles = {
  gin: { role: 'spirit' }, rye: { role: 'spirit' },
  'lemon juice': { role: 'sour' }, 'simple syrup': { role: 'sweet' },
  'sweet vermouth': { role: 'vermouth' }, campari: { role: 'amaro_liqueur' }, 'triple sec': { role: 'amaro_liqueur' },
  'soda water': { role: 'modifier' },
};
const index = buildPairingIndex([
  { source: 'gin', target: 'campari', strength: 0.8, known: true },
  { source: 'gin', target: 'sweet vermouth', strength: 0.8, known: true },
  { source: 'campari', target: 'sweet vermouth', strength: 0.9, known: true },
  { source: 'gin', target: 'lemon juice', strength: 0.6, known: true },
], Object.keys(roles));
const pool = buildRolePool(roles, index.names);
const families = [{ id: 2, name: 'Sour Family', color: '#a16207' }, { id: 4, name: 'Aromatic Stirred', color: '#7c3aed' }];

function renderInvent(props = {}) {
  return render(<InventCocktail bar={['gin', 'campari', 'sweet vermouth', 'lemon juice', 'simple syrup']} cocktails={[negroni]}
    families={families} roles={roles} pool={pool} pairingIndex={index} onClose={vi.fn()} {...props} />);
}

describe('InventCocktail', () => {
  it('invents a sour from the bar by default, with amounts, roles, build and why', () => {
    renderInvent();
    expect(screen.getByTestId('invent-source')).toHaveTextContent('From your bar (5 items)');
    expect(screen.getByTestId('invent-name')).toHaveTextContent('Gin & Lemon Sour');
    const lines = screen.getByTestId('invent-lines');
    expect(lines).toHaveTextContent('2 oz');
    expect(lines).toHaveTextContent('base spirit');
    expect(screen.getByTestId('invent-card')).toHaveTextContent(/Shake/);
    expect(screen.getByTestId('invent-why')).toHaveTextContent('gin + lemon juice');
  });

  it('switching to Aromatic Stirred builds the Negroni and names it as the closest cocktail', () => {
    const onSelectCocktail = vi.fn();
    renderInvent({ onSelectCocktail });
    fireEvent.click(within(screen.getByTestId('invent-families')).getByText('Aromatic Stirred'));
    expect(screen.getByTestId('invent-name')).toHaveTextContent('Gin & Campari Stirred');
    const nearest = screen.getByTestId('invent-nearest');
    fireEvent.click(within(nearest).getByText('Negroni'));
    expect(onSelectCocktail).toHaveBeenCalledWith('Negroni');
  });

  it('says which role is missing instead of inventing one', () => {
    renderInvent({ bar: ['gin', 'simple syrup'] });
    expect(screen.getByTestId('invent-missing')).toHaveTextContent('Missing: sour');
    expect(screen.queryByTestId('invent-card')).toBeNull();
  });

  it('shuffle, riff and notebook', () => {
    const onRiff = vi.fn(); const onOpenRecipeLab = vi.fn();
    renderInvent({ onRiff, onOpenRecipeLab, bar: ['gin', 'rye', 'lemon juice', 'simple syrup', 'triple sec'] });
    const first = screen.getByTestId('invent-card').textContent;
    fireEvent.click(screen.getByTestId('invent-shuffle'));
    expect(screen.getByTestId('invent-card').textContent).not.toBe(first);
    fireEvent.click(screen.getByTestId('invent-riff'));
    expect(onRiff.mock.calls[0][0].ingredients_raw.length).toBe(3);
    fireEvent.click(screen.getByTestId('invent-notebook'));
    expect(onOpenRecipeLab.mock.calls[0][0]).toHaveLength(3);
  });

  it('with an empty bar says it draws on every bottle, and offers base spirits', () => {
    renderInvent({ bar: [] });
    expect(screen.getByTestId('invent-source')).toHaveTextContent(/every bottle/);
    const bases = screen.getByTestId('invent-bases');
    fireEvent.click(within(bases).getByText('rye'));
    expect(screen.getByTestId('invent-name')).toHaveTextContent(/^Rye/);
  });
});
