/**
 * A11y smoke test for GuidedDiscoveryStart (Phase 5b).
 * Enforces the a11y commitments made in Phase 3 + hardened in Phase 5b.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import GuidedDiscoveryStart from '../GuidedDiscoveryStart.jsx';

const SAMPLE_INGREDIENTS = ['salmon', 'salt', 'sage'];

function flush() {
  return act(async () => {
    await new Promise((r) => setTimeout(r, 1));
  });
}

describe('GuidedDiscoveryStart — a11y smoke tests', () => {
  it('bubble grid container has role="group" and aria-labelledby pointing at the sentence starter', () => {
    render(<GuidedDiscoveryStart ingredients={SAMPLE_INGREDIENTS} onShowPairings={() => {}} />);
    const grid = document.querySelector('[role="group"]');
    expect(grid).toBeTruthy();
    const labelledById = grid.getAttribute('aria-labelledby');
    expect(labelledById).toBe('guided-sentence-starter');
    // The labelled element must exist in the DOM
    expect(document.getElementById(labelledById)).toBeTruthy();
  });

  it('sentence starter exists with id="guided-sentence-starter"', () => {
    render(<GuidedDiscoveryStart ingredients={SAMPLE_INGREDIENTS} onShowPairings={() => {}} />);
    const starter = document.getElementById('guided-sentence-starter');
    expect(starter).toBeTruthy();
    expect(starter.textContent).toMatch(/pairing/i);
  });

  it('each bubble summary has aria-expanded attribute', () => {
    render(<GuidedDiscoveryStart ingredients={SAMPLE_INGREDIENTS} onShowPairings={() => {}} />);
    const summaries = document.querySelectorAll('details summary');
    expect(summaries.length).toBeGreaterThan(0);
    for (const summary of summaries) {
      expect(summary.hasAttribute('aria-expanded')).toBe(true);
    }
  });

  it('aria-expanded reflects open/closed state on bubble toggle', () => {
    render(<GuidedDiscoveryStart ingredients={SAMPLE_INGREDIENTS} onShowPairings={() => {}} />);
    const seasonDetails = document.querySelector('details[data-bubble-key="season"]');
    const summary = seasonDetails.querySelector('summary');
    expect(summary.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(summary);
    expect(summary.getAttribute('aria-expanded')).toBe('true');
  });

  it('stack remove chips have aria-label matching the remove action', async () => {
    render(<GuidedDiscoveryStart ingredients={SAMPLE_INGREDIENTS} onShowPairings={() => {}} />);
    // Select a season bubble to produce a chip
    fireEvent.click(document.querySelector('details[data-bubble-key="season"] summary'));
    fireEvent.click(screen.getByRole('button', { name: 'summer' }));
    await flush();
    const chip = screen.getByTestId('guided-stack-chip-season');
    const label = chip.getAttribute('aria-label');
    expect(label).toBeTruthy();
    expect(label).toMatch(/Goes with a season/i);
  });

  it('CTA has aria-disabled="true" when disabled', () => {
    render(<GuidedDiscoveryStart ingredients={SAMPLE_INGREDIENTS} onShowPairings={() => {}} />);
    const cta = screen.getByTestId('guided-cta-show-pairings');
    expect(cta.getAttribute('aria-disabled')).toBe('true');
  });

  it('CTA has aria-disabled="false" when enabled', async () => {
    render(<GuidedDiscoveryStart ingredients={SAMPLE_INGREDIENTS} onShowPairings={() => {}} />);
    fireEvent.click(document.querySelector('details[data-bubble-key="season"] summary'));
    fireEvent.click(screen.getByRole('button', { name: 'summer' }));
    await flush();
    const cta = screen.getByTestId('guided-cta-show-pairings');
    expect(cta.getAttribute('aria-disabled')).toBe('false');
  });

  it('aria-live="polite" region exists for stack-mutation announcements', () => {
    render(<GuidedDiscoveryStart ingredients={SAMPLE_INGREDIENTS} onShowPairings={() => {}} />);
    const live = screen.getByTestId('guided-aria-live');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.getAttribute('aria-atomic')).toBe('true');
    expect(live.getAttribute('role')).toBe('status');
  });

  it('aria-live region announces when a bubble is added', async () => {
    render(<GuidedDiscoveryStart ingredients={SAMPLE_INGREDIENTS} onShowPairings={() => {}} />);
    fireEvent.click(document.querySelector('details[data-bubble-key="season"] summary'));
    fireEvent.click(screen.getByRole('button', { name: 'summer' }));
    await flush();
    const live = screen.getByTestId('guided-aria-live');
    expect(live.textContent).toMatch(/Added/i);
    expect(live.textContent).toMatch(/1 selection/);
  });

  it('aria-live region announces when a bubble is removed via stack chip', async () => {
    render(<GuidedDiscoveryStart ingredients={SAMPLE_INGREDIENTS} onShowPairings={() => {}} />);
    fireEvent.click(document.querySelector('details[data-bubble-key="season"] summary'));
    fireEvent.click(screen.getByRole('button', { name: 'summer' }));
    await flush();
    fireEvent.click(screen.getByTestId('guided-stack-chip-season'));
    await flush();
    const live = screen.getByTestId('guided-aria-live');
    expect(live.textContent).toMatch(/Removed/i);
    expect(live.textContent).toMatch(/0 selection/);
  });
});
