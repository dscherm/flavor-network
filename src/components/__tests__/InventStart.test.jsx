// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import InventStart from '../InventStart.jsx';

const setup = (props = {}) => {
  const onPick = vi.fn(); const onSkip = vi.fn();
  render(<InventStart question="Which liquor?" options={[{ key: 'gin', have: true }, { key: 'rum' }]} onPick={onPick} onSkip={onSkip} testidPrefix="s" {...props} />);
  return { onPick, onSkip };
};

describe('InventStart', () => {
  it('asks the question and shows chips, owned marked', () => {
    setup();
    expect(screen.getByTestId('s-question')).toHaveTextContent('Which liquor?');
    const chips = screen.getAllByTestId('s-option');
    expect(chips.map((c) => c.getAttribute('data-key'))).toEqual(['gin', 'rum']);
    expect(chips[0]).toHaveTextContent('have');
    expect(chips[1]).not.toHaveTextContent('have');
  });
  it('a chip picks its key; typed text picks the trimmed text', () => {
    const h = setup();
    fireEvent.click(screen.getAllByTestId('s-option')[1]);
    expect(h.onPick).toHaveBeenCalledWith('rum');
    fireEvent.change(screen.getByTestId('s-input'), { target: { value: '  mezcal ' } });
    fireEvent.click(screen.getByTestId('s-go'));
    expect(h.onPick).toHaveBeenLastCalledWith('mezcal');
    expect(screen.getByTestId('s-input').value).toBe('');
  });
  it('ignores blank text; skip shows only when allowed', () => {
    const h = setup();
    fireEvent.click(screen.getByTestId('s-go'));
    expect(h.onPick).not.toHaveBeenCalled();
    expect(screen.queryByTestId('s-skip')).toBeNull();
  });
  it('skip reports upward', () => {
    const h = setup({ allowSkip: true });
    fireEvent.click(screen.getByTestId('s-skip'));
    expect(h.onSkip).toHaveBeenCalled();
  });
  it('starts with an empty box and has 44px targets', () => {
    setup();
    expect(screen.getByTestId('s-input').value).toBe('');
    expect(screen.getByTestId('s-go').className).toMatch(/min-h-\[44px\]/);
    expect(screen.getAllByTestId('s-option')[0].className).toMatch(/min-h-\[44px\]/);
  });
  it('imports nothing lab-specific', () => {
    const src = readFileSync('src/components/InventStart.jsx', 'utf8');
    expect(src.split('\n').filter((l) => /^import /.test(l)).join('\n').replace('./inventUi.jsx', '')).not.toMatch(/cocktail|sauce|recipe|invent[A-Z]|data\/(?!chalkTheme)/i);
  });
});
