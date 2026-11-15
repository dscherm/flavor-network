// SHARE-4. The build-time share index covers every built-in recipe the /r/ page can open.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildShareIndex, describe as describeRecipe } from '../../../scripts/buildShareIndex.mjs';
import { slugFor, uniqueBySlug } from '../sharedRecipe.js';
import { SEED_RECIPES } from '../seedRecipes.js';

const ROOT = resolve(__dirname, '../../..');
const json = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));

describe('share index', () => {
  const index = buildShareIndex();
  const codex = json('public/data/cocktail_codex_v2.json');
  const sauces = json('public/data/sauce_augment.json').sauces;

  it('has an entry for every built-in cocktail, sauce and Cookbook dish', () => {
    for (const [kind, items] of [['cocktail', codex.cocktails], ['sauce', sauces], ['dish', SEED_RECIPES]]) {
      const unique = uniqueBySlug(kind, items);
      const keys = Object.keys(index).filter((k) => k.startsWith(`${kind}/`));
      expect(keys.length).toBe(unique.length);
      for (const it of unique) expect(index[`${kind}/${slugFor(kind, it)}`]).toBeTruthy();
    }
  });

  it('every entry has a name, a short description and its kind', () => {
    for (const [key, e] of Object.entries(index)) {
      expect(e.kind).toBe(key.split('/')[0]);
      expect(e.name).toBeTruthy();
      expect(e.description.length).toBeGreaterThan(10);
      expect(e.description.length).toBeLessThanOrEqual(160);
    }
  });

  it('the committed functions/src/share/share-index.json is up to date', () => {
    const committed = json('functions/src/share/share-index.json');
    expect(Object.keys(committed).sort()).toEqual(Object.keys(index).sort());
    expect(committed['cocktail/negroni']).toEqual(index['cocktail/negroni']);
  });

  it('describe trims long ingredient lists to the limit', () => {
    const lines = Array.from({ length: 6 }, (_, i) => ({ key: `very long ingredient name number ${i} `.repeat(3) }));
    expect(describeRecipe('sauce', lines).length).toBeLessThanOrEqual(160);
    expect(describeRecipe('sauce', [])).toBe('A sauce on Neural Flavor.');
  });
});
