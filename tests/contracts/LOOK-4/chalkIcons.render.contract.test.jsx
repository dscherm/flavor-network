// LOOK-4 render contract (blind, TRUSTED mode): written from plan.md, design/DESIGN.md and the
// task brief only; src/components/ChalkIcons.jsx was not read.
//
// Every named export of ChalkIcons.jsx whose name starts with a capital letter and that is a
// React component (a function, or a memo / forwardRef object) is rendered and must:
//   AC-5  render an <svg> element
//   AC-6  with a `title` prop (or, if that gives no name, a `label` prop) be exposed with that
//         accessible name: aria-label / aria-labelledby on the svg, or an svg <title> child, or
//         role="img" with that name; with `aria-hidden` true be hidden (aria-hidden="true" on the
//         svg or a wrapper) and carry no name
//   AC-7  colour with currentColor (stroke or fill) so the colour comes from the text token around it
//
// Prop contract assumed (stated in .schermness/reports/LOOK-4-tests.md):
//   <Icon />                       renders an svg
//   <Icon title="Share" />         the svg's accessible name is "Share"
//   <Icon label="Share" />         accepted instead of title
//   <Icon aria-hidden />           decorative: aria-hidden="true", no aria-label, no <title>
import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';

let mod = null;
let loadError = null;

beforeAll(async () => {
  try {
    mod = await import('../../../src/components/ChalkIcons.jsx');
  } catch (e) {
    loadError = e;
  }
});

const isComponent = (v) =>
  typeof v === 'function' ||
  (v !== null && typeof v === 'object' && typeof v.$$typeof === 'symbol');

function components() {
  if (!mod) return [];
  return Object.entries(mod).filter(([name, v]) => /^[A-Z]/.test(name) && isComponent(v));
}

function accessibleName(svg, container) {
  if (!svg) return '';
  const label = svg.getAttribute('aria-label');
  if (label && label.trim()) return label.trim();
  const by = svg.getAttribute('aria-labelledby');
  if (by) {
    const text = by
      .split(/\s+/)
      .map((id) => container.ownerDocument.getElementById(id)?.textContent || '')
      .join(' ')
      .trim();
    if (text) return text;
  }
  const title = Array.from(svg.children).find((c) => c.tagName.toLowerCase() === 'title');
  if (title && title.textContent.trim()) return title.textContent.trim();
  // A wrapper with role="img" and a label also counts.
  const wrapper = svg.closest('[role="img"]');
  if (wrapper && wrapper !== svg) {
    const wl = wrapper.getAttribute('aria-label');
    if (wl && wl.trim()) return wl.trim();
  }
  return '';
}

function isHidden(svg) {
  return Boolean(svg && svg.closest('[aria-hidden="true"]'));
}

function forEachIcon(fn) {
  expect(loadError, `src/components/ChalkIcons.jsx could not be imported: ${loadError}`).toBeNull();
  const list = components();
  expect(list.length, 'ChalkIcons.jsx exports no capitalised React components').toBeGreaterThan(0);
  const failures = [];
  for (const [name, C] of list) {
    try {
      const msg = fn(name, C);
      if (msg) failures.push(`${name}: ${msg}`);
    } catch (e) {
      failures.push(`${name}: threw ${e && e.message}`);
    } finally {
      cleanup();
    }
  }
  expect(failures, failures.join('\n')).toEqual([]);
}

describe('LOOK-4 ChalkIcons render contract', () => {
  // Covers: AC-5
  it('every icon renders an <svg>', () => {
    forEachIcon((name, C) => {
      const { container } = render(<C />);
      return container.querySelector('svg') ? '' : 'no <svg> rendered';
    });
  });

  // Covers: AC-6
  it('every icon given a title (or label) has that accessible name', () => {
    forEachIcon((name, C) => {
      const want = `Test ${name}`;
      let r = render(<C title={want} />);
      let svg = r.container.querySelector('svg');
      if (accessibleName(svg, r.container) === want && !isHidden(svg)) return '';
      cleanup();
      r = render(<C label={want} />);
      svg = r.container.querySelector('svg');
      if (accessibleName(svg, r.container) === want && !isHidden(svg)) return '';
      return `neither title="${want}" nor label="${want}" gave a visible svg that accessible name (got "${accessibleName(svg, r.container)}")`;
    });
  });

  // Covers: AC-6
  it('every icon with aria-hidden is hidden and has no accessible name', () => {
    forEachIcon((name, C) => {
      const { container } = render(<C aria-hidden={true} />);
      const svg = container.querySelector('svg');
      if (!svg) return 'no <svg> rendered';
      if (!isHidden(svg)) return 'aria-hidden did not reach the svg or a wrapper';
      const n = accessibleName(svg, container);
      return n ? `hidden icon still carries a name "${n}"` : '';
    });
  });

  // Covers: AC-7
  it('every icon colours with currentColor (stroke or fill)', () => {
    forEachIcon((name, C) => {
      const { container } = render(<C />);
      const html = container.innerHTML;
      return /(stroke|fill)\s*[=:]\s*["']?currentColor/i.test(html)
        ? ''
        : 'no stroke or fill of currentColor in the rendered markup';
    });
  });
});
