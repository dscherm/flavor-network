import { describe, it, expect } from 'vitest';
import { buildVocabIndex, buildRecipeInputs, rankLogits } from '../recipeRuntime.js';

const meta = {
  vocab: ['salt', 'garlic', 'onion', 'tomato', 'basil', 'sugar'],
  maxlen: 4,
  pad_id: 6, // == vocab length (the model's padding_idx)
  cuisine_vocab: ['Global', 'Italian', 'Asian'],
  cuisine_null: 3,
  season_vocab: ['summer', 'winter'],
  season_null: 2,
};
const vocabIndex = buildVocabIndex(meta.vocab);

describe('recipeRuntime — buildRecipeInputs', () => {
  it('maps observed names to ids, pads to maxlen, sets the mask', () => {
    const inp = buildRecipeInputs(['garlic', 'onion'], {}, meta, vocabIndex);
    expect(inp.observedIds).toEqual([1, 2]);
    expect(inp.obsIds).toEqual([1, 2, 6, 6]);   // padded with pad_id
    expect(inp.obsMask).toEqual([1, 1, 0, 0]);
  });

  it('resolves cuisine/season to ids, falling back to null indices', () => {
    const a = buildRecipeInputs(['garlic'], { cuisine: 'Italian', season: 'winter' }, meta, vocabIndex);
    expect(a.cuisine).toBe(1);
    expect(a.season).toBe(1);
    const b = buildRecipeInputs(['garlic'], {}, meta, vocabIndex);
    expect(b.cuisine).toBe(meta.cuisine_null);
    expect(b.season).toBe(meta.season_null);
    const c = buildRecipeInputs(['garlic'], { cuisine: 'Klingon' }, meta, vocabIndex);
    expect(c.cuisine).toBe(meta.cuisine_null); // unknown cuisine → null
  });

  it('uses a provided 11-D profile, else zeros', () => {
    const p = Array.from({ length: 11 }, (_, i) => i / 10);
    expect(buildRecipeInputs(['garlic'], { profile: p }, meta, vocabIndex).profile).toEqual(p);
    expect(buildRecipeInputs(['garlic'], { profile: [1, 2, 3] }, meta, vocabIndex).profile)
      .toEqual(new Array(11).fill(0)); // wrong length → zeros
    expect(buildRecipeInputs(['garlic'], {}, meta, vocabIndex).profile).toEqual(new Array(11).fill(0));
  });

  it('drops unknown ingredient names and truncates beyond maxlen', () => {
    const inp = buildRecipeInputs(['garlic', 'dragonfruit', 'onion', 'tomato', 'basil'], {}, meta, vocabIndex);
    expect(inp.observedIds).toEqual([1, 2, 3, 4]); // dragonfruit dropped
    expect(inp.obsMask).toEqual([1, 1, 1, 1]);     // all maxlen slots filled
  });
});

describe('recipeRuntime — rankLogits', () => {
  it('ranks by logit desc and excludes observed ids', () => {
    //            salt garlic onion tomato basil sugar
    const logits = [9, 1, 8, 2, 7, 3];
    const out = rankLogits(logits, meta.vocab, [0 /* salt */], 3);
    expect(out.map((r) => r.name)).toEqual(['onion', 'basil', 'sugar']); // salt excluded despite top logit
    expect(out[0].score).toBe(8);
  });
});
