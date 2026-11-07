// @vitest-environment jsdom
// WEAK-3: the Cookbook recipe card's "What do I need?" splits mains from
// flavourings, uses swaps and the spice rack.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import CookbookLab from '../CookbookLab.jsx';
import { SEED_RECIPES } from '../../data/seedRecipes.js';
import { MY_KITCHEN_KEY, SPICE_RACK_KEY } from '../../data/myKitchen.js';

vi.mock('../NetworkScene.jsx', () => ({ default: () => null }));
vi.mock('../MultiAxisRadarStack.jsx', () => ({ default: () => null }));

const CATS = {
  beef: 'protein', tomato: 'vegetable', onion: 'aromatic', carrot: 'vegetable', celery: 'vegetable',
  garlic: 'aromatic', 'red wine': 'liquid', pasta: 'grain',
};
const bolognese = SEED_RECIPES.find((r) => r.id === 'beef-bolognese');
const ctx = { graph: { nodes: new Map(bolognese.ingredients.map((n) => [n, { name: n, category: CATS[n] }])) } };

function openBolognese() {
  render(<CookbookLab ctx={ctx} />);
  fireEvent.click(screen.getByRole('button', { name: /Beef Bolognese/i }));
  return within(screen.getByRole('dialog')).getByTestId('what-do-i-need');
}

describe('Cookbook card — What do I need? (WEAK-3)', () => {
  beforeEach(() => {
    localStorage.clear();
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    }
  });

  it('with every main, it can be made; garlic and red wine are "even better with"', () => {
    localStorage.setItem(MY_KITCHEN_KEY, JSON.stringify(['beef', 'tomato', 'onion', 'carrot', 'celery', 'pasta']));
    const section = openBolognese();
    expect(within(section).getByTestId('what-do-i-need-summary')).toHaveTextContent('You can make it ✓');
    expect(within(section).getByTestId('what-do-i-need-better')).toHaveTextContent('Even better with: garlic, red wine');
  });

  it('a missing main is "you need"; a shallot stands in for the onion', () => {
    localStorage.setItem(MY_KITCHEN_KEY, JSON.stringify(['beef', 'tomato', 'shallot', 'carrot', 'pasta', 'garlic']));
    const section = openBolognese();
    expect(within(section).getByTestId('what-do-i-need-summary')).toHaveTextContent('you need 1');
    expect(within(section).getByTestId('what-do-i-need-missing')).toHaveTextContent('celery');
    expect(within(section).getByTestId('what-do-i-need-swaps')).toHaveTextContent('Use your shallot for the onion');
  });

  it('reads the spice rack setting: the spices move from "even better with" to assumed', () => {
    // Lamb Kofta: lamb, onion, parsley, cumin, coriander, cinnamon, garlic, yogurt.
    localStorage.setItem(MY_KITCHEN_KEY, JSON.stringify(['lamb', 'onion', 'yogurt']));
    const nodes = new Map([['lamb', 'protein'], ['onion', 'aromatic'], ['yogurt', 'dairy'], ['parsley', 'herb'],
      ['cumin', 'spice'], ['coriander', 'spice'], ['cinnamon', 'spice'], ['garlic', 'aromatic']]
      .map(([n, category]) => [n, { name: n, category }]));
    const open = () => {
      const r = render(<CookbookLab ctx={{ graph: { nodes } }} />);
      fireEvent.click(screen.getByRole('button', { name: /Lamb Kofta/i }));
      return { r, section: within(screen.getByRole('dialog')).getByTestId('what-do-i-need') };
    };
    let { r, section } = open();
    expect(within(section).getByTestId('what-do-i-need-better'))
      .toHaveTextContent('Even better with: parsley, cumin, coriander, cinnamon, garlic');
    r.unmount();
    localStorage.setItem(SPICE_RACK_KEY, '1');
    ({ section } = open());
    expect(within(section).getByTestId('what-do-i-need-better')).toHaveTextContent('Even better with: parsley, garlic');
    expect(within(section).getByText(/Assumed on hand: cumin, coriander, cinnamon/)).toBeInTheDocument();
  });
});
