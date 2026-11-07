// STORIES-1 — checks over the shipped public/data/dish_stories.json.
//   (b) every shipped photo has a free licence and a recorded artist
//   (c) no disambiguation or non-food pages
// plus shape, size and key integrity against the source datasets.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { isFreeLicense, isFoodPage } from '../dishStoryMatch.js';
import { SEED_RECIPES } from '../seedRecipes.js';

const ROOT = path.resolve(__dirname, '../../..');
const FILE = path.join(ROOT, 'public/data/dish_stories.json');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const KINDS = ['recipes', 'sauces', 'cocktails', 'wines'];
const all = KINDS.flatMap((k) => Object.entries(data[k] || {}).map(([key, e]) => ({ kind: k, key, e })));

describe('dish_stories.json', () => {
  it('has the four buckets, a _meta block and stays under 1 MB', () => {
    for (const k of KINDS) expect(typeof data[k]).toBe('object');
    expect(data._meta.textLicense).toMatch(/CC BY-SA 4\.0/);
    expect(data._meta.counts.recipes.items).toBe(SEED_RECIPES.length);
    expect(fs.statSync(FILE).size).toBeLessThan(1024 * 1024);
  });

  it('every key belongs to a real recipe / sauce / cocktail / wine', () => {
    const ids = {
      recipes: new Set(SEED_RECIPES.map((r) => r.id)),
      sauces: new Set(read('public/data/sauce_augment.json').sauces.map((s) => s.name)),
      cocktails: new Set(read('public/data/cocktail_codex_v2.json').cocktails.map((c) => c.name)),
      wines: new Set(read('public/data/wine_styles.json').wines.map((w) => w.id)),
    };
    for (const { kind, key } of all) expect(ids[kind].has(key), `${kind}/${key}`).toBe(true);
  });

  it('every story is 1–2 short sentences linking an English Wikipedia article', () => {
    for (const { kind, key, e } of all) {
      const where = `${kind}/${key}`;
      expect(e.text.length, where).toBeGreaterThan(20);
      expect(e.text.length, where).toBeLessThanOrEqual(300);
      expect(e.url, where).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//);
    }
  });

  it('(b) 100% of shipped photos: free licence, artist recorded, Commons-hosted', () => {
    const photos = all.filter(({ e }) => e.photo);
    expect(photos.length).toBeGreaterThan(0);
    for (const { kind, key, e: { photo } } of photos) {
      const where = `${kind}/${key}`;
      expect(isFreeLicense(photo.license), `${where}: ${photo.license}`).toBe(true);
      expect(photo.artist && photo.artist.trim().length, where).toBeGreaterThan(0);
      expect(photo.artist, where).not.toMatch(/[<>]/);
      expect(photo.src, where).toMatch(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//);
      // small originals (≤ the 500px bucket) are served as-is; never a large original
      expect(photo.w, where).toBeLessThanOrEqual(500);
      expect(photo.page, where).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(photo.w, where).toBeGreaterThan(0);
      expect(photo.h, where).toBeGreaterThan(0);
    }
  });

  it('(c) no disambiguation or non-food pages', () => {
    for (const { kind, key, e } of all) {
      const where = `${kind}/${key} → ${e.title} «${e.desc}»`;
      expect(e.title, where).not.toMatch(/disambiguation/i);
      expect(e.desc || '', where).not.toMatch(/topics referred to by the same term|may refer to/i);
      expect(e.text, where).not.toMatch(/may refer to/i);
      expect(isFoodPage({ description: e.desc, extract: e.text }), where).toBe(true);
    }
  });
});
