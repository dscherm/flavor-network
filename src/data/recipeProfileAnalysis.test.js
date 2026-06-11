import { describe, it, expect } from 'vitest';
import {
  recipeAxisProfile, axisInsight, profileDelta, topMovers, rankByAxisImpact, AXES, axisLabel,
} from './recipeProfileAnalysis.js';

function nodesFrom(map) {
  return new Map(Object.entries(map).map(([k, gnnProbs]) => [k, { gnnProbs }]));
}
const z = () => Object.fromEntries(AXES.map((a) => [a, 0]));
const probs = (o) => ({ ...z(), ...o });

describe('recipeAxisProfile', () => {
  it('averages per-axis and ranks drivers', () => {
    const nodes = nodesFrom({
      honey: probs({ sweet: 0.9 }),
      lemon: probs({ sour: 0.8, sweet: 0.1 }),
    });
    const { scores, drivers, n } = recipeAxisProfile(['honey', 'lemon'], nodes);
    expect(n).toBe(2);
    expect(scores.sweet).toBeCloseTo(0.5);
    expect(scores.sour).toBeCloseTo(0.4);
    expect(drivers.sweet[0]).toBe('honey'); // highest sweet
  });

  it('skips ingredients without probs', () => {
    const nodes = nodesFrom({ honey: probs({ sweet: 0.9 }) });
    const { n, scores } = recipeAxisProfile(['honey', 'mystery'], nodes);
    expect(n).toBe(1);
    expect(scores.sweet).toBeCloseTo(0.9);
  });
});

describe('axisInsight', () => {
  it('flags a dominant axis with its balancing axis', () => {
    expect(axisInsight('sweet', 0.7)).toMatch(/balance with sour/i);
  });
  it('calls a low axis faint', () => {
    expect(axisInsight('umami', 0.05)).toMatch(/faint/i);
  });
});

describe('profileDelta + topMovers', () => {
  it('computes the shift a candidate causes', () => {
    const scores = { ...z(), sweet: 0.2 };
    const nodes = nodesFrom({ fig: probs({ sweet: 0.8, odor_fruity: 0.4 }) });
    const d = profileDelta('fig', scores, 2, nodes); // /(n+1)=/3
    expect(d.sweet).toBeCloseTo((0.8 - 0.2) / 3);
    const movers = topMovers(d, 2).map((m) => m.axis);
    expect(movers).toContain('sweet');
  });
  it('returns null for unknown candidate', () => {
    expect(profileDelta('nope', z(), 1, nodesFrom({}))).toBeNull();
  });
});

describe('rankByAxisImpact', () => {
  const nodes = nodesFrom({
    fig: probs({ sweet: 0.9 }),
    date: probs({ sweet: 0.7 }),
    lemon: probs({ sour: 0.9 }),
  });
  const scores = { ...z(), sweet: 0.1 };

  it('boost ranks candidates by positive delta on the axis', () => {
    const r = rankByAxisImpact(['fig', 'date', 'lemon'], 'sweet', scores, 3, nodes, { mode: 'boost' });
    expect(r.map((x) => x.name)).toEqual(['fig', 'date']); // lemon adds no sweet
  });

  it('temper ranks by the balancing axis (sweet→sour)', () => {
    const r = rankByAxisImpact(['fig', 'lemon'], 'sweet', scores, 3, nodes, { mode: 'temper' });
    expect(r[0].name).toBe('lemon'); // raises sour, the balance for sweet
  });
});

describe('axisLabel', () => {
  it('uses chef aroma vocab (creamy for odor_fatty)', () => {
    expect(axisLabel('odor_fatty')).toBe('creamy');
    expect(axisLabel('sweet')).toBe('Sweet');
  });
});
