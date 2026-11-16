// @vitest-environment jsdom
// CHART-3: the note-and-strips chart with a swipe to the wheel.
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FlavorSwipe from '../FlavorSwipe.jsx';
import InventFlavorProfile from '../InventFlavorProfile.jsx';
import { flavorNote } from '../../data/flavorCharts.js';
import { AXES } from '../../data/flavorDisplay.js';

const bars = [
  { axis: 'odor_woody', label: 'Woody', color: '#967a51', score: 0.65 },
  { axis: 'sweet', label: 'Sweet', color: '#ff5fa2', score: 0.35 },
  { axis: 'bitter', label: 'Bitter', color: '#a855f7', score: 0.3 },
  { axis: 'odor_spicy', label: 'Spice', color: '#c25726', score: 0.3 },
  { axis: 'odor_toasty', label: 'Toasty', color: '#cd7e2d', score: 0.28 },
];
const active = (id) => screen.getByTestId(`s-page-${id}`).getAttribute('data-active') === 'true';

describe('FlavorSwipe', () => {
  it('opens on the sentence and strips, with the wheel on the second page', () => {
    render(<FlavorSwipe bars={bars} testidPrefix="s" />);
    expect(active('note')).toBe(true);
    expect(active('wheel')).toBe(false);
    expect(screen.getByTestId('s-sentence')).toHaveTextContent(flavorNote(bars).text);
    expect(screen.getByTestId('s-strip-taste')).toBeTruthy();
    expect(screen.getByTestId('s-strip-aroma')).toBeTruthy();
    expect(screen.getByTestId('s-page-wheel').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('s-dot-note').getAttribute('aria-current')).toBe('true');
  });

  it('underlines each note word in its colour', () => {
    render(<FlavorSwipe bars={bars} testidPrefix="s" />);
    const spans = [...screen.getByTestId('s-sentence').querySelectorAll('span')].filter((s) => s.style.borderBottom);
    expect(spans.map((s) => s.textContent.toLowerCase())).toEqual(flavorNote(bars).words.map((w) => w.label.toLowerCase()));
  });

  it('strip segments are as wide as their length and only the big ones are labelled', () => {
    render(<FlavorSwipe bars={bars} testidPrefix="s" />);
    const seg = screen.getByTestId('s-seg-odor_woody');
    expect(parseFloat(seg.style.width)).toBeGreaterThan(parseFloat(screen.getByTestId('s-seg-odor_toasty').style.width));
    expect(seg).toHaveTextContent('Woody');
  });

  it('reaches the wheel with the dots, and back', () => {
    render(<FlavorSwipe bars={bars} testidPrefix="s" />);
    fireEvent.click(screen.getByRole('button', { name: 'Flavor wheel' }));
    expect(active('wheel')).toBe(true);
    expect(screen.getByRole('button', { name: 'Flavor wheel' }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('button', { name: 'Tasting note' }).getAttribute('aria-current')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tasting note' }));
    expect(active('note')).toBe(true);
  });

  it('reaches the wheel by swiping left and back by swiping right; a short or vertical drag does nothing', () => {
    render(<FlavorSwipe bars={bars} testidPrefix="s" />);
    const area = screen.getByTestId('s-page-note').parentElement.parentElement;
    const drag = (x0, y0, x1, y1) => { fireEvent.pointerDown(area, { clientX: x0, clientY: y0 }); fireEvent.pointerUp(area, { clientX: x1, clientY: y1 }); };
    drag(200, 100, 190, 100);
    drag(200, 100, 100, 220);
    expect(active('note')).toBe(true);
    drag(200, 100, 100, 105);
    expect(active('wheel')).toBe(true);
    drag(100, 100, 200, 100);
    expect(active('note')).toBe(true);
  });

  it('reaches the wheel with the arrow keys', () => {
    render(<FlavorSwipe bars={bars} testidPrefix="s" />);
    const root = screen.getByTestId('s-swipe');
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    expect(active('wheel')).toBe(true);
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    expect(active('wheel')).toBe(true);
    fireEvent.keyDown(root, { key: 'ArrowLeft' });
    expect(active('note')).toBe(true);
  });

  it('dots are buttons at least 44px; the slide has no animation under reduced motion', () => {
    render(<FlavorSwipe bars={bars} testidPrefix="s" />);
    for (const id of ['note', 'wheel']) {
      const dot = screen.getByTestId(`s-dot-${id}`);
      expect(dot.tagName).toBe('BUTTON');
      expect(dot.style.minWidth).toBe('44px');
      expect(dot.style.minHeight).toBe('44px');
    }
    expect(screen.getByTestId('s-page-note').parentElement.className).toContain('motion-reduce:transition-none');
  });

  it('the box follows the active page, and the page not showing is aria-hidden and inert (never read twice or tabbable)', () => {
    render(<FlavorSwipe bars={bars} testidPrefix="s" />);
    const note = screen.getByTestId('s-page-note'), wheel = screen.getByTestId('s-page-wheel');
    const box = note.parentElement.parentElement;
    expect(box.className).toContain('transition-[height]');
    expect(box.className).toContain('motion-reduce:transition-none');
    expect(wheel.hasAttribute('inert')).toBe(true);
    expect(note.hasAttribute('inert')).toBe(false);
    fireEvent.click(screen.getByTestId('s-dot-wheel'));
    expect(note.hasAttribute('inert')).toBe(true);
    expect(note.getAttribute('aria-hidden')).toBe('true');
    expect(wheel.hasAttribute('inert')).toBe(false);
    expect(wheel.getAttribute('aria-hidden')).toBeNull();
  });

  it('gives screen readers every note, strongest first, whichever page is showing', () => {
    render(<FlavorSwipe bars={bars} testidPrefix="s" />);
    const items = screen.getAllByRole('listitem', { hidden: true });
    expect(items.map((i) => i.getAttribute('aria-label'))).toEqual(['Woody 65 percent', 'Sweet 35 percent', 'Bitter 30 percent', 'Spice 30 percent', 'Toasty 28 percent']);
    expect(screen.getByLabelText('Flavor notes, strongest first').className).toContain('sr-only');
  });

  it('draws a fixed wheel: seventeen tracks, a wedge only for notes that are on, labels for the strongest four, and the key', () => {
    render(<FlavorSwipe bars={bars} testidPrefix="s" />);
    const svg = screen.getByTestId('s-wheel');
    expect(svg.querySelectorAll('path').length).toBe(AXES.length + bars.length);
    expect(screen.getByTestId('s-wedge-sweet')).toBeTruthy();
    expect(screen.queryByTestId('s-wedge-umami')).toBeNull();
    expect([...svg.querySelectorAll('text')].map((t) => t.textContent).sort()).toEqual(['Bitter', 'Sweet', 'Spice', 'Woody'].sort());
    expect(screen.getByTestId('s-wheel-key')).toHaveTextContent('Left side: tastes. The rest: aromas.');
  });
});

describe('InventFlavorProfile around the swipe', () => {
  const profile = { bars, summary: 'On the chart: woody.', uncounted: ['mystery'], counted: ['bourbon'], drawn: true };
  it('keeps the guide label, the not-counted line and the summary under the chart', () => {
    render(<InventFlavorProfile profile={profile} testidPrefix="f" />);
    expect(screen.getByTestId('f-sentence')).toBeTruthy();
    expect(screen.getByTestId('f-note')).toHaveTextContent(/guide, not a taste test/);
    expect(screen.getByTestId('f-uncounted')).toHaveTextContent('mystery');
    expect(screen.queryByTestId('f-summary')).toBeNull(); // the sentence says it already
  });
  it('not enough data draws no chart and says why', () => {
    render(<InventFlavorProfile profile={{ bars: [], summary: 'Not enough flavor data for a chart yet.', uncounted: ['a', 'b'], counted: [], drawn: false }} testidPrefix="f" />);
    expect(screen.getByTestId('f-empty')).toHaveTextContent('Not enough flavor data for a chart yet.');
    expect(screen.queryByTestId('f-swipe')).toBeNull();
    expect(screen.queryByTestId('f-sentence')).toBeNull();
  });
  it('no data at all draws no chart and says why', () => {
    render(<InventFlavorProfile profile={{ bars: [], summary: '', uncounted: [] }} testidPrefix="f" />);
    expect(screen.getByTestId('f-empty')).toHaveTextContent('Add ingredients with flavor data');
    expect(screen.queryByTestId('f-swipe')).toBeNull();
  });
});
