// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import InventChecklist from '../InventChecklist.jsx';

const items = [
  { slotId: 'bitters', label: 'bitters', required: false, done: false, key: null },
  { slotId: 'base', label: 'base spirit', required: true, done: true, key: 'gin' },
  { slotId: 'sour', label: 'a sour', required: true, done: false, key: null, why: 'Citrus is what makes it a sour.' },
];
const setup = (props = {}) => {
  const h = { onOpen: vi.fn(), onPick: vi.fn() };
  render(<InventChecklist title="A Sour usually has" items={items} testidPrefix="c" optionsFor={(id) => (id === 'sour' ? [{ key: 'lime juice', have: true }, { key: 'lemon juice', note: 'brighter' }] : [])} {...h} {...props} />);
  return h;
};

describe('InventChecklist', () => {
  it('lists required parts first, ticks done ones, shows the why of an unticked required part', () => {
    setup();
    const order = screen.getAllByRole('listitem').map((li) => li.getAttribute('data-testid'));
    expect(order).toEqual(['c-item-base', 'c-item-sour', 'c-item-bitters']);
    expect(screen.getByTestId('c-item-base').getAttribute('data-done')).toBe('true');
    expect(screen.getByTestId('c-item-base')).toHaveTextContent('gin');
    expect(screen.getByTestId('c-why-sour')).toHaveTextContent('Citrus');
    expect(screen.queryByTestId('c-why-base')).toBeNull();
    expect(screen.getByText('A Sour usually has')).toBeTruthy();
  });
  it('only unticked parts open; the open one lists options; picking reports slot and key', () => {
    const h = setup({ openId: 'sour' });
    expect(screen.queryByTestId('c-open-base')).toBeNull();
    fireEvent.click(screen.getByTestId('c-open-bitters'));
    expect(h.onOpen).toHaveBeenCalledWith('bitters');
    const box = screen.getByTestId('c-options-sour');
    expect(box).toHaveTextContent('brighter');
    fireEvent.click(within(box).getByText('lime juice'));
    expect(h.onPick).toHaveBeenCalledWith('sour', 'lime juice');
  });
  it('says so when an open part has no options', () => {
    setup({ openId: 'bitters' });
    expect(screen.getByTestId('c-none-bitters')).toBeTruthy();
  });
  it('renders nothing without items', () => {
    const { container } = render(<InventChecklist items={[]} onOpen={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('a ticked part reads "label — ingredient" with no tag; needed / optional only on unticked parts', () => {
    setup();
    const done = screen.getByTestId('c-item-base');
    expect(done.textContent).toMatch(/base spirit — gin/);
    expect(done.textContent).not.toMatch(/needed|optional|usual/);
    expect(screen.queryByTestId('c-tag-base')).toBeNull();
    expect(screen.getByTestId('c-tag-sour')).toHaveTextContent('needed');
    expect(screen.getByTestId('c-tag-bitters')).toHaveTextContent('optional');
    expect(screen.getByTestId('c-item-bitters').textContent).not.toMatch(/usual/);
  });
  it('has 44px targets', () => {
    setup();
    expect(screen.getByTestId('c-open-sour').className).toMatch(/min-h-\[44px\]/);
  });
  it('imports nothing lab-specific', () => {
    const src = readFileSync('src/components/InventChecklist.jsx', 'utf8');
    expect(src.split('\n').filter((l) => /^import /.test(l)).join('\n').replace('./inventUi.jsx', '')).not.toMatch(/cocktail|sauce|recipe|invent[A-Z]|data\/(?!chalkTheme)/i);
  });
});
