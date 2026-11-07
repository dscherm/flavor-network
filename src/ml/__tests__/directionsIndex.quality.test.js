/**
 * WEAK-2 — the shipped directions index keeps the quality bars it was built
 * to (flavor-gnn/scripts/fm_dir1_build_index.mjs). Reads the real file.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  stepMentions, normalizeTitle, titleFoods, foodInNames, representableFoods,
} from '../directionsQuality.js';

const MODELS = path.resolve(__dirname, '..', '..', '..', 'public', 'models');
const index = JSON.parse(fs.readFileSync(path.join(MODELS, 'directions_index.json'), 'utf-8'));
const { vocab } = JSON.parse(fs.readFileSync(path.join(MODELS, 'recipe_vocab.json'), 'utf-8'));

describe('directions_index.json quality (WEAK-2)', () => {
  const recs = index.recipes;

  it('keeps the 40 000 cap, the format and the 25 MB limit', () => {
    expect(recs.length).toBeGreaterThan(30000);
    expect(recs.length).toBeLessThanOrEqual(40000);
    expect(fs.statSync(path.join(MODELS, 'directions_index.json')).size).toBeLessThanOrEqual(25 * 1024 * 1024);
    for (const r of recs.slice(0, 200)) {
      expect(Array.isArray(r.v) && r.v.length >= 3).toBe(true);
      expect(typeof r.t).toBe('string');
      expect(Array.isArray(r.d) && r.d.length > 0).toBe(true);
    }
    // The inverted index points back at entries holding that id.
    for (const [id, postings] of Object.entries(index.inv).slice(0, 50)) {
      for (const i of postings) expect(recs[i].v).toContain(Number(id));
    }
  });

  it('every entry\'s steps mention at least one of its listed ingredients', () => {
    const bad = recs.filter((r) => stepMentions(r.d, r.v.map((id) => vocab[id])).mentioned === 0);
    expect(bad.length).toBe(0);
  });

  it('no title names a representable headline food its list lacks', () => {
    const rep = representableFoods(vocab);
    const bad = recs.filter((r) => titleFoods(r.t).some((k) => rep.has(k) && !foodInNames(k, r.v.map((id) => vocab[id]))));
    expect(bad.length).toBe(0);
  });

  it('at most two entries per normalised title', () => {
    const count = new Map();
    for (const r of recs) count.set(normalizeTitle(r.t), (count.get(normalizeTitle(r.t)) || 0) + 1);
    expect(Math.max(...count.values())).toBeLessThanOrEqual(2);
    const repeats = recs.length - count.size;
    expect(repeats / recs.length).toBeLessThan(0.1);
  });
});
