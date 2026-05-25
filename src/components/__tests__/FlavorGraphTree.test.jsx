import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FlavorGraphTree from '../FlavorGraphTree.jsx';

function mkNode(overrides = {}) {
  return {
    name: 'parsley',
    flavorGraph: {
      tier1: ['green'],
      tier2: ['bitter'],
      tier3: ['fresh'],
      leaves: ['phenolic', 'herbal', 'leafy'],
      source: 'chef',
      ...overrides.flavorGraph,
    },
    ...overrides,
  };
}

describe('FlavorGraphTree', () => {
  it('renders one chip per tier1/tier2/tier3 + each leaf', () => {
    render(<FlavorGraphTree node={mkNode()} />);
    expect(screen.getByText('green')).toBeTruthy();
    expect(screen.getByText('bitter')).toBeTruthy();
    expect(screen.getByText('fresh')).toBeTruthy();
    expect(screen.getByText('phenolic')).toBeTruthy();
    expect(screen.getByText('herbal')).toBeTruthy();
    expect(screen.getByText('leafy')).toBeTruthy();
  });

  it('renders the chef-curated footer when source === "chef"', () => {
    render(<FlavorGraphTree node={mkNode()} />);
    expect(screen.getByText(/Chef-curated/)).toBeTruthy();
  });

  it('renders nothing when node has no flavorGraph (long-tail case)', () => {
    const { container } = render(<FlavorGraphTree node={{ name: 'banana', flavorGraph: null }} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when all tier arrays + leaves are empty', () => {
    const { container } = render(
      <FlavorGraphTree node={mkNode({ flavorGraph: { tier1: [], tier2: [], tier3: [], leaves: [] } })} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders TierBadge on both chips when a term appears at both T2 and T3 (pungent dual-tier)', () => {
    render(
      <FlavorGraphTree node={mkNode({
        flavorGraph: {
          tier1: ['green'],
          tier2: ['pungent', 'bitter'],
          tier3: ['pungent', 'fresh'],
          leaves: [],
          source: 'chef',
        },
      })} />
    );
    expect(screen.getByLabelText('Tier-2 taste')).toBeTruthy();
    expect(screen.getByLabelText('Tier-3 mouthfeel')).toBeTruthy();
  });

  it('skips the chef footer when source is not "chef" (e.g. future GNN-derived path)', () => {
    render(<FlavorGraphTree node={mkNode({ flavorGraph: { ...mkNode().flavorGraph, source: 'gnn' } })} />);
    expect(screen.queryByText(/Chef-curated/)).toBeNull();
  });
});
