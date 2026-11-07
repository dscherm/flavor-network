// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ChalkLoader, CountryFlag, LabArt, MakeArt } from '../chalkArt.jsx';
import { FLAG_SPECS, flagShapes, FLAG_W, FLAG_H } from '../../data/countryFlags.js';

afterEach(cleanup);

describe('ChalkLoader', () => {
  it('is a status region with its label and a glass drawing', () => {
    render(<ChalkLoader label="Setting up the bar…" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Setting up the bar…');
    expect(screen.getByTestId('chalk-glass')).toBeTruthy();
  });

  it('has a compact form for sitting inside another screen', () => {
    render(<ChalkLoader compact label="Setting the table…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Setting the table…');
  });
});

describe('CountryFlag', () => {
  it('draws a flag as SVG (not an emoji) with an accessible name', () => {
    render(<CountryFlag country="France" />);
    const flag = screen.getByRole('img', { name: 'France flag' });
    expect(flag.tagName.toLowerCase()).toBe('svg');
    expect(flag.textContent).not.toMatch(/\p{Regional_Indicator}/u);
  });

  it('renders nothing for a country it has no drawing for', () => {
    const { container } = render(<CountryFlag country="Atlantis" />);
    expect(container.innerHTML).toBe('');
  });

  it('every flag\'s stripes cover the whole board', () => {
    for (const [country, spec] of Object.entries(FLAG_SPECS)) {
      const stripes = flagShapes(spec).slice(0, spec.colors.length);
      const covered = stripes.reduce((sum, r) => sum + (spec.dir === 'v' ? r.w : r.h), 0);
      expect(covered, country).toBeCloseTo(spec.dir === 'v' ? FLAG_W : FLAG_H, 5);
    }
  });
});

describe('LabArt / MakeArt', () => {
  it('draws every lab and every Make card', () => {
    for (const id of ['cocktail', 'sauce', 'wine', 'cookbook', 'pairing', 'recipe']) {
      const { container, unmount } = render(<LabArt id={id} accent="#f59e0b" />);
      expect(container.querySelector('svg'), id).toBeTruthy();
      unmount();
    }
    for (const kind of ['book', 'pencil', 'camera', 'link']) {
      const { container, unmount } = render(<MakeArt kind={kind} accent="#34d399" />);
      expect(container.querySelector('svg'), kind).toBeTruthy();
      unmount();
    }
  });
});
