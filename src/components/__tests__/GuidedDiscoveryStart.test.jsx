import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import GuidedDiscoveryStart from '../GuidedDiscoveryStart.jsx';
import { BUBBLE_REGISTRY } from '../../data/guidedDiscovery.js';

const SAMPLE_INGREDIENTS = ['salmon', 'salt', 'sage', 'sumac', 'sour cream'];

function flush() {
  // setAnnouncement uses setTimeout(…, 0) — flush microtasks/timers so
  // the live region updates before assertions.
  return act(async () => {
    await new Promise((r) => setTimeout(r, 1));
  });
}

describe('GuidedDiscoveryStart', () => {
  it('renders the sentence starter, the 8 bubbles, and a disabled CTA', () => {
    render(<GuidedDiscoveryStart ingredients={SAMPLE_INGREDIENTS} onShowPairings={() => {}} />);
    expect(screen.getByText("I'm thinking about pairing that…")).toBeInTheDocument();
    // 8 bubbles in the registry
    expect(BUBBLE_REGISTRY).toHaveLength(8);
    for (const b of BUBBLE_REGISTRY) {
      expect(screen.getByText(b.label)).toBeInTheDocument();
    }
    const cta = screen.getByTestId('guided-cta-show-pairings');
    expect(cta).toBeDisabled();
  });

  it('expands a bubble when clicked', () => {
    render(<GuidedDiscoveryStart ingredients={SAMPLE_INGREDIENTS} onShowPairings={() => {}} />);
    // Click the season bubble's summary
    const seasonBubble = document.querySelector('details[data-bubble-key="season"]');
    expect(seasonBubble.open).toBe(false);
    const summary = seasonBubble.querySelector('summary');
    fireEvent.click(summary);
    expect(seasonBubble.open).toBe(true);
  });

  it('selecting a season chip adds it to the stack and enables CTA', async () => {
    const onShow = vi.fn();
    render(<GuidedDiscoveryStart ingredients={SAMPLE_INGREDIENTS} onShowPairings={onShow} />);
    // Open the season bubble
    fireEvent.click(document.querySelector('details[data-bubble-key="season"] summary'));
    // Pick "summer"
    const summerBtn = screen.getByRole('button', { name: 'summer' });
    fireEvent.click(summerBtn);
    await flush();
    // Stack chip should appear
    expect(screen.getByTestId('guided-stack-chip-season')).toBeInTheDocument();
    // CTA should now be enabled
    const cta = screen.getByTestId('guided-cta-show-pairings');
    expect(cta).not.toBeDisabled();
    // Tapping the CTA fires onShowPairings with the local stack
    fireEvent.click(cta);
    expect(onShow).toHaveBeenCalledTimes(1);
    const passed = onShow.mock.calls[0][0];
    expect(passed).toHaveLength(1);
    expect(passed[0].key).toBe('season');
    expect(passed[0].value).toBe('summer');
  });

  it('tapping a stack chip removes that bubble from the stack', async () => {
    render(<GuidedDiscoveryStart ingredients={SAMPLE_INGREDIENTS} onShowPairings={() => {}} />);
    fireEvent.click(document.querySelector('details[data-bubble-key="season"] summary'));
    fireEvent.click(screen.getByRole('button', { name: 'summer' }));
    await flush();
    expect(screen.getByTestId('guided-stack-chip-season')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('guided-stack-chip-season'));
    await flush();
    expect(screen.queryByTestId('guided-stack-chip-season')).toBeNull();
    expect(screen.getByTestId('guided-cta-show-pairings')).toBeDisabled();
  });

  it('ingredient bubble keeps user on grid after selection (Round 4 revision)', async () => {
    render(<GuidedDiscoveryStart ingredients={SAMPLE_INGREDIENTS} onShowPairings={() => {}} />);
    const ingredientBubble = document.querySelector('details[data-bubble-key="ingredient"]');
    fireEvent.click(ingredientBubble.querySelector('summary'));
    expect(ingredientBubble.open).toBe(true);
    // Type into the SearchBar combobox + select "salmon"
    const input = screen.getByRole('combobox', { name: 'Search ingredients' });
    fireEvent.change(input, { target: { value: 'salmon' } });
    // Click the matched option
    const opt = screen.getByText('salmon');
    fireEvent.mouseDown(opt);
    await flush();
    // Stack chip should appear
    expect(screen.getByTestId('guided-stack-chip-ingredient')).toBeInTheDocument();
    // Crucially: the ingredient disclosure remains open — Round 4
    // revision keeps the user on the grid so they can stack more.
    expect(ingredientBubble.open).toBe(true);
  });

  it('aria-live region announces stack mutations', async () => {
    render(<GuidedDiscoveryStart ingredients={SAMPLE_INGREDIENTS} onShowPairings={() => {}} />);
    fireEvent.click(document.querySelector('details[data-bubble-key="season"] summary'));
    fireEvent.click(screen.getByRole('button', { name: 'summer' }));
    await flush();
    const announcer = screen.getByTestId('guided-aria-live');
    expect(announcer.textContent).toMatch(/Added: Goes with a season/);
    expect(announcer.textContent).toMatch(/1 selection/);
  });

  it('CTA is enabled iff stack has at least one entry', async () => {
    render(<GuidedDiscoveryStart ingredients={SAMPLE_INGREDIENTS} onShowPairings={() => {}} />);
    const cta = screen.getByTestId('guided-cta-show-pairings');
    expect(cta).toBeDisabled();
    fireEvent.click(document.querySelector('details[data-bubble-key="dessert"] summary'));
    fireEvent.click(screen.getByRole('button', { name: /Yes, this is for dessert/ }));
    await flush();
    expect(cta).not.toBeDisabled();
  });
});

describe('Constraint #4 — GuidedDiscoveryStart purity', () => {
  it('contains zero setFilterStack call sites (mirrors Phase 2 purity check)', () => {
    const file = path.resolve(
      __dirname,
      '..',
      'GuidedDiscoveryStart.jsx',
    );
    const src = fs.readFileSync(file, 'utf8');
    // Per Constraint #4: GuidedDiscoveryStart.jsx must NEVER call
    // setFilterStack from App.jsx. The handoff lives in App.jsx's
    // onExploreInNetwork handler (not here, not in the bubble cards).
    // Strip line comments + block comments before scanning so docstrings
    // explaining the constraint don't trip the check.
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    // No actual call expression (matches `setFilterStack(` in any
    // accessor / member position).
    expect(stripped).not.toMatch(/setFilterStack\s*\(/);
    // Also no bare identifier reference (assignment, prop pass-through,
    // import). Since the symbol could legitimately appear inside an
    // explore-handler name, we further allow it ONLY when preceded by
    // `exploreInNetwork`, `onExploreInNetwork`, or `handleExplore`.
    const refs = stripped.match(/setFilterStack/g) || [];
    expect(refs).toHaveLength(0);
  });

  it('top-of-file Constraint #4 comment exists', () => {
    const file = path.resolve(
      __dirname,
      '..',
      'GuidedDiscoveryStart.jsx',
    );
    const src = fs.readFileSync(file, 'utf8');
    expect(src).toMatch(/Constraint #4/);
  });
});
