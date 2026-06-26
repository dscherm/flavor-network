import { describe, it, expect } from 'vitest';
import { sharedCompoundsFor, buildAnalysis, buildPairingCardProps } from '../pairingCardData.js';

const NODES = new Map([
  ['garlic', { name: 'garlic', taste: 'pungent', cuisines: ['Italian'], flavorGraph: { tier1: ['pungent'] }, gnnCompounds: { top_compounds: [{ name: 'allicin' }, { name: 'diallyl' }] } }],
  ['basil', { name: 'basil', taste: 'bitter', cuisines: ['Italian'], flavorGraph: { tier1: ['green'] }, gnnCompounds: { top_compounds: [{ name: 'allicin' }, { name: 'linalool' }] } }],
  ['lemon', { name: 'lemon', taste: 'sour', cuisines: ['Mediterranean'], flavorGraph: { tier1: ['citrus'] } }],
]);
const CTX = {
  graph: { nodes: NODES },
  bridgeCompoundIndex: new Map([['garlic|lemon', { bridges: [{ name: 'limonene' }] }]]),
  flavorBibleSet: new Set(['basil|garlic']),
};

describe('sharedCompoundsFor', () => {
  it('returns curated bridge compounds when present', () => {
    expect(sharedCompoundsFor('garlic', NODES.get('garlic'), 'lemon', NODES.get('lemon'), CTX)).toEqual(['limonene']);
  });
  it('falls back to the GNN top-5 compound intersection', () => {
    expect(sharedCompoundsFor('garlic', NODES.get('garlic'), 'basil', NODES.get('basil'), CTX)).toEqual(['allicin']);
  });
  it('is null when nothing shared / inputs missing', () => {
    expect(sharedCompoundsFor('garlic', NODES.get('garlic'), 'lemon', NODES.get('lemon'), { graph: { nodes: NODES } })).toBeNull(); // no bridge idx, lemon has no gnnCompounds
    expect(sharedCompoundsFor('', null, 'x', null, CTX)).toBeNull();
  });
});

describe('buildAnalysis', () => {
  it('describes a strong/classic pair anchored by shared compounds', () => {
    const a = buildAnalysis(NODES.get('garlic'), NODES.get('basil'), 0.9, ['allicin']);
    expect(a).toMatch(/garlic \+ basil is a classic pair, anchored by 1 shared aroma compound/);
  });
  it('returns null for missing inputs', () => {
    expect(buildAnalysis(null, NODES.get('basil'), 0.5, null)).toBeNull();
  });
});

describe('buildPairingCardProps', () => {
  it('builds full props for a center→partner pairing', () => {
    const p = buildPairingCardProps('garlic', 'basil', CTX, { strength: 0.9, lens: 'aroma' });
    expect(p.node).toBe(NODES.get('basil'));
    expect(p.filterType).toBe('aroma');
    expect(p.strength).toBe(0.9);
    expect(p.sharedCompounds).toEqual(['allicin']);
    expect(p.analysis).toMatch(/classic pair/);
    expect(p.fb).toBe(true); // basil|garlic in the flavor-bible set
  });

  it('builds a focus card (center === partner) with no pairing data', () => {
    const p = buildPairingCardProps('garlic', 'garlic', CTX, { lens: 'affinity' });
    expect(p.node).toBe(NODES.get('garlic'));
    expect(p.filterType).toBe('taste'); // affinity → taste radar
    expect(p.strength).toBeNull();
    expect(p.sharedCompounds).toBeNull();
    expect(p.analysis).toBeNull();
    expect(p.fb).toBe(false);
  });
});
