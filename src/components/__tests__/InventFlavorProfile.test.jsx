// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import InventFlavorProfile from '../InventFlavorProfile.jsx';
import { buildFlavorProfile } from '../../data/inventProfile.js';

const RAW = JSON.parse(readFileSync('public/proDataset/gnn_entropy.json', 'utf8'));

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
    expect(screen.getByTestId('f-note')).toHaveTextContent(/taste labels and aroma notes for each ingredient, weighted by amount/);
    expect(screen.getByTestId('f-note')).toHaveTextContent(/guide, not a taste test/);
    expect(screen.getByTestId('f-note').textContent).not.toMatch(/compound|molecul/i);
  });
  it('renders an empty profile without throwing', () => {
    for (const pr of [undefined, null, {}, { bars: [], summary: '', uncounted: [] }]) {
      const { unmount } = render(<InventFlavorProfile profile={pr} testidPrefix="f" />);
      expect(screen.getByTestId('f-empty')).toBeTruthy();
      expect(screen.queryByTestId('f-uncounted')).toBeNull();
      unmount();
    }
  });
  it('a list with no taste label, no taste line and no aroma line draws no chart, just the plain line', () => {
    // (The model's values, placeholder or not, are never read: FLAVOR-5.)
    const names = ['zzz one', 'zzz two', 'zzz three', 'zzz four'];
    const nodes = new Map(names.map((k) => [k, { gnnProbs: RAW['sugar'].probs }]));
    const pr = buildFlavorProfile(names, nodes, { noun: 'drink' });
    render(<InventFlavorProfile profile={pr} testidPrefix="f" />);
    expect(screen.getByTestId('f-empty')).toHaveTextContent('Not enough flavor data for a chart yet.');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.queryByTestId('f-summary')).toBeNull();
  });
  it('imports nothing lab-specific', () => {
    const src = readFileSync('src/components/InventFlavorProfile.jsx', 'utf8');
    expect(src.split('\n').filter((l) => /^import /.test(l)).join('\n').replace('./inventUi.jsx', '')).not.toMatch(/cocktail|sauce|recipe|invent[A-Z]|data\/(?!chalkTheme|flavorDisplay)/i);
  });
});
