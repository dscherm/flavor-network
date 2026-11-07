import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WhatDoINeed from '../WhatDoINeed.jsx';
import { needsFromKitchen } from '../../data/whatDoINeed.js';

const recipe = ['pasta', 'tomato', 'garlic', 'basil', 'salt'];
const amounts = { garlic: '3 cloves', basil: '1 handful' };

describe('WhatDoINeed', () => {
  it('says how many you have and lists what to buy with amounts', () => {
    render(<WhatDoINeed title="Pomodoro" needs={needsFromKitchen(recipe, ['pasta', 'tomato'], { amounts })} />);
    expect(screen.getByTestId('what-do-i-need-summary').textContent).toBe('You have 2 of 4 — you need 2:');
    const missing = screen.getByTestId('what-do-i-need-missing').textContent;
    expect(missing).toContain('garlic');
    expect(missing).toContain('3 cloves');
    expect(missing).toContain('basil');
  });

  it('"I have it" reports the item; everything covered says so', () => {
    const onHave = vi.fn();
    const { rerender } = render(<WhatDoINeed title="P" needs={needsFromKitchen(recipe, ['pasta', 'tomato'])} onHave={onHave} />);
    fireEvent.click(screen.getByTestId('what-do-i-need-have-garlic'));
    expect(onHave).toHaveBeenCalledWith('garlic');
    rerender(<WhatDoINeed title="P" needs={needsFromKitchen(recipe, ['pasta', 'tomato', 'garlic', 'basil'])} />);
    expect(screen.getByTestId('what-do-i-need-summary').textContent).toBe('You have everything ✓');
    expect(screen.queryByTestId('what-do-i-need-copy')).toBeNull();
  });

  it('copies a shopping list', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    render(<WhatDoINeed title="Pomodoro" needs={needsFromKitchen(recipe, ['pasta'], { amounts })} />);
    fireEvent.click(screen.getByTestId('what-do-i-need-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toMatch(/^Shopping list for Pomodoro:\n- tomato\n- 3 cloves garlic/);
    expect(await screen.findByText('Copied ✓')).toBeTruthy();
  });

  it('with an empty kitchen, lists everything as needed', () => {
    render(<WhatDoINeed title="P" needs={needsFromKitchen(recipe, [])} stockEmpty />);
    expect(screen.getByTestId('what-do-i-need-summary').textContent).toMatch(/kitchen is empty/);
    expect(screen.getByTestId('what-do-i-need-missing').querySelectorAll('li').length).toBe(4);
  });
});
