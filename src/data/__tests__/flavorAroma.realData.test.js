import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { aromaBarsFor, validateAromaTruth, profileFor, measure } from '../../../scripts/measureFlavorProfile.mjs';
import { loadFlavorNodes } from '../../../scripts/lib/flavorNodes.mjs';
import { SEED_RECIPES } from '../seedRecipes.js';
import { RECIPE_DETAILS } from '../seedRecipeDetails.js';
import { scoreAroma, summarizeAroma, summarize } from '../flavorScore.js';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';

const truth = JSON.parse(readFileSync('data/aroma-truth.json', 'utf8'));
const mainTruth = JSON.parse(readFileSync('data/flavor-truth.json', 'utf8'));
const codex = readCuratedCodex();
const sauces = JSON.parse(readFileSync('public/data/sauce_augment.json', 'utf8')).sauces;
const data = { cocktails: codex.cocktails, families: codex.families, sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
const nodes = loadFlavorNodes();

const topAromas = (id, n = 2) => aromaBarsFor({ id }, data, nodes).bars
  .filter((b) => b.axis.startsWith('odor_') && b.score > 0).sort((a, b) => b.score - a.score).slice(0, n).map((b) => b.axis.slice(5));

describe('spot checks on real data', () => {
  it('mint leads green, lemon fruity, butter fatty, black pepper spicy, rose water floral', () => {
    expect(topAromas('ingredient/mint', 1)).toEqual(['green']);
    expect(topAromas('ingredient/lemon', 1)).toEqual(['fruity']);
    expect(topAromas('ingredient/butter', 1)).toEqual(['fatty']);
    expect(topAromas('ingredient/black pepper', 1)).toEqual(['spicy']);
    expect(topAromas('ingredient/rose water', 1)).toEqual(['floral']);
  });
  it('vanilla is woody (the sweet-woody decision), basil green, bourbon woody, cinnamon spicy', () => {
    expect(topAromas('ingredient/vanilla', 1)).toEqual(['woody']);
    expect(topAromas('ingredient/basil', 1)).toEqual(['green']);
    expect(topAromas('ingredient/bourbon', 1)).toEqual(['woody']);
    expect(topAromas('ingredient/cinnamon', 1)).toEqual(['spicy']);
  });
  it('a Mojito shows green and fruity; a Daiquiri fruity; an Old Fashioned woody', () => {
    expect([...topAromas('cocktail/mojito')].sort()).toEqual(['fruity', 'green']);
    expect(topAromas('cocktail/daiquiri', 1)).toEqual(['fruity']);
    expect(topAromas('cocktail/old-fashioned', 1)).toEqual(['woody']);
  });
  it('Pesto leads green, Hollandaise fatty, Salsa Verde green', () => {
    expect(topAromas('dish/pesto-genovese', 1)).toEqual(['green']);
    expect(topAromas('sauce/hollandaise', 1)).toEqual(['fatty']);
    expect(topAromas('sauce/salsa-verde', 1)).toEqual(['green']);
  });
});

describe('the aroma answer key', () => {
  it('is well formed, with 40 items of which exactly 10 are the hold-out', () => {
    expect(validateAromaTruth(truth)).toEqual([]);
    expect(truth.items.length).toBe(40);
    expect(truth.items.filter((i) => i.holdout).length).toBe(10);
    expect(truth.items.filter((i) => i.id.startsWith('ingredient/')).length).toBe(20);
    expect(truth._about).toMatch(/2026-11-16/);
  });
  const run = (set) => set.map((it) => {
    const r = aromaBarsFor(it, data, nodes);
    expect(r.found, it.id).toBe(true);
    return scoreAroma(r.bars, it);
  });
  it('tuning set: at least 85% as expected, no forbidden aroma leads, every item has an aroma chart', () => {
    const s = summarizeAroma(run(truth.items.filter((i) => !i.holdout)));
    expect(s.okPct).toBeGreaterThanOrEqual(85);
    expect(s.forbiddenLeads).toBe(0);
    expect(s.noChart).toBe(0);
  });
  it('hold-out: at least 70% as expected, no forbidden aroma leads', () => {
    const s = summarizeAroma(run(truth.items.filter((i) => i.holdout)));
    expect(s.okPct).toBeGreaterThanOrEqual(70);
    expect(s.forbiddenLeads).toBe(0);
    expect(s.noChart).toBe(0);
  });
  it('the main taste key still scores as after FLAVOR-4 and its four aroma expectations are met', () => {
    const { rows } = measure(mainTruth, data, nodes, profileFor);
    const s = summarize(rows);
    expect(s.top1).toBe(36);
    expect(s.forbiddenLeads).toBe(0);
    expect(s.aromaOk).toBe(4);
    expect(s.aromaOf).toBe(4);
  });
});
