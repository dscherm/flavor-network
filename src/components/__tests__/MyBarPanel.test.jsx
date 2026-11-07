// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import MyBarPanel from '../MyBarPanel.jsx';
import { buildPairingIndex } from '../../data/recipePairingMatch.js';

const ing = (raw) => ({ raw });
const negroni = { name: 'Negroni', ingredients_raw: [ing('1 oz Gin'), ing('1 oz Sweet vermouth'), ing('1 oz Campari')] };
const boulevardier = { name: 'Boulevardier', ingredients_raw: [ing('1 1/4 oz Bourbon'), ing('1 oz Sweet vermouth'), ing('1 oz Campari')] };
const manhattan = { name: 'Manhattan', ingredients_raw: [ing('2 oz Rye'), ing('1 oz Sweet vermouth'), ing('2 dashes Angostura bitters')] };
const roles = {
  gin: { role: 'spirit' }, bourbon: { role: 'spirit' }, rye: { role: 'spirit' },
  'sweet vermouth': { role: 'vermouth' }, campari: { role: 'amaro_liqueur' }, 'angostura bitters': { role: 'bitter' },
};
const index = buildPairingIndex([], Object.keys(roles));

function Harness({ initial = [], ...props }) {
  const [bar, setBar] = useState(initial);
  return <MyBarPanel bar={bar} onChange={setBar} cocktails={[negroni, boulevardier, manhattan]} roles={roles} pairingIndex={index} {...props} />;
}

describe('MyBarPanel', () => {
  it('starts empty, with quick-add chips for common ingredients', () => {
    render(<Harness />);
    expect(screen.getByText(/your bar is empty/i)).toBeInTheDocument();
    const quick = screen.getByTestId('my-bar-quick');
    expect(within(quick).getByText('+ sweet vermouth')).toBeInTheDocument();
    expect(screen.queryByTestId('my-bar-make')).toBeNull();
  });

  it('adding by text and by chip fills the bar and lists what you can make', () => {
    const onSelectCocktail = vi.fn();
    render(<Harness onSelectCocktail={onSelectCocktail} />);
    fireEvent.change(screen.getByTestId('my-bar-input'), { target: { value: 'Gin' } });
    fireEvent.click(screen.getByTestId('my-bar-add'));
    fireEvent.click(within(screen.getByTestId('my-bar-quick')).getByText('+ sweet vermouth'));
    fireEvent.click(within(screen.getByTestId('my-bar-quick')).getByText('+ campari'));
    expect(within(screen.getByTestId('my-bar-items')).getByText(/gin/)).toBeInTheDocument();

    const make = screen.getByTestId('my-bar-make');
    expect(within(make).getByText('Negroni')).toBeInTheDocument();
    const away = screen.getByTestId('my-bar-one-away');
    expect(within(away).getByText('Boulevardier')).toBeInTheDocument();
    expect(away).toHaveTextContent('missing bourbon');

    fireEvent.click(within(make).getByText('Negroni'));
    expect(onSelectCocktail).toHaveBeenCalledWith('Negroni');
  });

  it('a rye bar makes the Boulevardier "with rye instead of bourbon"', () => {
    render(<Harness initial={['rye', 'sweet vermouth', 'campari']} />);
    const make = screen.getByTestId('my-bar-make');
    expect(within(make).getByText('Boulevardier')).toBeInTheDocument();
    expect(make).toHaveTextContent('with rye instead of bourbon');
    // Rye never stands in for gin: the Negroni is one away.
    expect(within(screen.getByTestId('my-bar-one-away')).getByText('Negroni')).toBeInTheDocument();
  });

  it('removing an item updates the lists', () => {
    render(<Harness initial={['gin', 'sweet vermouth', 'campari']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove campari' }));
    expect(within(screen.getByTestId('my-bar-make')).queryByText('Negroni')).toBeNull();
    expect(screen.getByTestId('my-bar-one-away')).toHaveTextContent('missing campari');
  });

  it('close and invent buttons call back', () => {
    const onClose = vi.fn(); const onInvent = vi.fn();
    render(<Harness onClose={onClose} onInvent={onInvent} />);
    fireEvent.click(screen.getByTestId('my-bar-invent'));
    fireEvent.click(screen.getByTestId('my-bar-close'));
    expect(onInvent).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
