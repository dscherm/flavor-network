// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import InventFlavorProfile from '../InventFlavorProfile.jsx';

const profile = {
  bars: [{ axis: 'sour', label: 'Sour', color: '#2bd4d4', score: 0.6 }, { axis: 'sweet', label: 'Sweet', color: '#ff5fa2', score: 0.3 }],
  summary: 'This drink leans sour.', uncounted: ['mystery bitters'], counted: ['lime juice'],
};

describe('InventFlavorProfile', () => {
  it('draws a labelled bar per firing axis, with summary, uncounted and the visual-guide note', () => {
    render(<InventFlavorProfile profile={profile} testidPrefix="f" />);
    expect(screen.getByTestId('f-bar-sour').getAttribute('aria-label')).toBe('Sour 60 percent');
    expect(screen.getByTestId('f-bar-sweet')).toHaveTextContent('Sweet');
    expect(screen.getByTestId('f-summary')).toHaveTextContent('leans sour');
    expect(screen.getByTestId('f-uncounted')).toHaveTextContent('mystery bitters');
    expect(screen.getByTestId('f-note')).toHaveTextContent('not how it will taste');
  });
  it('renders an empty profile without throwing', () => {
    for (const pr of [undefined, null, {}, { bars: [], summary: '', uncounted: [] }]) {
      const { unmount } = render(<InventFlavorProfile profile={pr} testidPrefix="f" />);
      expect(screen.getByTestId('f-empty')).toBeTruthy();
      expect(screen.queryByTestId('f-uncounted')).toBeNull();
      unmount();
    }
  });
  it('imports nothing lab-specific', () => {
    const src = readFileSync('src/components/InventFlavorProfile.jsx', 'utf8');
    expect(src.split('\n').filter((l) => /^import /.test(l)).join('\n').replace('./inventUi.jsx', '')).not.toMatch(/cocktail|sauce|recipe|invent[A-Z]|data\/(?!chalkTheme)/i);
  });
});
