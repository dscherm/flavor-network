// @vitest-environment jsdom
// STANDIN-3: the sheet for a bar row. Fizzy waters say they are one thing; a bar swap shows its note; a spirit has no cross-family answer.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import fs from 'node:fs';
import StoreAlternatives from '../StoreAlternatives.jsx';

const roles = JSON.parse(fs.readFileSync(`${process.cwd()}/public/data/cocktail_roles.json`, 'utf8')).byIngredient;
const stock = () => ({ kitchen: [], pantry: [], bar: [] });
const sheet = (key) => render(<StoreAlternatives item={{ id: 'i', key, label: key, parts: [], from: [] }} stock={stock} loadRoles={() => Promise.resolve(roles)} onPick={() => {}} onUseHave={() => {}} onClose={() => {}} />);

afterEach(cleanup);

describe('the sheet for a bar row', () => {
  it('soda water: club soda, seltzer and sparkling water are the same thing, not stand-ins', async () => {
    sheet('soda water');
    const same = await screen.findByTestId('store-alt-same');
    expect(same.textContent).toMatch(/same thing/);
    expect(screen.getByTestId('store-alt-nothing').textContent).not.toMatch(/Nothing really replaces/);
    expect(screen.queryByTestId('store-alt-list')).toBeNull();
    expect(within(screen.getByTestId('store-alt-sheet')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Close']);
  });
  it('tonic water: nothing really replaces it, with the reason', async () => {
    sheet('tonic water');
    const none = await screen.findByTestId('store-alt-nothing');
    expect(none.textContent).toMatch(/^Nothing really replaces tonic water\./);
    expect(none.textContent).toMatch(/quinine/);
  });
  it('gin: an honest none, no vodka', async () => {
    sheet('gin');
    const none = await screen.findByTestId('store-alt-nothing');
    expect(none.textContent).toMatch(/Nothing really replaces gin\./);
    expect(none.textContent).toMatch(/[Jj]uniper/);
    expect(screen.queryByTestId('store-alt-vodka')).toBeNull();
  });
  it('campari: aperol, labelled "Use instead", with what changes', async () => {
    sheet('campari');
    expect((await screen.findByTestId('store-alt-kind-aperol')).textContent).toBe('Use instead');
    expect(screen.getByTestId('store-alt-note-aperol').textContent).toMatch(/Sweeter, lighter and much less bitter/);
  });
  it('simple syrup: "Make it", with the amounts', async () => {
    sheet('simple syrup');
    expect((await screen.findByTestId('store-alt-kind-sugar')).textContent).toBe('Make it');
    expect(screen.getByTestId('store-alt-amount-sugar').textContent).toMatch(/1\/2 cup sugar stirred into 1\/2 cup hot water/);
  });
});
