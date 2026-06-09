import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildVocabIndex, predictQuantity, predictBowlQuantities } from '../quantityModel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Synthetic artifact — deterministic, no dependency on the built data.
const artifact = {
  _meta: { minSamples: 5, global: { unit: 'each', qty: 1, grams: 120 } },
  model: {
    0: { unit: 'cup', qty: 1, grams: 240, n: 5000 },   // "flour"
    1: { unit: 'tsp', qty: 0.5, grams: 2.5, n: 800 },  // "vanilla"
    2: { unit: 'tbsp', qty: 2, grams: 28, n: 3 },      // "rareherb" — below minSamples
  },
};
const vocabIndex = buildVocabIndex(['flour', 'vanilla', 'rareherb']);

describe('quantityModel — predictQuantity', () => {
  it('returns the per-ingredient model prediction above the sample floor', () => {
    expect(predictQuantity('flour', { artifact, vocabIndex })).toEqual({ unit: 'cup', qty: 1, source: 'model' });
    expect(predictQuantity('Vanilla', { artifact, vocabIndex })).toEqual({ unit: 'tsp', qty: 0.5, source: 'model' });
  });

  it('falls back to the global prior below the sample floor', () => {
    // rareherb has n=3 < minSamples=5 → global.
    expect(predictQuantity('rareherb', { artifact, vocabIndex })).toEqual({ unit: 'each', qty: 1, source: 'global' });
  });

  it('falls back to the global prior for an unknown ingredient', () => {
    expect(predictQuantity('dragonfruit', { artifact, vocabIndex })).toEqual({ unit: 'each', qty: 1, source: 'global' });
  });

  it('returns null on bad input', () => {
    expect(predictQuantity('', { artifact, vocabIndex })).toBeNull();
    expect(predictQuantity('flour', null)).toBeNull();
  });
});

describe('quantityModel — predictBowlQuantities', () => {
  it('predicts each name in a bowl', () => {
    const out = predictBowlQuantities(['flour', 'vanilla', 'dragonfruit'], { artifact, vocabIndex });
    expect(out).toEqual([
      { name: 'flour', unit: 'cup', qty: 1, source: 'model' },
      { name: 'vanilla', unit: 'tsp', qty: 0.5, source: 'model' },
      { name: 'dragonfruit', unit: 'each', qty: 1, source: 'global' },
    ]);
  });
});

// Smoke test against the real artifact when it has been built (skipped in CI
// where the gitignored data isn't present).
describe('quantityModel — real FM-Q2 artifact (smoke)', () => {
  const modelPath = resolve(__dirname, '../../../flavor-gnn/data/quantity_model.json');
  const vocabPath = resolve(__dirname, '../../../flavor-gnn/data/vocab.json');
  const ready = existsSync(modelPath) && existsSync(vocabPath);
  it.runIf(ready)('predicts a {unit, qty} for a common ingredient', () => {
    const real = JSON.parse(readFileSync(modelPath, 'utf-8'));
    const vocab = JSON.parse(readFileSync(vocabPath, 'utf-8')).vocab;
    const idx = buildVocabIndex(vocab);
    const p = predictQuantity('butter', { artifact: real, vocabIndex: idx });
    expect(p).not.toBeNull();
    expect(typeof p.unit).toBe('string');
    expect(p.qty).toBeGreaterThan(0);
  });
});
