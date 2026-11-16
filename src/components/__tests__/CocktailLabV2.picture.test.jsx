// @vitest-environment jsdom
// PICTURE-4: a saved cocktail with a picture shows it on its "Yours" row and on its card (a drawing at once, a chalk picture read lazily).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const codex = readCuratedCodex();
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
  getCocktailRoles: vi.fn(async () => (await import('node:fs')).default
    ? JSON.parse((await import('node:fs')).default.readFileSync(`${process.cwd()}/public/data/cocktail_roles.json`, 'utf8')).byIngredient
    : {}),
}));
const panelProps = { current: null };
vi.mock('../InventCocktail.jsx', () => ({
  default: (props) => {
    panelProps.current = props;
    return (
      <div data-testid="mock-invent">
        <span data-testid="mock-edit">{props.editItem ? JSON.stringify(props.editItem) : ''}</span>
        <span data-testid="mock-result" />
        <button type="button" data-testid="mock-save" onClick={async () => {
          const r = await props.onSave({ kind: 'cocktail', ...(props.editItem ? { id: props.editItem.id } : {}), name: 'Panel Drink', category: 3, lines: [{ key: 'gin', amount: '2 oz', role: null }, { key: 'sweet vermouth', amount: '1 oz', role: null }] });
          document.querySelector('[data-testid="mock-result"]').textContent = JSON.stringify(r);
        }}>save</button>
        <button type="button" data-testid="mock-close" onClick={props.onClose}>close</button>
      </div>
    );
  },
}));

import CocktailLabV2 from '../CocktailLabV2.jsx';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';

const keep = new Set(['Negroni', 'Gimlet', 'Old-Fashioned', 'Daiquiri']);
const picked = codex.cocktails.filter((c) => keep.has(c.name));
const GRAPH = {
  ...codex,
  cocktails: picked,
  byFamily: new Map(codex.families.map((f) => [f.id, picked.filter((c) => c.family_id === f.id)])),
  byCanonical: new Map(picked.map((c) => [c.canonical, c])),
};
const fullData = { graph: { nodes: new Map(Object.entries(ingredients)), edges: [] } };
const L = (...pairs) => pairs.map(([key, amount]) => ({ key, amount, role: null }));
const item = (over = {}) => ({
  id: 'inv-1', kind: 'cocktail', name: 'Gin Vermouth Thing', createdAt: 1, category: 3, source: 'invent',
  lines: L(['gin', '2 oz'], ['sweet vermouth', '1 oz']), method: 'Stir with ice.', ...over,
});
const withSaved = (items) => ({ profile: { cocktails: items }, saveInvention: vi.fn(() => ({ ok: true, item: {} })), deleteInvention: vi.fn(() => true) });
const SIGNED_IN = { user: { uid: 'u1' }, loginWithGoogle: vi.fn(), loginWithApple: vi.fn(), authError: null };
const SIGNED_OUT = { user: null, loginWithGoogle: vi.fn(), loginWithApple: vi.fn(), authError: null };

beforeEach(() => {
  localStorage.clear();
  panelProps.current = null;
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => GRAPH });
});

import { ShareOwnContext } from '../shareOwnContext.js';
import { clearPictureCache } from '../PictureView.jsx';

const ctx = { userProfile: {}, auth: SIGNED_IN };
const renderLab = (items) => render(
  <ShareOwnContext.Provider value={ctx}>
    <CocktailLabV2 fullData={fullData} userProfile={withSaved(items)} auth={SIGNED_IN} />
  </ShareOwnContext.Provider>,
);
beforeEach(() => { clearPictureCache(); });

describe('CocktailLabV2 — pictures on the cook’s own cocktails', () => {
  it('a drawing shows on the Yours row and on the opened card, without any read', async () => {
    renderLab([item({ picture: { kind: 'icon', icon: 'glass:flute', v: 1 } })]);
    const group = await screen.findByTestId('cocktail-yours-group');
    const row = within(group).getByTestId('yours-row-picture');
    expect(row.querySelector('[data-picture="glass:flute"]')).toBeTruthy();
    fireEvent.click(within(group).getByText('Gin Vermouth Thing'));
    const card = await screen.findByTestId('lab-node-card');
    expect(within(card).getByTestId('yours-card-picture').querySelector('[data-picture="glass:flute"]')).toBeTruthy();
  });

  it('an unknown drawing id draws the neutral fallback instead of breaking the list', async () => {
    renderLab([item({ picture: { kind: 'icon', icon: 'glass:retired', v: 1 } })]);
    const group = await screen.findByTestId('cocktail-yours-group');
    expect(within(group).getByTestId('yours-row-picture').querySelector('[data-picture="fallback"]')).toBeTruthy();
  });

  it('a chalk picture is not read by the list up front; it is read when its row mounts, and shown', async () => {
    const reads = [];
    vi.doMock('../../data/pictureStore.js', async (orig) => ({
      ...(await orig()),
      loadPicture: vi.fn(async (_db, uid, id) => { reads.push([uid, id]); return { dataUrl: 'data:image/jpeg;base64,AAAA', w: 600, h: 600 }; }),
    }));
    vi.doMock('../../firebase.js', () => ({ db: {}, auth: {} }));
    vi.resetModules();
    const { default: Lab } = await import('../CocktailLabV2.jsx');
    const { ShareOwnContext: Ctx } = await import('../shareOwnContext.js');
    const { clearPictureCache: clear } = await import('../PictureView.jsx');
    clear();
    expect(reads).toHaveLength(0);
    render(
      <Ctx.Provider value={ctx}>
        <Lab fullData={fullData} userProfile={withSaved([item({ picture: { kind: 'chalk', v: 7 } }), item({ id: 'inv-2', name: 'Plain One' })])} auth={SIGNED_IN} />
      </Ctx.Provider>,
    );
    const group = await screen.findByTestId('cocktail-yours-group');
    await waitFor(() => expect(within(group).getByTestId('yours-row-picture').getAttribute('data-picture-kind')).toBe('chalk'));
    expect(within(group).getByTestId('yours-row-picture').querySelector('img').getAttribute('src')).toBe('data:image/jpeg;base64,AAAA');
    // One read for the one chalk picture; the item without a picture caused none.
    expect(reads).toEqual([['u1', 'inv-1']]);
    vi.doUnmock('../../data/pictureStore.js');
    vi.doUnmock('../../firebase.js');
  });

  it('an item with no picture looks as it did: no picture element on its row', async () => {
    renderLab([item()]);
    const group = await screen.findByTestId('cocktail-yours-group');
    expect(within(group).queryByTestId('yours-row-picture')).toBeNull();
  });
});
