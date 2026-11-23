// @vitest-environment jsdom
// LOOK-6 contract test (blind): AC-6, the logo is unchanged. Written from plan.md (LOOK-6 AC-6) and the
// brief .schermness/design/LOOK-6.md (test idea 9.6). How ChalkLogo is rendered was learned from
// src/components/__tests__/ChalkLogo.test.jsx only (default export, renders an <svg> with a <text>Nf</text>).
//
// The family and weight are read from the <text> element's attribute (font-family / font-weight) or its
// inline style, whichever is set; a weight of "bold" counts as 700.
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import ChalkLogo from '../../../src/components/ChalkLogo.jsx';

afterEach(cleanup);

function nfText(container) {
  return [...container.querySelectorAll('text')].find((t) => t.textContent.trim() === 'Nf');
}

function family(el) {
  return el.getAttribute('font-family') || el.style.fontFamily || window.getComputedStyle(el).fontFamily || '';
}

function fontWeight(el) {
  const w = el.getAttribute('font-weight') || el.style.fontWeight || window.getComputedStyle(el).fontWeight || '';
  return w === 'bold' ? '700' : String(w);
}

describe('LOOK-6 AC-6: ChalkLogo Nf', () => {
  // Covers: AC-6
  it.each([
    ['animated', {}],
    ['still', { animate: false }],
  ])('the %s logo draws Nf in Caveat at weight 700', (_label, props) => {
    const { container } = render(<ChalkLogo title="Neural Flavor" {...props} />);
    const nf = nfText(container);
    expect(nf, 'no <text> with Nf').toBeTruthy();
    expect(family(nf)).toMatch(/Caveat/);
    expect(family(nf)).not.toMatch(/Kalam|Alegreya/i);
    expect(fontWeight(nf)).toBe('700');
  });
});
