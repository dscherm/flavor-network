// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import CocktailRiff from '../CocktailRiff.jsx';
import { buildPairingIndex } from '../../data/recipePairingMatch.js';
import { buildRolePool } from '../../data/cocktailRiff.js';

const ing = (raw) => ({ raw });
const negroni = { name: 'Negroni', ingredients_raw: [ing('1 oz Gin'), ing('1 oz Sweet vermouth'), ing('1 oz Campari')] };
const boulevardier = { name: 'Boulevardier', ingredients_raw: [ing('1 1/4 oz Bourbon'), ing('1 oz Sweet vermouth'), ing('1 oz Campari')] };
const roles = {
  gin: { role: 'spirit' }, whiskey: { role: 'spirit' }, rum: { role: 'spirit' },
  'sweet vermouth': { role: 'vermouth' }, campari: { role: 'amaro_liqueur' }, aperol: { role: 'amaro_liqueur' },
};
const names = ['gin', 'whiskey', 'rum', 'bourbon', 'sweet vermouth', 'campari', 'aperol'];
const index = buildPairingIndex([
  { source: 'whiskey', target: 'sweet vermouth', strength: 0.9, known: true },
  { source: 'rum', target: 'campari', strength: 0.2, known: true },
], names);
const pool = buildRolePool(roles, index.names);

function renderRiff(props = {}) {
  return render(<CocktailRiff cocktail={negroni} cocktails={[negroni, boulevardier]} roles={roles} pool={pool} pairingIndex={index} onClose={vi.fn()} {...props} />);
}

describe('CocktailRiff', () => {
  it('lists each line with its role and a swap button', () => {
    renderRiff();
    expect(screen.getByText('Riff on the Negroni')).toBeInTheDocument();
    expect(screen.getByText('base spirit')).toBeInTheDocument();
    expect(screen.getByText('vermouth / aperitif wine')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'swap' })).toHaveLength(3);
  });

  it('swapping the gin for whiskey names the Boulevardier', () => {
    renderRiff();
    fireEvent.click(screen.getByTestId('cocktail-riff-swap-0'));
    const options = screen.getByTestId('cocktail-riff-candidates');
    fireEvent.click(within(options).getByText('whiskey'));
    expect(screen.getByText('Your Negroni riff')).toBeInTheDocument();
    expect(screen.getByText(/was Gin/)).toBeInTheDocument();
    const nearest = screen.getByTestId('cocktail-riff-nearest');
    expect(within(nearest).getByText('Boulevardier')).toBeInTheDocument();
    expect(nearest).toHaveTextContent('basically this drink');
  });

  it('reset restores the original, and the notebook gets the riffed ingredients', () => {
    const onOpenRecipeLab = vi.fn();
    renderRiff({ onOpenRecipeLab });
    fireEvent.click(screen.getByTestId('cocktail-riff-swap-0'));
    fireEvent.click(within(screen.getByTestId('cocktail-riff-candidates')).getByText('whiskey'));
    fireEvent.click(screen.getByRole('button', { name: /recipe notebook/i }));
    expect(onOpenRecipeLab).toHaveBeenCalledWith(['whiskey', 'sweet vermouth', 'campari']);
    fireEvent.click(screen.getByRole('button', { name: /reset to the negroni/i }));
    expect(screen.getByText('Riff on the Negroni')).toBeInTheDocument();
  });
});
