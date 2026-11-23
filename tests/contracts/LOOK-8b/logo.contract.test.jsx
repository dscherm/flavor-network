// @vitest-environment jsdom
// LOOK-8b contract tests (blind): the owner's revision of the LOOK-8 logo. Chalk-blue liquid (#5b9fd6),
// "Nf" in slate ink on a filled cream label centred on the flask, hat band without letters, bubbles at
// the sides of the label. Written from plan.md (LOOK-8b AC-1..AC-4), the approved brief
// .schermness/design/LOOK-8b.md and the prototype docs/prototypes/logo-flask-colours.html.
// ChalkLogo.jsx and AnimatedLogo.jsx were NOT read by the test writer.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ChalkLogo from '../../../src/components/ChalkLogo.jsx';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
// The hat is unchanged since before LOOK-8; reuse LOOK-8's fixture.
const HAT = JSON.parse(readFileSync(resolve(ROOT, 'tests/contracts/LOOK-8/hatPaths.json'), 'utf8')).paths;
const SMIL = 'animate, animateMotion, animateTransform, set';

const CREAM = '#f5efde';
const SAGE = '#8fa274';
const BLUE = '#5b9fd6';
const SLATE = '#0a0a0a';
const ORANGE = '#f2a93b';

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const src = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');
const lc = (v) => String(v || '').toLowerCase().trim();

function mockReducedMotion(reduce) {
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

function animatedBy(el, css) {
  let node = el;
  while (node && node.nodeType === 1) {
    if ([...node.children].some((c) => c.matches(SMIL))) return 'smil';
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

const flaskOf = (c) => c.querySelector('[data-part="flask"]');
const labelOf = (c) => c.querySelector('[data-part="label"]');
const bubblesOf = (c) => [...c.querySelectorAll('[data-part="bubble"]')];
const nfText = (c) => [...c.querySelectorAll('text')].find((t) => t.textContent.trim() === 'Nf');
const attrOrStyle = (el, attr, prop) => el.getAttribute(attr) || el.style[prop] || '';
const num = (el, a) => Number.parseFloat(el.getAttribute(a));

// The label's box, from x/y/width/height (the prototype draws it as a <rect>).
function labelBox(label) {
  const x = num(label, 'x');
  const y = num(label, 'y');
  const w = num(label, 'width');
  const h = num(label, 'height');
  return { x, y, w, h };
}

// A bubble's centre, from cx/cy plus a translate() on the circle itself if any.
function bubbleCircle(b) {
  let cx = num(b, 'cx');
  let cy = num(b, 'cy');
  const r = num(b, 'r');
  const t = (b.getAttribute('transform') || '').match(/translate\(\s*([-\d.]+)[\s,]*([-\d.]+)?\s*\)/);
  if (t) {
    cx += Number(t[1]);
    cy += Number(t[2] || 0);
  }
  return { cx, cy, r };
}

const VARIANTS = [
  ['animated', {}],
  ['still', { animate: false }],
];

describe('LOOK-8b AC-1: Nf in slate ink on a cream label centred on the flask', () => {
  // Covers: AC-1
  it.each(VARIANTS)('the %s logo has a data-part="label" inside the flask, cream-filled, centred on x=100', (_l, props) => {
    const { container } = render(<ChalkLogo title="Neural Flavor" {...props} />);
    const flask = flaskOf(container);
    expect(flask, 'no data-part="flask"').toBeTruthy();
    const label = labelOf(container);
    expect(label, 'no element with data-part="label"').toBeTruthy();
    expect(label.closest('[data-part="flask"]'), 'label is not inside the flask group').toBe(flask);
    expect(lc(attrOrStyle(label, 'fill', 'fill')), 'label is not filled cream').toBe(CREAM);
    const { x, y, w, h } = labelBox(label);
    for (const [k, v] of Object.entries({ x, y, width: w, height: h })) {
      expect(Number.isFinite(v), `label ${k} is not a number`).toBe(true);
    }
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
    expect(Math.abs(x + w / 2 - 100), `label centre x is ${x + w / 2}, not 100`).toBeLessThanOrEqual(0.5);
  });

  // Covers: AC-1
  it.each(VARIANTS)('the %s logo draws Nf inside the flask, on the label, x=100, Caveat 700, slate ink', (_l, props) => {
    const { container } = render(<ChalkLogo title="Neural Flavor" {...props} />);
    const nf = nfText(container);
    expect(nf, 'no <text> with Nf').toBeTruthy();
    expect(nf.closest('[data-part="flask"]'), 'Nf is not inside the flask group').toBeTruthy();
    expect(attrOrStyle(nf, 'font-family', 'fontFamily')).toMatch(/Caveat/);
    const wgt = String(attrOrStyle(nf, 'font-weight', 'fontWeight'));
    expect(wgt === 'bold' ? '700' : wgt).toBe('700');
    expect(Number.parseFloat(nf.getAttribute('x'))).toBe(100);
    expect(lc(nf.getAttribute('text-anchor') || nf.style.textAnchor)).toBe('middle');
    expect(lc(attrOrStyle(nf, 'fill', 'fill'))).toBe(SLATE);
    // The baseline sits on the label.
    const { y, h } = labelBox(labelOf(container));
    const ty = Number.parseFloat(nf.getAttribute('y'));
    expect(ty, `Nf baseline y=${ty} not within the label ${y}..${y + h}`).toBeGreaterThan(y);
    expect(ty).toBeLessThanOrEqual(y + h);
    // Drawn after (on top of) the label.
    expect(isBefore(labelOf(container), nf)).toBe(true);
  });
});

function isBefore(a, b) {
  // eslint-disable-next-line no-bitwise
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('LOOK-8b AC-2: hat unchanged and without letters', () => {
  // Covers: AC-2
  it.each(VARIANTS)('the %s logo still draws every hat path from hatPaths.json', (_l, props) => {
    const { container } = render(<ChalkLogo title="Neural Flavor" {...props} />);
    const ds = new Set([...container.querySelectorAll('path')].map((p) => norm(p.getAttribute('d'))));
    for (const [name, d] of Object.entries(HAT)) {
      expect(ds.has(d), `hat path "${name}" missing or changed`).toBe(true);
    }
  });

  // Covers: AC-2
  it.each(VARIANTS)('the %s logo has no text element outside the flask', (_l, props) => {
    const { container } = render(<ChalkLogo title="Neural Flavor" {...props} />);
    const texts = [...container.querySelectorAll('svg text')];
    expect(texts.length).toBeGreaterThan(0);
    const outside = texts.filter((t) => !t.closest('[data-part="flask"]')).map((t) => t.textContent.trim());
    expect(outside, 'text drawn outside the flask (the hat band must carry no letters)').toEqual([]);
  });
});

describe('LOOK-8b AC-3: chalk-blue liquid and the new colour set', () => {
  // Covers: AC-3
  it('chalkTheme.js carries the chalk-blue liquid token', () => {
    expect(src('src/data/chalkTheme.js').toLowerCase()).toContain(BLUE);
  });

  // Covers: AC-3
  it.each(VARIANTS)('the %s logo fills the liquid inside the flask with #5b9fd6', (_l, props) => {
    const { container } = render(<ChalkLogo title="Neural Flavor" {...props} />);
    const flask = flaskOf(container);
    expect(flask).toBeTruthy();
    const blue = [...flask.querySelectorAll('*')].filter((el) => lc(attrOrStyle(el, 'fill', 'fill')) === BLUE);
    expect(blue.length, 'no element inside the flask is filled chalk blue').toBeGreaterThan(0);
  });

  // Covers: AC-3
  it.each(VARIANTS)('the %s logo uses no old orange anywhere and only cream, sage, chalk blue and slate', (_l, props) => {
    const { container } = render(<ChalkLogo title="Neural Flavor" {...props} />);
    const svg = container.querySelector('svg');
    expect(svg.outerHTML.toLowerCase()).not.toContain(ORANGE);
    const allowed = [CREAM, SAGE, BLUE, SLATE];
    const bad = [];
    for (const el of svg.querySelectorAll('*')) {
      if (el.closest('filter, defs, title, style')) continue;
      for (const [a, p] of [['fill', 'fill'], ['stroke', 'stroke']]) {
        const v = lc(attrOrStyle(el, a, p));
        if (!v || v === 'none' || v === 'currentcolor' || v.startsWith('url(')) continue;
        if (!allowed.includes(v)) bad.push(`${el.tagName} ${a}=${v}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('LOOK-8b AC-4: bubbles at the sides of the label', () => {
  // Covers: AC-4
  it('with motion allowed, the bubbles animate', () => {
    mockReducedMotion(false);
    const { container } = render(<ChalkLogo title="Neural Flavor" />);
    const bubbles = bubblesOf(container);
    expect(bubbles.length, 'no data-part="bubble"').toBeGreaterThan(0);
    const css = cssText();
    expect(bubbles.filter((b) => animatedBy(b, css)).length, 'no bubble carries an animation').toBeGreaterThan(0);
  });

  // Covers: AC-4
  it('with prefers-reduced-motion: reduce, bubbles stay drawn and none is left running', () => {
    mockReducedMotion(true);
    const { container } = render(<ChalkLogo title="Neural Flavor" />);
    expect(container.querySelectorAll(SMIL).length).toBe(0);
    const css = cssText();
    const bubbles = bubblesOf(container);
    expect(bubbles.length).toBeGreaterThan(0);
    for (const b of bubbles) {
      const how = animatedBy(b, css);
      if (!how) continue;
      expect(how.startsWith('class:'), `bubble animated by ${how} under reduced motion`).toBe(true);
      expect(reducedMotionStops(css, how.slice(6)), `no reduced-motion rule stops .${how.slice(6)}`).toBe(true);
    }
  });

  // Covers: AC-4
  it.each(VARIANTS)('in the %s logo no bubble overlaps the label box', (_l, props) => {
    const { container } = render(<ChalkLogo title="Neural Flavor" {...props} />);
    const label = labelOf(container);
    expect(label, 'no data-part="label"').toBeTruthy();
    const { x, y, w, h } = labelBox(label);
    const bubbles = bubblesOf(container);
    expect(bubbles.length).toBeGreaterThan(0);
    for (const b of bubbles) {
      const { cx, cy, r } = bubbleCircle(b);
      expect([cx, cy, r].every(Number.isFinite), 'bubble without numeric cx/cy/r').toBe(true);
      const overlapX = cx + r > x && cx - r < x + w;
      const overlapY = cy + r > y && cy - r < y + h;
      expect(overlapX && overlapY, `bubble (${cx}, ${cy}, r ${r}) overlaps label ${x},${y} ${w}x${h}`).toBe(false);
    }
  });

  // Covers: AC-4
  it('bubbles rise at the sides: no bubble shares the label\'s horizontal span, so rising never crosses it', () => {
    const { container } = render(<ChalkLogo title="Neural Flavor" />);
    const { x, w } = labelBox(labelOf(container));
    for (const b of bubblesOf(container)) {
      const { cx, r } = bubbleCircle(b);
      expect(cx + r <= x || cx - r >= x + w, `bubble at x=${cx} r=${r} is under the label (${x}..${x + w})`).toBe(true);
    }
  });
});
