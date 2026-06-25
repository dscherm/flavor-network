// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import PairingLab from '../PairingLab.jsx';

afterEach(cleanup);

const NODES = new Map([
  ['garlic', { name: 'garlic', taste: 'pungent', category: 'Aromatic', cuisines: ['Italian'],       flavorGraph: { tier1: ['pungent'] } }],
  ['basil',  { name: 'basil',  taste: 'bitter',  category: 'Herb',     cuisines: ['Italian'],        flavorGraph: { tier1: ['green'] } }],
  ['lemon',  { name: 'lemon',  taste: 'sour',    category: 'Fruit',    cuisines: ['Mediterranean'],  flavorGraph: { tier1: ['citrus'] } }],
  ['onion',  { name: 'onion',  taste: 'pungent', category: 'Vegetable',cuisines: ['French'],         flavorGraph: { tier1: ['pungent'] } }],
  ['butter', { name: 'butter', taste: 'sweet',   category: 'Fat',      cuisines: ['French'],         flavorGraph: { tier1: ['creamy'] } }],
  ['thyme',  { name: 'thyme',  taste: 'bitter',  category: 'Herb',     cuisines: ['Mediterranean'],  flavorGraph: { tier1: ['herbal'] } }],
]);

const EDGES = [
  { source: 'garlic', target: 'basil',  strength: 0.9 },
  { source: 'garlic', target: 'lemon',  strength: 0.8 },
  { source: 'garlic', target: 'onion',  strength: 0.7 },
  { source: 'garlic', target: 'butter', strength: 0.6 },
  { source: 'garlic', target: 'thyme',  strength: 0.5 },
];

const DATA = {
  graph: { nodes: NODES, edges: EDGES, ingredientList: [...NODES.keys()] },
  gnnEntropy: {},
  cuisineMap: {},
  seasonMap: {
    basil: { season: 'summer' }, lemon: { season: 'winter' },
    onion: { season: 'year-round' }, butter: { season: 'year-round' }, thyme: { season: 'summer' },
  },
};

describe('PairingLab', () => {
  it('mounts with a default center and shows the lens controls', () => {
    render(<PairingLab ctx={DATA} />);
    expect(screen.getByTestId('pairing-lab')).toBeTruthy();
    ['affinity', 'aroma', 'taste', 'cuisine', 'season'].forEach((l) => {
      expect(screen.getByTestId(`lens-${l}`)).toBeTruthy();
    });
  });

  it('shows an affinity insight for the default (well-connected) center', () => {
    render(<PairingLab ctx={DATA} />);
    // garlic default → 5 partners
    expect(screen.getByTestId('lens-insight').textContent).toMatch(/5 partners, led by/);
  });

  it('switching the lens updates the insight line', () => {
    render(<PairingLab ctx={DATA} />);
    fireEvent.click(screen.getByTestId('lens-taste'));
    expect(screen.getByTestId('lens-insight').textContent).toMatch(/mostly Bitter/);
    fireEvent.click(screen.getByTestId('lens-cuisine'));
    expect(screen.getByTestId('lens-insight').textContent).toMatch(/mostly European \(cuisine\)/);
  });

  it('tapping a partner re-centers the board', () => {
    render(<PairingLab ctx={DATA} />);
    // Board partner list is labelled "Partners of <center>".
    expect(screen.getByRole('list', { name: /partners of garlic/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'basil' }));
    expect(screen.getByRole('list', { name: /partners of basil/i })).toBeTruthy();
  });

  it('degrades gracefully when pairing data is absent', () => {
    render(<PairingLab ctx={{ graph: { nodes: new Map(), edges: [] } }} />);
    expect(screen.getByText(/isn’t loaded yet/i)).toBeTruthy();
  });
});
