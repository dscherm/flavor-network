// @vitest-environment jsdom
// LOOK-7 contract tests (blind): the Cocktail menu. Written from plan.md (LOOK-7 AC-1, AC-3, AC-7) and the
// approved brief .schermness/design/LOOK-7.md (sections 3.3, 9, decision D2). Render setups reused from
// src/components/__tests__/CocktailLabV2.shopping.test.jsx (the whole lab, so "Invent a cocktail" is wired the
// way the app wires it) and src/components/__tests__/labIngredientSearch.test.jsx (CocktailBrowse alone).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { hasBorder, hasBoxShadow, minHeightPx, expectOnePrimary, expectNoOtherAccentFill } from './helpers.js';

const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const ingredients = read('public/proDataset/ingredients.json');

vi.mock('../../../src/components/NetworkScene.jsx', () => ({ default: () => null }));
vi.mock('../../../src/components/ClusterJoystick.jsx', () => ({ default: () => null }));
vi.mock('../../../src/components/ShapeLegend.jsx', () => ({ default: () => null }));
vi.mock('../../../src/three/AxisLabels.js', () => ({ createClusterLabels: () => ({ add: () => {} }), createGlowSprite: () => ({}) }));
vi.mock('../../../src/data/cocktailCodexV2.js', () => ({
  loadCodexV2: (raw) => raw,
  curateCodexRaw: (raw) => raw,
  placeCocktailInFamily: () => ({ x: 0, y: 0, z: 0 }),
  topSimilar: () => [],
  crossFamilySimilar: () => [],
  cocktailSimilarity: () => 0,
}));
vi.mock('../../../src/data/ingredientRoles.js', async (orig) => ({
  ...(await orig()),
  getCocktailRoles: vi.fn(async () => JSON.parse((await import('node:fs')).default.readFileSync(`${process.cwd()}/public/data/cocktail_roles.json`, 'utf8')).byIngredient),
}));
vi.mock('../../../src/components/InventCocktail.jsx', () => ({ default: () => null }));

import CocktailLabV2 from '../../../src/components/CocktailLabV2.jsx';
import CocktailBrowse from '../../../src/components/CocktailBrowse.jsx';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';
import { emptyShopping } from '../../../src/data/shoppingStore.js';

const codex = readCuratedCodex();
const keep = new Set(['Negroni', 'Daiquiri', 'Gimlet', 'Old-Fashioned']);
const picked = codex.cocktails.filter((c) => keep.has(c.name));
const GRAPH = {
  ...codex,
  cocktails: picked,
  byFamily: new Map(codex.families.map((f) => [f.id, picked.filter((c) => c.family_id === f.id)])),
  byCanonical: new Map(picked.map((c) => [c.canonical, c])),
};
const fullData = { graph: { nodes: new Map(Object.entries(ingredients)), edges: [] } };
const up = { profile: { cocktails: [], shopping: emptyShopping() }, saveInvention: vi.fn(), deleteInvention: vi.fn(), updateShopping: vi.fn() };

// Same fixture as labIngredientSearch.test.jsx, with a second family so sub-groups and families both show.
function cocktail(name, ings, extra = {}) {
  return { name, canonical: name.toLowerCase(), family_id: 0, subcluster_id: '0.1', ingredients_raw: ings.map((raw) => ({ raw })), ...extra };
}
const COCKTAILS = [
  cocktail('Gimlet', ['Gin', 'Lime juice', 'Simple syrup'], { is_root: true, build_method: 'shake', ice_format: 'up', iba_official: true }),
  cocktail('Negroni', ['Gin', 'Campari', 'Sweet vermouth'], { build_method: 'stir', ice_format: 'rocks', subcluster_id: '0.2' }),
  cocktail('Moscow Mule', ['Vodka', 'Ginger beer', 'Lime juice'], { build_method: 'build', ice_format: 'tall' }),
];
const COCKTAIL_GRAPH = { families: [{ id: 0, name: 'Sours', color: '#88ccff' }], byFamily: new Map([[0, COCKTAILS]]) };

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => GRAPH });
});
afterEach(cleanup);

describe('LOOK-7 cocktail menu', () => {
  // Covers: AC-1
  it('the cocktail menu has exactly one primary: a button filled with the accent (Invent a cocktail)', async () => {
    const { container } = render(<CocktailLabV2 fullData={fullData} userProfile={up} auth={{ user: null }} onOpenShopping={vi.fn()} />);
    await screen.findAllByTestId('cocktail-row');
    const p = expectOnePrimary(expect, container, 'cocktail menu');
    // Brief D2: the menu's one filled button is "Invent a cocktail".
    expect(p.textContent).toMatch(/Invent a cocktail/i);
  });

  // Covers: AC-3
  it('nothing on the cocktail menu other than the primary has the accent as its background', async () => {
    const { container } = render(<CocktailLabV2 fullData={fullData} userProfile={up} auth={{ user: null }} onOpenShopping={vi.fn()} />);
    await screen.findAllByTestId('cocktail-row');
    expectNoOtherAccentFill(expect, container, 'cocktail menu');
  });

  // Covers: AC-7
  it('every cocktail-row has no border, no box-shadow and a min height of at least 44 px (CocktailBrowse)', () => {
    render(
      <CocktailBrowse graph={COCKTAIL_GRAPH} selectedCocktail={null} onSelectCocktail={vi.fn()}
        filterFamily={null} onFilterFamily={vi.fn()} filterSpirit={null} onFilterSpirit={vi.fn()} />,
    );
    const rows = screen.getAllByTestId('cocktail-row');
    expect(rows.length).toBe(COCKTAILS.length);
    for (const row of rows) {
      const tag = `row "${row.textContent}" (style="${row.getAttribute('style')}", class="${row.getAttribute('class')}")`;
      expect(hasBorder(row), `${tag} has a border`).toBe(false);
      expect(hasBoxShadow(row), `${tag} has a box-shadow`).toBe(false);
      const h = minHeightPx(row);
      expect(h, `${tag} sets no min height`).not.toBeNull();
      expect(h, `${tag} min height`).toBeGreaterThanOrEqual(44);
    }
  });

  // Covers: AC-7
  it('the selected row is still a plain row: no border, no box-shadow, at least 44 px', () => {
    render(
      <CocktailBrowse graph={COCKTAIL_GRAPH} selectedCocktail={COCKTAILS[1]} onSelectCocktail={vi.fn()}
        filterFamily={null} onFilterFamily={vi.fn()} filterSpirit={null} onFilterSpirit={vi.fn()} />,
    );
    for (const row of screen.getAllByTestId('cocktail-row')) {
      expect(hasBorder(row), `row "${row.textContent}" has a border`).toBe(false);
      expect(hasBoxShadow(row), `row "${row.textContent}" has a box-shadow`).toBe(false);
      expect(minHeightPx(row) ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  // Covers: AC-7
  it('the rows of the real Cocktail Lab menu meet the same rule', async () => {
    render(<CocktailLabV2 fullData={fullData} userProfile={up} auth={{ user: null }} onOpenShopping={vi.fn()} />);
    const rows = await screen.findAllByTestId('cocktail-row');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(hasBorder(row), `row "${row.textContent}" has a border`).toBe(false);
      expect(hasBoxShadow(row), `row "${row.textContent}" has a box-shadow`).toBe(false);
      expect(minHeightPx(row) ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});
