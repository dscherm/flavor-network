import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { AROMAS, AROMA_ALIASES, NOT_IN_GRAPH_AROMA, aromaFor, garnishAromaLines } from '../flavorAromas.js';
import { STRENGTHS, NOT_IN_GRAPH } from '../flavorStrengths.js';
import { loadCurationTables, applyCuration } from '../../../scripts/lib/curationTables.mjs';

const raw = JSON.parse(readFileSync('public/proDataset/ingredients.json', 'utf8'));
const GRAPH = new Set(Object.keys(applyCuration(raw, null, loadCurationTables()).ingredients).filter((k) => !k.startsWith('_')));
const AX = ['fruity', 'floral', 'green', 'woody', 'spicy', 'fatty'];

describe('the aroma table is well formed', () => {
  it('every line has a potency and only the six aromas on 0..3', () => {
    const bad = [];
    for (const [k, e] of Object.entries(AROMAS)) {
      if (typeof e.potency !== 'number' || e.potency < 0) bad.push(`${k}: potency`);
      for (const [a, v] of Object.entries(e)) {
        if (a === 'potency') continue;
        if (!AX.includes(a)) bad.push(`${k}: unknown key ${a}`);
        else if (typeof v !== 'number' || v <= 0 || v > 3) bad.push(`${k}: ${a}=${v} (omit zeros; max 3)`);
      }
      if (!AX.some((a) => e[a] > 0) && e.potency !== 0) bad.push(`${k}: no aroma, so write potency: 0`);
    }
    expect(bad).toEqual([]);
  });
  it('every name is an ingredient in the curated data (or is listed in NOT_IN_GRAPH_AROMA)', () => {
    expect(Object.keys(AROMAS).filter((k) => !GRAPH.has(k) && !NOT_IN_GRAPH_AROMA.includes(k))).toEqual([]);
  });
  it('NOT_IN_GRAPH_AROMA lists only names that are really missing from the graph, and each has a line', () => {
    expect(NOT_IN_GRAPH_AROMA.filter((k) => GRAPH.has(k))).toEqual([]);
    expect(NOT_IN_GRAPH_AROMA.filter((k) => !AROMAS[k])).toEqual([]);
  });
  it('every alias points at a line', () => {
    expect(Object.entries(AROMA_ALIASES).filter(([, to]) => !AROMAS[to])).toEqual([]);
  });
  it('covers every ingredient the strength table covers, plus the garnish and floral keys', () => {
    expect(Object.keys(STRENGTHS).filter((k) => !aromaFor(k))).toEqual([]);
    expect(NOT_IN_GRAPH.filter((k) => !aromaFor(k))).toEqual([]);
    for (const k of ['mint', 'lemon', 'lime', 'orange', 'basil', 'rosemary', 'lavender', 'rose water', 'nutmeg', 'cinnamon']) expect(aromaFor(k), k).toBeTruthy();
  });
  it('is a table of a believable size', () => {
    const n = Object.keys(AROMAS).length;
    expect(n).toBeGreaterThanOrEqual(250);
    expect(n).toBeLessThanOrEqual(450);
  });
  it('aromaFor returns six axes and a potency, and null for an unknown name', () => {
    const r = aromaFor('Mint');
    expect(Object.keys(r.axes)).toEqual(AX);
    expect(r.axes.green).toBe(3);
    expect(r.potency).toBeGreaterThan(5);
    expect(aromaFor('not an ingredient')).toBeNull();
    expect(aromaFor(undefined)).toBeNull();
  });
  it('the potent things are potent and the bulk things are not', () => {
    const p = (k) => aromaFor(k).potency;
    for (const k of ['mint', 'clove', 'vanilla', 'rose water', 'saffron', 'truffle']) expect(p(k), k).toBeGreaterThanOrEqual(6);
    for (const k of ['gin', 'rum', 'bourbon', 'milk', 'white wine']) expect(p(k), k).toBeLessThan(1);
    for (const k of ['water', 'sugar', 'salt', 'flour', 'vodka', 'soda water']) expect(p(k), k).toBe(0);
  });
  it('vanilla is woody (the sweet-woody decision), mint green, chili heat is not the spicy aroma of a chili', () => {
    const top = (k) => Object.entries(aromaFor(k).axes).sort((a, b) => b[1] - a[1])[0][0];
    expect(top('vanilla')).toBe('woody');
    expect(top('mint')).toBe('green');
    expect(top('chili')).not.toBe('spicy');
  });
});

describe('garnishAromaLines', () => {
  const keys = (t) => Object.fromEntries(garnishAromaLines(t).map((l) => [l.key, l.amount]));
  it('a citrus twist, peel or zest counts 2 g of that fruit; a wedge or wheel 1 g', () => {
    expect(keys('1 lemon twist')).toEqual({ lemon: 2 });
    expect(keys('Orange peel')).toEqual({ orange: 2 });
    expect(keys('orange zest')).toEqual({ orange: 2 });
    expect(keys('Lime wedge')).toEqual({ lime: 1 });
    expect(keys('1 orange half wheel')).toEqual({ orange: 1 });
    expect(keys('orange and lemon twists')).toEqual({ orange: 2, lemon: 2 });
  });
  it('mint, herbs, nutmeg, cinnamon and coffee beans count; other garnish adds nothing', () => {
    expect(keys('mint sprig and cucumber wheel')).toEqual({ mint: 2 });
    expect(keys('1 mint bouquet')).toEqual({ mint: 2 });
    expect(keys('rosemary sprig')).toEqual({ rosemary: 2 });
    expect(keys('Cinnamon and nutmeg')).toEqual({ nutmeg: 0.5, cinnamon: 1 });
    expect(keys('3 coffee beans')).toEqual({ 'coffee bean': 1 });
    expect(garnishAromaLines('1 brandied cherry')).toEqual([]);
    expect(garnishAromaLines('')).toEqual([]);
    expect(garnishAromaLines(undefined)).toEqual([]);
  });
  it('every key a garnish line produces has a line in the aroma table', () => {
    for (const t of ['lemon twist', 'lime wedge', 'orange peel', 'grapefruit twist', 'mint', 'rosemary', 'basil', 'thyme', 'sage', 'nutmeg', 'cinnamon', 'coffee beans']) {
      for (const l of garnishAromaLines(t)) expect(aromaFor(l.key), `${t} -> ${l.key}`).toBeTruthy();
    }
  });
});
