// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import InventNameSave from '../InventNameSave.jsx';

const setup = (props = {}) => {
  const onName = vi.fn(); const onSave = vi.fn();
  render(<InventNameSave name="" onName={onName} placeholder="Name your cocktail" saveLabel="Add to my cocktails" onSave={onSave} testidPrefix="n" {...props} />);
  return { onName, onSave };
};

describe('InventNameSave', () => {
  it('starts with the name it is given (empty): only a placeholder, max 80', () => {
    setup();
    expect(screen.getByTestId('n-name').value).toBe('');
    expect(screen.getByTestId('n-name').getAttribute('placeholder')).toBe('Name your cocktail');
    expect(screen.getByTestId('n-name').getAttribute('maxlength')).toBe('80');
  });
  it('reports typing; the button is disabled with a short reason until canSave', () => {
    const h = setup();
    fireEvent.change(screen.getByTestId('n-name'), { target: { value: 'Garden Sour' } });
    expect(h.onName).toHaveBeenCalledWith('Garden Sour');
    expect(screen.getByTestId('n-save')).toBeDisabled();
    expect(screen.getByTestId('n-reason')).toHaveTextContent('at least two ingredients');
    fireEvent.click(screen.getByTestId('n-save'));
    expect(h.onSave).not.toHaveBeenCalled();
  });
  it('saves when allowed', () => {
    const h = setup({ canSave: true, name: 'X' });
    expect(screen.queryByTestId('n-reason')).toBeNull();
    fireEvent.click(screen.getByTestId('n-save'));
    expect(h.onSave).toHaveBeenCalled();
    expect(screen.getByTestId('n-save')).toHaveTextContent('Add to my cocktails');
  });
  it.each([
    ['saved', 'Added to your cocktails.', 'Added to your cocktails.'],
    ['error', 'Could not save.', 'Could not save.'],
    ['signin', '', 'Sign in to save'],
  ])('status %s is shown and the button stays usable', (status, message, text) => {
    setup({ canSave: true, name: 'X', status, message });
    expect(screen.getByTestId('n-status')).toHaveTextContent(text);
    expect(screen.getByTestId('n-save')).not.toBeDisabled();
  });
  it('saving disables the button', () => {
    setup({ canSave: true, name: 'X', status: 'saving' });
    expect(screen.getByTestId('n-save')).toBeDisabled();
    expect(screen.getByTestId('n-save')).toHaveTextContent('Saving');
  });
  it('has 44px targets', () => {
    setup();
    expect(screen.getByTestId('n-save').className).toMatch(/min-h-\[44px\]/);
    expect(screen.getByTestId('n-name').className).toMatch(/min-h-\[44px\]/);
  });
  it('imports nothing lab-specific', () => {
    const src = readFileSync('src/components/InventNameSave.jsx', 'utf8');
    expect(src.split('\n').filter((l) => /^import /.test(l)).join('\n').replace('./inventUi.jsx', '')).not.toMatch(/cocktail|sauce|recipe|invent[A-Z]|data\/(?!chalkTheme)/i);
  });
});
