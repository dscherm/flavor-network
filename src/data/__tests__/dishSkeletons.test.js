import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  DISH_SKELETON_ORDER, DISH_SKELETONS, DISH_MIN_DEGREE, dishSkeleton, slotAccepts, rankDishSlot, dishTypeForIngredients,
} from '../dishSkeletons.js';
import { DISH_TYPES } from '../dishType.js';
import { buildPairingIndex } from '../recipePairingMatch.js';
import { isBasicLike } from '../inventRecipe.js';
import { isBasic } from '../myKitchen.js';
import { seedBuild, fillRequired, buildKeys, missing } from '../inventBuild.js';

// The real ingredient graph and the real pairings (the index is built the way
// the app builds it: observed + predicted edges, source/target/strength).
const root = path.resolve(__dirname, '../../../public/proDataset');
const ingredients = JSON.parse(fs.readFileSync(path.join(root, 'ingredients.json'), 'utf8'));
const nodes = new Map(Object.entries(ingredients));
const pairings = JSON.parse(fs.readFileSync(path.join(root, 'pairings.json'), 'utf8'));
const pairingIndex = buildPairingIndex(
  pairings.map((e) => ({ source: e.ingredientA, target: e.ingredientB, strength: e.strength })),
  nodes.keys(),
);

const rankFn = (opts = {}) => (slot, currentKeys) => rankDishSlot({ slot, currentKeys, nodes, pairingIndex, ...opts });
const stirFry = () => dishSkeleton('stir-fry', { nodes });
const slotOf = (skeleton, id) => skeleton.slots.find((s) => s.id === id);
const SALT_OIL_WATER = /(^|\s)(salt|water)$|(^|\s)oils?(\s|$)/;

describe('the 8 dish skeletons', () => {
  it('are stir-fry, braise/stew, soup, salad, pasta, roast, tacos and grain bowl, in order', () => {
    expect(DISH_SKELETON_ORDER).toEqual(['stir-fry', 'braise-stew', 'soup', 'salad', 'pasta', 'roast', 'tacos', 'grain-bowl']);
    expect(Object.keys(DISH_SKELETONS).sort()).toEqual([...DISH_SKELETON_ORDER].sort());
  });

  it('carry a label, blurb, method and a DishArt type that exists', () => {
    for (const id of DISH_SKELETON_ORDER) {
      const d = DISH_SKELETONS[id];
      expect(d.id).toBe(id);
      expect(d.label.length).toBeGreaterThan(2);
      expect(d.blurb.length).toBeGreaterThan(10);
      expect(d.method.split(/[.!?]\s/).length).toBeGreaterThanOrEqual(2);
      expect(Object.keys(DISH_TYPES), `${id} → ${d.dishType}`).toContain(d.dishType);
    }
  });

  it('each have >= 2 required slots, and every slot accepts >= 5 ingredients in the real graph', () => {
    for (const id of DISH_SKELETON_ORDER) {
      const sk = dishSkeleton(id, { nodes });
      expect(sk.slots.filter((s) => s.required).length, id).toBeGreaterThanOrEqual(2);
      for (const slot of sk.slots) {
        const n = [...nodes.keys()].filter((k) => slot.accepts(k)).length;
        expect(n, `${id}/${slot.id}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('no slot accepts salt, oil or water (nor any graph ingredient named like them)', () => {
    const named = [...nodes.keys()].filter((k) => SALT_OIL_WATER.test(k) || /cooking spray/.test(k));
    expect(named.length).toBeGreaterThan(50);
    for (const id of DISH_SKELETON_ORDER) {
      const sk = dishSkeleton(id, { nodes });
      for (const slot of sk.slots) {
        for (const k of ['salt', 'sea salt', 'olive oil', 'vegetable oil', 'oil', 'water', ...named]) {
          expect(slot.accepts(k), `${id}/${slot.id} accepted ${k}`).toBe(false);
        }
      }
    }
  });

  it('an unknown type has no skeleton', () => {
    expect(dishSkeleton('souffle', { nodes })).toBeNull();
  });
});

describe('main slot', () => {
  it('takes tofu, chickpea, egg, mushroom and cauliflower, and proteins', () => {
    const main = slotOf(stirFry(), 'main');
    for (const k of ['tofu', 'chickpea', 'egg', 'mushroom', 'cauliflower', 'chicken', 'beef', 'shrimp', 'lentil', 'eggplant']) {
      expect(slotAccepts(main, k, nodes), k).toBe(true);
    }
  });
  it('does not take a sauce, a spice or a dessert', () => {
    const main = slotOf(stirFry(), 'main');
    for (const k of ['soy sauce', 'cumin', 'chocolate', 'lemon', 'rice']) expect(slotAccepts(main, k, nodes), k).toBe(false);
  });
  it('works for a typed name the graph has no node for', () => {
    expect(slotAccepts(slotOf(stirFry(), 'main'), 'firm tofu', null)).toBe(true);
    expect(slotAccepts(slotOf(stirFry(), 'main'), 'cremini mushrooms', null)).toBe(true);
  });
});

describe('stir-fry + chicken (real graph, real pairing index)', () => {
  const sk = stirFry();
  const seeded = seedBuild(sk, { lab: 'recipe', pinned: [{ key: 'chicken', source: 'user' }] });
  const filled = fillRequired(seeded, rankFn());

  it('puts chicken in main, locked', () => {
    const main = slotOf(filled, 'main');
    expect(main.line.key).toBe('chicken');
    expect(main.locked).toBe(true);
  });

  it('pre-fills vegetable, aromatic, sauce and starch with ordinary ingredients', () => {
    expect(missing(filled)).toEqual([]);
    for (const id of ['vegetable', 'aromatic', 'sauce', 'starch']) {
      const key = slotOf(filled, id).line.key;
      expect(slotOf(sk, id).accepts(key), `${id}: ${key}`).toBe(true);
      expect(isBasicLike(key) || isBasic(key), key).toBe(false);
      expect(pairingIndex.degree.get(key) || 0, key).toBeGreaterThanOrEqual(DISH_MIN_DEGREE);
    }
    expect(new Set(buildKeys(filled)).size).toBe(buildKeys(filled).length);
  });

  it('leaves optional slots empty', () => {
    for (const id of ['chili', 'herb', 'crunch']) expect(slotOf(filled, id).line).toBeNull();
  });
});

describe('every dish type pre-fills its required slots from the real graph', () => {
  const mains = { 'stir-fry': 'chicken', 'braise-stew': 'beef', soup: 'chickpea', salad: 'lettuce', pasta: 'shrimp', roast: 'pork', tacos: 'beef', 'grain-bowl': 'chickpea' };
  for (const id of DISH_SKELETON_ORDER) {
    it(id, () => {
      const sk = dishSkeleton(id, { nodes });
      const b = fillRequired(seedBuild(sk, { pinned: [{ key: mains[id], source: 'user' }] }), rankFn());
      expect(missing(b)).toEqual([]);
      for (const s of b.slots.filter((x) => x.required)) {
        expect(s.line, `${id}/${s.id}`).toBeTruthy();
        expect(s.accepts(s.line.key)).toBe(true);
      }
    });
  }
});

describe('rankDishSlot', () => {
  const slot = slotOf(stirFry(), 'vegetable');
  const base = { slot, currentKeys: ['chicken'], nodes, pairingIndex };

  it('without modelScores still returns a ranked list, best pairing first', () => {
    const r = rankDishSlot(base);
    expect(r.length).toBeGreaterThan(5);
    for (let i = 1; i < r.length; i++) expect(r[i - 1].score).toBeGreaterThanOrEqual(r[i].score);
    expect(r[0].score).toBeGreaterThan(r[r.length - 1].score);
    expect(r.every((c) => slot.accepts(c.key) && c.have === false)).toBe(true);
  });

  it('never offers basics, keys already in the build, or rare ingredients', () => {
    const r = rankDishSlot({ ...base, currentKeys: ['chicken', 'broccoli'] });
    expect(r.map((c) => c.key)).not.toContain('broccoli');
    for (const c of r) {
      expect(isBasicLike(c.key) || isBasic(c.key), c.key).toBe(false);
      expect(pairingIndex.degree.get(c.key) || 0, c.key).toBeGreaterThanOrEqual(DISH_MIN_DEGREE);
    }
    for (const id of DISH_SKELETON_ORDER) {
      for (const s of dishSkeleton(id, { nodes }).slots) {
        const keys = rankDishSlot({ slot: s, currentKeys: [], nodes, pairingIndex }).map((c) => c.key);
        for (const k of ['salt', 'water', 'olive oil', 'vegetable oil', 'oil', 'sugar', 'flour']) expect(keys).not.toContain(k);
        if (s.id !== 'fat' || id !== 'roast') for (const k of keys) expect(isBasic(k), `${id}/${s.id}: ${k}`).toBe(false);
      }
    }
  });

  it('puts kitchen items first, flagged have, even when a stranger pairs better', () => {
    const best = rankDishSlot(base)[0].key;
    const mine = rankDishSlot(base).slice(-2).map((c) => c.key);
    const r = rankDishSlot({ ...base, kitchen: mine });
    expect(r.slice(0, 2).map((c) => c.key).sort()).toEqual([...mine].sort());
    expect(r.slice(0, 2).every((c) => c.have)).toBe(true);
    expect(r.slice(2).every((c) => !c.have)).toBe(true);
    expect(r.map((c) => c.key)).toContain(best);
  });

  it('a kitchen item the slot rejects is not offered', () => {
    const r = rankDishSlot({ ...base, kitchen: ['chocolate', 'salt'] });
    expect(r.map((c) => c.key)).not.toContain('chocolate');
    expect(r.map((c) => c.key)).not.toContain('salt');
  });

  it('modelScores re-order but do not change who is eligible', () => {
    const plain = rankDishSlot(base);
    const last = plain[plain.length - 1].key;
    const withModel = rankDishSlot({ ...base, modelScores: new Map([[last, 0.99]]) });
    expect(withModel.map((c) => c.key).sort()).toEqual(plain.map((c) => c.key).sort());
    expect(withModel.findIndex((c) => c.key === last)).toBeLessThan(plain.length - 1);
  });

  it('reads a model score outside [0,1] as a logit', () => {
    const plain = rankDishSlot(base);
    const last = plain[plain.length - 1].key;
    const r = rankDishSlot({ ...base, modelScores: new Map([[last, 6]]) });
    expect(r.findIndex((c) => c.key === last)).toBeLessThan(plain.length - 1);
  });

  it('is deterministic and survives no pairing index / no currentKeys', () => {
    expect(rankDishSlot(base)).toEqual(rankDishSlot(base));
    const bare = rankDishSlot({ slot, nodes });
    expect(bare.length).toBeGreaterThan(5);
    expect(rankDishSlot({ slot, nodes: null })).toEqual([]);
    expect(rankDishSlot({})).toEqual([]);
  });
});

describe('cuisine only re-orders', () => {
  // The ingredients file carries no cuisines, so tag a few on a copy.
  const tagged = new Map(nodes);
  const r0 = rankDishSlot({ slot: slotOf(stirFry(), 'vegetable'), currentKeys: ['chicken'], nodes, pairingIndex });
  const lowKey = r0[r0.length - 1].key;
  tagged.set(lowKey, { ...nodes.get(lowKey), cuisines: ['Chinese'] });
  const slot = slotOf(stirFry(), 'vegetable');
  const run = (cuisine) => rankDishSlot({ slot, currentKeys: ['chicken'], nodes: tagged, pairingIndex, cuisine });

  it('changes the order but not the eligible set, and never empties it', () => {
    const none = run(null);
    const chinese = run('Chinese');
    expect(chinese.map((c) => c.key)).not.toEqual(none.map((c) => c.key));
    expect(chinese.map((c) => c.key).sort()).toEqual(none.map((c) => c.key).sort());
    const nowhere = run('Atlantis');
    expect(nowhere.length).toBe(none.length);
    expect(nowhere.map((c) => c.key)).toEqual(none.map((c) => c.key));
  });

  it('is a small nudge: the tagged ingredient moves up, the leader is not removed', () => {
    const none = run(null);
    const chinese = run('Chinese');
    expect(chinese.findIndex((c) => c.key === lowKey)).toBeLessThan(none.findIndex((c) => c.key === lowKey));
    expect(chinese.length).toBe(none.length);
  });

  it('does not replace a locked or user-set pick when the cuisine changes', () => {
    const sk = stirFry();
    const seeded = seedBuild(sk, { pinned: [{ key: 'chicken', source: 'user' }, { key: 'rice', source: 'user' }] });
    const a = fillRequired(seeded, rankFn({ cuisine: null }));
    const b = fillRequired(seeded, rankFn({ cuisine: 'Chinese' }));
    for (const id of ['main', 'starch']) {
      expect(slotOf(a, id).line.key).toBe(slotOf(b, id).line.key);
      expect(slotOf(b, id).locked).toBe(true);
    }
  });
});

describe('rankDishSlot with no slot ("goes with the list")', () => {
  const base = { slot: null, currentKeys: ['chicken'], nodes, pairingIndex };
  it('ranks the whole ordinary pool against the list, best pairing first, never basics or keys in the list', () => {
    const r = rankDishSlot(base);
    expect(r.length).toBeGreaterThan(100);
    for (let i = 1; i < r.length; i++) expect(r[i - 1].score).toBeGreaterThanOrEqual(r[i].score);
    expect(r.map((c) => c.key)).not.toContain('chicken');
    for (const c of r) expect(isBasicLike(c.key) || isBasic(c.key), c.key).toBe(false);
    // not limited to one part: it offers vegetables, sauces and starches alike
    const keys = new Set(r.slice(0, 400).map((c) => c.key));
    expect(['broccoli', 'rice', 'garlic'].some((k) => keys.has(k))).toBe(true);
  });
  it('puts the kitchen first and lets a model score lift a candidate', () => {
    const plain = rankDishSlot(base);
    const mine = plain.slice(-2).map((c) => c.key);
    const r = rankDishSlot({ ...base, kitchen: mine });
    expect(r.slice(0, 2).map((c) => c.key).sort()).toEqual([...mine].sort());
    expect(r[0].have).toBe(true);
    const last = plain[plain.length - 1].key;
    const lifted = rankDishSlot({ ...base, modelScores: new Map([[last, 0.99]]) });
    expect(lifted.findIndex((c) => c.key === last)).toBeLessThan(plain.length - 1);
  });
  it('still needs the graph, and works with no pairing index', () => {
    expect(rankDishSlot({ slot: null, nodes: null })).toEqual([]);
    expect(rankDishSlot({ slot: null, nodes }).length).toBeGreaterThan(5);
  });
});

describe('dishTypeForIngredients', () => {
  const t = (s) => dishTypeForIngredients(s.split(',').map((x) => x.trim()), { nodes });
  it('noodle, soy sauce, ginger, chicken → stir-fry', () => expect(t('noodle, soy sauce, ginger, chicken')).toBe('stir-fry'));
  it('tortilla, lime, pork → tacos', () => expect(t('tortilla, lime, pork')).toBe('tacos'));
  it('lettuce, vinegar, olive oil → salad', () => expect(t('lettuce, vinegar, olive oil')).toBe('salad'));
  it('spaghetti, tomato sauce, garlic → pasta', () => expect(t('spaghetti, tomato sauce, garlic')).toBe('pasta'));
  it('chicken stock, carrot, onion, chicken → soup', () => expect(t('chicken stock, carrot, onion, chicken')).toBe('soup'));
  it('falls back to the first type when nothing fits, and for an empty list', () => {
    expect(t('chocolate, vanilla')).toBe('stir-fry');
    expect(dishTypeForIngredients([], { nodes })).toBe('stir-fry');
  });
});

describe('rules', () => {
  it('a pasta dish has one pasta shape', () => {
    const sk = dishSkeleton('pasta', { nodes });
    const b = seedBuild(sk, { pinned: [{ key: 'spaghetti', source: 'user' }, { key: 'penne', source: 'user' }] });
    expect(b.rejected.map((r) => r.key)).toEqual(['penne']);
    expect(b.rejected[0].reason).toMatch(/one pasta shape/);
  });
  it('other dish types add no rules the dish does not need', () => {
    for (const id of DISH_SKELETON_ORDER.filter((x) => x !== 'pasta')) expect(dishSkeleton(id, { nodes }).rules).toEqual([]);
  });
});
