// @vitest-environment jsdom
// LOOK-9 contract tests (blind): the Pairing Lab board, tray, peek, and the ingredient card (PairingModeCard).
// Written from plan.md (LOOK-9 AC-1, AC-2, AC-5) and the approved brief .schermness/design/LOOK-9.md (sections 3.8,
// 7 D4, 9). No file under src/ was read; render setups reused from src/components/__tests__/PairingLab.test.jsx
// (the six-ingredient graph, "details for lemon" opens the peek, peek-add fills the tray) and
// PairingModeCard.wheel.test.jsx (a node from public/proDataset/ingredients.json). IngredientArt is recognised by
// its data-testid="ingredient-art", as SaucePairings.test.jsx does.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { hasAnyBackground, hasRoundedFull, primaries, expectNoOtherAccentFill, expectSelectedNotFilled } from './helpers.js';
import PairingLab from '../../../src/components/PairingLab.jsx';
import PairingModeCard from '../../../src/components/PairingModeCard.jsx';

afterEach(cleanup);

const NODES = new Map([
  ['garlic', { name: 'garlic', taste: 'pungent', category: 'Aromatic', cuisines: ['Italian'], flavorGraph: { tier1: ['pungent'] } }],
  ['basil', { name: 'basil', taste: 'bitter', category: 'Herb', cuisines: ['Italian'], flavorGraph: { tier1: ['green'] } }],
  ['lemon', { name: 'lemon', taste: 'sour', category: 'Fruit', cuisines: ['Mediterranean'], flavorGraph: { tier1: ['citrus'] } }],
  ['onion', { name: 'onion', taste: 'pungent', category: 'Vegetable', cuisines: ['French'], flavorGraph: { tier1: ['pungent'] } }],
  ['butter', { name: 'butter', taste: 'sweet', category: 'Fat', cuisines: ['French'], flavorGraph: { tier1: ['creamy'] } }],
  ['thyme', { name: 'thyme', taste: 'bitter', category: 'Herb', cuisines: ['Mediterranean'], flavorGraph: { tier1: ['herbal'] } }],
]);
const EDGES = [
  { source: 'garlic', target: 'basil', strength: 0.9 },
  { source: 'garlic', target: 'lemon', strength: 0.8 },
  { source: 'garlic', target: 'onion', strength: 0.7 },
  { source: 'garlic', target: 'butter', strength: 0.6 },
  { source: 'garlic', target: 'thyme', strength: 0.5 },
  { source: 'lemon', target: 'thyme', strength: 0.4 },
];
const DATA = {
  graph: { nodes: NODES, edges: EDGES, ingredientList: [...NODES.keys()] },
  gnnEntropy: {},
  cuisineMap: {},
  seasonMap: { basil: { season: 'summer' }, lemon: { season: 'winter' }, onion: { season: 'year-round' }, butter: { season: 'year-round' }, thyme: { season: 'summer' } },
};
const HANDLERS = { onFindCocktail: () => {}, onFindSauce: () => {}, onFindRecipe: () => {}, onOpenRecipeLab: () => {} };

const peek = (name) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`details for ${name}`, 'i') }));
function plateOfTwo() {
  peek('lemon');
  fireEvent.click(screen.getByTestId('peek-add'));
  peek('basil');
  fireEvent.click(screen.getByTestId('peek-add'));
  expect(screen.getByTestId('tray-bar')).toBeTruthy();
}

describe('LOOK-9 Pairing Lab: no primary (decision D4)', () => {
  // Covers: AC-1
  it('the board has no [data-primary="true"] and no accent background', () => {
    const { container } = render(<PairingLab ctx={DATA} {...HANDLERS} />);
    expect(screen.getByTestId('pairing-lab')).toBeTruthy();
    expect(primaries(container)).toHaveLength(0);
    expectNoOtherAccentFill(expect, container, 'Pairing Lab board');
  });

  // Covers: AC-1
  it('the board with a two-ingredient plate (tray showing) has no primary', () => {
    const { container } = render(<PairingLab ctx={DATA} {...HANDLERS} />);
    plateOfTwo();
    expect(primaries(container)).toHaveLength(0);
    expectNoOtherAccentFill(expect, container, 'Pairing Lab, plate of two');
  });

  // Covers: AC-1
  it('the peek has no primary', () => {
    const { container } = render(<PairingLab ctx={DATA} {...HANDLERS} />);
    peek('lemon');
    expect(screen.getByTestId('peek-add')).toBeTruthy();
    expect(primaries(document.body)).toHaveLength(0);
    expectNoOtherAccentFill(expect, document.body, 'Pairing Lab peek');
    expect(primaries(container)).toHaveLength(0);
  });
});

describe('LOOK-9 Pairing Lab: selected is not filled', () => {
  // Covers: AC-2
  it('the current lens tab (aria-selected) and the Surprise toggle when on (aria-pressed) have no background', () => {
    const { container } = render(<PairingLab ctx={DATA} {...HANDLERS} />);
    fireEvent.click(screen.getByTestId('lens-taste'));
    expectSelectedNotFilled(expect, screen.getByTestId('lens-taste'), 'Taste lens');
    for (const l of ['affinity', 'aroma', 'cuisine', 'season']) {
      expect(hasAnyBackground(screen.getByTestId(`lens-${l}`)), `lens-${l} has a background`).toBe(false);
    }
    fireEvent.click(screen.getByTestId('surprise-btn'));
    expect(screen.getByTestId('surprise-banner')).toBeTruthy();
    expectSelectedNotFilled(expect, screen.getByTestId('surprise-btn'), 'Surprise toggle (on)');
    expectNoOtherAccentFill(expect, container, 'Pairing Lab, taste lens + surprise');
  });
});

describe('LOOK-9 ingredient card: a drawing, not a coloured initial disc', () => {
  const DATA_ING = JSON.parse(readFileSync('public/proDataset/ingredients.json', 'utf8'));
  const nodeOf = (name) => ({ name, ...DATA_ING[name] });
  const roundRadius = (el) => /^(50%|9{3,}px|9{3,})$/.test(String(el.style.borderRadius || '').trim());

  // Covers: AC-5
  it.each(['lemon', 'soy sauce', 'cinnamon'])('%s: the card shows an IngredientArt svg and no round filled disc', (name) => {
    const { container } = render(<PairingModeCard node={nodeOf(name)} />);
    const art = container.querySelector('[data-testid="ingredient-art"]');
    expect(art, 'an IngredientArt drawing (data-testid="ingredient-art") on the card').toBeTruthy();
    expect(art.tagName.toLowerCase() === 'svg' || !!art.querySelector('svg'), 'the ingredient drawing is an svg').toBe(true);
    const discs = [...container.querySelectorAll('*')]
      .filter((el) => !(el instanceof SVGElement))
      .filter((el) => (hasRoundedFull(el) || roundRadius(el)) && hasAnyBackground(el))
      .map((el) => `<${el.tagName.toLowerCase()} style="${el.getAttribute('style') || ''}" class="${el.getAttribute('class') || ''}">${(el.textContent || '').slice(0, 10)}`);
    expect(discs, 'round elements with a background colour (the old initial disc)').toEqual([]);
  });
});
