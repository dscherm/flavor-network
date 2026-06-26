// @vitest-environment jsdom
// Regression guard for PAIR-LAB-P3a: the Pairing Lab must wire bridge
// pairs (partners that also pair with each other) into PairingBoard.
// The P4 PairingLab rewrite silently dropped this prop; this test fails
// if it's dropped again. Mocks PairingBoard to capture its props.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

let boardProps = null;
vi.mock('../PairingBoard.jsx', () => ({
  default: (props) => { boardProps = props; return null; },
}));
// SearchBar/BottomSheet are inert here; keep them light.
vi.mock('../SearchBar.jsx', () => ({ default: () => null }));
vi.mock('../BottomSheet.jsx', () => ({ default: () => null }));

import PairingLab from '../PairingLab.jsx';

afterEach(() => { boardProps = null; cleanup(); });

const NODES = new Map([
  ['garlic', { name: 'garlic', taste: 'pungent' }],
  ['basil', { name: 'basil', taste: 'bitter' }],
  ['lemon', { name: 'lemon', taste: 'sour' }],
  ['thyme', { name: 'thyme', taste: 'bitter' }],
]);
const EDGES = [
  { source: 'garlic', target: 'basil', strength: 0.9 },
  { source: 'garlic', target: 'lemon', strength: 0.8 },
  { source: 'garlic', target: 'thyme', strength: 0.5 },
  { source: 'lemon', target: 'thyme', strength: 0.4 }, // lemon+thyme = a trio with garlic
];
const DATA = { graph: { nodes: NODES, edges: EDGES, ingredientList: [...NODES.keys()] } };

describe('PairingLab → PairingBoard bridge wiring', () => {
  it('passes computed bridge pairs to the board', () => {
    render(<PairingLab ctx={DATA} />);
    expect(Array.isArray(boardProps?.bridges)).toBe(true);
    expect(boardProps.bridges).toEqual([{ a: 'lemon', b: 'thyme' }]);
  });
});
