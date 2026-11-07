// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import WineLab from '../WineLab.jsx';
import { _resetWineStylesCache } from '../../data/wineStyles.js';

const WINE_JSON = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data/wine_styles.json'), 'utf8'));

beforeEach(() => {
  _resetWineStylesCache();
  global.fetch = vi.fn((url) => (String(url).includes('wine_styles')
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(WINE_JSON) })
    : Promise.resolve({ ok: false })));
});

describe('WineLab — browse', () => {
  it('lists every wine under its family', async () => {
    render(<WineLab />);
    await waitFor(() => expect(screen.getByText('Wine List')).toBeInTheDocument());
    for (const fam of WINE_JSON._meta.families) expect(screen.getByTestId(`wine-family-${fam.id}`)).toBeInTheDocument();
    expect(document.querySelectorAll('[data-testid^="wine-row-"]').length).toBe(WINE_JSON.wines.length);
  });

  it('search matches food: "salmon" finds the wines that list it', async () => {
    render(<WineLab />);
    await waitFor(() => screen.getByText('Wine List'));
    fireEvent.change(screen.getByLabelText(/search wines/i), { target: { value: 'salmon' } });
    const expected = WINE_JSON.wines.filter((w) => w.classicMatches.includes('salmon')).map((w) => w.id).sort();
    const shown = [...document.querySelectorAll('[data-testid^="wine-row-"]')].map((el) => el.dataset.testid.replace('wine-row-', '')).sort();
    expect(shown).toEqual(expected);
  });

  it('search matches grape: "nebbiolo" finds Barolo', async () => {
    render(<WineLab />);
    await waitFor(() => screen.getByText('Wine List'));
    fireEvent.change(screen.getByLabelText(/search wines/i), { target: { value: 'nebbiolo' } });
    expect(screen.getByTestId('wine-row-barolo')).toBeInTheDocument();
    expect(screen.queryByTestId('wine-row-chablis')).toBeNull();
  });

  it('colour chips filter (Sparkling includes Lambrusco and Moscato d’Asti)', async () => {
    render(<WineLab />);
    await waitFor(() => screen.getByText('Wine List'));
    fireEvent.click(screen.getByRole('button', { name: 'Sparkling' }));
    expect(screen.getByTestId('wine-row-lambrusco')).toBeInTheDocument();
    expect(screen.getByTestId('wine-row-moscato-dasti')).toBeInTheDocument();
    expect(screen.queryByTestId('wine-row-barolo')).toBeNull();
  });

  it('country chips filter, and a country shows its region chips', async () => {
    render(<WineLab />);
    await waitFor(() => screen.getByText('Wine List'));
    fireEvent.click(screen.getByTestId('wine-country-Italy'));
    const shown = [...document.querySelectorAll('[data-testid^="wine-row-"]')].map((el) => el.dataset.testid.replace('wine-row-', ''));
    expect(shown.sort()).toEqual(WINE_JSON.wines.filter((w) => w.countries.includes('Italy')).map((w) => w.id).sort());
    fireEvent.click(screen.getByRole('button', { name: /^Piedmont/ }));
    const piedmont = [...document.querySelectorAll('[data-testid^="wine-row-"]')].map((el) => el.dataset.testid.replace('wine-row-', ''));
    expect(piedmont.sort()).toEqual(['barbera', 'barolo', 'moscato-dasti']);
  });

  it('search matches a region name: "tuscany" finds Chianti and Vin Santo', async () => {
    render(<WineLab />);
    await waitFor(() => screen.getByText('Wine List'));
    fireEvent.change(screen.getByLabelText(/search wines/i), { target: { value: 'tuscany' } });
    const shown = [...document.querySelectorAll('[data-testid^="wine-row-"]')].map((el) => el.dataset.testid.replace('wine-row-', ''));
    expect(shown.sort()).toEqual(['chianti', 'vin-santo']);
  });

  it('group by country makes one section per home country, each wine once', async () => {
    render(<WineLab />);
    await waitFor(() => screen.getByText('Wine List'));
    fireEvent.click(screen.getByRole('button', { name: 'Country' }));
    expect(screen.getByTestId('wine-country-section-France')).toBeInTheDocument();
    expect(screen.getByTestId('wine-country-section-Hungary')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-testid^="wine-row-"]').length).toBe(WINE_JSON.wines.length);
  });

  it('opens a wine card with structure, grapes, notes and classic foods', async () => {
    render(<WineLab />);
    await waitFor(() => screen.getByText('Wine List'));
    fireEvent.click(screen.getByTestId('wine-row-chianti'));
    const card = screen.getByTestId('lab-node-card');
    expect(card).toHaveAttribute('data-kind', 'wine');
    expect(within(card).getByText('Grapes')).toBeInTheDocument();
    expect(within(card).getByText('Sangiovese')).toBeInTheDocument();
    expect(card).toHaveTextContent('Country: 🇮🇹 Italy');
    expect(card).toHaveTextContent('Region: Tuscany');
    expect(within(card).getByText('Tasting notes')).toBeInTheDocument();
    expect(within(card).getByText('Wines like this')).toBeInTheDocument();
    expect(within(card).getByTestId('lab-node-card-pairs-with')).toHaveTextContent('tomato');
  });
});

describe('WineLab — matches', () => {
  const wine = (id) => WINE_JSON.wines.find((w) => w.id === id);
  const ctx = {
    recipeName: 'Beef Bourguignon',
    returnTab: 'cookbook',
    items: [
      { item: wine('red-burgundy'), similarity: 1, reasons: ['the red wine in the pot points to a red in the glass'] },
      { item: wine('cotes-du-rhone'), similarity: 0.8, reasons: ['French wine with French food'] },
    ],
  };

  it('shows the ranked wines with their reasons and a back button', async () => {
    const onBack = vi.fn();
    render(<WineLab matchesContext={ctx} onBackToRecipe={onBack} />);
    expect(screen.getByText('Wines for Beef Bourguignon')).toBeInTheDocument();
    expect(screen.getByText('best match')).toBeInTheDocument();
    expect(screen.getByText('the red wine in the pot points to a red in the glass')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('wine-matches-back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('the card opened from a match says why it was picked', async () => {
    render(<WineLab matchesContext={ctx} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('wine-row-red-burgundy'));
    expect(screen.getByTestId('lab-node-card')).toHaveTextContent('Why with Beef Bourguignon');
  });
});
