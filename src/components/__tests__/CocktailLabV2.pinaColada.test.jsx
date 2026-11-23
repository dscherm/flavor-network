// @vitest-environment jsdom
// LOOK-2: the Pina Colada card reads "3 tbsp coconut milk" (amount, then name) in What do I need? and in Ingredients.
// The codex line "3 tblsp Coconut milk" used to be read as amount "3" + name "tblsp Coconut milk".
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { useState } from 'react';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const ingredients = read('public/proDataset/ingredients.json');

vi.mock('../NetworkScene.jsx', () => ({ default: () => null }));
vi.mock('../ClusterJoystick.jsx', () => ({ default: () => null }));
vi.mock('../ShapeLegend.jsx', () => ({ default: () => null }));
vi.mock('../../three/AxisLabels.js', () => ({ createClusterLabels: () => ({ add: () => {} }), createGlowSprite: () => ({}) }));
vi.mock('../../data/cocktailCodexV2.js', () => ({
  loadCodexV2: (raw) => raw,
  curateCodexRaw: (raw) => raw,
  placeCocktailInFamily: () => ({ x: 0, y: 0, z: 0 }),
  topSimilar: () => [],
  crossFamilySimilar: () => [],
  cocktailSimilarity: () => 0,
}));
vi.mock('../../data/ingredientRoles.js', async (orig) => ({
  ...(await orig()),
  getCocktailRoles: vi.fn(async () => JSON.parse((await import('node:fs')).default.readFileSync(`${process.cwd()}/public/data/cocktail_roles.json`, 'utf8')).byIngredient),
}));
vi.mock('../InventCocktail.jsx', () => ({ default: () => null }));

import CocktailLabV2 from '../CocktailLabV2.jsx';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';
import { commitList, emptyShopping } from '../../data/shoppingStore.js';

const codex = readCuratedCodex();
const keep = new Set(['Pina Colada']);
const picked = codex.cocktails.filter((c) => keep.has(c.name));
const GRAPH = {
  ...codex,
  cocktails: picked,
  byFamily: new Map(codex.families.map((f) => [f.id, picked.filter((c) => c.family_id === f.id)])),
  byCanonical: new Map(picked.map((c) => [c.canonical, c])),
};
const fullData = { graph: { nodes: new Map(Object.entries(ingredients)), edges: [] } };

function Lab() {
  const [state, setState] = useState(emptyShopping());
  const up = {
    profile: { cocktails: [], shopping: state },
    saveInvention: vi.fn(), deleteInvention: vi.fn(),
    updateShopping: (change, opts) => setState((s) => { const next = change(s.list); return next === s.list ? s : commitList(s, next, opts); }),
  };
  return <CocktailLabV2 fullData={fullData} userProfile={up} auth={{ user: null }} />;
}



beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => GRAPH });
});

const rowFor = (list, name) => [...within(list).getAllByRole('listitem')].find((li) => li.textContent.toLowerCase().includes(name));
const text = (li) => li.textContent.replace(/\s+/g, ' ').trim().toLowerCase();

describe('Pina Colada card (LOOK-2)', () => {
  it('shows coconut milk and pineapple with the amount in front of the name, in What do I need and in Ingredients', async () => {
    render(<Lab />);
    fireEvent.click((await screen.findAllByText('Pina Colada'))[0]);
    const card = await screen.findByTestId('lab-node-card');

    const missing = within(within(card).getByTestId('what-do-i-need')).getByTestId('what-do-i-need-missing');
    for (const [name, amount] of [['coconut milk', '3 tbsp'], ['pineapple', '3 tbsp']]) {
      const row = rowFor(missing, name);
      expect(text(row)).toMatch(new RegExp(`^${amount} ?${name}`));
      expect(text(row)).not.toMatch(/tblsp/);
    }

    const ingredients = within(card).getByTestId('lab-node-card-ingredients');
    for (const [name, amount] of [['coconut milk', '3 tbsp'], ['pineapple', '3 tbsp']]) {
      const row = rowFor(ingredients, name);
      expect(text(row)).toMatch(new RegExp(`${amount} ?${name}$`));
      expect(text(row)).not.toMatch(/tblsp/);
    }
  });
});
