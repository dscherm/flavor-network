import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

const STYLES = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data/wine_styles.json'), 'utf8'));
vi.mock('../../data/wineStyles.js', async (orig) => ({
  ...(await orig()),
  loadWineStyles: vi.fn(() => Promise.resolve(STYLES)),
}));

import SaucePairings from '../SaucePairings.jsx';
import { loadWineStyles } from '../../data/wineStyles.js';

const BORDELAISE = {
  name: 'Bordelaise', cuisine: 'French', proteins: ['beef', 'lamb'],
  ingredients: [{ name: 'red wine' }, { name: 'shallot' }, { name: 'butter' }, { name: 'thyme' }],
};

describe('SaucePairings', () => {
  beforeEach(() => { loadWineStyles.mockClear(); });

  it('lists the proteins with a drawing each', () => {
    render(<SaucePairings sauce={BORDELAISE} />);
    const list = screen.getByTestId('sauce-proteins');
    expect(list.textContent).toContain('beef');
    expect(list.textContent).toContain('lamb');
    expect(list.querySelectorAll('[data-testid="ingredient-art"][data-kind="steak"]').length).toBe(2);
  });

  it('shows a wine with its glass for the proteins, and hands off for more', async () => {
    const onFindWine = vi.fn();
    render(<SaucePairings sauce={BORDELAISE} onFindWine={onFindWine} />);
    const wines = await screen.findByTestId('sauce-wines');
    expect(wines.querySelectorAll('li').length).toBeGreaterThan(0);
    expect(wines.textContent).toMatch(/with (beef|lamb)/);
    expect(wines.querySelector('[data-testid^="wine-glass-"]')).toBeTruthy();
    fireEvent.click(screen.getByTestId('sauce-more-wines'));
    expect(onFindWine).toHaveBeenCalledWith(
      ['red wine', 'shallot', 'butter', 'thyme', 'beef'], 'Bordelaise with beef', 'sauce', { cuisine: 'French' },
    );
  });

  it('renders proteins even when wine data fails to load', async () => {
    loadWineStyles.mockImplementationOnce(() => Promise.resolve(null));
    render(<SaucePairings sauce={BORDELAISE} />);
    await waitFor(() => expect(loadWineStyles).toHaveBeenCalled());
    expect(screen.getByTestId('sauce-proteins')).toBeTruthy();
    expect(screen.queryByTestId('sauce-wines')).toBeNull();
  });

  it('renders nothing for a sauce without proteins', () => {
    const { container } = render(<SaucePairings sauce={{ name: 'X', ingredients: [] }} />);
    expect(container.innerHTML).toBe('');
  });
});
