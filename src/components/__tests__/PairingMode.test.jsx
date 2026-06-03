// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import PairingMode from '../PairingMode.jsx';
import PairingModeCard from '../PairingModeCard.jsx';

function buildCtx() {
  const nodes = new Map([
    ['tomato', {
      name: 'tomato',
      taste: 'umami sweet',
      cuisines: ['Italian', 'Mediterranean'],
      season: 'summer',
      pairingCount: 240,
      cluster: 3,
      flavorGraph: { tier1: ['umami'], tier2: ['sweet'], tier3: ['juicy'] },
    }],
    ['basil', {
      name: 'basil',
      taste: 'sweet',
      cuisines: ['Italian'],
      season: 'summer',
      pairingCount: 110,
      cluster: 0,
      flavorGraph: { tier1: ['green'], tier2: [], tier3: [] },
    }],
    ['lemon', {
      name: 'lemon',
      taste: 'sour',
      cuisines: ['Mediterranean'],
      season: 'winter',
      pairingCount: 105,
      cluster: 1,
      flavorGraph: { tier1: ['citrus'] },
    }],
    ['garlic', {
      name: 'garlic',
      taste: 'pungent',
      cuisines: ['Italian'],
      season: 'year-round',
      pairingCount: 200,
      cluster: 2,
      flavorGraph: { tier1: ['pungent'] },
    }],
  ]);
  const edges = [
    { source: 'tomato', target: 'basil',  strength: 0.95 },
    { source: 'tomato', target: 'garlic', strength: 0.88 },
    { source: 'tomato', target: 'lemon',  strength: 0.72 },
  ];
  return { graph: { nodes, edges }, cuisineNeighborIndex: null };
}

describe('PairingModeCard', () => {
  it('renders ingredient name + tier chips + radar', () => {
    const node = {
      name: 'basil',
      taste: 'sweet',
      cuisines: ['Italian'],
      season: 'summer',
      pairingCount: 110,
      cluster: 0,
      flavorGraph: { tier1: ['green'], tier2: ['sweet'], tier3: ['fresh'] },
    };
    render(<PairingModeCard node={node} filterType="taste" chosenAxis="sweet" strength={0.95} />);
    expect(screen.getByTestId('pairing-card-name').textContent).toBe('basil');
    expect(screen.getByTestId('pairing-card-aroma').textContent).toContain('green');
    expect(screen.getByTestId('pairing-card-taste').textContent).toContain('sweet');
    expect(screen.getByTestId('pairing-card-mouthfeel').textContent).toContain('fresh');
    const radar = screen.getByTestId('pairing-card-radar');
    expect(radar.getAttribute('data-filter-type')).toBe('taste');
    expect(radar.getAttribute('data-chosen-axis')).toBe('sweet');
    // Polygon renders for every node; sweet wedge gets a cone too.
    expect(screen.getByTestId('pairing-card-radar-polygon')).toBeInTheDocument();
    expect(screen.queryByTestId('pairing-card-cone-sweet')).toBeInTheDocument();
  });

  it('renders empty placeholder when node is missing', () => {
    render(<PairingModeCard node={null} />);
    expect(screen.getByTestId('pairing-card-empty')).toBeInTheDocument();
  });
});

describe('PairingMode container', () => {
  it('renders the strongest pairing as the top card', () => {
    render(<PairingMode focal="tomato" ctx={buildCtx()} onExit={() => {}} />);
    const top = screen.getByTestId('pairing-card-top').querySelector('[data-testid=pairing-card]');
    expect(top.getAttribute('data-ingredient')).toBe('basil');
  });

  it('back button calls onExit', () => {
    const onExit = vi.fn();
    render(<PairingMode focal="tomato" ctx={buildCtx()} onExit={onExit} />);
    fireEvent.click(screen.getByTestId('pairing-mode-back'));
    expect(onExit).toHaveBeenCalled();
  });

  it('left button advances to next pairing (basil → garlic by strength desc)', () => {
    render(<PairingMode focal="tomato" ctx={buildCtx()} onExit={() => {}} />);
    expect(screen.getByTestId('pairing-card-top').querySelector('[data-testid=pairing-card]').getAttribute('data-ingredient')).toBe('basil');
    fireEvent.click(screen.getByTestId('pairing-mode-left'));
    expect(screen.getByTestId('pairing-card-top').querySelector('[data-testid=pairing-card]').getAttribute('data-ingredient')).toBe('garlic');
  });

  it('right button rotates spoke within current radar', () => {
    render(<PairingMode focal="tomato" ctx={buildCtx()} onExit={() => {}} />);
    const root = screen.getByTestId('pairing-mode');
    expect(root.getAttribute('data-chosen-axis')).toBe('');
    fireEvent.click(screen.getByTestId('pairing-mode-right'));
    // First rotation: chosenAxis = first axis in taste = 'sweet'
    expect(root.getAttribute('data-chosen-axis')).toBe('sweet');
    fireEvent.click(screen.getByTestId('pairing-mode-right'));
    expect(root.getAttribute('data-chosen-axis')).toBe('sour');
  });

  it('up/down buttons cycle filter category and reset chosenAxis', () => {
    render(<PairingMode focal="tomato" ctx={buildCtx()} onExit={() => {}} />);
    fireEvent.click(screen.getByTestId('pairing-mode-right'));
    expect(screen.getByTestId('pairing-mode').getAttribute('data-chosen-axis')).toBe('sweet');
    fireEvent.click(screen.getByTestId('pairing-mode-up'));
    const root = screen.getByTestId('pairing-mode');
    expect(root.getAttribute('data-filter-type')).toBe('aroma');
    expect(root.getAttribute('data-chosen-axis')).toBe('');
  });

  it('rebuilds stack when chosenAxis filters out the current card', () => {
    render(<PairingMode focal="tomato" ctx={buildCtx()} onExit={() => {}} />);
    // Default: all 3 pairings visible
    expect(screen.getByTestId('pairing-mode').getAttribute('data-stack-size')).toBe('3');
    // Rotate spoke: 'sweet' selected. basil has taste='sweet'; garlic/lemon don't.
    fireEvent.click(screen.getByTestId('pairing-mode-right'));
    expect(screen.getByTestId('pairing-mode').getAttribute('data-stack-size')).toBe('1');
    expect(screen.getByTestId('pairing-card-top').querySelector('[data-testid=pairing-card]').getAttribute('data-ingredient')).toBe('basil');
  });

  it('escape key calls onExit', () => {
    const onExit = vi.fn();
    render(<PairingMode focal="tomato" ctx={buildCtx()} onExit={onExit} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExit).toHaveBeenCalled();
  });

  it('renders empty state when no pairings match', () => {
    render(
      <PairingMode
        focal="tomato"
        ctx={{ graph: { nodes: buildCtx().graph.nodes, edges: [] } }}
        onExit={() => {}}
      />,
    );
    expect(screen.getByTestId('pairing-mode-empty')).toBeInTheDocument();
  });

  it('progress counter advances on left button', () => {
    render(<PairingMode focal="tomato" ctx={buildCtx()} onExit={() => {}} />);
    expect(screen.getByTestId('pairing-mode-progress').textContent).toBe('1/3');
    fireEvent.click(screen.getByTestId('pairing-mode-left'));
    expect(screen.getByTestId('pairing-mode-progress').textContent).toBe('2/3');
  });
});
