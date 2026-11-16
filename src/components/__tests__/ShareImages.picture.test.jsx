// @vitest-environment jsdom
// PICTURE-4: the picture reaches the card renderer, and the canvas renderer draws (or skips) an image primitive.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
vi.mock('../../data/shareTargets.js', async (orig) => ({ ...(await orig()), SHARE_CHARTS_ENABLED: true }));
import ShareImages from '../ShareImages.jsx';
import { drawCard, loadCardImages } from '../../data/shareCardCanvas.js';
import { layoutCard } from '../../data/shareCardLayout.js';
import { resolveBuiltIn } from '../../data/sharedRecipe.js';
import { SEED_RECIPES } from '../../data/seedRecipes.js';
import { RECIPE_DETAILS } from '../../data/seedRecipeDetails.js';

const recipe = resolveBuiltIn('dish', 'beef-bolognese', { dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS });
const NODES = new Map(recipe.lines.map((l, i) => [l.label || l.key, { taste: i % 2 ? 'umami salty' : 'sweet sour' }]));
const pic = { src: 'data:image/jpeg;base64,/9j/AAAA', w: 600, h: 600, kind: 'chalk' };
afterEach(() => cleanup());

const mount = (extra = {}) => {
  const renderFiles = vi.fn(async () => [new File([new Uint8Array([1])], 'c.png', { type: 'image/png' })]);
  render(<ShareImages link="/r/dish/beef-bolognese" recipe={recipe} nodes={NODES} origin="https://neuralflavor.web.app" renderFiles={renderFiles} {...extra} />);
  return renderFiles;
};

describe('ShareImages and the picture', () => {
  it('hands the picture to the renderer on the recipe, and nothing extra without one', async () => {
    const withPic = mount({ picture: pic });
    await waitFor(() => expect(withPic).toHaveBeenCalled());
    expect(withPic.mock.calls[0][0].recipe.picture).toEqual(pic);
    expect(withPic.mock.calls[0][0].recipe.name).toBe(recipe.name);
    cleanup();
    const without = mount();
    await waitFor(() => expect(without).toHaveBeenCalled());
    expect('picture' in without.mock.calls[0][0].recipe).toBe(false);
  });

  it('draws again when the picture arrives after the first draw', async () => {
    const renderFiles = vi.fn(async () => [new File([new Uint8Array([1])], 'c.png', { type: 'image/png' })]);
    const ui = (picture) => <ShareImages link="/r/dish/beef-bolognese" recipe={recipe} nodes={NODES} origin="https://neuralflavor.web.app" renderFiles={renderFiles} picture={picture} />;
    const { rerender } = render(ui(null));
    await waitFor(() => expect(renderFiles).toHaveBeenCalledTimes(1));
    rerender(ui(pic));
    await waitFor(() => expect(renderFiles).toHaveBeenCalledTimes(2));
    expect(renderFiles.mock.calls[1][0].recipe.picture).toEqual(pic);
  });
});

describe('canvas renderer: image primitives', () => {
  const card = layoutCard({ format: 'portrait', recipe: { kind: 'cocktail', name: 'X', lines: [{ label: 'gin', amount: '1' }], method: '', picture: pic }, bars: [], link: 'x/r/a' });
  const ctxStub = () => {
    const calls = [];
    return new Proxy({ calls }, {
      get: (t, k) => (k === 'calls' ? calls : (k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : (...a) => { calls.push([k, a]); })),
      set: () => true,
    });
  };

  it('draws a loaded image inside its box, clipped to the frame, and skips one that did not load', () => {
    const ip = card.primitives.find((p) => p.type === 'image');
    const img = { naturalWidth: 600, naturalHeight: 600 };
    const ctx = ctxStub();
    drawCard(ctx, card, new Map([[ip.src, img]]));
    const draw = ctx.calls.filter(([k]) => k === 'drawImage');
    expect(draw).toHaveLength(1);
    expect(draw[0][1][0]).toBe(img);
    const [, x, y, w, h] = draw[0][1];
    expect(x).toBeCloseTo(ip.x, 5); expect(y).toBeCloseTo(ip.y, 5); expect(w).toBeCloseTo(ip.w, 5); expect(h).toBeCloseTo(ip.h, 5);
    expect(ctx.calls.some(([k]) => k === 'clip')).toBe(true);
    const none = ctxStub();
    drawCard(none, card, new Map());
    expect(none.calls.filter(([k]) => k === 'drawImage')).toHaveLength(0);
  });

  it('loadCardImages loads each address once and tolerates one that fails', async () => {
    const made = [];
    vi.stubGlobal('Image', class { constructor() { made.push(this); setTimeout(() => (this.src.includes('bad') ? this.onerror() : this.onload()), 0); } });
    const two = { primitives: [{ type: 'image', src: 'data:a' }, { type: 'image', src: 'data:a' }, { type: 'image', src: 'data:bad' }, { type: 'text' }] };
    const map = await loadCardImages(two);
    expect(made).toHaveLength(2);
    expect([...map.keys()]).toEqual(['data:a']);
    vi.unstubAllGlobals();
  });
});
