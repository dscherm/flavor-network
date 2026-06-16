// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import IngredientPicker from '../IngredientPicker.jsx';

function buildCtx({ withSauce = false, withCocktail = false } = {}) {
  const nodes = new Map([
    ['basil', {
      name: 'basil',
      taste: 'sweet',
      cuisines: ['Italian'],
      season: 'summer',
      category: 'Herb',
      pairingCount: 95,
      flavorGraph: { tier1: ['green'] },
    }],
    ['lemon', {
      name: 'lemon',
      taste: 'sour',
      cuisines: ['Mediterranean'],
      season: 'winter',
      category: 'Fruit',
      pairingCount: 110,
      flavorGraph: { tier1: ['citrus'] },
    }],
    ['salt', {
      name: 'salt',
      taste: 'salty',
      cuisines: [],
      season: 'year-round',
      category: 'Spice',
      pairingCount: 200,
      flavorGraph: { tier1: ['pungent'] },
    }],
    ['simple syrup', {
      name: 'simple syrup',
      taste: 'sweet',
      cuisines: [],
      season: 'year-round',
      category: 'Sweetener',
      pairingCount: 40,
      inCocktailLab: withCocktail,
      flavorGraph: { tier1: [] },
    }],
    ['butter', {
      name: 'butter',
      taste: 'sweet',
      cuisines: ['French'],
      season: 'year-round',
      category: 'Fat',
      pairingCount: 130,
      inSauceLab: withSauce,
      flavorGraph: { tier1: ['creamy'] },
    }],
  ]);
  return {
    graph: { nodes },
    gnnEntropy: null,
    cuisineMap: null,
    seasonMap: { basil: { season: 'summer' }, lemon: { season: 'winter' }, salt: { season: 'year-round' }, 'simple syrup': { season: 'year-round' }, butter: { season: 'year-round' } },
  };
}

describe('IngredientPicker', () => {
  it('renders 5 outer-category pills', () => {
    render(<IngredientPicker mode="notebook" ctx={buildCtx()} />);
    expect(screen.getByTestId('picker-pill-taste')).toBeInTheDocument();
    expect(screen.getByTestId('picker-pill-aroma')).toBeInTheDocument();
    expect(screen.getByTestId('picker-pill-season')).toBeInTheDocument();
    expect(screen.getByTestId('picker-pill-cuisine')).toBeInTheDocument();
    expect(screen.getByTestId('picker-pill-family')).toBeInTheDocument();
  });

  it('defaults to TASTE pill + null chosenAxis (shows every bucketed ingredient)', () => {
    render(<IngredientPicker mode="notebook" ctx={buildCtx()} />);
    expect(screen.getByTestId('picker-pill-taste').getAttribute('aria-checked')).toBe('true');
    const list = screen.getByTestId('picker-ingredient-list');
    // 5 ingredients all have a taste bucket → all 5 visible
    expect(within(list).getByTestId('picker-row-basil')).toBeInTheDocument();
    expect(within(list).getByTestId('picker-row-lemon')).toBeInTheDocument();
    expect(within(list).getByTestId('picker-row-salt')).toBeInTheDocument();
    expect(within(list).getByTestId('picker-row-butter')).toBeInTheDocument();
  });

  it('tapping a radar axis label narrows the list to that bucket', () => {
    render(<IngredientPicker mode="notebook" ctx={buildCtx()} />);
    // Tap "Sour" axis on the Taste radar
    const sourAxis = screen.getByTestId('picker-axis-Sour');
    fireEvent.click(sourAxis);
    const list = screen.getByTestId('picker-ingredient-list');
    expect(within(list).getByTestId('picker-row-lemon')).toBeInTheDocument();
    expect(within(list).queryByTestId('picker-row-basil')).toBeNull();
    expect(within(list).queryByTestId('picker-row-salt')).toBeNull();
  });

  it('tapping same axis again clears the filter', () => {
    render(<IngredientPicker mode="notebook" ctx={buildCtx()} />);
    const sourAxis = screen.getByTestId('picker-axis-Sour');
    fireEvent.click(sourAxis);
    fireEvent.click(sourAxis);
    const radar = screen.getByTestId('ingredient-picker-radar');
    expect(radar.getAttribute('data-chosen-axis')).toBe('');
  });

  it('switching pill resets chosenAxis to null', () => {
    render(<IngredientPicker mode="notebook" ctx={buildCtx()} />);
    fireEvent.click(screen.getByTestId('picker-axis-Sour'));
    expect(screen.getByTestId('ingredient-picker-radar').getAttribute('data-chosen-axis')).toBe('Sour');
    fireEvent.click(screen.getByTestId('picker-pill-family'));
    expect(screen.getByTestId('ingredient-picker-radar').getAttribute('data-chosen-axis')).toBe('');
  });

  it('notebook mode: row tap PINS to radar (does not commit yet)', () => {
    const onSelect = vi.fn();
    const onIngredientPick = vi.fn();
    render(
      <IngredientPicker
        mode="notebook"
        ctx={buildCtx()}
        onSelect={onSelect}
        onIngredientPick={onIngredientPick}
      />,
    );
    fireEvent.click(screen.getByTestId('picker-row-basil'));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onIngredientPick).not.toHaveBeenCalled();
    // Pinned: the row should now be a commit button.
    expect(screen.getByTestId('picker-commit-basil')).toBeInTheDocument();
    expect(screen.getByTestId('ingredient-picker').getAttribute('data-primary-count')).toBe('1');
  });

  it('notebook mode: commit click calls onSelect and clears that pin', () => {
    const onSelect = vi.fn();
    render(
      <IngredientPicker mode="notebook" ctx={buildCtx()} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByTestId('picker-row-basil'));
    expect(screen.getByTestId('picker-commit-basil')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('picker-commit-basil'));
    expect(onSelect).toHaveBeenCalledWith('basil');
    // Pinning cleared; row reverts to a regular pick row.
    expect(screen.queryByTestId('picker-commit-basil')).toBeNull();
    expect(screen.getByTestId('ingredient-picker').getAttribute('data-primary-count')).toBe('0');
  });

  it('notebook mode: multiple primaries can be pinned at once', () => {
    render(<IngredientPicker mode="notebook" ctx={buildCtx()} />);
    fireEvent.click(screen.getByTestId('picker-row-basil'));
    fireEvent.click(screen.getByTestId('picker-row-lemon'));
    expect(screen.getByTestId('ingredient-picker').getAttribute('data-primary-count')).toBe('2');
  });

  it('notebook mode: clicking a pinned ingredient on the radar opens a confirm popup', () => {
    render(<IngredientPicker mode="notebook" ctx={buildCtx()} />);
    fireEvent.click(screen.getByTestId('picker-row-basil'));
    // Pinned basil should now appear as a clickable group on the radar.
    const pin = screen.getByTestId('picker-radar-pin-basil');
    fireEvent.click(pin);
    const confirm = screen.getByTestId('picker-radar-confirm');
    expect(confirm.getAttribute('data-confirm-name')).toBe('basil');
    expect(confirm.textContent).toContain('Add');
    expect(confirm.textContent).toContain('basil');
  });

  it('notebook mode: confirm Yes adds to recipe and clears the pin', () => {
    const onSelect = vi.fn();
    render(<IngredientPicker mode="notebook" ctx={buildCtx()} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('picker-row-basil'));
    fireEvent.click(screen.getByTestId('picker-radar-pin-basil'));
    fireEvent.click(screen.getByTestId('picker-radar-confirm-yes'));
    expect(onSelect).toHaveBeenCalledWith('basil');
    expect(screen.queryByTestId('picker-radar-confirm')).toBeNull();
    expect(screen.getByTestId('ingredient-picker').getAttribute('data-primary-count')).toBe('0');
  });

  it('notebook mode: confirm Cancel keeps the pin and dismisses the popup', () => {
    const onSelect = vi.fn();
    render(<IngredientPicker mode="notebook" ctx={buildCtx()} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('picker-row-basil'));
    fireEvent.click(screen.getByTestId('picker-radar-pin-basil'));
    fireEvent.click(screen.getByTestId('picker-radar-confirm-cancel'));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByTestId('picker-radar-confirm')).toBeNull();
    expect(screen.getByTestId('ingredient-picker').getAttribute('data-primary-count')).toBe('1');
  });

  it('guided mode: row tap calls onIngredientPick, NOT onSelect', () => {
    const onSelect = vi.fn();
    const onIngredientPick = vi.fn();
    render(
      <IngredientPicker
        mode="guided"
        ctx={buildCtx()}
        onSelect={onSelect}
        onIngredientPick={onIngredientPick}
      />,
    );
    fireEvent.click(screen.getByTestId('picker-row-basil'));
    expect(onIngredientPick).toHaveBeenCalledWith('basil');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('list is sorted by pairingCount descending', () => {
    render(<IngredientPicker mode="notebook" ctx={buildCtx()} />);
    const list = screen.getByTestId('picker-ingredient-list');
    const rows = within(list).getAllByRole('button');
    // top of list should be 'salt' (pairingCount 200)
    expect(rows[0].textContent).toContain('salt');
    // basil (95) comes after lemon (110)
    const order = rows.map((r) => r.getAttribute('data-testid')?.replace('picker-row-', ''));
    expect(order.indexOf('lemon')).toBeLessThan(order.indexOf('basil'));
  });

  it('mode prop is exposed via data-mode attribute', () => {
    const { rerender } = render(<IngredientPicker mode="notebook" ctx={buildCtx()} />);
    expect(screen.getByTestId('ingredient-picker').getAttribute('data-mode')).toBe('notebook');
    rerender(<IngredientPicker mode="guided" ctx={buildCtx()} />);
    expect(screen.getByTestId('ingredient-picker').getAttribute('data-mode')).toBe('guided');
  });

  it('renders empty-state when no ingredients match', () => {
    const emptyCtx = { graph: { nodes: new Map() } };
    render(<IngredientPicker mode="notebook" ctx={emptyCtx} />);
    expect(screen.getByTestId('picker-ingredient-list').textContent).toContain('No ingredients match');
  });

  it('curated mode lists only the supplied candidate names + custom title (Suggest/Replace)', () => {
    render(
      <IngredientPicker
        mode="notebook"
        ctx={buildCtx()}
        candidateNames={['lemon', 'basil']}
        title="✨ Suggested ingredients"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('✨ Suggested ingredients')).toBeInTheDocument();
    expect(screen.getByTestId('picker-row-lemon')).toBeInTheDocument();
    expect(screen.getByTestId('picker-row-basil')).toBeInTheDocument();
    // non-candidates are excluded from the curated list
    expect(screen.queryByTestId('picker-row-salt')).not.toBeInTheDocument();
    expect(screen.queryByTestId('picker-row-butter')).not.toBeInTheDocument();
  });
});
