import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NetworkA11yShim from '../NetworkA11yShim.jsx';

function makeData(nodes, edges = []) {
  return { graph: { nodes, edges } };
}

const fixtureNodes = [
  { name: 'garlic', pairingCount: 312 },
  { name: 'onion', pairingCount: 280 },
  { name: 'tomato', pairingCount: 250 },
  { name: 'butter', pairingCount: 220 },
  { name: 'salt', pairingCount: 180 },
];

describe('NetworkA11yShim', () => {
  it('renders a button per top-N node when nothing is selected', () => {
    render(<NetworkA11yShim data={makeData(fixtureNodes)} selectedNode={null} onNodeClick={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(fixtureNodes.length);
    expect(buttons[0]).toHaveTextContent('garlic');
    expect(buttons[0]).toHaveAttribute('aria-label', 'garlic, 312 pairings');
  });

  it('orders nodes by pairingCount descending', () => {
    const shuffled = [...fixtureNodes].sort(() => Math.random() - 0.5);
    render(<NetworkA11yShim data={makeData(shuffled)} selectedNode={null} onNodeClick={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    const labels = buttons.map((b) => b.textContent);
    expect(labels).toEqual(['garlic', 'onion', 'tomato', 'butter', 'salt']);
  });

  it('caps the unselected list at 50 nodes', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      name: `ing-${i}`,
      pairingCount: 1000 - i,
    }));
    render(<NetworkA11yShim data={makeData(many)} selectedNode={null} onNodeClick={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(50);
  });

  it('calls onNodeClick with the full node object when a button is clicked', () => {
    const onClick = vi.fn();
    render(<NetworkA11yShim data={makeData(fixtureNodes)} selectedNode={null} onNodeClick={onClick} />);
    fireEvent.click(screen.getByText('onion'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0]).toMatchObject({ name: 'onion', pairingCount: 280 });
  });

  it('switches to selected + pairings when a node is selected', () => {
    const edges = [
      { source: 'garlic', target: 'onion', strength: 0.9 },
      { source: 'garlic', target: 'tomato', strength: 0.7 },
      { source: 'butter', target: 'salt', strength: 0.4 }, // unrelated
    ];
    render(
      <NetworkA11yShim
        data={makeData(fixtureNodes, edges)}
        selectedNode="garlic"
        onNodeClick={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('garlic');
    const labels = buttons.map((b) => b.textContent);
    expect(labels).toContain('onion');
    expect(labels).toContain('tomato');
    expect(labels).not.toContain('salt');
  });

  it('marks the selected node aria-pressed=true and announces selection', () => {
    render(
      <NetworkA11yShim
        data={makeData(fixtureNodes, [])}
        selectedNode="garlic"
        onNodeClick={vi.fn()}
      />,
    );
    const garlicBtn = screen.getByText('garlic');
    expect(garlicBtn).toHaveAttribute('aria-pressed', 'true');
    expect(garlicBtn).toHaveAttribute('aria-label', 'garlic, 312 pairings, selected');
    expect(screen.getByRole('status')).toHaveTextContent('Selected: garlic');
  });

  it('renders nothing when data is missing', () => {
    const { container } = render(
      <NetworkA11yShim data={null} selectedNode={null} onNodeClick={vi.fn()} />,
    );
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('accepts a Map<name, node> for nodes (matches useProData runtime shape)', () => {
    const map = new Map(fixtureNodes.map((n) => [n.name, n]));
    render(
      <NetworkA11yShim
        data={{ graph: { nodes: map, edges: [] } }}
        selectedNode={null}
        onNodeClick={vi.fn()}
      />,
    );
    const labels = screen.getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(['garlic', 'onion', 'tomato', 'butter', 'salt']);
  });

  it('Map input + selectedNode resolves selection via Map.get()', () => {
    const map = new Map(fixtureNodes.map((n) => [n.name, n]));
    const edges = [
      { source: 'garlic', target: 'onion', strength: 0.9 },
      { source: 'tomato', target: 'garlic', strength: 0.6 },
    ];
    render(
      <NetworkA11yShim
        data={{ graph: { nodes: map, edges } }}
        selectedNode="garlic"
        onNodeClick={vi.fn()}
      />,
    );
    const labels = screen.getAllByRole('button').map((b) => b.textContent);
    expect(labels[0]).toBe('garlic');
    expect(labels).toContain('onion');
    expect(labels).toContain('tomato');
  });

  it('orders pairings by strength when a node is selected', () => {
    const edges = [
      { source: 'garlic', target: 'butter', strength: 0.3 },
      { source: 'garlic', target: 'onion', strength: 0.9 },
      { source: 'garlic', target: 'tomato', strength: 0.6 },
    ];
    render(
      <NetworkA11yShim
        data={makeData(fixtureNodes, edges)}
        selectedNode="garlic"
        onNodeClick={vi.fn()}
      />,
    );
    const labels = screen.getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(['garlic', 'onion', 'tomato', 'butter']);
  });
});
