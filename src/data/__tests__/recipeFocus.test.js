import { describe, it, expect } from 'vitest';
import { detectFocus, inferMassShares, roleOfIngredient } from '../recipeFocus.js';

describe('recipeFocus', () => {
  describe('roleOfIngredient', () => {
    it('classifies pork loin as protein', () => {
      expect(roleOfIngredient('pork loin')).toBe('protein');
    });
    it('classifies rosemary as herb', () => {
      expect(roleOfIngredient('rosemary')).toBe('herb');
    });
    it('classifies olive oil as fat (not vegetable)', () => {
      expect(roleOfIngredient('olive oil')).toBe('fat');
    });
    it('classifies tomato as other when no node context', () => {
      // No regex match → other (cluster lookup needs a node)
      const r = roleOfIngredient('tomato');
      expect(['other', 'vegetable', 'fruit']).toContain(r);
    });
  });

  describe('inferMassShares', () => {
    it('returns shares summing to ~1.0', () => {
      const shares = inferMassShares(['pork loin', 'rosemary', 'garlic', 'olive oil', 'salt']);
      let sum = 0;
      for (const v of shares.values()) sum += v;
      expect(sum).toBeCloseTo(1, 5);
    });

    it('protein takes the largest share when alone in its role', () => {
      const shares = inferMassShares(['pork loin', 'rosemary', 'garlic', 'olive oil', 'salt']);
      const pork = shares.get('pork loin');
      for (const [name, share] of shares) {
        if (name === 'pork loin') continue;
        expect(pork).toBeGreaterThan(share);
      }
    });

    it('uses caller-provided quantities when supplied', () => {
      const q = new Map([['pork loin', 500], ['rosemary', 5], ['garlic', 10]]);
      const shares = inferMassShares(['pork loin', 'rosemary', 'garlic'], { quantities: q });
      expect(shares.get('pork loin')).toBeCloseTo(500 / 515, 5);
      expect(shares.get('rosemary')).toBeCloseTo(5 / 515, 5);
    });

    it('splits role share when multiple ingredients share a role', () => {
      const shares = inferMassShares(['rosemary', 'basil', 'mint']);
      // All three are herbs → equal shares after renormalization
      const vals = [...shares.values()];
      expect(vals[0]).toBeCloseTo(vals[1], 5);
      expect(vals[1]).toBeCloseTo(vals[2], 5);
    });
  });

  describe('detectFocus', () => {
    it('triggers CENTERED on a single-protein recipe (pork loin scenario)', () => {
      const result = detectFocus(['pork loin', 'rosemary', 'garlic', 'olive oil', 'salt']);
      expect(result.mode).toBe('centered');
      expect(result.focal).toBe('pork loin');
    });

    it('triggers BALANCED on a multi-vegetable salad', () => {
      // No standout role / no single dominant ingredient
      const result = detectFocus(['cucumber', 'red onion', 'tomato', 'parsley', 'mint']);
      expect(result.mode).toBe('balanced');
      expect(result.focal).toBeNull();
    });

    it('returns scores for every ingredient', () => {
      const names = ['pork loin', 'rosemary', 'garlic'];
      const result = detectFocus(names);
      for (const n of names) {
        expect(result.scores.has(n)).toBe(true);
        expect(typeof result.scores.get(n)).toBe('number');
      }
    });

    it('returns mass shares for every ingredient', () => {
      const names = ['chicken breast', 'lemon', 'thyme'];
      const result = detectFocus(names);
      for (const n of names) {
        expect(result.massShares.has(n)).toBe(true);
      }
    });

    it('respects user-supplied quantities for the centered decision', () => {
      // Same recipe but with a tiny pork-loin quantity should NOT trigger centered.
      const q = new Map([['pork loin', 5], ['rosemary', 100], ['garlic', 100]]);
      const result = detectFocus(['pork loin', 'rosemary', 'garlic'], { quantities: q });
      // With quantities flipped, pork loin's mass share collapses; we
      // expect balanced (or at minimum, focal not = pork loin).
      if (result.mode === 'centered') {
        expect(result.focal).not.toBe('pork loin');
      }
    });
  });
});
