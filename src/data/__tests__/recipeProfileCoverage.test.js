// PROFILE-1: every built-in recipe has a flavor profile on its card, from the one shared function.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveBuiltIn, normaliseBuiltIn, fromOwnItem, slugFor, uniqueBySlug } from '../sharedRecipe.js';
import { profileForRecipe } from '../shareCardData.js';
import { groupBars } from '../flavorDisplay.js';
import { NO_CHART_LINE } from '../recipeProfileAnalysis.js';
import { SEED_RECIPES } from '../seedRecipes.js';
import { RECIPE_DETAILS } from '../seedRecipeDetails.js';
import { loadFlavorNodes } from '../../../scripts/lib/flavorNodes.mjs';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';

const nodes = loadFlavorNodes();
const codex = readCuratedCodex();
const sauces = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/sauce_augment.json'), 'utf8')).sauces || [];
const data = { cocktails: codex.cocktails, families: codex.families, sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
const shareCards = JSON.parse(readFileSync(resolve(process.cwd(), 'functions/src/share/share-cards.json'), 'utf8'));

const LISTS = { cocktail: uniqueBySlug('cocktail', data.cocktails), sauce: uniqueBySlug('sauce', data.sauces), dish: uniqueBySlug('dish', data.dishes) };

// What a card puts on screen for a recipe: the plain line, or the bars.
function cardView(recipe) {
  const p = profileForRecipe(recipe, nodes);
  if (!p.drawn) return { line: NO_CHART_LINE, bars: [] };
  return { line: null, bars: groupBars(p.bars, 'compact').bars };
}

describe('PROFILE-1 coverage: every built-in recipe', () => {
  const report = {};
  for (const [kind, list] of Object.entries(LISTS)) {
    it(`${kind}: each recipe yields a profile or the plain line, identical to the shared page's`, () => {
      const noChart = [];
      let charted = 0;
      for (const item of list) {
        const slug = slugFor(kind, item);
        const page = resolveBuiltIn(kind, slug, data);
        const card = normaliseBuiltIn(kind, item, data);
        expect(card, `${kind}/${slug}`).toBeTruthy();
        // The card's recipe is the shared page's recipe, so the profile is too.
        expect(card).toEqual(page);
        expect(profileForRecipe(card, nodes)).toEqual(profileForRecipe(page, nodes));
        const v = cardView(card);
        if (v.line) {
          expect(v.bars).toEqual([]);
          const p = profileForRecipe(card, nodes);
          noChart.push(`${slug}: ${card.lines.length === 0 ? 'no lines' : `${p.counted.length} of ${p.counted.length + p.uncounted.length} ingredients with data`}`);
        } else {
          charted += 1;
          expect(v.bars.length).toBeGreaterThan(0);
        }
      }
      report[kind] = { total: list.length, charted, noChart };
      expect(charted + noChart.length).toBe(list.length);
    });
  }

  it('prints the counts by kind', () => {
    const lines = Object.entries(report).map(([k, r]) => `${k}: ${r.total} recipes, ${r.charted} chart, ${r.noChart.length} plain line${r.noChart.length ? ` (${r.noChart.join('; ')})` : ''}`);
    process.stderr.write(`PROFILE-1 coverage\n${lines.join('\n')}`);
    expect(Object.keys(report)).toHaveLength(3);
  });
});

describe('PROFILE-1: the card, the shared page and the server share card lead the same', () => {
  const lead = (bars) => {
    const taste = bars.filter((b) => ['sweet', 'sour', 'bitter', 'salty', 'umami', 'heat'].includes(String(b.label).toLowerCase())).slice(0, 2).map((b) => b.label);
    const aroma = bars.filter((b) => !['sweet', 'sour', 'bitter', 'salty', 'umami', 'heat'].includes(String(b.label).toLowerCase())).slice(0, 2).map((b) => b.label);
    return { taste, aroma };
  };
  for (const [kind, slug] of [['cocktail', 'negroni'], ['sauce', 'hollandaise'], ['dish', 'beef-bolognese']]) {
    it(`${kind}/${slug}`, () => {
      const item = LISTS[kind].find((it) => slugFor(kind, it) === slug);
      expect(item).toBeTruthy();
      const cardBars = cardView(normaliseBuiltIn(kind, item, data)).bars;
      const pageBars = groupBars(profileForRecipe(resolveBuiltIn(kind, slug, data), nodes).bars, 'compact').bars;
      const server = shareCards[`${kind}/${slug}`];
      expect(server, 'server share card entry').toBeTruthy();
      const serverBars = groupBars(server.bars, 'compact').bars;
      expect(lead(cardBars).taste.length).toBeGreaterThan(0);
      expect(lead(cardBars)).toEqual(lead(pageBars));
      expect(lead(cardBars)).toEqual(lead(serverBars));
    });
  }
});

describe('PROFILE-1: the cook\'s own items', () => {
  const cocktail = { id: 'c1', kind: 'cocktail', name: 'Mine', lines: [{ key: 'gin', amount: '2 oz' }, { key: 'lime juice', amount: '1 oz' }, { key: 'simple syrup', amount: '0.75 oz' }] };
  const sauce = { id: 's1', kind: 'sauce', name: 'Mine', lines: [{ key: 'butter', amount: '2 tbsp' }, { key: 'lemon juice', amount: '1 tbsp' }, { key: 'salt', amount: '1 tsp' }] };
  const dish = { id: 'd1', kind: 'recipe', name: 'Mine', lines: [{ key: 'tomato', amount: '400 g' }, { key: 'basil', amount: '1 bunch' }, { key: 'garlic', amount: '2 cloves' }] };
  for (const [kind, item] of [['cocktail', cocktail], ['sauce', sauce], ['recipe', dish]]) {
    it(`${kind}: a profile from its own lines and amounts`, () => {
      const r = fromOwnItem(kind, item);
      expect(r.lines).toEqual(item.lines);
      const p = profileForRecipe(r, nodes);
      expect(p.drawn).toBe(true);
      expect(p.bars.length).toBeGreaterThan(0);
      const heavy = profileForRecipe(fromOwnItem(kind, { ...item, lines: item.lines.map((l, i) => (i === 0 ? { ...l, amount: '1 tsp' } : l)) }), nodes);
      expect(heavy.scores).not.toEqual(p.scores);
    });
  }
  it('has no item without name or lines', () => {
    expect(fromOwnItem('cocktail', { name: 'x', lines: [] })).toBeNull();
    expect(fromOwnItem('cocktail', null)).toBeNull();
  });
});
