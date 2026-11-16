import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { buildTasteLabels } from '../../../scripts/buildTasteLabels.mjs';
import { loadFlavorNodes } from '../../../scripts/lib/flavorNodes.mjs';
import { measure, profileFor, validateTruth } from '../../../scripts/measureFlavorProfile.mjs';
import { resolveBuiltIn } from '../sharedRecipe.js';
import { SEED_RECIPES } from '../seedRecipes.js';
import { RECIPE_DETAILS } from '../seedRecipeDetails.js';
import { summarize } from '../flavorScore.js';
import { labelWeights } from '../flavorTaste.js';
import { buildFlavorProfile } from '../inventProfile.js';
import { resolveIngredientName } from '../recipePairingMatch.js';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';

const FILE = 'public/proDataset/taste_labels.json';
const truth = JSON.parse(readFileSync('data/flavor-truth.json', 'utf8'));
const codex = readCuratedCodex();
const sauces = JSON.parse(readFileSync('public/data/sauce_augment.json', 'utf8')).sauces;
const data = { cocktails: codex.cocktails, families: codex.families, sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };

describe('the shipped taste label file', () => {
  const text = readFileSync(FILE, 'utf8');
  const shipped = JSON.parse(text);

  it('is the curated labels as the build step writes them (regenerate with node scripts/buildTasteLabels.mjs)', () => {
    expect(shipped).toEqual(buildTasteLabels());
  });
  it('stays small: under 150 KB gzipped', () => {
    expect(gzipSync(text).length).toBeLessThan(150 * 1024);
  });
  it('uses only words the taste vocabulary knows', () => {
    const bad = Object.entries(shipped).filter(([, label]) => {
      const w = labelWeights(label);
      return !w.any || w.unknown.length > 0;
    });
    expect(bad.slice(0, 5)).toEqual([]);
  });
  it('parsley, thyme and cumin no longer chart heat; garlic, mustard and chilies still do', () => {
    for (const k of ['parsley', 'thyme', 'cumin', 'cinnamon', 'nutmeg', 'basil', 'paprika', 'turmeric']) {
      expect(labelWeights(shipped[k]).axes.heat, k).toBe(0);
    }
    for (const k of ['garlic', 'mustard', 'cayenne pepper', 'black pepper', 'ginger']) {
      expect(labelWeights(shipped[k]).axes.heat, k).toBeGreaterThan(0);
    }
  });
});

describe('the answer-key recipes charted from labels', () => {
  const nodes = loadFlavorNodes();
  it('at least 90% of their ingredients are counted for taste', () => {
    expect(validateTruth(truth)).toEqual([]);
    const { rows, missing } = measure(truth, data, nodes, profileFor);
    expect(missing).toEqual([]);
    expect(summarize(rows).countedPct).toBeGreaterThanOrEqual(90);
  });
  it('the top taste is an expected one for at least 70% of the 41 items', () => {
    const { rows } = measure(truth, data, nodes, profileFor);
    expect(summarize(rows).top1Pct).toBeGreaterThanOrEqual(70);
  });
  it('Negroni charts bitter and sweet, Daiquiri charts sweet and sour; a chili dish shows heat', () => {
    const names = new Set(nodes.keys());
    const chart = (kind, slug) => {
      const r = resolveBuiltIn(kind, slug, data);
      const keys = r.lines.map((l) => resolveIngredientName(l.label || l.key, names) || l.key);
      const amounts = Object.fromEntries(r.lines.map((l, i) => [keys[i], l.amount]));
      return buildFlavorProfile(keys, nodes, { amounts }).axes.filter((a) => !a.startsWith('odor_'));
    };
    expect(chart('cocktail', 'negroni').slice(0, 2).sort()).toEqual(['bitter', 'sweet']);
    expect(chart('cocktail', 'daiquiri').slice(0, 2).sort()).toEqual(['sour', 'sweet']);
    expect(chart('dish', 'mapo-tofu')).toContain('heat');
  });
});
