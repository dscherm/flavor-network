// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SaucePantryPanel from '../SaucePantryPanel.jsx';
import { buildCategoryMap } from '../../data/saucePantry.js';

const meta = [
  { name: 'butter', category: 'Fat' }, { name: 'flour', category: 'Thickener' }, { name: 'egg yolk', category: 'Thickener' },
  { name: 'milk', category: 'Liquid' }, { name: 'cream', category: 'Liquid' }, { name: 'white wine', category: 'Liquid' },
  { name: 'lemon juice', category: 'Acid' }, { name: 'onion', category: 'Aromatic' }, { name: 'shallot', category: 'Aromatic' },
  { name: 'nutmeg', category: 'Seasoning' },
];
const catMap = buildCategoryMap(meta);
const names = new Set(meta.map((m) => m.name));
const families = [{ id: 0, name: 'Béchamel', color: '#f5f0d6' }, { id: 1, name: 'Velouté', color: '#e8c989' }, { id: 3, name: 'Hollandaise', color: '#f3d44e' }];
const sauces = [
  { name: 'Hollandaise', family_id: 3, ingredients: ['egg yolk', 'butter', 'lemon juice', 'salt'] },
  { name: 'Béchamel', family_id: 0, ingredients: ['butter', 'flour', 'milk', 'nutmeg', 'salt'] },
  { name: 'Smetana', family_id: 1, ingredients: ['butter', 'onion', 'white wine', 'crème fraîche'] },
];

function renderPanel(props = {}) {
  return render(<SaucePantryPanel kitchen={['egg yolk', 'lemon', 'onion', 'white wine', 'cream', 'milk']} onChange={vi.fn()}
    sauces={sauces} families={families} names={names} catMap={catMap} onClose={vi.fn()} {...props} />);
}

describe('SaucePantryPanel', () => {
  it('lists sauces you can make and those one or two away, with a stand-in', () => {
    renderPanel();
    const make = screen.getByTestId('sauce-pantry-make');
    expect(within(make).getByText('Hollandaise')).toBeInTheDocument();
    const nearly = screen.getByTestId('sauce-pantry-nearly');
    expect(within(nearly).getByText('Béchamel')).toBeInTheDocument();
    expect(nearly).toHaveTextContent('missing nutmeg');
    expect(nearly).toHaveTextContent('missing crème fraîche · or use your cream in its place');
  });

  it('draws each sauce with its family vessel, hidden from assistive tech', () => {
    const { container } = renderPanel();
    const svgs = container.querySelectorAll('[data-testid="sauce-pantry-make"] svg');
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svgs[0].getAttribute('data-vessel')).toBe('bowl'); // Hollandaise → whisked bowl
  });

  it('opens the sauce card on tap', () => {
    const onSelectSauce = vi.fn();
    renderPanel({ onSelectSauce });
    fireEvent.click(within(screen.getByTestId('sauce-pantry-make')).getByText('Hollandaise'));
    expect(onSelectSauce).toHaveBeenCalledWith('Hollandaise');
  });

  it('adds from the box (resolved name) and from quick-add chips, removes on tap', () => {
    const onChange = vi.fn();
    renderPanel({ kitchen: ['milk'], onChange });
    fireEvent.change(screen.getByTestId('sauce-pantry-input'), { target: { value: '2 Shallots' } });
    fireEvent.click(screen.getByTestId('sauce-pantry-add'));
    expect(onChange).toHaveBeenLastCalledWith(['milk', 'shallot']);
    fireEvent.click(within(screen.getByTestId('sauce-pantry-quick')).getByRole('button', { name: 'Add egg yolk' }));
    expect(onChange).toHaveBeenLastCalledWith(['milk', 'egg yolk']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove milk' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('quick-add chips skip basics', () => {
    renderPanel({ kitchen: [] });
    const quick = screen.getByTestId('sauce-pantry-quick');
    expect(quick).not.toHaveTextContent('butter');
    expect(quick).not.toHaveTextContent('salt');
  });

  it('toggles assume basics', () => {
    const onAssumeBasicsChange = vi.fn();
    renderPanel({ onAssumeBasicsChange });
    const box = screen.getByTestId('sauce-pantry-basics');
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(onAssumeBasicsChange).toHaveBeenCalledWith(false);
  });

  it('without basics, butter has to be in the pantry', () => {
    renderPanel({ assumeBasics: false });
    expect(within(screen.getByTestId('sauce-pantry-make')).queryByText('Hollandaise')).toBeNull();
  });

  it('empty pantry: a hint, no result lists', () => {
    renderPanel({ kitchen: [] });
    expect(screen.getByTestId('sauce-pantry-items')).toHaveTextContent('Your pantry is empty');
    expect(screen.queryByTestId('sauce-pantry-make')).toBeNull();
  });

  it('Back and Invent buttons', () => {
    const onClose = vi.fn();
    const onInvent = vi.fn();
    renderPanel({ onClose, onInvent });
    fireEvent.click(screen.getByTestId('sauce-pantry-close'));
    fireEvent.click(screen.getByTestId('sauce-pantry-invent'));
    expect(onClose).toHaveBeenCalled();
    expect(onInvent).toHaveBeenCalled();
  });
});
