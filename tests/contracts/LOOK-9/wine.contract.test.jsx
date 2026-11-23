// @vitest-environment jsdom
// LOOK-9 contract tests (blind): the Wine Lab (list, Wines for X, wine card). Written from plan.md (LOOK-9 AC-1,
// AC-2, AC-3, AC-7) and the approved brief .schermness/design/LOOK-9.md (sections 3.7, 7 D3, 9). No file under src/
// was read; the render setup is the one in src/components/__tests__/WineLab.test.jsx (real wine_styles.json, fetch
// routed by URL). Colour chips are found by their name ("Sparkling"), country chips by data-testid wine-country-<C>,
// as the existing tests do.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import {
  hasBorder, hasBoxShadow, hasBackgroundImage, minHeightPx, primaries,
  expectNoOtherAccentFill, expectSelectedNotFilled,
} from './helpers.js';
import WineLab from '../../../src/components/WineLab.jsx';
import { _resetWineStylesCache } from '../../../src/data/wineStyles.js';

const WINE_JSON = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data/wine_styles.json'), 'utf8'));

beforeEach(() => {
  _resetWineStylesCache();
  global.fetch = vi.fn((url) => (String(url).includes('wine_styles')
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(WINE_JSON) })
    : Promise.resolve({ ok: false })));
});
afterEach(cleanup);

const wineRows = () => [...document.querySelectorAll('[data-testid^="wine-row-"]')];
const filtersToggle = () => screen.queryByTestId('wine-filters-toggle')
  || screen.getByRole('button', { name: /^\s*filters\b/i });
async function openList() {
  const utils = render(<WineLab />);
  await waitFor(() => expect(screen.getByText('Wine list')).toBeInTheDocument());
  return utils;
}
const openFilters = () => {
  const t = filtersToggle();
  if (t.getAttribute('aria-expanded') !== 'true') fireEvent.click(t);
};
const wine = (id) => WINE_JSON.wines.find((w) => w.id === id);
const MATCHES = {
  recipeName: 'Beef Bourguignon',
  returnTab: 'cookbook',
  items: [
    { item: wine('red-burgundy'), similarity: 1, reasons: ['the red wine in the pot points to a red in the glass'] },
    { item: wine('cotes-du-rhone'), similarity: 0.8, reasons: ['French wine with French food'] },
  ],
};

function expectPlainRows(list, label) {
  expect(list.length, `${label}: wine rows`).toBeGreaterThan(0);
  for (const row of list) {
    const tag = `${label} ${row.getAttribute('data-testid')} (style="${row.getAttribute('style')}", class="${row.getAttribute('class')}")`;
    expect(hasBorder(row), `${tag} has a border`).toBe(false);
    expect(hasBoxShadow(row), `${tag} has a box-shadow`).toBe(false);
    expect(hasBackgroundImage(row), `${tag} has a background image`).toBe(false);
    const h = minHeightPx(row);
    expect(h, `${tag} sets no min height`).not.toBeNull();
    expect(h, `${tag} min height`).toBeGreaterThanOrEqual(44);
  }
}

describe('LOOK-9 Wine Lab: no primary', () => {
  // Covers: AC-1
  it('the wine list has no [data-primary="true"] and no accent background', async () => {
    const { container } = await openList();
    expect(primaries(container)).toHaveLength(0);
    expectNoOtherAccentFill(expect, container, 'Wine list');
  });

  // Covers: AC-1
  it('the wine card has no primary and no accent background', async () => {
    const { container } = await openList();
    fireEvent.click(screen.getByTestId('wine-row-chianti'));
    const card = screen.getByTestId('lab-node-card');
    expect(primaries(card)).toHaveLength(0);
    expect(primaries(container)).toHaveLength(0);
    expectNoOtherAccentFill(expect, card, 'Chianti card');
  });

  // Covers: AC-1
  it('Wines for X (a matches list) has no primary', async () => {
    const { container } = render(<WineLab matchesContext={MATCHES} onBackToRecipe={vi.fn()} />);
    expect(screen.getByText('Wines for Beef Bourguignon')).toBeInTheDocument();
    expect(primaries(container)).toHaveLength(0);
    expectNoOtherAccentFill(expect, container, 'Wines for Beef Bourguignon');
  });
});

describe('LOOK-9 Wine Lab: selected is not filled', () => {
  // Covers: AC-2
  it('a selected colour chip and a selected country chip carry aria-pressed and no background; no accent fill anywhere', async () => {
    const { container } = await openList();
    openFilters();
    fireEvent.click(screen.getByRole('button', { name: 'Sparkling' }));
    expectSelectedNotFilled(expect, screen.getByRole('button', { name: 'Sparkling' }), 'Sparkling colour chip');
    expectNoOtherAccentFill(expect, container, 'Wine list, Sparkling');
    // a fresh list for the country (Sparkling has few Italian wines; keep the two filters independent)
    cleanup();
    _resetWineStylesCache();
    const again = await openList();
    openFilters();
    fireEvent.click(screen.getByTestId('wine-country-Italy'));
    expectSelectedNotFilled(expect, screen.getByTestId('wine-country-Italy'), 'Italy country chip');
    expectNoOtherAccentFill(expect, again.container, 'Wine list, Italy');
    expect(primaries(again.container)).toHaveLength(0);
  });
});

describe('LOOK-9 Wine Lab: rows', () => {
  // Covers: AC-3
  it('every wine-row-* on the list has no border, no box-shadow, no background image and min height >= 44', async () => {
    await openList();
    expect(wineRows().length).toBe(WINE_JSON.wines.length);
    expectPlainRows(wineRows(), 'list');
  });

  // Covers: AC-3
  it('rows on a Wines for X list (best match included) meet the same rule', async () => {
    render(<WineLab matchesContext={MATCHES} onBackToRecipe={vi.fn()} />);
    await waitFor(() => expect(wineRows().length).toBe(2));
    expectPlainRows(wineRows(), 'matches');
  });
});

describe('LOOK-9 Wine Lab: Filters (decision D3)', () => {
  // Covers: AC-7
  it('no colour or country chip is visible until Filters is pressed (aria-expanded false then true)', async () => {
    await openList();
    expect(screen.queryByRole('button', { name: 'Sparkling' }), 'colour chip visible before Filters').toBeNull();
    expect(screen.queryByTestId('wine-country-Italy'), 'country chip visible before Filters').toBeNull();
    const toggle = filtersToggle();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(filtersToggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Sparkling' })).toBeInTheDocument();
    expect(screen.getByTestId('wine-country-Italy')).toBeInTheDocument();
  });

  // Covers: AC-7
  it('choosing a colour chip still filters (Sparkling keeps Lambrusco and Moscato d’Asti, drops Barolo)', async () => {
    await openList();
    openFilters();
    fireEvent.click(screen.getByRole('button', { name: 'Sparkling' }));
    expect(screen.getByTestId('wine-row-lambrusco')).toBeInTheDocument();
    expect(screen.getByTestId('wine-row-moscato-dasti')).toBeInTheDocument();
    expect(screen.queryByTestId('wine-row-barolo')).toBeNull();
  });

  // Covers: AC-7
  it('choosing a country chip still filters to that country', async () => {
    await openList();
    openFilters();
    fireEvent.click(screen.getByTestId('wine-country-Italy'));
    const shown = wineRows().map((el) => el.dataset.testid.replace('wine-row-', '')).sort();
    expect(shown).toEqual(WINE_JSON.wines.filter((w) => w.countries.includes('Italy')).map((w) => w.id).sort());
  });
});
