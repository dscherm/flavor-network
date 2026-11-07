// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import WineLab from '../WineLab.jsx';
import { _resetWineStylesCache } from '../../data/wineStyles.js';

const WINE_JSON = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data/wine_styles.json'), 'utf8'));
const FAMILIES = WINE_JSON._meta.families;
const shownIds = () => [...document.querySelectorAll('[data-testid^="wine-row-"]')].map((el) => el.dataset.testid.replace('wine-row-', '')).sort();

beforeEach(() => {
  _resetWineStylesCache();
  global.fetch = vi.fn((url) => (String(url).includes('wine_styles')
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(WINE_JSON) })
    : Promise.resolve({ ok: false })));
});

describe('WineLab — family glasses (DESIGN-2)', () => {
  it('every wine row carries its family glass, hidden from screen readers, name still as text', async () => {
    render(<WineLab />);
    await waitFor(() => screen.getByText('Wine List'));
    for (const w of WINE_JSON.wines) {
      const row = screen.getByTestId(`wine-row-${w.id}`);
      const glass = row.querySelector(`[data-testid="wine-glass-${w.family}"]`);
      expect(glass, w.id).toBeTruthy();
      expect(glass.getAttribute('aria-hidden')).toBe('true');
      expect(row).toHaveTextContent(w.name);
    }
  });

  it('the family filter is a shelf with one glass per family and a count', async () => {
    render(<WineLab />);
    await waitFor(() => screen.getByText('Wine List'));
    const shelf = screen.getByTestId('wine-shelf');
    for (const fam of FAMILIES) {
      const n = WINE_JSON.wines.filter((w) => w.family === fam.id).length;
      const btn = within(shelf).getByTestId(`wine-shelf-${fam.id}`);
      expect(btn).toHaveAccessibleName(`${fam.name}, ${n} wine${n === 1 ? '' : 's'}`);
      expect(btn.querySelector(`[data-testid="wine-shelf-glass-${fam.id}"]`)).toBeTruthy();
    }
  });

  it('tapping a shelf glass filters to that family; tapping again clears it', async () => {
    render(<WineLab />);
    await waitFor(() => screen.getByText('Wine List'));
    const btn = screen.getByTestId('wine-shelf-full-red');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(shownIds()).toEqual(WINE_JSON.wines.filter((w) => w.family === 'full-red').map((w) => w.id).sort());
    fireEvent.click(btn);
    expect(shownIds().length).toBe(WINE_JSON.wines.length);
  });

  it('shelf works together with the colour and country chips', async () => {
    render(<WineLab />);
    await waitFor(() => screen.getByText('Wine List'));
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    // counts follow the colour chip: no dessert wine is a red
    const reds = WINE_JSON.wines.filter((w) => w.colour === 'red');
    const lightN = reds.filter((w) => w.family === 'light-red').length;
    expect(screen.getByTestId('wine-shelf-light-red')).toHaveAccessibleName(`Light Reds, ${lightN} wine${lightN === 1 ? '' : 's'}`);
    fireEvent.click(screen.getByTestId('wine-shelf-medium-red'));
    fireEvent.click(screen.getByTestId('wine-country-Italy'));
    expect(shownIds()).toEqual(WINE_JSON.wines
      .filter((w) => w.colour === 'red' && w.family === 'medium-red' && w.countries.includes('Italy'))
      .map((w) => w.id).sort());
    fireEvent.click(screen.getByTestId('wine-shelf-clear'));
    expect(shownIds()).toEqual(reds.filter((w) => w.countries.includes('Italy')).map((w) => w.id).sort());
  });

  it('the wine card leads with a large family glass', async () => {
    render(<WineLab />);
    await waitFor(() => screen.getByText('Wine List'));
    fireEvent.click(screen.getByTestId('wine-row-champagne'));
    const card = screen.getByTestId('lab-node-card');
    const art = within(card).getByTestId('lab-node-card-art');
    const glass = within(art).getByTestId('wine-card-glass');
    expect(glass.dataset.glass).toBe('flute');
    expect(Number(glass.getAttribute('height'))).toBeGreaterThanOrEqual(80);
  });

  it('matches-mode rows carry the family glass too', () => {
    const wine = (id) => WINE_JSON.wines.find((w) => w.id === id);
    const ctx = {
      recipeName: 'Beef Bourguignon',
      items: [
        { item: wine('red-burgundy'), reasons: ['red in the pot'] },
        { item: wine('champagne'), reasons: ['fizz'] },
      ],
    };
    render(<WineLab matchesContext={ctx} />);
    expect(screen.getByTestId('wine-row-red-burgundy').querySelector(`[data-testid="wine-glass-${wine('red-burgundy').family}"]`)).toBeTruthy();
    expect(screen.getByTestId('wine-row-champagne').querySelector('[data-testid="wine-glass-sparkling"]')).toBeTruthy();
  });
});
