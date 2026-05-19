import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import GuidedDiscoverySwipe from '../GuidedDiscoverySwipe.jsx';

const SAMPLE_INGREDIENTS = ['tomato', 'basil', 'onion', 'garlic', 'chicken'];

function flush() {
  return act(async () => {
    await new Promise((r) => setTimeout(r, 1));
  });
}

// Drive Card 1 (ingredient picker) → land on Card 2 (FilterTypeCard).
async function pickIngredientAndAdvance(name) {
  const input = screen.getByRole('combobox', { name: 'Search ingredients' });
  fireEvent.change(input, { target: { value: name } });
  const opt = screen.getByText(name);
  fireEvent.mouseDown(opt);
  await flush();
  const gotItBtn = screen.getByRole('button', { name: /got it/i });
  fireEvent.click(gotItBtn);
  await flush();
}

describe('GuidedDiscoverySwipe — Track 3 / Phase 5 (2-card flow)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the ingredient picker (SearchBar + Suggest one) on initial render', () => {
    render(
      <GuidedDiscoverySwipe
        ingredients={SAMPLE_INGREDIENTS}
        onComplete={() => {}}
      />,
    );
    // Sentence-starter heading
    expect(
      screen.getByText("I'm thinking about pairing that…"),
    ).toBeInTheDocument();
    // Card 1 heading
    expect(
      screen.getByText('Starts with a specific ingredient'),
    ).toBeInTheDocument();
    // SearchBar combobox
    expect(
      screen.getByRole('combobox', { name: 'Search ingredients' }),
    ).toBeInTheDocument();
    // Suggest-one fallback
    expect(screen.getByText('Suggest one for me')).toBeInTheDocument();
    // FilterTypeCard should NOT be in the DOM yet
    expect(screen.queryByTestId('guided-filter-type-card')).toBeNull();
  });

  it('ingredient pick → Got it transitions to GuidedFilterTypeCard', async () => {
    render(
      <GuidedDiscoverySwipe
        ingredients={SAMPLE_INGREDIENTS}
        onComplete={() => {}}
      />,
    );
    await pickIngredientAndAdvance('tomato');
    expect(screen.getByTestId('guided-filter-type-card')).toBeVisible();
  });

  it('filter-type pick + Got it → onComplete fires once with { ingredient, filterType }', async () => {
    const onComplete = vi.fn();
    render(
      <GuidedDiscoverySwipe
        ingredients={SAMPLE_INGREDIENTS}
        onComplete={onComplete}
      />,
    );
    await pickIngredientAndAdvance('basil');

    // Pick a filter pill on Card 2
    const tastePill = screen.getByRole('radio', { name: /a taste/i });
    fireEvent.click(tastePill);

    // FilterTypeCard's own Got-it button (now the only "got it" in the DOM)
    const gotItBtn = screen.getByRole('button', { name: /got it/i });
    fireEvent.click(gotItBtn);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({
      ingredient: 'basil',
      filterType: 'taste',
    });
  });

  it('Card 1 Got-it is disabled until an ingredient is picked', () => {
    render(
      <GuidedDiscoverySwipe
        ingredients={SAMPLE_INGREDIENTS}
        onComplete={() => {}}
      />,
    );
    const gotItBtn = screen.getByRole('button', { name: /got it/i });
    expect(gotItBtn).toBeDisabled();
    expect(gotItBtn).toHaveAttribute('aria-disabled', 'true');
  });

  it('Suggest one for me populates the picked ingredient', async () => {
    render(
      <GuidedDiscoverySwipe
        ingredients={SAMPLE_INGREDIENTS}
        onComplete={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Suggest one for me'));
    await flush();
    // The picked name lands in <strong className="text-emerald-200">
    const strong = document.querySelector('strong.text-emerald-200');
    expect(strong).not.toBeNull();
    expect(['chicken', 'onion', 'basil', 'vanilla']).toContain(
      strong.textContent,
    );
    // And Card 1's Got-it is now enabled
    const gotItBtn = screen.getByRole('button', { name: /got it/i });
    expect(gotItBtn).not.toBeDisabled();
  });

  // G2 NEW11 fake-timer spec — explicit "no auto-advance" guarantee.
  // Per ralplan §2.4: picking an ingredient must NOT auto-render the
  // FilterTypeCard. Only an explicit Got-it click commits the transition.
  it('no-auto-advance: ingredient pick does NOT auto-render FilterTypeCard', async () => {
    vi.useFakeTimers();
    render(
      <GuidedDiscoverySwipe
        ingredients={SAMPLE_INGREDIENTS}
        onComplete={() => {}}
      />,
    );

    // Pick ingredient via SearchBar (the same gesture used elsewhere).
    const input = screen.getByRole('combobox', { name: 'Search ingredients' });
    fireEvent.change(input, { target: { value: 'tomato' } });
    const opt = screen.getByText('tomato');
    fireEvent.mouseDown(opt);

    // Advance any pending timers; the FilterTypeCard must NOT appear.
    vi.advanceTimersByTime(5000);
    expect(screen.queryByTestId('guided-filter-type-card')).toBeNull();

    // Switch back to real timers before driving the explicit user action.
    vi.useRealTimers();
    await flush();

    // Explicit Got-it click flips to Card 2.
    const gotItBtn = screen.getByRole('button', { name: /got it/i });
    fireEvent.click(gotItBtn);
    expect(screen.getByTestId('guided-filter-type-card')).toBeVisible();
  });
});

describe('Constraint #4 — GuidedDiscoverySwipe purity', () => {
  it('contains zero setFilterStack call sites', () => {
    const file = path.resolve(
      __dirname,
      '..',
      'GuidedDiscoverySwipe.jsx',
    );
    const src = fs.readFileSync(file, 'utf8');
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/setFilterStack\s*\(/);
    const refs = stripped.match(/setFilterStack/g) || [];
    expect(refs).toHaveLength(0);
  });

  // Track 3 / Phase 5 verification gate: the swipe-deck registry must
  // no longer be imported here. (BUBBLE_REGISTRY stays alive elsewhere
  // for Build's flow — verified by a separate src/-wide grep.)
  it('does NOT import or reference BUBBLE_REGISTRY', () => {
    const file = path.resolve(
      __dirname,
      '..',
      'GuidedDiscoverySwipe.jsx',
    );
    const src = fs.readFileSync(file, 'utf8');
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/BUBBLE_REGISTRY/);
  });
});
