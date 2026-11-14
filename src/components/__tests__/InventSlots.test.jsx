// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import InventSlots from '../InventSlots.jsx';

const accepts = () => true;
const build = () => ({
  lab: 'x', baseline: {}, rules: [], rejected: [],
  slots: [
    { id: 'main', label: 'the main', required: true, accepts, line: { key: 'chicken', source: 'search' }, locked: true },
    { id: 'acid', label: 'the acid', required: true, accepts, line: null, locked: false },
    { id: 'herb', label: 'a herb', required: false, accepts, line: null, locked: false },
  ],
  extras: [{ key: 'garlic', source: 'user' }],
});

function setup(props = {}) {
  const handlers = { onPick: vi.fn(), onClear: vi.fn(), onAddExtra: vi.fn(), onRemoveExtra: vi.fn() };
  render(<InventSlots build={build()} testidPrefix="t" amountFor={(k) => (k === 'chicken' ? '1 lb' : undefined)}
    shortlistFor={(id) => (id === 'acid' ? [{ key: 'lemon', have: true }, { key: 'vinegar', note: 'you would need it' }] : [])}
    {...handlers} {...props} />);
  return handlers;
}

describe('InventSlots', () => {
  it('renders each slot: pick, amount, lock mark, and needed / optional for empty ones', () => {
    setup();
    expect(screen.getByTestId('t-line-main')).toHaveTextContent('chicken');
    expect(screen.getByTestId('t-amount-main')).toHaveTextContent('1 lb');
    expect(screen.getByTestId('t-slot-main')).toHaveTextContent('from your search');
    expect(screen.getByTestId('t-line-acid')).toHaveTextContent('needed');
    expect(screen.getByTestId('t-line-herb')).toHaveTextContent('empty — optional');
    expect(screen.getByTestId('t-extras')).toHaveTextContent('garlic');
  });

  it('opens a ranked shortlist with have/note marks and reports a pick', () => {
    const h = setup();
    expect(screen.queryByTestId('t-shortlist-acid')).toBeNull();
    fireEvent.click(screen.getByTestId('t-open-acid'));
    const list = screen.getByTestId('t-shortlist-acid');
    expect(list).toHaveTextContent('have');
    expect(list).toHaveTextContent('you would need it');
    fireEvent.click(within(list).getByText('lemon'));
    expect(h.onPick).toHaveBeenCalledWith('acid', 'lemon');
    expect(screen.queryByTestId('t-shortlist-acid')).toBeNull();
  });

  it('reports typed text raw, and stays open when the pick is refused', () => {
    const h = setup();
    h.onPick.mockReturnValue(false);
    fireEvent.click(screen.getByTestId('t-open-herb'));
    fireEvent.change(screen.getByTestId('t-type-herb'), { target: { value: '  Basil ' } });
    fireEvent.submit(screen.getByTestId('t-type-herb').closest('form'));
    expect(h.onPick).toHaveBeenCalledWith('herb', 'Basil');
    expect(screen.getByTestId('t-shortlist-herb')).toBeTruthy();
  });

  it('clear, add extra and remove extra report upward', () => {
    const h = setup();
    fireEvent.click(screen.getByTestId('t-clear-main'));
    expect(h.onClear).toHaveBeenCalledWith('main');
    fireEvent.change(screen.getByTestId('t-add-input'), { target: { value: 'cumin' } });
    fireEvent.click(screen.getByTestId('t-add'));
    expect(h.onAddExtra).toHaveBeenCalledWith('cumin');
    fireEvent.click(screen.getByTestId('t-remove-garlic'));
    expect(h.onRemoveExtra).toHaveBeenCalledWith('garlic');
  });

  it('shows a refusal notice and honours label overrides', () => {
    setup({ notice: 'No emulsion without an emulsifier.', labels: { needed: 'required', extras: 'Add-ons' } });
    expect(screen.getByTestId('t-notice')).toHaveTextContent('No emulsion');
    expect(screen.getByTestId('t-line-acid')).toHaveTextContent('required');
    expect(screen.getByText('Add-ons')).toBeTruthy();
  });

  it('knows nothing about cocktails (no lab imports)', () => {
    const src = readFileSync('src/components/InventSlots.jsx', 'utf8');
    const imports = src.split('\n').filter((l) => /^import /.test(l));
    expect(imports.join('\n')).not.toMatch(/cocktail|sauce|recipe|invent[A-Z]/i);
  });
});
