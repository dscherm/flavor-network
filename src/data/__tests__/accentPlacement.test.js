import { describe, it, expect } from 'vitest';
import {
  categorySignal,
  computeIneligibleRings,
  distinctiveRing,
  lineThickness,
  activatedAromas,
  computeAccentPlacement,
} from '../accentPlacement.js';

function mkNode(over = {}) {
  return {
    name: 'unnamed',
    taste: '',
    season: '',
    cuisines: [],
    gnnProbs: null,
    ...over,
  };
}

function gnnAroma(values) {
  // values keyed by short aroma key
  const out = {};
  for (const [k, v] of Object.entries(values)) {
    out[`odor_${k}`] = v;
  }
  return out;
}

describe('accentPlacement', () => {
  describe('categorySignal', () => {
    it('extracts taste tokens from taste string', () => {
      const node = mkNode({ taste: 'sweet sour bitter' });
      const set = categorySignal(node, 'taste');
      expect(set.has('sweet')).toBe(true);
      expect(set.has('sour')).toBe(true);
      expect(set.has('bitter')).toBe(true);
      expect(set.has('umami')).toBe(false);
    });

    it('extracts cuisines from array', () => {
      const node = mkNode({ cuisines: ['French', 'Italian'] });
      const set = categorySignal(node, 'cuisine');
      expect(set.has('french')).toBe(true);
      expect(set.has('italian')).toBe(true);
    });

    it('returns empty set for missing data', () => {
      const node = mkNode();
      expect(categorySignal(node, 'taste').size).toBe(0);
      expect(categorySignal(node, 'season').size).toBe(0);
      expect(categorySignal(node, 'cuisine').size).toBe(0);
    });
  });

  describe('computeIneligibleRings', () => {
    it('returns all 4 rings when focal has zero metadata', () => {
      const focal = mkNode({ name: 'mystery' });
      const ineligible = computeIneligibleRings(focal);
      expect(ineligible.has('taste')).toBe(true);
      expect(ineligible.has('season')).toBe(true);
      expect(ineligible.has('cuisine')).toBe(true);
      expect(ineligible.has('method')).toBe(true);
    });

    it('returns only empty axes — taste populated → taste eligible', () => {
      const focal = mkNode({ name: 'salt', taste: 'salty' });
      const ineligible = computeIneligibleRings(focal);
      expect(ineligible.has('taste')).toBe(false);
      expect(ineligible.has('cuisine')).toBe(true);
    });

    it('iter-2 fix: salt focal with cuisines=[] excludes cuisine ring', () => {
      const focal = mkNode({ name: 'salt', taste: 'salty', cuisines: [] });
      const ineligible = computeIneligibleRings(focal);
      expect(ineligible.has('cuisine')).toBe(true);
    });
  });

  describe('distinctiveRing', () => {
    it('picks max-gain ring', () => {
      const focal = mkNode({ taste: 'salty', cuisines: ['british'] });
      const neighbor = mkNode({ taste: 'salty', cuisines: ['british', 'french', 'italian'] });
      // Cuisine gains 2 (french, italian); taste gains 0; result: cuisine
      expect(distinctiveRing(neighbor, focal, { ineligibleRings: new Set() })).toBe('cuisine');
    });

    it('honors taste > cuisine tiebreaker', () => {
      const focal = mkNode({ taste: '', cuisines: [] });
      const neighbor = mkNode({ taste: 'sweet', cuisines: ['french'] });
      // Both rings would gain 1 — but cuisine is ineligible (focal=[])
      // and taste is also ineligible. So argmax falls back to season/method (also ineligible)
      // and returns null.
      expect(distinctiveRing(neighbor, focal, {
        ineligibleRings: new Set(['taste', 'cuisine', 'season', 'method']),
      })).toBeNull();
    });

    it('iter-2: focal=salt (empty cuisines, 2 tastes) vs neighbor (4 cuisines, 1 taste-overlap) → taste wins', () => {
      const focal = mkNode({ name: 'salt', taste: 'salty pungent' });
      const neighbor = mkNode({
        name: 'soy sauce',
        taste: 'salty umami',
        cuisines: ['chinese', 'japanese', 'korean', 'vietnamese'],
      });
      // Cuisine is INELIGIBLE because focal has zero cuisines.
      // Taste: neighbor has {salty, umami}, focal has {salty, pungent}.
      //        Gain = umami → 1.
      // Season + method: both ineligible (focal empty).
      const ineligible = computeIneligibleRings(focal);
      expect(distinctiveRing(neighbor, focal, { ineligibleRings: ineligible })).toBe('taste');
    });

    it('returns null when no positive gain anywhere', () => {
      const focal = mkNode({ taste: 'sweet sour', cuisines: ['french'] });
      const neighbor = mkNode({ taste: 'sweet sour', cuisines: ['french'] });
      const ineligible = computeIneligibleRings(focal);
      expect(distinctiveRing(neighbor, focal, { ineligibleRings: ineligible })).toBeNull();
    });
  });

  describe('lineThickness', () => {
    it('returns 1 when only distinctive ring contributes', () => {
      const focal = mkNode({ taste: 'sweet', cuisines: ['french'], season: 'fall', name: 'apple' });
      const neighbor = mkNode({ taste: 'sweet', cuisines: ['french'], season: 'fall', name: 'apple-twin' });
      expect(lineThickness(neighbor, focal, 'taste', { ineligibleRings: new Set() })).toBe(1);
    });

    it('returns 4 when all 4 categories contribute (desktop)', () => {
      const focal = mkNode({ name: 'apple' });
      const neighbor = mkNode({
        name: 'roasted lamb',
        taste: 'umami',
        cuisines: ['mediterranean'],
        season: 'fall',
      });
      // method via dominantMethodFor → 'roast' for protein
      const ineligibleRings = new Set();
      // Apple's focal is empty → focal-empty gives gain=N for every ring,
      // so all 4 contribute when ineligibleRings is empty.
      expect(lineThickness(neighbor, focal, 'taste', { ineligibleRings })).toBe(4);
    });
  });

  describe('activatedAromas', () => {
    it('returns only keys above per-axis threshold', () => {
      const focal = mkNode({
        gnnProbs: gnnAroma({ fruity: 0.8, floral: 0.1, green: 0.6, woody: 0.3, spicy: 0.05, fatty: 0.9 }),
      });
      const thresholds = { fruity: 0.55, floral: 0.55, green: 0.50, woody: 0.45, spicy: 0.65, creamy: 0.70 };
      const set = activatedAromas(focal, thresholds);
      expect(set.has('fruity')).toBe(true);
      expect(set.has('green')).toBe(true);
      expect(set.has('creamy')).toBe(true);
      expect(set.has('floral')).toBe(false);
      expect(set.has('spicy')).toBe(false);
    });

    it('returns empty set when focal has no GNN', () => {
      const focal = mkNode();
      expect(activatedAromas(focal, {}).size).toBe(0);
    });

    it('falls back to 0.30 default when threshold missing for an axis', () => {
      const focal = mkNode({
        gnnProbs: gnnAroma({ fruity: 0.35, floral: 0.20 }),
      });
      const set = activatedAromas(focal, {});
      expect(set.has('fruity')).toBe(true);   // 0.35 >= 0.30
      expect(set.has('floral')).toBe(false);  // 0.20 < 0.30
    });
  });

  describe('computeAccentPlacement (end-to-end)', () => {
    function mkGraphNodes(spec) {
      const m = new Map();
      for (const [name, over] of Object.entries(spec)) {
        m.set(name, mkNode({ name, ...over }));
      }
      return m;
    }

    it('drops neighbors with no GNN probs and counts them', () => {
      const focal = mkNode({ name: 'apple', gnnProbs: gnnAroma({ fruity: 0.9 }) });
      const nodes = mkGraphNodes({
        cinnamon: { gnnProbs: gnnAroma({ spicy: 0.8 }) },
        'mystery-thing': {},  // no GNN
      });
      const neighbors = [
        { name: 'cinnamon', strength: 0.7 },
        { name: 'mystery-thing', strength: 0.5 },
      ];
      const r = computeAccentPlacement(focal, neighbors, nodes);
      expect(r.cells.length).toBe(1);
      expect(r.cells[0].ingredientName).toBe('cinnamon');
      expect(r.dropped).toBe(1);
    });

    it('honors perCellCap=4 and records overflow', () => {
      const focal = mkNode({ name: 'apple', gnnProbs: gnnAroma({ fruity: 0.9 }) });
      const spec = {};
      const neighbors = [];
      for (let i = 0; i < 6; i++) {
        spec[`f${i}`] = { gnnProbs: gnnAroma({ fruity: 0.8 }), taste: 'sweet' };
        neighbors.push({ name: `f${i}`, strength: 0.7 - i * 0.05 });
      }
      const r = computeAccentPlacement(focal, neighbors, mkGraphNodes(spec));
      // All 6 fall into (fruity, taste) → cap at 4 + overflow=2 on last taken
      const cellsInGroup = r.cells.filter((c) => c.sector === 'fruity' && c.ring === 'taste');
      expect(cellsInGroup.length).toBe(4);
      const last = cellsInGroup[cellsInGroup.length - 1];
      expect(last.overflow).toBe(2);
    });

    it('iter-2 fix: salt focal (empty cuisines) → cuisine ring inert; neighbors land elsewhere', () => {
      const focal = mkNode({
        name: 'salt',
        taste: 'salty',
        gnnProbs: gnnAroma({ fatty: 0.7 }),
      });
      const nodes = mkGraphNodes({
        'soy sauce': {
          taste: 'salty umami',
          cuisines: ['chinese', 'japanese', 'korean', 'vietnamese'],
          gnnProbs: gnnAroma({ fatty: 0.6 }),
        },
      });
      const r = computeAccentPlacement(focal, [{ name: 'soy sauce', strength: 0.9 }], nodes);
      // Cuisine ineligible. Soy sauce has umami beyond salt's salty → taste ring.
      expect(r.cells.length).toBe(1);
      expect(r.cells[0].ring).toBe('taste');
      expect(r.cells[0].ingredientName).toBe('soy sauce');
      expect(r.ineligibleRings.has('cuisine')).toBe(true);
    });

    it('fallback flag set when all rings ineligible', () => {
      const focal = mkNode({ name: 'mystery', gnnProbs: gnnAroma({ fruity: 0.9 }) });
      const nodes = mkGraphNodes({
        cinnamon: { gnnProbs: gnnAroma({ fruity: 0.7 }) },
      });
      const r = computeAccentPlacement(focal, [{ name: 'cinnamon', strength: 0.5 }], nodes);
      expect(r.cells.length).toBe(1);
      expect(r.cells[0].fallback).toBe(true);
      expect(r.cells[0].thickness).toBe(1);
    });

    it('mobile mode drops method ring from eligibility', () => {
      const focal = mkNode({ name: 'apple', taste: 'sweet', cuisines: ['british'], gnnProbs: gnnAroma({ fruity: 0.9 }) });
      const r = computeAccentPlacement(focal, [], new Map(), { isMobile: true });
      expect(r.ineligibleRings.has('method')).toBe(true);
    });

    it('iter-2 fix: compact=true produces ≤3 cells per sector under single ring "compact"', () => {
      const focal = mkNode({ name: 'apple', taste: 'sweet', gnnProbs: gnnAroma({ fruity: 0.9 }) });
      const spec = {};
      const neighbors = [];
      for (let i = 0; i < 8; i++) {
        spec[`f${i}`] = { gnnProbs: gnnAroma({ fruity: 0.8 }), taste: 'sour' };
        neighbors.push({ name: `f${i}`, strength: 0.7 - i * 0.05 });
      }
      const r = computeAccentPlacement(focal, neighbors, mkGraphNodes(spec), { compact: true });
      const fruitySector = r.cells.filter((c) => c.sector === 'fruity');
      expect(fruitySector.length).toBeLessThanOrEqual(3);
      // All cells in compact mode share ring='compact'
      for (const c of r.cells) {
        expect(c.ring).toBe('compact');
      }
    });
  });
});
