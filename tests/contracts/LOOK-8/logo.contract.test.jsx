// @vitest-environment jsdom
// LOOK-8 contract tests (blind): the chef's hat with "Nf" now caps a conical flask (candidate E) instead
// of the Rutherford atom. Written from plan.md (LOOK-8 AC-1..AC-3) and the approved brief
// .schermness/design/LOOK-8.md. ChalkLogo.jsx and AnimatedLogo.jsx were NOT read by the test writer;
// rendering setup comes from src/components/__tests__/ChalkLogo.test.jsx and tests/contracts/LOOK-6.
//
// Fixture: hatPaths.json holds the six hat path `d` strings taken from the pre-LOOK-8 ChalkLogo.jsx
// (git HEAD at the time the tests were written), identified through the HAT table of
// docs/prototypes/logo-candidates.html, which copies them unchanged.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ChalkLogo from '../../../src/components/ChalkLogo.jsx';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const HAT = JSON.parse(readFileSync(resolve(HERE, 'hatPaths.json'), 'utf8')).paths;
const SMIL = 'animate, animateMotion, animateTransform, set';

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const src = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

function mockReducedMotion(reduce) {
  vi.stubGlobal('matchMedia', undefined);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query) => ({
      matches: reduce && /prefers-reduced-motion:\s*reduce/.test(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

const ORIGINAL_MATCH_MEDIA = window.matchMedia;
beforeEach(() => mockReducedMotion(false));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: ORIGINAL_MATCH_MEDIA });
});

// All CSS that can carry the motion rules: <style> elements in the document (inside the svg or not),
// the component source itself (a CSS string in JS), and any .css file it imports.
function cssText() {
  const parts = [...document.querySelectorAll('style')].map((s) => s.textContent);
  const jsx = src('src/components/ChalkLogo.jsx');
  parts.push(jsx);
  for (const m of jsx.matchAll(/import\s+['"](\.{1,2}\/[^'"]+\.css)['"]/g)) {
    const p = resolve(ROOT, 'src/components', m[1]);
    if (existsSync(p)) parts.push(readFileSync(p, 'utf8'));
  }
  return parts.join('\n');
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Is this element (or an ancestor inside the svg) given a running animation, by SMIL, inline style or a
// CSS class rule with an `animation` / `animation-name` other than none?
function animatedBy(el, css) {
  let node = el;
  while (node && node.nodeType === 1) {
    if (node.querySelector && [...node.children].some((c) => c.matches(SMIL))) return 'smil';
    const inline = (node.getAttribute('style') || '').toLowerCase();
    if (/animation(-name)?\s*:\s*(?!none)/.test(inline)) return 'inline';
    const cls = (node.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    for (const c of cls) {
      const re = new RegExp(`\\.${escapeRe(c)}(?![\\w-])[^{}]*\\{[^}]*animation(-name)?\\s*:\\s*(?!none)`, 'i');
      if (re.test(css)) return `class:${c}`;
    }
    if (node.tagName && node.tagName.toLowerCase() === 'svg') break;
    node = node.parentElement;
  }
  return null;
}

// Inside an @media (prefers-reduced-motion: reduce) block, is the class's animation turned off?
function reducedMotionStops(css, cls) {
  const blocks = [];
  const re = /@media[^{]*prefers-reduced-motion\s*:\s*reduce[^{]*\{/gi;
  let m;
  while ((m = re.exec(css))) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    blocks.push(css.slice(re.lastIndex, i));
  }
  const ruleRe = new RegExp(
    `\\.${escapeRe(cls)}(?![\\w-])[^{}]*\\{[^}]*(animation\\s*:\\s*none|animation-name\\s*:\\s*none|animation-play-state\\s*:\\s*paused)`,
    'i',
  );
  return blocks.some((b) => ruleRe.test(b));
}

function flaskOf(container) {
  return container.querySelector('[data-part="flask"]');
}

function bubblesOf(container) {
  const marked = [...container.querySelectorAll('[data-part="bubble"]')];
  if (marked.length) return marked;
  const flask = flaskOf(container);
  return flask ? [...flask.querySelectorAll('circle')] : [];
}

function nfText(container) {
  return [...container.querySelectorAll('text')].find((t) => t.textContent.trim() === 'Nf');
}
const attrOrStyle = (el, attr, prop) => el.getAttribute(attr) || el.style[prop] || '';

describe('LOOK-8 AC-1: no atom drawing code left in the logo components', () => {
  // Covers: AC-1
  it.each(['src/components/ChalkLogo.jsx', 'src/components/AnimatedLogo.jsx'])('%s has no orbit, electron, nucleus or atom', (rel) => {
    const text = src(rel);
    const hits = text.match(/\batoms?\b|\belectrons?\b|\bnucleus\b|\borbits?\b|\borbital\b|animateMotion|rutherford/gi) || [];
    expect(hits, `found: ${hits.join(', ')}`).toEqual([]);
  });

  // Covers: AC-1
  it('the rendered logo has no ellipse orbits, rotate groups or radial-gradient nucleus', () => {
    const { container } = render(<ChalkLogo title="Neural Flavor" />);
    expect(container.querySelectorAll('animateMotion').length).toBe(0);
    expect(container.querySelectorAll('radialGradient').length).toBe(0);
    expect(container.querySelectorAll('g[transform^="rotate"]').length).toBe(0);
  });
});

describe('LOOK-8 AC-2: hat and Nf unchanged, flask added', () => {
  // Covers: AC-2
  it.each([
    ['animated', {}],
    ['still', { animate: false }],
  ])('the %s logo draws every pre-LOOK-8 hat path unchanged', (_l, props) => {
    const { container } = render(<ChalkLogo title="Neural Flavor" {...props} />);
    const ds = new Set([...container.querySelectorAll('path')].map((p) => norm(p.getAttribute('d'))));
    for (const [name, d] of Object.entries(HAT)) {
      expect(ds.has(d), `hat path "${name}" missing or changed`).toBe(true);
    }
  });

  // Covers: AC-2
  // Position (y=128 on the hat band), size 32 and orange fill superseded by LOOK-8b (owner, 2026-11-23):
  // Nf now sits on a cream label on the flask in slate ink; see tests/contracts/LOOK-8b.
  it('draws Nf in Caveat 700, centred on x=100', () => {
    const { container } = render(<ChalkLogo title="Neural Flavor" />);
    const nf = nfText(container);
    expect(nf, 'no <text> with Nf').toBeTruthy();
    expect(attrOrStyle(nf, 'font-family', 'fontFamily')).toMatch(/Caveat/);
    const w = String(attrOrStyle(nf, 'font-weight', 'fontWeight'));
    expect(w === 'bold' ? '700' : w).toBe('700');
    expect(nf.getAttribute('x')).toBe('100');
  });

  // Covers: AC-2
  it.each([
    ['animated', {}],
    ['still', { animate: false }],
  ])('the %s logo has a flask element marked data-part="flask" with drawn lines', (_l, props) => {
    const { container } = render(<ChalkLogo title="Neural Flavor" {...props} />);
    const flask = flaskOf(container);
    expect(flask, 'no element with data-part="flask"').toBeTruthy();
    expect(flask.closest('svg')).toBeTruthy();
    expect(flask.querySelectorAll('path, line, polyline, polygon, rect, ellipse, circle').length).toBeGreaterThan(0);
    // The hat is not part of the flask drawing.
    const flaskDs = [...flask.querySelectorAll('path')].map((p) => norm(p.getAttribute('d')));
    expect(flaskDs).not.toContain(HAT.puffs);
  });

  // Covers: AC-2
  // Colour set superseded by LOOK-8b (owner, 2026-11-23): orange is no longer required; the liquid is chalk
  // blue #5b9fd6 and Nf is slate ink #0a0a0a. LOOK-8b AC-3 pins the exact set.
  it('keeps the logo colours only: cream, sage, chalk blue and slate (orange tolerated until LOOK-8b lands)', () => {
    const { container } = render(<ChalkLogo title="Neural Flavor" />);
    const svg = container.querySelector('svg');
    const bad = [];
    for (const el of svg.querySelectorAll('*')) {
      if (el.closest('filter, defs, title, style')) continue;
      for (const a of ['fill', 'stroke']) {
        const v = (el.getAttribute(a) || '').toLowerCase().trim();
        if (!v || v === 'none' || v === 'currentcolor' || v.startsWith('url(')) continue;
        if (!['#f5efde', '#f2a93b', '#8fa274', '#5b9fd6', '#0a0a0a'].includes(v)) bad.push(`${el.tagName} ${a}=${v}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('LOOK-8 AC-3: motion', () => {
  // Covers: AC-3
  it('with motion allowed, the bubbles animate', () => {
    mockReducedMotion(false);
    const { container } = render(<ChalkLogo title="Neural Flavor" />);
    const bubbles = bubblesOf(container);
    expect(bubbles.length, 'no bubbles (data-part="bubble" or circles inside the flask)').toBeGreaterThan(0);
    const css = cssText();
    const moving = bubbles.filter((b) => animatedBy(b, css));
    expect(moving.length, 'no bubble carries an animation').toBeGreaterThan(0);
  });

  // Covers: AC-3
  it('with prefers-reduced-motion: reduce, no SMIL animation and no bubble left running', () => {
    mockReducedMotion(true);
    expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
    const { container } = render(<ChalkLogo title="Neural Flavor" />);
    expect(container.querySelectorAll(SMIL).length).toBe(0);
    const css = cssText();
    const bubbles = bubblesOf(container);
    expect(bubbles.length, 'the still logo is complete: bubbles stay drawn').toBeGreaterThan(0);
    for (const b of bubbles) {
      const how = animatedBy(b, css);
      if (!how) continue; // animation class dropped under reduced motion
      expect(how.startsWith('class:'), `bubble animated by ${how} under reduced motion`).toBe(true);
      expect(reducedMotionStops(css, how.slice(6)), `no reduced-motion rule stops .${how.slice(6)}`).toBe(true);
    }
  });

  // Covers: AC-3
  it('animate={false} draws the still logo: no SMIL, no animated bubble, bubbles still drawn', () => {
    const { container } = render(<ChalkLogo animate={false} />);
    expect(container.querySelectorAll(SMIL).length).toBe(0);
    const css = cssText();
    const bubbles = bubblesOf(container);
    expect(bubbles.length).toBeGreaterThan(0);
    expect(bubbles.filter((b) => animatedBy(b, css))).toEqual([]);
  });
});
