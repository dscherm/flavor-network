// @vitest-environment jsdom
// WHEEL-1: the ingredient card draws the combined flavor wheel from that one ingredient's notes.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import PairingModeCard from '../PairingModeCard.jsx';
import { ingredientNoteBars, wheelAxisFor } from '../../data/pairingCardData.js';
import { flavorWheel } from '../../data/flavorCharts.js';
import { FLOOR } from '../../data/flavorDisplay.js';
import { NO_CHART_LINE, nodeProbs, AXES } from '../../data/recipeProfileAnalysis.js';

const DATA = JSON.parse(readFileSync('public/proDataset/ingredients.json', 'utf8'));
const nodeOf = (name) => ({ name, ...DATA[name] });

afterEach(cleanup);

describe('the card draws FlavorWheel', () => {
  it.each(['lemon', 'soy sauce', 'cinnamon'])('%s: no polygon radar; wedges on the wheel are exactly the notes the tables give', (name) => {
    render(<PairingModeCard node={nodeOf(name)} />);
    expect(screen.queryByTestId('pairing-card-radar-polygon')).toBeNull();
    expect(screen.queryByTestId('pairing-card-radar')).toBeNull();
    expect(screen.getByTestId('pairing-card-wheel')).toBeInTheDocument();
    const bars = ingredientNoteBars(nodeOf(name));
    expect(bars.length).toBeGreaterThan(0);
    const wheel = flavorWheel(bars, 'card');
    const drawn = wheel.wedges.filter((w) => w.on).map((w) => w.axis).sort();
    const inDom = [...document.querySelectorAll('[data-testid^="pairing-card-wedge-"]')]
      .map((e) => e.getAttribute('data-testid').replace('pairing-card-wedge-', '')).filter((a) => a !== 'chosen').sort();
    expect(inDom).toEqual(drawn);
    // the screen-reader list is the ranked notes
    const listed = [...screen.getByTestId('pairing-card-notes').querySelectorAll('li')].map((l) => l.textContent);
    expect(listed).toEqual(bars.map((b) => b.label));
  });

  it.each(['lemon', 'soy sauce', 'cinnamon'])('%s: the strongest wedges are the strongest values nodeProbs reads from the tables', (name) => {
    const p = nodeProbs(name, new Map([[name, nodeOf(name)]]));
    const expected = AXES.filter((a) => (p[a] || 0) >= FLOOR).sort((x, y) => (p[y] - p[x]) || (AXES.indexOf(x) - AXES.indexOf(y)));
    const got = ingredientNoteBars(nodeOf(name)).map((b) => b.axis);
    expect(got).toEqual(expected);
    expect(got.slice(0, 3)).toEqual(expected.slice(0, 3));
  });

  it('named notes: lemon is sour and fruity, soy sauce umami and salty, cinnamon spicy', () => {
    expect(ingredientNoteBars(nodeOf('lemon')).slice(0, 3).map((b) => b.axis)).toEqual(expect.arrayContaining(['sour', 'odor_fruity']));
    expect(ingredientNoteBars(nodeOf('soy sauce')).slice(0, 3).map((b) => b.axis)).toEqual(expect.arrayContaining(['umami', 'salty']));
    expect(ingredientNoteBars(nodeOf('cinnamon')).map((b) => b.axis)).toContain('odor_spicy');
  });

  it('a chosen spoke marks its wedge and always labels it; the filter mapping is applied', () => {
    render(<PairingModeCard node={nodeOf('lemon')} filterType="taste" chosenAxis="spicy" />);
    const mark = screen.getByTestId('pairing-card-wedge-chosen');
    expect(mark.getAttribute('data-axis')).toBe('heat');
    expect(screen.getByTestId('pairing-card-chart').getAttribute('data-chosen-wedge')).toBe('heat');
    expect(screen.getByTestId('pairing-card-wheel').textContent).toContain('Heat');
  });

  it('a spoke with no wedge (season, cuisine, astringent) keeps only the Leaning line', () => {
    render(<PairingModeCard node={nodeOf('lemon')} filterType="season" chosenAxis="summer" />);
    expect(screen.queryByTestId('pairing-card-wedge-chosen')).toBeNull();
    expect(screen.getByTestId('pairing-card-chart').textContent).toContain('Leaning summer');
  });

  it('an ingredient with no flavor data shows the plain line, not an empty ring', () => {
    render(<PairingModeCard node={{ name: 'zzz unknown thing' }} />);
    expect(screen.getByTestId('pairing-card-no-chart').textContent).toBe(NO_CHART_LINE);
    expect(screen.queryByTestId('pairing-card-wheel')).toBeNull();
  });
});

describe('wheelAxisFor', () => {
  it('maps the old spokes to wedges and returns null where nothing stands for them', () => {
    expect(wheelAxisFor('taste', 'pungent')).toBe('heat');
    expect(wheelAxisFor('taste', 'astringent')).toBeNull();
    expect(wheelAxisFor('aroma', 'roasted')).toBe('odor_toasty');
    expect(wheelAxisFor('aroma', 'creamy')).toBe('odor_fatty');
    expect(wheelAxisFor('cuisine', 'East Asian')).toBeNull();
    expect(wheelAxisFor('season', 'winter')).toBeNull();
    expect(wheelAxisFor('taste', null)).toBeNull();
  });
});
