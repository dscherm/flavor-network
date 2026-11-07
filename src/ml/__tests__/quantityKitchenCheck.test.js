/**
 * WEAK-4 — the shipped amount model, checked against a hand-written list of
 * common ingredients (kitchenQuantityCases.js) and for kitchen fractions.
 * Runs against public/models/quantity_model.json (tracked, always present).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildVocabIndex, predictQuantity } from '../quantityModel.js';
import { isKitchenQty } from '../kitchenUnits.js';
import { parseAmount } from '../../data/portionParser.js';
import { predictAmountFromCtx } from '../quantityRuntime.js';
import { KITCHEN_CASES, passesCase } from './kitchenQuantityCases.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const artifact = JSON.parse(readFileSync(resolve(__dirname, '../../../public/models/quantity_model.json'), 'utf-8'));
const vocab = JSON.parse(readFileSync(resolve(__dirname, '../../../public/models/recipe_vocab.json'), 'utf-8')).vocab;
const ctx = { artifact, vocabIndex: buildVocabIndex(vocab) };

describe('WEAK-4 kitchen check — common ingredients', () => {
  const results = KITCHEN_CASES.map((c) => ({ c, pred: predictQuantity(c.name, ctx) }));

  it.each(results.map((r) => [r.c.name, r]))('%s', (_name, { c, pred }) => {
    expect(pred?.source).toBe('model');
    if (!passesCase(c, pred)) {
      throw new Error(`${c.name}: got ${pred?.qty} ${pred?.unit}; want one of ${JSON.stringify(c.ok)}`);
    }
  });
});

describe('WEAK-4 kitchen check — every prediction', () => {
  it('no ingredient gets a non-kitchen quantity, and every raw string re-parses', () => {
    const bad = [];
    for (let id = 0; id < vocab.length; id++) {
      const pred = predictQuantity(vocab[id], ctx);
      if (!pred) continue;
      if (!isKitchenQty(pred.qty, pred.unit)) bad.push(`${vocab[id]}=${pred.qty} ${pred.unit}`);
      const amount = predictAmountFromCtx(vocab[id], ctx);
      const re = parseAmount(amount.raw);
      if (!re || re.unit !== pred.unit || Math.abs(re.qty - pred.qty) > 1e-6) bad.push(`raw:${amount.raw}`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('artifact stays about the size of the FM-Q2 original (190 KB)', () => {
    expect(JSON.stringify(artifact).length).toBeLessThan(260 * 1024);
  });
});
