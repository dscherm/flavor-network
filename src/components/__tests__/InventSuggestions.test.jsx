// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import InventSuggestions from '../InventSuggestions.jsx';

describe('InventSuggestions', () => {
  it('shows chips, owned marked, and reports an add', () => {
    const onAdd = vi.fn();
    render(<InventSuggestions title="Goes well with what you have" items={[{ key: 'mint', have: true }, { key: 'basil', note: 'herbal' }]} onAdd={onAdd} testidPrefix="g" />);
    const items = screen.getAllByTestId('g-item');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('have');
    expect(items[1]).toHaveTextContent('herbal');
    fireEvent.click(items[1]);
    expect(onAdd).toHaveBeenCalledWith('basil');
    expect(items[0].className).toMatch(/min-h-\[44px\]/);
  });
  it('shows emptyText with no items, nothing when there is no emptyText', () => {
    const { unmount } = render(<InventSuggestions items={[]} onAdd={() => {}} emptyText="Nothing to suggest yet." testidPrefix="g" />);
    expect(screen.getByTestId('g-empty')).toHaveTextContent('Nothing to suggest');
    unmount();
    const { container } = render(<InventSuggestions items={[]} onAdd={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('imports nothing lab-specific', () => {
    const src = readFileSync('src/components/InventSuggestions.jsx', 'utf8');
    expect(src.split('\n').filter((l) => /^import /.test(l)).join('\n').replace('./inventUi.jsx', '')).not.toMatch(/cocktail|sauce|recipe|invent[A-Z]|data\/(?!chalkTheme)/i);
  });
});
