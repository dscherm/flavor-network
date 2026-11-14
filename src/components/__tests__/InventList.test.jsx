// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import InventList from '../InventList.jsx';

const lines = [
  { key: 'gin', amount: '2 oz', have: true },
  { key: 'elderflower liqueur', amount: '¾ oz', have: false },
  { key: 'mint', source: 'search' },
];
const setup = (props = {}) => {
  const h = { onRemove: vi.fn(), onAmount: vi.fn(), onReplace: vi.fn(), onAdd: vi.fn() };
  render(<InventList lines={lines} testidPrefix="l" replacementsFor={(k) => (k === 'elderflower liqueur' ? [{ key: 'st-germain' }, { key: 'triple sec', note: 'sweeter' }] : [])} {...h} {...props} />);
  return h;
};

describe('InventList', () => {
  it('shows exactly the given lines with suggested amounts, and an always-visible add box', () => {
    setup();
    expect(screen.getAllByTestId('l-line').map((r) => r.getAttribute('data-key'))).toEqual(['gin', 'elderflower liqueur', 'mint']);
    expect(screen.getByTestId('l-amount-gin').value).toBe('2 oz');
    expect(screen.getAllByTestId('l-line')[2]).toHaveTextContent('from your search');
    expect(screen.getByTestId('l-add-input').value).toBe('');
  });
  it('an empty list says so and still has the add box', () => {
    setup({ lines: [] });
    expect(screen.getByTestId('l-empty')).toBeTruthy();
    expect(screen.getByTestId('l-add-input')).toBeTruthy();
  });
  it('remove, amount edit and add report upward', () => {
    const h = setup();
    fireEvent.click(screen.getByTestId('l-remove-gin'));
    expect(h.onRemove).toHaveBeenCalledWith('gin');
    fireEvent.change(screen.getByTestId('l-amount-gin'), { target: { value: '1½ oz' } });
    expect(h.onAmount).toHaveBeenCalledWith('gin', '1½ oz');
    expect(screen.getByTestId('l-amount-gin').value).toBe('1½ oz');
    fireEvent.change(screen.getByTestId('l-add-input'), { target: { value: ' basil ' } });
    fireEvent.click(screen.getByTestId('l-add'));
    expect(h.onAdd).toHaveBeenCalledWith('basil');
  });
  it('only have === false offers "Don\'t have it?"; it lists replacements and replaces', () => {
    const h = setup();
    expect(screen.queryByTestId('l-need-gin')).toBeNull();
    expect(screen.queryByTestId('l-need-mint')).toBeNull();
    expect(screen.queryByTestId('l-replacements-elderflower liqueur')).toBeNull();
    fireEvent.click(screen.getByTestId('l-need-elderflower liqueur'));
    const box = screen.getByTestId('l-replacements-elderflower liqueur');
    expect(within(box).getAllByTestId('l-replace-option')).toHaveLength(2);
    expect(box).toHaveTextContent('sweeter');
    fireEvent.click(within(box).getByText('st-germain'));
    expect(h.onReplace).toHaveBeenCalledWith('elderflower liqueur', 'st-germain');
    expect(screen.queryByTestId('l-replacements-elderflower liqueur')).toBeNull();
  });
  it('says so when there are no replacements', () => {
    setup({ replacementsFor: () => [] });
    fireEvent.click(screen.getByTestId('l-need-elderflower liqueur'));
    expect(screen.getByTestId('l-no-replacements-elderflower liqueur')).toBeTruthy();
  });
  it('shows a refusal notice; offers typeahead from vocab', () => {
    setup({ notice: 'gin is already in the build', vocab: ['gin', 'ginger beer'] });
    expect(screen.getByTestId('l-notice')).toHaveTextContent('already');
    fireEvent.change(screen.getByTestId('l-add-input'), { target: { value: 'gin' } });
    expect(document.querySelectorAll('datalist option')).toHaveLength(2);
  });
  it('has 44px targets', () => {
    setup();
    for (const id of ['l-remove-gin', 'l-add', 'l-need-elderflower liqueur', 'l-amount-gin']) expect(screen.getByTestId(id).className).toMatch(/min-h-\[44px\]/);
  });
  it('imports nothing lab-specific', () => {
    const src = readFileSync('src/components/InventList.jsx', 'utf8');
    expect(src.split('\n').filter((l) => /^import /.test(l)).join('\n').replace('./inventUi.jsx', '')).not.toMatch(/cocktail|sauce|recipe|invent[A-Z]|data\/(?!chalkTheme)/i);
  });
});
