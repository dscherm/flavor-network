// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import InventCategoryPicker from '../InventCategoryPicker.jsx';

const options = [{ id: 2, label: 'Sour', blurb: 'bright, shaken', art: <i data-testid="art" /> }, { id: 3, label: 'Sipper', blurb: 'strong, stirred' }];
const setup = (props = {}) => {
  const onChange = vi.fn(); const onToggle = vi.fn();
  render(<InventCategoryPicker title="Going for a particular style? (optional)" options={options} value={null} onChange={onChange} onToggle={onToggle} testidPrefix="p" {...props} />);
  return { onChange, onToggle };
};

describe('InventCategoryPicker', () => {
  it('is collapsed by default: only the toggle shows', () => {
    const h = setup();
    expect(screen.getByTestId('p-toggle')).toHaveTextContent('Going for a particular style? (optional)');
    expect(screen.getByTestId('p-toggle').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('p-option-2')).toBeNull();
    fireEvent.click(screen.getByTestId('p-toggle'));
    expect(h.onToggle).toHaveBeenCalled();
  });
  it('open: lists styles with blurbs and art plus "No particular style"; choosing reports id or null', () => {
    const h = setup({ open: true, value: 2 });
    expect(screen.getByTestId('p-option-2')).toHaveTextContent('bright, shaken');
    expect(screen.getByTestId('art')).toBeTruthy();
    expect(screen.getByTestId('p-option-2').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('p-option-3').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByTestId('p-option-3'));
    expect(h.onChange).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByTestId('p-none'));
    expect(h.onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId('p-none')).toHaveTextContent('No particular style');
  });
  it('shows the chosen style on the collapsed row; has 44px targets', () => {
    setup({ value: 3 });
    expect(screen.getByTestId('p-toggle')).toHaveTextContent('Sipper');
    expect(screen.getByTestId('p-toggle').className).toMatch(/min-h-\[44px\]/);
  });
  it('imports nothing lab-specific', () => {
    const src = readFileSync('src/components/InventCategoryPicker.jsx', 'utf8');
    expect(src.split('\n').filter((l) => /^import /.test(l)).join('\n').replace('./inventUi.jsx', '')).not.toMatch(/cocktail|sauce|recipe|invent[A-Z]|data\/(?!chalkTheme)/i);
  });
});
