// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import InventCategoryHint from '../InventCategoryHint.jsx';

describe('InventCategoryHint', () => {
  it('words the recommendation and reports Accept / Not now', () => {
    const onAccept = vi.fn(); const onDismiss = vi.fn();
    render(<InventCategoryHint label="Sour" blurb="bright, shaken, citrus-forward" onAccept={onAccept} onDismiss={onDismiss} testidPrefix="h" />);
    expect(screen.getByTestId('h')).toHaveTextContent('This looks like Sour — bright, shaken, citrus-forward. Use it?');
    fireEvent.click(screen.getByTestId('h-accept'));
    fireEvent.click(screen.getByTestId('h-dismiss'));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('h-accept').className).toMatch(/min-h-\[44px\]/);
    expect(screen.getByTestId('h-dismiss')).toHaveTextContent('Not now');
  });
  it('the lead can be overridden', () => {
    render(<InventCategoryHint label="a Sour" onAccept={() => {}} onDismiss={() => {}} labels={{ lead: 'Looks like' }} />);
    expect(screen.getByTestId('hint')).toHaveTextContent('Looks like a Sour. Use it?');
  });
  it('imports nothing lab-specific', () => {
    const src = readFileSync('src/components/InventCategoryHint.jsx', 'utf8');
    expect(src.split('\n').filter((l) => /^import /.test(l)).join('\n').replace('./inventUi.jsx', '')).not.toMatch(/cocktail|sauce|recipe|invent[A-Z]|data\/(?!chalkTheme)/i);
  });
});
