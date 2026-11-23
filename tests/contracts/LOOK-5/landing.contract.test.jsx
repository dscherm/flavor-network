// @vitest-environment jsdom
// LOOK-5 contract tests (blind): written from plan.md (LOOK-5 acceptance_criteria AC-1..AC-7) and the
// approved brief .schermness/design/LOOK-5.md (sections 3, 5, 9). The only src files consulted were
// src/components/__tests__/LandingScreen.makeTile.test.jsx (how LandingScreen is rendered) and the
// export NAMES of src/data/usage.js (getConsent, subscribeConsent, setConsent).
//
// Assumed prop contract (from the existing test and the brief):
//   <LandingScreen onModeSelect={fn} isLoading={bool} picked={id} />
//   consent: getConsent() returns null while unanswered, 'yes' / 'no' once answered;
//            subscribeConsent(fn) registers a listener and returns an unsubscribe function.
// The Tab walk (AC-5) is simulated without @testing-library/user-event (not installed): the
// sequential focus order is computed from the DOM (tabindex > 0 first, then document order, skipping
// disabled and tabindex="-1"), and each stop is focused to prove it really takes focus.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, cleanup, act } from '@testing-library/react';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const LANDING_PATH = path.join(ROOT, 'src', 'components', 'LandingScreen.jsx');
const COCKTAIL_BROWSE_PATH = path.join(ROOT, 'src', 'components', 'CocktailBrowse.jsx');

const ORDER = ['make', 'cocktail', 'sauce', 'wine', 'cookbook', 'pairing'];

// ---- consent mock (controllable) ----
const consent = vi.hoisted(() => ({ value: null, listeners: new Set() }));

vi.mock('../../../src/data/usage.js', () => ({
  CONSENT_KEY: 'nf.analytics.consent',
  DEBUG_KEY: 'nf.usage.debug',
  getConsent: vi.fn(() => consent.value),
  subscribeConsent: vi.fn((fn) => {
    consent.listeners.add(fn);
    return () => consent.listeners.delete(fn);
  }),
  setConsent: vi.fn((v) => {
    consent.value = v;
    for (const fn of [...consent.listeners]) fn(v);
  }),
  initUsage: vi.fn(),
  track: vi.fn(),
  __resetUsageForTests: vi.fn(),
}));

// The logo is not under test here (its file must not change); stand-in is a named, non-focusable image.
vi.mock('../../../src/components/AnimatedLogo.jsx', () => ({
  default: () => (
    <svg role="img" aria-label="Neural Flavor" data-testid="logo-stub" />
  ),
}));

vi.mock('../../../src/utils/native.js', () => ({
  hapticMedium: vi.fn(),
}));

import LandingScreen from '../../../src/components/LandingScreen.jsx';

function setConsentValue(v) {
  consent.value = v;
  for (const fn of [...consent.listeners]) fn(v);
}

beforeEach(() => {
  consent.value = null;
  consent.listeners.clear();
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (q) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return false; },
    });
  }
});

afterEach(() => cleanup());

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1'))
    .join('\n');
}

const TABBABLE_SEL = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  'iframe',
  '[tabindex]',
  '[contenteditable="true"]',
].join(',');

function tabOrder(root) {
  const all = Array.from(root.querySelectorAll(TABBABLE_SEL)).filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.tagName === 'INPUT' && el.type === 'hidden') return false;
    const ti = el.getAttribute('tabindex');
    if (ti !== null && Number(ti) < 0) return false;
    return true;
  });
  const positive = all
    .filter((el) => Number(el.getAttribute('tabindex')) > 0)
    .sort((a, b) => Number(a.getAttribute('tabindex')) - Number(b.getAttribute('tabindex')));
  const rest = all.filter((el) => !(Number(el.getAttribute('tabindex')) > 0));
  return [...positive, ...rest];
}

describe('LOOK-5 landing page: the shelf and the menu board', () => {
  // Covers: AC-1
  it('AC-1: exactly six buttons, data-mode in order make..pairing, data-testid landing-tile-{id}', () => {
    render(<LandingScreen onModeSelect={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(6);
    expect(buttons.map((b) => b.getAttribute('data-mode'))).toEqual(ORDER);
    expect(buttons.map((b) => b.getAttribute('data-testid'))).toEqual(
      ORDER.map((id) => `landing-tile-${id}`),
    );
  });

  // Covers: AC-2
  it('AC-2: no stats boast; the plain line is shown', () => {
    const { container } = render(<LandingScreen onModeSelect={vi.fn()} />);
    const text = container.textContent || '';
    expect(text).not.toContain('2.2M');
    expect(text).not.toContain('68,417');
    expect(text.toLowerCase()).not.toContain('molecular');
    // The two sentences may sit in separate nowrap spans; compare without whitespace.
    const squash = (s) => s.replace(/\s+/g, '');
    expect(squash(text)).toContain(squash('Start with what you have. Find what goes with it.'));
  });

  // Covers: AC-3
  it('AC-3: LandingScreen.jsx has no accent field, no stripe, no box shadow, no fn-shimmer', () => {
    expect(fs.existsSync(LANDING_PATH)).toBe(true);
    const raw = fs.readFileSync(LANDING_PATH, 'utf8');
    const src = stripComments(raw);
    expect(src, 'an `accent:` field remains on the lab list').not.toMatch(/\baccent\s*:/);
    expect(raw).not.toContain('left-0 top-0 bottom-0 w-1');
    expect(src).not.toMatch(/box-shadow/i);
    expect(src).not.toMatch(/boxShadow/);
    expect(raw).not.toContain('fn-shimmer');
  });

  // Covers: AC-4
  it('AC-4: loading after picking wine: wine row busy, the other five disabled, a status loader', () => {
    render(<LandingScreen onModeSelect={vi.fn()} isLoading picked="wine" />);
    const wine = screen.getByTestId('landing-tile-wine');
    expect(wine.getAttribute('aria-busy')).toBe('true');
    for (const id of ORDER.filter((m) => m !== 'wine')) {
      const btn = screen.getByTestId(`landing-tile-${id}`);
      expect(btn, `${id} should be disabled while loading`).toBeDisabled();
      expect(btn.getAttribute('aria-busy')).not.toBe('true');
    }
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });

  // Covers: AC-5
  it('AC-5: six Tab presses visit the six lab buttons in order; the shelf takes no focus', () => {
    const { container } = render(<LandingScreen onModeSelect={vi.fn()} />);
    document.body.focus();
    const order = tabOrder(document.body);
    expect(order.length).toBeGreaterThanOrEqual(6);
    const firstSix = order.slice(0, 6);
    expect(firstSix.map((el) => el.getAttribute('data-testid'))).toEqual(
      ORDER.map((id) => `landing-tile-${id}`),
    );
    for (const el of firstSix) {
      act(() => el.focus());
      expect(document.activeElement).toBe(el);
    }
    // Nothing inside a decorative (aria-hidden) part of the page — the shelf drawing — is a tab stop.
    const hidden = Array.from(container.querySelectorAll('[aria-hidden="true"]'));
    expect(hidden.length, 'the shelf drawing should be marked aria-hidden').toBeGreaterThan(0);
    for (const h of hidden) {
      const stops = order.filter((el) => h === el || h.contains(el));
      expect(stops, 'a focusable element sits inside an aria-hidden drawing').toEqual([]);
    }
  });

  // Covers: AC-6
  it('AC-6: bottom spacer present while consent is unanswered, absent when answered', () => {
    consent.value = null;
    const first = render(<LandingScreen onModeSelect={vi.fn()} />);
    expect(screen.getByTestId('landing-consent-spacer')).toBeInTheDocument();
    first.unmount();

    consent.value = 'no';
    render(<LandingScreen onModeSelect={vi.fn()} />);
    expect(screen.queryByTestId('landing-consent-spacer')).toBeNull();
  });

  // Covers: AC-6
  it('AC-6: the spacer goes when consent is answered while the page is open', () => {
    consent.value = null;
    render(<LandingScreen onModeSelect={vi.fn()} />);
    expect(screen.getByTestId('landing-consent-spacer')).toBeInTheDocument();
    act(() => setConsentValue('yes'));
    expect(screen.queryByTestId('landing-consent-spacer')).toBeNull();
  });

  // Covers: AC-7
  it('AC-7: ChalkBottle is exported from chalkArt.jsx and renders an svg', async () => {
    const mod = await import('../../../src/components/chalkArt.jsx');
    const ChalkBottle = mod.ChalkBottle;
    expect(ChalkBottle, 'chalkArt.jsx does not export ChalkBottle').toBeTruthy();
    const { container } = render(<ChalkBottle spirit="rum" label="rum" color="#c2703a" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  // Covers: AC-7
  it('AC-7: CocktailBrowse.jsx no longer defines its own bottleMark (it uses ChalkBottle)', () => {
    const src = stripComments(fs.readFileSync(COCKTAIL_BROWSE_PATH, 'utf8'));
    expect(src).not.toMatch(/function\s+bottleMark\b/);
    expect(src).not.toMatch(/(const|let|var)\s+bottleMark\s*=/);
    expect(src).toMatch(/import\s*\{[^}]*\bChalkBottle\b[^}]*\}\s*from\s*['"][^'"]*chalkArt(\.jsx)?['"]/);
  });
});
