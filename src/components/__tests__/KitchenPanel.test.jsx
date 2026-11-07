// @vitest-environment jsdom
// KITCHEN-2: the "What's in my kitchen?" panel. The real-recipe index is mocked.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

const VOCAB = ['chicken', 'garlic', 'lemon', 'rice', 'onion', 'tomato', 'salt', 'thyme'];
const REC = [
  { v: [0, 1, 2, 6], t: 'Garlic Lemon Chicken', d: ['Brown the chicken.', 'Add garlic and lemon.'] },
  { v: [3, 5, 4, 7], t: 'Herby Tomato Rice', d: ['Fry onion.', 'Add rice.'] },
];
const INV = {};
REC.forEach((r, i) => r.v.forEach((id) => { (INV[id] ||= []).push(i); }));
let realResult;
vi.mock('../../ml/kitchenRuntime.js', () => ({
  loadRealRecipes: vi.fn(() => realResult),
  loadInventModel: vi.fn(async () => null),
}));

import KitchenPanel from '../KitchenPanel.jsx';

const NODES = new Map(['chicken', 'garlic', 'lemon', 'lemon juice', 'rice', 'onion', 'tomato', 'basil', 'salt', 'olive oil', 'thyme'].map((n) => [n, { category: 'vegetable' }]));

function mount(props = {}) {
  const p = {
    kitchen: [], onChange: vi.fn(), assumeBasics: true, onAssumeBasicsChange: vi.fn(),
    nodes: NODES, onOpenRecipe: vi.fn(), onUseRealRecipe: vi.fn(), onInvent: vi.fn(), onClose: vi.fn(),
    ...props,
  };
  const r = render(<KitchenPanel {...p} />);
  return { ...p, ...r };
}

describe('KitchenPanel', () => {
  beforeEach(() => { realResult = Promise.resolve({ index: { recipes: REC, inv: INV }, vocab: VOCAB }); });

  it('empty kitchen: invites you to add things, shows quick-add chips, no results yet', () => {
    mount();
    expect(screen.getByText(/Your kitchen is empty/)).toBeInTheDocument();
    expect(within(screen.getByTestId('kitchen-quick')).getByRole('button', { name: '+ garlic' })).toBeInTheDocument();
    expect(screen.queryByTestId('kitchen-make')).toBeNull();
  });

  it('adds from the autocomplete and from quick-add', () => {
    const p = mount({ kitchen: ['chicken'] });
    fireEvent.change(screen.getByTestId('kitchen-input'), { target: { value: 'lem' } });
    fireEvent.click(within(screen.getByTestId('kitchen-suggestions')).getByRole('button', { name: '+ lemon' }));
    expect(p.onChange).toHaveBeenLastCalledWith(['chicken', 'lemon']);
    fireEvent.click(within(screen.getByTestId('kitchen-quick')).getByRole('button', { name: '+ garlic' }));
    expect(p.onChange).toHaveBeenLastCalledWith(['chicken', 'garlic']);
  });

  it('Enter adds the best match for what was typed', () => {
    const p = mount();
    fireEvent.change(screen.getByTestId('kitchen-input'), { target: { value: 'garl' } });
    fireEvent.submit(screen.getByTestId('kitchen-input').closest('form'));
    expect(p.onChange).toHaveBeenLastCalledWith(['garlic']);
  });

  it('removes a chip, and toggles assumed basics', () => {
    const p = mount({ kitchen: ['chicken', 'garlic'] });
    fireEvent.click(screen.getByRole('button', { name: 'Remove garlic' }));
    expect(p.onChange).toHaveBeenLastCalledWith(['chicken']);
    const sw = screen.getByRole('switch', { name: /Assume basics/ });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(sw);
    expect(p.onAssumeBasicsChange).toHaveBeenCalledWith(false);
  });

  it('lists Cookbook recipes you can make and the ones one or two away, with what is missing', () => {
    // Mujadara in the Cookbook: lentil, rice, onion, olive oil, cumin, salt (lentil & cumin missing)
    mount({ kitchen: ['rice', 'onion', 'lentil', 'cumin'] });
    const make = screen.getByTestId('kitchen-make');
    expect(within(make).getByRole('button', { name: /Mujadara/ })).toBeInTheDocument();
    expect(within(make).getAllByTestId('dish-art').length).toBeGreaterThan(0);
  });

  it('names what a nearly-there Cookbook recipe is missing, and opens it on tap', () => {
    const p = mount({ kitchen: ['rice', 'onion', 'lentil'] });
    const nearly = screen.getByTestId('kitchen-nearly');
    const row = within(nearly).getByRole('button', { name: /Mujadara/ });
    expect(row).toHaveTextContent('missing cumin');
    fireEvent.click(row);
    expect(p.onOpenRecipe).toHaveBeenCalledWith(expect.objectContaining({ name: 'Mujadara' }));
  });

  it('shows a chalk loader, then real recipes with what you have and what is missing; tap hands over', async () => {
    let resolve;
    realResult = new Promise((r) => { resolve = r; });
    const p = mount({ kitchen: ['chicken', 'garlic', 'lemon'] });
    expect(within(screen.getByTestId('kitchen-real')).getByTestId('chalk-loader')).toBeInTheDocument();
    resolve({ index: { recipes: REC, inv: INV }, vocab: VOCAB });
    const row = await screen.findByTestId('kitchen-real-0');
    expect(row).toHaveTextContent('Garlic Lemon Chicken');
    expect(row).toHaveTextContent('you have 3 of 3');
    fireEvent.click(screen.getByRole('button', { name: /Show the method for Garlic Lemon Chicken/ }));
    expect(screen.getByText('Brown the chicken.')).toBeInTheDocument();
    fireEvent.click(row);
    expect(p.onUseRealRecipe).toHaveBeenCalledWith(expect.objectContaining({ title: 'Garlic Lemon Chicken', missing: [] }));
  });

  it('if the index fails to load, says so and the Cookbook lists still work', async () => {
    realResult = Promise.resolve(null);
    mount({ kitchen: ['rice', 'onion', 'lentil'] });
    expect(await screen.findByTestId('kitchen-real-failed')).toBeInTheDocument();
    expect(within(screen.getByTestId('kitchen-nearly')).getByRole('button', { name: /Mujadara/ })).toBeInTheDocument();
  });

  it('back and invent buttons', () => {
    const p = mount();
    fireEvent.click(screen.getByTestId('kitchen-invent'));
    expect(p.onInvent).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('kitchen-close'));
    expect(p.onClose).toHaveBeenCalled();
  });
});
