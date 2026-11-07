// @vitest-environment jsdom
// WEAK-3: "You need" (mains), "Even better with…" (flavourings) and swaps
// in the What do I need? section.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WhatDoINeed from '../WhatDoINeed.jsx';
import { needsFromKitchen } from '../../data/whatDoINeed.js';

// Kung-pao-ish: chicken and peanut are mains here; the rest flavour it.
const recipe = ['chicken', 'peanut', 'scallion', 'sichuan peppercorn', 'soy sauce', 'garlic'];
const mainOf = (n) => n === 'chicken' || n === 'peanut';

describe('WhatDoINeed — WEAK-3', () => {
  it('"You need" lists only missing mains; flavourings go under "Even better with"', () => {
    render(<WhatDoINeed title="K" needs={needsFromKitchen(recipe, ['chicken', 'garlic'], { mainOf, swaps: true })} />);
    expect(screen.getByTestId('what-do-i-need-summary').textContent).toBe('You have 2 of 3 — you need 1:');
    const missing = screen.getByTestId('what-do-i-need-missing').textContent;
    expect(missing).toContain('peanut');
    expect(missing).not.toContain('soy sauce');
    expect(screen.getByTestId('what-do-i-need-better').textContent)
      .toBe('Even better with: scallion, sichuan peppercorn, soy sauce');
  });

  it('a swap from the kitchen counts: "You can make it ✓ — with a swap" and "Use your onion for the scallion"', () => {
    render(<WhatDoINeed title="K" needs={needsFromKitchen(recipe, ['chicken', 'peanut', 'onion', 'soy sauce'], { mainOf, swaps: true })} />);
    expect(screen.getByTestId('what-do-i-need-summary').textContent).toBe('You can make it ✓ — with a swap');
    expect(screen.getByTestId('what-do-i-need-swaps').textContent).toContain('Use your onion for the scallion');
    expect(screen.queryByTestId('what-do-i-need-missing')).toBeNull();
    expect(screen.getByTestId('what-do-i-need-better').textContent).toBe('Even better with: sichuan peppercorn, garlic');
  });

  it('every main and nothing else missing: "You can make it ✓", and the list still copies the extras', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    render(<WhatDoINeed title="K" needs={needsFromKitchen(recipe, ['chicken', 'peanut'], { mainOf })} />);
    expect(screen.getByTestId('what-do-i-need-summary').textContent).toBe('You can make it ✓');
    fireEvent.click(screen.getByTestId('what-do-i-need-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain('Even better with:\n- scallion');
  });

  it('a swapped item shows as "your … instead" under what you have', () => {
    render(<WhatDoINeed title="K" needs={needsFromKitchen(recipe, ['chicken', 'peanut', 'onion'], { mainOf, swaps: true })} />);
    fireEvent.click(screen.getByTestId('what-do-i-need-toggle-have'));
    expect(screen.getByTestId('what-do-i-need-have').textContent).toContain('scallion (your onion instead)');
  });

  it('nothing changes for a strict list (no mainOf): sauces and cards without a recipe', () => {
    render(<WhatDoINeed title="S" needs={needsFromKitchen(['butter', 'parsley', 'shallot'], ['shallot'])} />);
    expect(screen.getByTestId('what-do-i-need-summary').textContent).toBe('You have 1 of 2 — you need 1:');
    expect(screen.queryByTestId('what-do-i-need-better')).toBeNull();
    expect(screen.queryByTestId('what-do-i-need-swaps')).toBeNull();
  });
});
