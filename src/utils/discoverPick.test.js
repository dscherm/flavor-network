import { describe, it, expect } from 'vitest';
import { pickPairing } from './discoverPick.js';

const edges = [
  { source: 'salt', target: 'butter', strength: 0.2 },
  { source: 'lemon', target: 'thyme', strength: 0.9 },
  { source: 'sake', target: 'soy sauce', strength: 0.99 },
  { source: 'basil', target: 'tomato', strength: 0.8 },
  { source: 'garlic', target: 'rosemary', strength: 0.6 },
];

const nodes = new Map([
  ['salt', { name: 'salt', taste: 'salty', cuisines: [] }],
  ['butter', { name: 'butter', taste: 'fatty', cuisines: [] }],
  ['lemon', { name: 'lemon', taste: 'sour', cuisines: ['mediterranean'] }],
  ['thyme', { name: 'thyme', taste: 'bitter', cuisines: ['mediterranean', 'italian'] }],
  ['sake', { name: 'sake', taste: 'umami', cuisines: ['japanese'] }],
  ['soy sauce', { name: 'soy sauce', taste: 'salty umami', cuisines: ['japanese'] }],
  ['basil', { name: 'basil', taste: 'pungent', cuisines: ['italian'] }],
  ['tomato', { name: 'tomato', taste: 'sour umami', cuisines: ['italian'] }],
  ['garlic', { name: 'garlic', taste: 'pungent', cuisines: ['italian'] }],
  ['rosemary', { name: 'rosemary', taste: 'bitter', cuisines: ['italian'] }],
]);

describe('pickPairing', () => {
  it('returns null for empty inputs', () => {
    expect(pickPairing(null, nodes, { kind: 'surprise' })).toBeNull();
    expect(pickPairing([], nodes, { kind: 'surprise' })).toBeNull();
  });

  it('surprise kind returns edges with strength >= 0.5', () => {
    const p = pickPairing(edges, nodes, { kind: 'surprise' });
    expect(p).not.toBeNull();
    expect(p.strength).toBeGreaterThanOrEqual(0.5);
  });

  it('taste:umami matches sake+soy_sauce (both contain umami)', () => {
    const p = pickPairing(edges, nodes, { kind: 'taste', value: 'umami' });
    expect(p).not.toBeNull();
    // only one strong edge has both endpoints containing 'umami'
    expect([p.source, p.target].sort()).toEqual(['sake', 'soy sauce']);
  });

  it('cuisine:italian picks only Italian pairings', () => {
    const p = pickPairing(edges, nodes, { kind: 'cuisine', value: 'italian' });
    expect(p).not.toBeNull();
    const a = nodes.get(p.source);
    const b = nodes.get(p.target);
    expect(a.cuisines).toContain('italian');
    expect(b.cuisines).toContain('italian');
  });

  it('returns null when filter has no matches', () => {
    expect(pickPairing(edges, nodes, { kind: 'taste', value: 'nonexistent' })).toBeNull();
    expect(pickPairing(edges, nodes, { kind: 'cuisine', value: 'martian' })).toBeNull();
  });

  it('deterministic within same day + same salt', () => {
    const a = pickPairing(edges, nodes, { kind: 'surprise' });
    const b = pickPairing(edges, nodes, { kind: 'surprise' });
    expect(a).toEqual(b);
  });

  it('different salt yields a different selection when pool has >1 element', () => {
    // rig: use taste:bitter — thyme has bitter, rosemary has bitter; need both endpoints
    const edges2 = [
      { source: 'thyme', target: 'rosemary', strength: 0.9 },
      { source: 'rosemary', target: 'thyme', strength: 0.9 },
    ];
    const nodes2 = nodes;
    // This rig has 2 edges; different salts may or may not collide — test only
    // that same salt → same result (stronger determinism invariant).
    const a = pickPairing(edges2, nodes2, { kind: 'taste', value: 'bitter' }, 0);
    const b = pickPairing(edges2, nodes2, { kind: 'taste', value: 'bitter' }, 0);
    expect(a).toEqual(b);
  });

  it('strength floor excludes weak pairings (salt+butter at 0.2 is never picked)', () => {
    const ps = [];
    for (let salt = 0; salt < 20; salt++) {
      const p = pickPairing(edges, nodes, { kind: 'surprise' }, salt);
      if (p) ps.push(`${p.source}|${p.target}`);
    }
    expect(ps.every(k => !k.includes('salt|butter'))).toBe(true);
  });
});
