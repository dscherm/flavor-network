// @vitest-environment jsdom
// LOOK-4: the one drawn icon set. Every icon renders; icon-only buttons keep an accessible name.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import * as Icons from '../ChalkIcons.jsx';

const ICONS = Object.entries(Icons).filter(([n, v]) => /^[A-Z]/.test(n) && typeof v === 'function');

describe('ChalkIcons', () => {
  it('draws the 15 icons of the set (chevrons counted as one, in four directions)', () => {
    const names = ICONS.map(([n]) => n);
    for (const n of ['ChevronLeft', 'ChevronRight', 'ChevronDown', 'ChevronUp', 'Close', 'Search', 'Filters', 'Share',
      'Basket', 'Camera', 'Shaker', 'Whisk', 'Checkbox', 'More', 'Home', 'Person', 'Labs', 'Help']) {
      expect(names).toContain(n);
    }
  });

  it.each(ICONS)('%s draws each stroke twice (halo under a crisp line) with round ends and no fill', (name, C) => {
    const { container } = render(<C size={24} />);
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    const paths = [...svg.querySelectorAll('path')];
    if (paths.length) {
      expect(paths.length % 2).toBe(0);
      for (let i = 0; i < paths.length; i += 2) {
        expect(paths[i].getAttribute('d')).toBe(paths[i + 1].getAttribute('d'));
        expect(paths[i].getAttribute('stroke-opacity')).toBe('0.25');
        expect(Number(paths[i].getAttribute('stroke-width'))).toBeCloseTo(Number(paths[i + 1].getAttribute('stroke-width')) * 2.2, 5);
        expect(paths[i + 1].getAttribute('stroke-linecap')).toBe('round');
        expect(paths[i + 1].getAttribute('fill')).toBe('none');
      }
    }
    expect(svg.innerHTML).not.toMatch(/filter|#[0-9a-f]{3,6}\b|rgb\(/i);
  });

  it('keeps the line at 1.5 px at every size (core = 1.5 * 24 / size)', () => {
    const { container } = render(<Icons.Close size={16} />);
    const crisp = container.querySelectorAll('path')[1];
    expect(Number(crisp.getAttribute('stroke-width'))).toBeCloseTo(2.25, 5);
  });

  it('a decorative icon is hidden; one given a title is named', () => {
    const a = render(<Icons.Share />);
    expect(a.container.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    a.unmount();
    const b = render(<Icons.Share title="Share" />);
    expect(b.container.querySelector('svg').getAttribute('aria-label')).toBe('Share');
  });

  it('the checkbox adds a tick when checked', () => {
    const off = render(<Icons.Checkbox />).container.querySelectorAll('path').length;
    const on = render(<Icons.Checkbox checked />).container.querySelectorAll('path').length;
    expect(on).toBe(off + 2);
  });
});

describe('icon-only buttons keep an accessible name', () => {
  const dir = path.resolve(__dirname, '..');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsx'));
  it('every <button> that holds only a Close, More or Chevron icon has an aria-label', () => {
    const bad = [];
    for (const f of files) {
      if (f === 'ChalkIcons.jsx') continue;
      const text = fs.readFileSync(path.join(dir, f), 'utf8');
      const re = /<button\b([\s\S]*?)<\/button>/g;
      let m;
      while ((m = re.exec(text))) {
        const whole = m[0];
        if (!/<(Close|More|ChevronLeft|ChevronRight)\b/.test(whole)) continue;
        const inner = whole.slice(whole.indexOf('>', whole.indexOf('<button')) + 1);
        const words = inner.replace(/<[^>]*>/g, ' ').replace(/\{[^}]*\}/g, ' ').trim();
        const named = /aria-label|title=/.test(whole.slice(0, whole.indexOf('>')) ) || /aria-label=/.test(whole);
        if (words === '' && !named) bad.push(f);
      }
    }
    expect(bad).toEqual([]);
  });
});
