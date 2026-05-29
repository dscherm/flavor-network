// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RecipeTypePills, { RECIPE_TYPE_PILLS } from '../RecipeTypePills.jsx';

const TYPES = ['main', 'side', 'appetizer', 'dessert', 'drink', 'sauce', 'other'];

describe('RecipeTypePills — RL-RECIPETYPE', () => {
  it('renders a radiogroup with all 7 recipe-type pills', () => {
    render(<RecipeTypePills value={null} onChange={() => {}} />);
    const group = screen.getByTestId('recipe-type-pills');
    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('Recipe type');
    for (const t of TYPES) {
      const pill = screen.getByTestId(`recipe-type-pill-${t}`);
      expect(pill.getAttribute('role')).toBe('radio');
      expect(pill.getAttribute('aria-checked')).toBe('false');
    }
  });

  it('exports RECIPE_TYPE_PILLS with the canonical 7-item ordering', () => {
    expect(RECIPE_TYPE_PILLS.map(p => p.key)).toEqual(TYPES);
  });

  it('aria-checked reflects the value prop', () => {
    render(<RecipeTypePills value="dessert" onChange={() => {}} />);
    for (const t of TYPES) {
      const pill = screen.getByTestId(`recipe-type-pill-${t}`);
      expect(pill.getAttribute('aria-checked')).toBe(t === 'dessert' ? 'true' : 'false');
    }
  });

  it('tapping a pill fires onChange(key) when nothing was selected', () => {
    const onChange = vi.fn();
    render(<RecipeTypePills value={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('recipe-type-pill-main'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('main');
  });

  it('re-tapping the currently-selected pill fires onChange(null) to clear', () => {
    const onChange = vi.fn();
    render(<RecipeTypePills value="main" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('recipe-type-pill-main'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('tapping a different pill fires onChange(newKey) — single-select replace', () => {
    const onChange = vi.fn();
    render(<RecipeTypePills value="main" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('recipe-type-pill-dessert'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('dessert');
  });

  it('full gesture: tap → set → re-tap-same → clear → tap-different → switch (acceptance criterion)', () => {
    let current = null;
    const onChange = (next) => { current = next; };
    const { rerender } = render(<RecipeTypePills value={current} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('recipe-type-pill-side'));
    expect(current).toBe('side');
    rerender(<RecipeTypePills value={current} onChange={onChange} />);
    expect(screen.getByTestId('recipe-type-pill-side').getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByTestId('recipe-type-pill-side'));
    expect(current).toBeNull();
    rerender(<RecipeTypePills value={current} onChange={onChange} />);
    expect(screen.getByTestId('recipe-type-pill-side').getAttribute('aria-checked')).toBe('false');

    fireEvent.click(screen.getByTestId('recipe-type-pill-drink'));
    expect(current).toBe('drink');
    rerender(<RecipeTypePills value={current} onChange={onChange} />);
    expect(screen.getByTestId('recipe-type-pill-drink').getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByTestId('recipe-type-pill-sauce'));
    expect(current).toBe('sauce');
    rerender(<RecipeTypePills value={current} onChange={onChange} />);
    expect(screen.getByTestId('recipe-type-pill-sauce').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('recipe-type-pill-drink').getAttribute('aria-checked')).toBe('false');
  });

  it('every pill has minimum 44px touch target (min-h-[44px])', () => {
    render(<RecipeTypePills value={null} onChange={() => {}} />);
    for (const t of TYPES) {
      const pill = screen.getByTestId(`recipe-type-pill-${t}`);
      expect(pill.className).toMatch(/min-h-\[44px\]/);
    }
  });

  it('every pill has a focus-visible ring class for keyboard accessibility', () => {
    render(<RecipeTypePills value={null} onChange={() => {}} />);
    for (const t of TYPES) {
      const pill = screen.getByTestId(`recipe-type-pill-${t}`);
      expect(pill.className).toMatch(/focus-visible:ring/);
    }
  });

  it('onChange may be omitted without crashing on tap (defensive)', () => {
    render(<RecipeTypePills value={null} />);
    expect(() => fireEvent.click(screen.getByTestId('recipe-type-pill-main'))).not.toThrow();
  });
});
