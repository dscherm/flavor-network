// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import IngredientSuggestionsPopout from '../IngredientSuggestionsPopout.jsx';
import { bowlFromIngredients } from '../../data/bowlEntry.js';
import * as engine from '../../data/recipeSuggestionEngine.js';

vi.mock('../../data/tastePositioning.js', () => ({
  scoreIngredient: () => ({ channels: {} }),
}));
vi.mock('../../utils/color.js', () => ({
  TASTE_COLORS: { default: '#888888' },
}));
vi.mock('../../data/recipeScoring.js', () => ({
  AROMA_COLORS: {},
}));
vi.mock('../../data/ingredientRoles.js', () => ({
  roleOf: () => 'other',
  rolesCompatible: () => true,
}));
vi.mock('../../data/graph.js', () => ({
  getNeighborsEnriched: () => [],
}));

function buildCtx() {
  const recipePairs = {
    tomato: { basil: 1000, garlic: 800, oregano: 600, onion: 700 },
    basil:  { tomato: 1000, garlic: 500, oregano: 700, onion: 300 },
    garlic: { tomato: 800, basil: 500, oregano: 400, onion: 900 },
    oregano: { tomato: 600, basil: 700, garlic: 400, onion: 200 },
    onion:  { tomato: 700, basil: 300, garlic: 900, oregano: 200 },
  };
  const globalCount = {
    tomato: 5000, basil: 3000, garlic: 4500, oregano: 1200, onion: 8000,
  };
  return { recipePairs, globalCount };
}

const NODES = new Map([
  ['tomato', {}], ['basil',  {}], ['garlic', {}], ['oregano', {}], ['onion', {}],
]);

function mount(overrides = {}) {
  return render(
    <IngredientSuggestionsPopout
      ingredient={null}
      recipeIngredients={['tomato', 'basil']}
      bowl={bowlFromIngredients(['tomato', 'basil'])}
      focalKey={null}
      nodes={NODES}
      edges={[]}
      scopeFilter={null}
      labMode="taste"
      onAdd={() => {}}
      onClose={() => {}}
      {...overrides}
    />,
  );
}

describe('IngredientSuggestionsPopout — RL-FOCAL-WIRE add-mode focal-weighted ranking', () => {
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe() {} unobserve() {} disconnect() {}
      };
    }
    vi.restoreAllMocks();
  });

  it('engages rankSuggestions when bowl + recipePairs + globalCount all present', () => {
    const spy = vi.spyOn(engine, 'rankSuggestions');
    const ctx = buildCtx();
    mount({ ...ctx });
    expect(spy).toHaveBeenCalled();
    const callArgs = spy.mock.calls[0];
    expect(callArgs[1]).toBe(null); // focalKey
    expect(callArgs[3]).toMatchObject({
      recipePairs: ctx.recipePairs,
      globalCount: ctx.globalCount,
    });
  });

  it('passes focalKey through to rankSuggestions when set', () => {
    const spy = vi.spyOn(engine, 'rankSuggestions');
    const ctx = buildCtx();
    mount({ ...ctx, focalKey: 'tomato' });
    expect(spy).toHaveBeenCalled();
    const callArgs = spy.mock.calls[0];
    expect(callArgs[1]).toBe('tomato');
  });

  it('falls back to legacy aggregator when recipePairs is missing (no rankSuggestions call)', () => {
    const spy = vi.spyOn(engine, 'rankSuggestions');
    mount({ recipePairs: null, globalCount: { tomato: 5000 } });
    expect(spy).not.toHaveBeenCalled();
  });

  it('falls back to legacy aggregator when globalCount is missing', () => {
    const spy = vi.spyOn(engine, 'rankSuggestions');
    const ctx = buildCtx();
    mount({ ...ctx, globalCount: null });
    expect(spy).not.toHaveBeenCalled();
  });

  it('falls back to legacy aggregator when bowl prop is missing', () => {
    const spy = vi.spyOn(engine, 'rankSuggestions');
    const ctx = buildCtx();
    mount({ ...ctx, bowl: null });
    expect(spy).not.toHaveBeenCalled();
  });

  it('replace-mode (ingredient set) does NOT use rankSuggestions (focal wiring is add-mode-only)', () => {
    const spy = vi.spyOn(engine, 'rankSuggestions');
    const ctx = buildCtx();
    mount({ ...ctx, ingredient: 'tomato', recipeIngredients: ['basil'] });
    expect(spy).not.toHaveBeenCalled();
  });

  it('engaged ranking surfaces a non-bowl candidate (garlic) in the rendered DOM', () => {
    const ctx = buildCtx();
    const { container } = mount({ ...ctx });
    expect(container.textContent).toMatch(/garlic/i);
    expect(container.textContent).toMatch(/onion/i);
  });
});
