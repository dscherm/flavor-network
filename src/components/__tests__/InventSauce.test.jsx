// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import InventSauce from '../InventSauce.jsx';
import { buildCategoryMap } from '../../data/saucePantry.js';

const meta = [
  { name: 'butter', category: 'Fat' }, { name: 'olive oil', category: 'Fat' },
  { name: 'flour', category: 'Thickener' }, { name: 'egg yolk', category: 'Thickener' },
  { name: 'milk', category: 'Liquid' }, { name: 'cream', category: 'Liquid' }, { name: 'chicken stock', category: 'Liquid' },
  { name: 'lemon juice', category: 'Acid' }, { name: 'white wine vinegar', category: 'Acid' }, { name: 'tomato', category: 'Acid' },
  { name: 'shallot', category: 'Aromatic' }, { name: 'garlic', category: 'Aromatic' }, { name: 'onion', category: 'Aromatic' },
  { name: 'tarragon', category: 'Herb' }, { name: 'nutmeg', category: 'Seasoning' }, { name: 'cumin', category: 'Seasoning' },
];
const catMap = buildCategoryMap(meta);
const families = [
  { id: 0, name: 'Béchamel', color: '#f5f0d6' }, { id: 1, name: 'Velouté', color: '#e8c989' }, { id: 2, name: 'Espagnole', color: '#a05a2c' },
  { id: 3, name: 'Hollandaise', color: '#f3d44e' }, { id: 4, name: 'Tomato', color: '#d94a3d' },
];
const sauces = [
  { name: 'Hollandaise', family_id: 3, ingredients: ['egg yolk', 'butter', 'lemon juice', 'salt'], proteins: ['salmon', 'eggs'] },
  { name: 'Béarnaise', family_id: 3, ingredients: ['egg yolk', 'butter', 'white wine vinegar', 'shallot', 'tarragon'], proteins: ['beef', 'salmon'] },
  { name: 'Béchamel', family_id: 0, ingredients: ['butter', 'flour', 'milk', 'nutmeg'], proteins: ['chicken'] },
  { name: 'Marinara', family_id: 4, ingredients: ['olive oil', 'tomato', 'garlic'], proteins: ['chicken'] },
];
// The real wine list, shaped as loadWineStyles returns it.
const wineJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/data/wine_styles.json'), 'utf8'));
const wineStyles = { families: wineJson._meta?.families || [], wines: wineJson.wines };

function renderInvent(props = {}) {
  return render(<InventSauce kitchen={['butter', 'egg yolk', 'lemon', 'shallot', 'cream', 'tomato', 'garlic']} sauces={sauces}
    families={families} meta={meta} catMap={catMap} wineStyles={null} onClose={vi.fn()} {...props} />);
}

describe('InventSauce', () => {
  it('shows techniques from the templates and three inventions from the pantry', () => {
    renderInvent({ initialStyle: 'Hollandaise' });
    expect(screen.getByTestId('sauce-invent-source')).toHaveTextContent('From your pantry (7 items)');
    const styles = screen.getByTestId('sauce-invent-styles');
    expect(within(styles).getByRole('button', { name: /Emulsion/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(styles).getByRole('button', { name: /Roux & milk/ })).toBeInTheDocument();
    expect(screen.getByTestId('sauce-invent-chemistry')).toHaveTextContent(/emulsifier/);
    const cards = screen.getAllByTestId('sauce-invent-card');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(3);
    const card = cards[0];
    expect(within(card).getByTestId('sauce-invent-lines')).toHaveTextContent('egg yolk');
    expect(within(card).getByTestId('sauce-invent-method')).toHaveTextContent(/lecithin/);
    expect(within(card).getByTestId('sauce-invent-honest')).toHaveTextContent('an idea from what pairs, not a tested recipe'.replace(/^a/, 'A'));
    expect(within(card).getByTestId('sauce-invent-vessel')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the closest existing sauce and opens it', () => {
    const onSelectSauce = vi.fn();
    renderInvent({ initialStyle: 'Hollandaise', onSelectSauce });
    const near = screen.getAllByTestId('sauce-invent-nearest')[0];
    const btn = within(near).getByRole('button');
    expect(btn).toHaveTextContent(/Hollandaise|Béarnaise/);
    fireEvent.click(btn);
    expect(onSelectSauce).toHaveBeenCalled();
  });

  it('marks what you would need when the pantry lacks a required role', () => {
    renderInvent({ initialStyle: 'Velouté' });
    expect(screen.getAllByTestId('sauce-invent-shopping')[0]).toHaveTextContent('chicken stock');
    expect(screen.getAllByTestId('sauce-invent-need').length).toBeGreaterThan(0);
  });

  it('only-what-I-have names the missing emulsifier instead of inventing', () => {
    renderInvent({ kitchen: ['butter', 'lemon'], initialStyle: 'Hollandaise' });
    fireEvent.click(screen.getByTestId('sauce-invent-pantry-only'));
    const miss = screen.getByTestId('sauce-invent-missing');
    expect(miss).toHaveTextContent('Missing: egg yolk (the emulsifier)');
    expect(screen.queryByTestId('sauce-invent-card')).toBeNull();
  });

  it('switches technique', () => {
    renderInvent({ initialStyle: 'Hollandaise' });
    fireEvent.click(within(screen.getByTestId('sauce-invent-styles')).getByRole('button', { name: /Tomato simmer/ }));
    expect(screen.getAllByTestId('sauce-invent-name')[0]).toHaveTextContent(/Tomato Sauce/);
  });

  it('a chosen protein brings its wine', () => {
    renderInvent({ initialStyle: 'Hollandaise', wineStyles });
    expect(screen.queryByTestId('sauce-invent-wine')).toBeNull();
    fireEvent.click(within(screen.getByTestId('sauce-invent-proteins')).getByRole('button', { name: 'salmon' }));
    const wine = screen.getAllByTestId('sauce-invent-wine')[0];
    expect(wine).toHaveTextContent('wine with salmon');
    expect(wineStyles.wines.some((w) => wine.textContent.includes(w.name))).toBe(true);
  });

  it('opens the invention in the Recipe Notebook, with the protein', () => {
    const onOpenRecipeLab = vi.fn();
    renderInvent({ initialStyle: 'Hollandaise', onOpenRecipeLab });
    fireEvent.click(within(screen.getByTestId('sauce-invent-proteins')).getByRole('button', { name: 'salmon' }));
    fireEvent.click(screen.getAllByTestId('sauce-invent-notebook')[0]);
    const arg = onOpenRecipeLab.mock.calls[0][0];
    expect(arg).toContain('egg yolk');
    expect(arg[arg.length - 1]).toBe('salmon');
  });

  it('Shuffle never repeats a sauce and says when the pantry has no more (WEAK-5)', () => {
    renderInvent({ initialStyle: 'Tomato', kitchen: ['tomato', 'garlic', 'onion', 'shallot'] });
    const seen = screen.getAllByTestId('sauce-invent-name').map((n) => n.textContent);
    for (let i = 0; i < 50 && !screen.queryByTestId('sauce-invent-exhausted'); i++) {
      fireEvent.click(screen.getByTestId('sauce-invent-shuffle'));
      if (!screen.queryByTestId('sauce-invent-exhausted')) seen.push(...screen.getAllByTestId('sauce-invent-name').map((n) => n.textContent));
    }
    expect(screen.getByTestId('sauce-invent-exhausted')).toHaveTextContent("That's every idea for this pantry; add an ingredient for more.");
    expect(new Set(seen).size).toBe(seen.length);
    fireEvent.click(screen.getByTestId('sauce-invent-start-over'));
    expect(screen.queryByTestId('sauce-invent-exhausted')).toBeNull();
    expect(screen.getAllByTestId('sauce-invent-name').map((n) => n.textContent)[0]).toBe(seen[0]);
  });

  it('shuffle steps through the inventions; Back closes', () => {
    const onClose = vi.fn();
    renderInvent({ initialStyle: 'Béchamel', kitchen: [], onClose });
    expect(screen.getByTestId('sauce-invent-source')).toHaveTextContent('Your pantry is empty');
    const first = screen.getAllByTestId('sauce-invent-name').map((n) => n.textContent).join('|');
    const shuffle = screen.getByTestId('sauce-invent-shuffle');
    if (!shuffle.disabled) {
      fireEvent.click(shuffle);
      expect(screen.getAllByTestId('sauce-invent-name').map((n) => n.textContent).join('|')).not.toBe(first);
    }
    fireEvent.click(screen.getByTestId('sauce-invent-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
